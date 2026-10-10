// ---- admin: จัดการข้อมูลพนักงาน (เพิ่ม/แก้ไข/ปิดใช้งาน/เปิดใช้งาน/ยกเลิกผูก LINE/ลบ) ----
// ทุก endpoint ถูกบันทึกลง audit_log ผ่าน RULES ใน audit.js
// - employee_id แก้ไม่ได้ (เป็น key ที่ตารางอื่นอ้างถึงทั้งหมด)
// - เลขบัตรประชาชนเก็บเป็น bcrypt เท่านั้น ไม่ส่งกลับไปหน้าเว็บ
// - "ลาออก" = ปิดใช้งาน (เก็บประวัติไว้) ลบจริงได้เฉพาะคนที่ยังไม่มีข้อมูลใดๆ ผูกอยู่เลย

const bcrypt = require('bcryptjs');

const EMPLOYEE_ID_RE = /^[A-Za-z0-9_-]{1,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ตารางที่อ้างถึง employee ทั้งหมด (FK แบบ RESTRICT) — มีแถวในตารางไหนก็ลบจริงไม่ได้
const RELATED_TABLES = [
  ['health_assessment', 'แบบสอบถามสุขภาพ'],
  ['running_submission', 'กิจกรรมที่ส่ง'],
  ['score_transaction', 'รายการคะแนน'],
  ['reward_redeem', 'การแลกของรางวัล'],
  ['employee_badge', 'เหรียญตรา'],
  ['challenge_participant', 'การเข้าร่วมชาเลนจ์'],
  ['employee_account', 'บัญชี LINE (รวมที่ยกเลิกแล้ว)'],
  ['admin_credential', 'สิทธิ์แอดมิน'],
];

// เลขบัตรประชาชนไทย: หลักที่ 13 เป็น check digit ของ 12 หลักแรก
function isValidThaiNationalId(id) {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

// ตรวจ/ทำความสะอาดฟิลด์ที่แก้ได้ — partial=true ใช้ตอนแก้ไข (ไม่ส่งเลขบัตรฯ มา = ไม่เปลี่ยน)
function parseEmployeeInput(body, { partial }) {
  const fullName = String(body.fullName || '').trim().replace(/\s+/g, ' ');
  const department = String(body.department || '').trim().replace(/\s+/g, ' ');
  const nationalId = String(body.nationalId || '').replace(/[\s-]/g, '');
  const dateOfBirth = body.dateOfBirth ? String(body.dateOfBirth) : '';

  if (!fullName) return { error: 'กรุณากรอกชื่อ-สกุล' };
  if (fullName.length > 150) return { error: 'ชื่อ-สกุลยาวเกิน 150 ตัวอักษร' };
  if (department.length > 100) return { error: 'ชื่อแผนกยาวเกิน 100 ตัวอักษร' };
  if (!partial && !nationalId) return { error: 'กรุณากรอกเลขบัตรประชาชน (ใช้ตอนพนักงานผูกบัญชี LINE)' };
  if (nationalId && !isValidThaiNationalId(nationalId)) return { error: 'เลขบัตรประชาชนไม่ถูกต้อง (ตรวจหลักสุดท้ายไม่ผ่าน)' };
  if (dateOfBirth) {
    if (!DATE_RE.test(dateOfBirth) || Number.isNaN(new Date(`${dateOfBirth}T00:00:00Z`).getTime())) {
      return { error: 'วันเกิดไม่ถูกต้อง' };
    }
    if (dateOfBirth > new Date().toISOString().slice(0, 10)) return { error: 'วันเกิดต้องไม่เป็นวันในอนาคต' };
  }

  return { fullName, department: department || null, nationalId: nationalId || null, dateOfBirth: dateOfBirth || null };
}

function registerEmployeeRoutes(app, pool, requireAdmin, audit) {
  // รายชื่อแผนกที่มีอยู่แล้ว ใช้เป็นตัวเลือกในฟอร์ม (กันพิมพ์ผิดแบบ "พนักงานบริกา")
  app.get('/api/admin/employees/departments', requireAdmin, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT department, COUNT(*) AS employee_count FROM employee
         WHERE department IS NOT NULL AND department <> ''
         GROUP BY department ORDER BY department`
      );
      res.json(rows);
    } catch (err) {
      console.error('list departments error:', err);
      res.status(500).json({ message: 'โหลดรายชื่อแผนกไม่สำเร็จ' });
    }
  });

  // ข้อมูลพนักงานสำหรับหน้าแก้ไข + สถานะ LINE + จำนวนข้อมูลที่ผูกอยู่ (บอกว่าลบจริงได้ไหม)
  app.get('/api/admin/employees/:employeeId', requireAdmin, async (req, res) => {
    const { employeeId } = req.params;
    try {
      const [empRows] = await pool.query(
        `SELECT employee_id, full_name, department, job_position, years_of_service, shift_type,
           DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth, employment_status, role,
           national_id_hash IS NOT NULL AS has_national_id, synced_at
         FROM employee WHERE employee_id = ?`,
        [employeeId]
      );
      if (empRows.length === 0) return res.status(404).json({ message: 'ไม่พบพนักงานคนนี้' });

      const [accounts] = await pool.query(
        `SELECT account_id, display_name, status, linked_at, last_login
         FROM employee_account WHERE employee_id = ? AND provider = 'LINE'
         ORDER BY linked_at DESC`,
        [employeeId]
      );

      const related = [];
      for (const [table, label] of RELATED_TABLES) {
        const [[row]] = await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE employee_id = ?`, [employeeId]);
        if (row.n > 0) related.push({ table, label, count: row.n });
      }

      res.json({
        employee: { ...empRows[0], has_national_id: Boolean(empRows[0].has_national_id) },
        lineAccounts: accounts,
        related,
        canDelete: related.length === 0,
      });
    } catch (err) {
      console.error('get employee error:', err);
      res.status(500).json({ message: 'โหลดข้อมูลพนักงานไม่สำเร็จ' });
    }
  });

  app.post('/api/admin/employees', requireAdmin, async (req, res) => {
    const employeeId = String(req.body.employeeId || '').trim().toUpperCase();
    if (!EMPLOYEE_ID_RE.test(employeeId)) {
      return res.status(400).json({ message: 'รหัสพนักงานต้องเป็นตัวอักษรอังกฤษ/ตัวเลข ไม่เกิน 20 ตัว เช่น EMP0175' });
    }
    const input = parseEmployeeInput(req.body, { partial: false });
    if (input.error) return res.status(400).json({ message: input.error });

    try {
      const nationalIdHash = await bcrypt.hash(input.nationalId, 10);
      await pool.query(
        `INSERT INTO employee
          (employee_id, full_name, department, date_of_birth, employment_status, role, national_id_hash)
         VALUES (?, ?, ?, ?, 'ACTIVE', 'EMPLOYEE', ?)`,
        [employeeId, input.fullName, input.department, input.dateOfBirth, nationalIdHash]
      );
      res.locals.audit = { detail: { fullName: input.fullName, department: input.department, dateOfBirth: input.dateOfBirth } };
      res.status(201).json({ employeeId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: `มีรหัสพนักงาน ${employeeId} อยู่ในระบบแล้ว` });
      }
      console.error('create employee error:', err);
      res.status(500).json({ message: 'เพิ่มพนักงานไม่สำเร็จ' });
    }
  });

  app.put('/api/admin/employees/:employeeId', requireAdmin, audit.captureBefore('employee', 'employee_id', 'employeeId'), async (req, res) => {
    const { employeeId } = req.params;
    const input = parseEmployeeInput(req.body, { partial: true });
    if (input.error) return res.status(400).json({ message: input.error });

    try {
      const sets = ['full_name = ?', 'department = ?', 'date_of_birth = ?'];
      const params = [input.fullName, input.department, input.dateOfBirth];
      if (input.nationalId) {
        sets.push('national_id_hash = ?');
        params.push(await bcrypt.hash(input.nationalId, 10));
      }
      const [result] = await pool.query(`UPDATE employee SET ${sets.join(', ')} WHERE employee_id = ?`, [...params, employeeId]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'ไม่พบพนักงานคนนี้' });
      res.json({ employeeId });
    } catch (err) {
      console.error('update employee error:', err);
      res.status(500).json({ message: 'บันทึกข้อมูลพนักงานไม่สำเร็จ' });
    }
  });

  // ลาออก/ปิดใช้งาน: เข้าแอปไม่ได้ทันที (requireAuth เช็คสถานะทุกคำขอ) + ยกเลิก LINE + ถอดสิทธิ์แอดมิน
  app.post('/api/admin/employees/:employeeId/deactivate', requireAdmin, async (req, res) => {
    const { employeeId } = req.params;
    if (employeeId === req.adminEmployeeId) {
      return res.status(400).json({ message: 'ไม่สามารถปิดใช้งานบัญชีของตัวเองได้' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `UPDATE employee SET employment_status = 'RESIGNED', role = 'EMPLOYEE'
         WHERE employee_id = ? AND employment_status = 'ACTIVE'`,
        [employeeId]
      );
      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ message: 'ไม่พบพนักงานที่ยังใช้งานอยู่รหัสนี้' });
      }
      const [lineResult] = await conn.query(
        `UPDATE employee_account SET status = 'REVOKED' WHERE employee_id = ? AND status = 'ACTIVE'`,
        [employeeId]
      );
      const [adminResult] = await conn.query('DELETE FROM admin_credential WHERE employee_id = ?', [employeeId]);
      await conn.commit();

      res.locals.audit = {
        detail: { lineAccountsRevoked: lineResult.affectedRows, adminRevoked: adminResult.affectedRows > 0 },
      };
      res.json({ employeeId, employmentStatus: 'RESIGNED' });
    } catch (err) {
      await conn.rollback();
      console.error('deactivate employee error:', err);
      res.status(500).json({ message: 'ปิดใช้งานไม่สำเร็จ' });
    } finally {
      conn.release();
    }
  });

  // กลับมาทำงาน: เปิดสถานะ ACTIVE — พนักงานต้องผูก LINE ใหม่ด้วยเลขบัตรประชาชน (บัญชีเดิมถูกยกเลิกไปแล้ว)
  app.post('/api/admin/employees/:employeeId/reactivate', requireAdmin, async (req, res) => {
    const { employeeId } = req.params;
    try {
      const [result] = await pool.query(
        `UPDATE employee SET employment_status = 'ACTIVE' WHERE employee_id = ? AND employment_status = 'RESIGNED'`,
        [employeeId]
      );
      if (result.affectedRows === 0) return res.status(404).json({ message: 'ไม่พบพนักงานที่ปิดใช้งานอยู่รหัสนี้' });
      res.json({ employeeId, employmentStatus: 'ACTIVE' });
    } catch (err) {
      console.error('reactivate employee error:', err);
      res.status(500).json({ message: 'เปิดใช้งานไม่สำเร็จ' });
    }
  });

  // ยกเลิกการผูก LINE (เช่น เปลี่ยนเครื่อง/ผูกผิดคน) — พนักงานผูกใหม่ได้ด้วยเลขบัตรประชาชน
  app.post('/api/admin/employees/:employeeId/unlink-line', requireAdmin, async (req, res) => {
    const { employeeId } = req.params;
    try {
      const [result] = await pool.query(
        `UPDATE employee_account SET status = 'REVOKED' WHERE employee_id = ? AND status = 'ACTIVE'`,
        [employeeId]
      );
      if (result.affectedRows === 0) return res.status(404).json({ message: 'พนักงานคนนี้ไม่ได้ผูกบัญชี LINE อยู่' });
      res.locals.audit = { detail: { lineAccountsRevoked: result.affectedRows } };
      res.json({ employeeId });
    } catch (err) {
      console.error('unlink line error:', err);
      res.status(500).json({ message: 'ยกเลิกการผูก LINE ไม่สำเร็จ' });
    }
  });

  // ลบจริง: เฉพาะคนที่เพิ่มผิด/ซ้ำ และยังไม่มีข้อมูลใดๆ ผูกอยู่ (ส่วนคนที่ลาออกให้ใช้ปิดใช้งาน)
  app.delete('/api/admin/employees/:employeeId', requireAdmin, async (req, res) => {
    const { employeeId } = req.params;
    if (employeeId === req.adminEmployeeId) {
      return res.status(400).json({ message: 'ไม่สามารถลบบัญชีของตัวเองได้' });
    }
    try {
      const [empRows] = await pool.query('SELECT full_name FROM employee WHERE employee_id = ?', [employeeId]);
      if (empRows.length === 0) return res.status(404).json({ message: 'ไม่พบพนักงานคนนี้' });

      const related = [];
      for (const [table, label] of RELATED_TABLES) {
        const [[row]] = await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE employee_id = ?`, [employeeId]);
        if (row.n > 0) related.push(label);
      }
      if (related.length > 0) {
        return res.status(409).json({ message: `ลบไม่ได้ เพราะมีข้อมูลผูกอยู่: ${related.join(', ')} — ให้ใช้ "ปิดใช้งาน" แทน` });
      }

      await pool.query('DELETE FROM employee WHERE employee_id = ?', [employeeId]);
      // ชื่อถูกลบไปจากตาราง employee แล้ว เก็บไว้ใน log เพื่อให้รู้ว่าลบใคร
      res.locals.audit = { detail: { fullName: empRows[0].full_name } };
      res.json({ employeeId });
    } catch (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(409).json({ message: 'ลบไม่ได้ เพราะมีข้อมูลผูกอยู่ ให้ใช้ "ปิดใช้งาน" แทน' });
      }
      console.error('delete employee error:', err);
      res.status(500).json({ message: 'ลบพนักงานไม่สำเร็จ' });
    }
  });
}

module.exports = { registerEmployeeRoutes, isValidThaiNationalId };
