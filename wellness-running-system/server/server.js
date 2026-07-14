require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// ---- file upload setup (proof photo เก็บ local disk ก่อน, ย้ายขึ้น cloud ทีหลังได้) ----
const UPLOAD_ROOT = path.join(__dirname, 'uploads', 'submissions');
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

// เสิร์ฟไฟล์รูปแบบ static เพื่อให้แอดมินเปิดดูรูปได้ระหว่าง dev
// ตอน deploy จริงควรใส่ auth คุมสิทธิ์การเข้าถึง route นี้ด้วย
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const submissionStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_ROOT),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `${req.employeeId}_${Date.now()}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadProof = multer({
  storage: submissionStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP เท่านั้น'));
    }
    cb(null, true);
  },
});

app.get('/api/health', async (req, res) => {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM employee');
  res.json({ status: 'ok', employeeCount: rows[0].total });
});

// ---- session helpers ----
function issueSessionCookie(res, employeeId) {
  const token = jwt.sign({ employeeId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('session', token, {
    httpOnly: true,
    secure: false, // dev เท่านั้น เพราะทดสอบผ่าน http://localhost ได้ด้วย
                    // ตอน deploy จริงบน https ต้องเปลี่ยนเป็น true
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 วัน
  });
}

// middleware เช็คว่า login อยู่ไหม ใช้ครอบทุก route ที่ต้อง login ก่อนเรียก
function requireAuth(req, res, next) {
  const token = req.cookies.session;
  if (!token) {
    return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อน' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.employeeId = payload.employeeId; // ใช้ต่อใน route อื่นๆ ได้เลย ไม่ต้องเชื่อค่าจาก frontend
    next();
  } catch (err) {
    return res.status(401).json({ message: 'session หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

// route ทดสอบ: ต้อง login ก่อนถึงจะเรียกได้ ใช้เช็คว่า middleware ทำงานถูก
app.get('/api/me', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT employee_id, full_name, department FROM employee WHERE employee_id = ?',
    [req.employeeId]
  );
  if (rows.length === 0) {
    return res.status(404).json({ message: 'ไม่พบข้อมูลพนักงาน' });
  }
  res.json(rows[0]);
});

// ---- activity submission loop (Phase 1 Part B) ----
// ใช้ตารางจริงจาก wellness.sql: activity_category, activity_type, running_submission
// คะแนน (activity_type.score) จะไป trigger score_transaction ตอนแอดมิน APPROVE เท่านั้น
// ตอนส่ง (PENDING) ไม่มีการ snapshot/บันทึกคะแนนใดๆ ไว้ที่ running_submission

// รายการประเภทกิจกรรมที่เลือกได้ (dropdown ฝั่ง frontend) พร้อม category และ require_image
app.get('/api/activities', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        at.activity_id, at.activity_name, at.score, at.require_image, at.description,
        ac.category_id, ac.category_name
       FROM activity_type at
       JOIN activity_category ac ON ac.category_id = at.category_id
       WHERE at.status = 'ACTIVE' AND ac.status = 'ACTIVE'
       ORDER BY ac.category_name, at.score`
    );
    res.json(rows);
  } catch (err) {
    console.error('get activities error:', err);
    res.status(500).json({ message: 'โหลดรายการกิจกรรมไม่สำเร็จ' });
  }
});

function handleProofUpload(req, res, next) {
  uploadProof.single('proofImage')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'ไฟล์รูปใหญ่เกินไป (สูงสุด 5MB)' });
    }
    // ครอบทั้ง MulterError อื่นๆ และ error จาก fileFilter (ชนิดไฟล์ไม่ถูกต้อง)
    return res.status(400).json({ message: err.message || 'อัปโหลดไฟล์ไม่สำเร็จ' });
  });
}

// พนักงานส่งกิจกรรมวิ่ง/เดิน -> เข้าสถานะ PENDING ใน running_submission รอแอดมินอนุมัติ
// รูปหลักฐานบังคับหรือไม่ ขึ้นกับ activity_type.require_image ของกิจกรรมที่เลือก
app.post('/api/submissions', requireAuth, handleProofUpload, async (req, res) => {
  const cleanupUploadedFile = () => {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
  };

  try {
    const { activityId, distance, duration, note } = req.body;

    if (!activityId) {
      cleanupUploadedFile();
      return res.status(400).json({ message: 'กรุณาเลือกประเภทกิจกรรม' });
    }

    const parsedDistance = distance !== undefined && distance !== '' ? Number(distance) : null;
    const parsedDuration = duration !== undefined && duration !== '' ? Number(duration) : null;

    if (parsedDistance !== null && (Number.isNaN(parsedDistance) || parsedDistance <= 0)) {
      cleanupUploadedFile();
      return res.status(400).json({ message: 'ระยะทางไม่ถูกต้อง' });
    }
    if (parsedDuration !== null && (Number.isNaN(parsedDuration) || parsedDuration <= 0)) {
      cleanupUploadedFile();
      return res.status(400).json({ message: 'ระยะเวลาไม่ถูกต้อง' });
    }

    const [activityRows] = await pool.query(
      `SELECT at.activity_id, at.require_image
       FROM activity_type at
       JOIN activity_category ac ON ac.category_id = at.category_id
       WHERE at.activity_id = ? AND at.status = 'ACTIVE' AND ac.status = 'ACTIVE'`,
      [activityId]
    );

    if (activityRows.length === 0) {
      cleanupUploadedFile();
      return res.status(400).json({ message: 'ไม่พบประเภทกิจกรรมนี้ หรือถูกปิดใช้งานแล้ว' });
    }

    if (activityRows[0].require_image && !req.file) {
      return res.status(400).json({ message: 'กิจกรรมนี้ต้องแนบรูปหลักฐาน' });
    }

    const proofImagePath = req.file
      ? path.posix.join('uploads', 'submissions', req.file.filename)
      : null;

    const [result] = await pool.query(
      `INSERT INTO running_submission
        (employee_id, activity_id, distance, duration, proof_image, note, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NOW())`,
      [req.employeeId, activityId, parsedDistance, parsedDuration, proofImagePath, note || null]
    );

    res.status(201).json({
      submissionId: result.insertId,
      status: 'PENDING',
      message: 'ส่งข้อมูลการวิ่งสำเร็จ กรุณารอการตรวจสอบจากแอดมิน',
    });
  } catch (err) {
    cleanupUploadedFile();
    console.error('create submission error:', err);
    res.status(500).json({ message: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// ---- admin auth (Phase 1 Part C) ----
// แยก session/cookie คนละชุดจากฝั่งพนักงาน (LINE) เพราะ use case ต่างกัน (แอดมินรีวิวบนคอมพิวเตอร์)
// แต่สิทธิ์แอดมินยังผูกกับ employee_id จริงเสมอ ผ่าน employee.role + ตาราง admin_credential

// route ปกติ ไม่ต้อง login ก่อนเรียก แต่ควรมี rate limit ในอนาคตกันการ brute force รหัสผ่าน
app.post('/api/admin/login', async (req, res) => {
  const { employeeId, password } = req.body;
  if (!employeeId || !password) {
    return res.status(400).json({ message: 'กรุณากรอกรหัสพนักงานและรหัสผ่าน' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT e.employee_id, e.role, e.employment_status, ac.password_hash
       FROM employee e
       JOIN admin_credential ac ON ac.employee_id = e.employee_id
       WHERE e.employee_id = ?`,
      [employeeId]
    );

    // ไม่บอกแยกว่า "ไม่พบ employeeId" หรือ "รหัสผ่านผิด" กันคนสุ่มเดารหัสพนักงานที่มีอยู่จริง
    if (rows.length === 0) {
      return res.status(401).json({ message: 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const account = rows[0];

    if (account.role !== 'ADMIN' || account.employment_status !== 'ACTIVE') {
      return res.status(403).json({ message: 'บัญชีนี้ไม่มีสิทธิ์แอดมิน หรือถูกระงับการใช้งาน' });
    }

    const passwordMatches = await bcrypt.compare(password, account.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = jwt.sign(
      { employeeId: account.employee_id, role: 'ADMIN' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' } // อายุสั้นกว่า session พนักงาน เพราะสิทธิ์นี้กระทบคะแนนคนอื่นได้
    );

    res.cookie('admin_session', token, {
      httpOnly: true,
      secure: false, // dev เท่านั้น เหมือน session พนักงาน ตอน deploy จริงบน https ต้องเปลี่ยนเป็น true
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.json({ employeeId: account.employee_id, role: 'ADMIN' });
  } catch (err) {
    console.error('admin login error:', err);
    res.status(500).json({ message: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_session');
  res.json({ message: 'ออกจากระบบแล้ว' });
});

// middleware เช็คสิทธิ์แอดมิน เช็คสดจาก DB ทุกครั้ง (ไม่เชื่อแค่ค่าใน JWT)
// เผื่อโดนถอด role หรือลาออกระหว่าง session 8 ชม. ยังไม่หมดอายุ
async function requireAdmin(req, res, next) {
  const token = req.cookies.admin_session;
  if (!token) {
    return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบแอดมินก่อน' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'ADMIN') {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const [rows] = await pool.query(
      `SELECT role, employment_status FROM employee WHERE employee_id = ?`,
      [payload.employeeId]
    );

    if (rows.length === 0 || rows[0].role !== 'ADMIN' || rows[0].employment_status !== 'ACTIVE') {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึง หรือบัญชีถูกระงับ' });
    }

    req.adminEmployeeId = payload.employeeId;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'session แอดมินหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

// เช็คว่า admin session ปัจจุบันยัง valid อยู่ไหม ใช้ตอนโหลดหน้าแอดมินครั้งแรก
// กันไม่ให้ต้อง login ใหม่ทุกครั้งที่ refresh หน้า (ถ้า cookie ยังไม่หมดอายุ)
app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ employeeId: req.adminEmployeeId, role: 'ADMIN' });
});

// preset เหตุผลปฏิเสธสำหรับ dropdown ฝั่งแอดมิน (is_other บอกว่าแถวไหนต้องให้พิมพ์เหตุผลเอง)
app.get('/api/admin/reject-reasons', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT reason_id, reason_text, is_other
       FROM reject_reason
       WHERE status = 'ACTIVE'
       ORDER BY is_other ASC, reason_id ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('get reject reasons error:', err);
    res.status(500).json({ message: 'โหลดรายการเหตุผลไม่สำเร็จ' });
  }
});

// รายการ submission ตามสถานะ (default PENDING) พร้อมข้อมูลพนักงาน+กิจกรรมสำหรับหน้ารีวิว
app.get('/api/admin/submissions', requireAdmin, async (req, res) => {
  const status = req.query.status || 'PENDING';
  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'status ไม่ถูกต้อง' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
        rs.submission_id, rs.employee_id, e.full_name, e.department,
        rs.activity_id, at.activity_name, at.score,
        rs.distance, rs.duration, rs.proof_image, rs.note,
        rs.status, rs.approved_by, rs.approved_at, rs.submitted_at,
        rr.reason_text AS reject_reason_text, rs.reject_reason_note
       FROM running_submission rs
       JOIN employee e ON e.employee_id = rs.employee_id
       JOIN activity_type at ON at.activity_id = rs.activity_id
       LEFT JOIN reject_reason rr ON rr.reason_id = rs.reject_reason_id
       WHERE rs.status = ?
       ORDER BY rs.submitted_at ASC`,
      [status]
    );
    res.json(rows);
  } catch (err) {
    console.error('get admin submissions error:', err);
    res.status(500).json({ message: 'โหลดรายการไม่สำเร็จ' });
  }
});

// อนุมัติ submission -> อัปเดตสถานะ + insert score_transaction (EARN) ในทรานแซกชันเดียวกัน
// ใช้ FOR UPDATE ล็อกแถวกันแอดมิน 2 คนกด approve รายการเดียวกันพร้อมกันจนคะแนนซ้ำ
app.post('/api/admin/submissions/:id/approve', requireAdmin, async (req, res) => {
  const submissionId = req.params.id;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [subRows] = await connection.query(
      `SELECT rs.submission_id, rs.employee_id, rs.status, at.score
       FROM running_submission rs
       JOIN activity_type at ON at.activity_id = rs.activity_id
       WHERE rs.submission_id = ?
       FOR UPDATE`,
      [submissionId]
    );

    if (subRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'ไม่พบ submission นี้' });
    }

    const submission = subRows[0];

    if (submission.status !== 'PENDING') {
      await connection.rollback();
      return res.status(400).json({
        message: `submission นี้ถูกตรวจสอบไปแล้ว (สถานะปัจจุบัน: ${submission.status})`,
      });
    }

    await connection.query(
      `UPDATE running_submission
       SET status = 'APPROVED', approved_by = ?, approved_at = NOW()
       WHERE submission_id = ?`,
      [req.adminEmployeeId, submissionId]
    );

    const isSelfApproval = submission.employee_id === req.adminEmployeeId;
    const remark = isSelfApproval
      ? `ได้คะแนนจากการอนุมัติ submission #${submissionId} (อนุมัติโดยตัวเอง)`
      : `ได้คะแนนจากการอนุมัติ submission #${submissionId}`;

    await connection.query(
      `INSERT INTO score_transaction
        (submission_id, employee_id, score, transaction_type, remark, created_by, created_at)
        VALUES (?, ?, ?, 'EARN', ?, ?, NOW())`,
      [submissionId, submission.employee_id, submission.score, remark, req.adminEmployeeId]
    );

    await connection.commit();
    res.json({ submissionId: Number(submissionId), status: 'APPROVED', scoreAwarded: submission.score });
  } catch (err) {
    await connection.rollback();
    console.error('approve submission error:', err);
    res.status(500).json({ message: 'อนุมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  } finally {
    connection.release();
  }
});

// ปฏิเสธ submission -> เปลี่ยนสถานะ + บันทึกเหตุผลจริง (reject_reason_id + reject_reason_note ถ้าเลือก "อื่นๆ")
// ไม่มีคะแนนเกี่ยวข้อง จึงไม่ต้องเปิด transaction
app.post('/api/admin/submissions/:id/reject', requireAdmin, async (req, res) => {
  const submissionId = req.params.id;
  const { reasonId, note } = req.body;

  if (!reasonId) {
    return res.status(400).json({ message: 'กรุณาเลือกเหตุผลที่ปฏิเสธ' });
  }

  try {
    const [subRows] = await pool.query(
      `SELECT submission_id, employee_id, status FROM running_submission WHERE submission_id = ?`,
      [submissionId]
    );

    if (subRows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบ submission นี้' });
    }

    const submission = subRows[0];

    if (submission.status !== 'PENDING') {
      return res.status(400).json({
        message: `submission นี้ถูกตรวจสอบไปแล้ว (สถานะปัจจุบัน: ${submission.status})`,
      });
    }

    const [reasonRows] = await pool.query(
      `SELECT reason_id, is_other FROM reject_reason WHERE reason_id = ? AND status = 'ACTIVE'`,
      [reasonId]
    );

    if (reasonRows.length === 0) {
      return res.status(400).json({ message: 'ไม่พบเหตุผลนี้ หรือถูกปิดใช้งานแล้ว' });
    }

    const reason = reasonRows[0];
    const trimmedNote = typeof note === 'string' ? note.trim() : '';

    // ถ้าเลือก "อื่นๆ" ต้องพิมพ์เหตุผลเองมาด้วยเสมอ ไม่งั้นจะไม่รู้สาเหตุจริงตอนย้อนดูทีหลัง
    if (reason.is_other && !trimmedNote) {
      return res.status(400).json({ message: 'กรุณาระบุเหตุผลเพิ่มเติม' });
    }

    const [result] = await pool.query(
      `UPDATE running_submission
       SET status = 'REJECTED', approved_by = ?, approved_at = NOW(),
           reject_reason_id = ?, reject_reason_note = ?
       WHERE submission_id = ? AND status = 'PENDING'`,
      [req.adminEmployeeId, reasonId, reason.is_other ? trimmedNote : null, submissionId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'ไม่พบ submission นี้ หรือถูกตรวจสอบไปแล้ว' });
    }

    res.json({ submissionId: Number(submissionId), status: 'REJECTED' });
  } catch (err) {
    console.error('reject submission error:', err);
    res.status(500).json({ message: 'ปฏิเสธไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// verify idToken กับ LINE โดยตรง ห้าม decode JWT เองแล้วเชื่อเลย
async function verifyLineIdToken(idToken) {
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: process.env.LINE_CHANNEL_ID,
    }),
  });

  if (!verifyRes.ok) {
    return null;
  }
  return verifyRes.json(); // { sub, name, picture, ... }
}

app.post('/api/auth/line-login', async (req, res) => {
  const { idToken, employeeId } = req.body;
  if (!idToken) {
    return res.status(400).json({ message: 'missing idToken' });
  }

  try {
    const payload = await verifyLineIdToken(idToken);
    if (!payload) {
      return res.status(401).json({ message: 'LINE token ไม่ถูกต้องหรือหมดอายุ' });
    }

    const lineUserId = payload.sub;
    const displayName = payload.name || null;
    const pictureUrl = payload.picture || null;

    // 1. เคยผูกบัญชีนี้กับ LINE user นี้ไว้แล้วหรือยัง
    const [existingRows] = await pool.query(
      `SELECT * FROM employee_account WHERE provider = 'LINE' AND provider_user_id = ?`,
      [lineUserId]
    );

    if (existingRows.length > 0) {
      const account = existingRows[0];
      await pool.query(
        `UPDATE employee_account SET last_login = NOW(), display_name = ?, picture_url = ? WHERE account_id = ?`,
        [displayName, pictureUrl, account.account_id]
      );
      issueSessionCookie(res, account.employee_id);
      return res.json({
        linked: true,
        employeeId: account.employee_id,
        displayName,
      });
    }

    // 2. ยังไม่เคยผูก และหน้าเว็บยังไม่ได้ส่งรหัสพนักงานมา -> บอกให้ frontend ขึ้นฟอร์มกรอก
    if (!employeeId) {
      return res.json({ linked: false, needsEmployeeId: true, displayName, pictureUrl });
    }

    // 3. มีการกรอกรหัสพนักงานมาด้วย -> เช็คว่ามีจริงและยังทำงานอยู่ไหม
    const [empRows] = await pool.query(
      `SELECT * FROM employee WHERE employee_id = ? AND employment_status = 'ACTIVE'`,
      [employeeId]
    );

    if (empRows.length === 0) {
      return res.status(400).json({
        message: 'ไม่พบรหัสพนักงานนี้ หรือไม่ใช่พนักงานที่ยังทำงานอยู่ กรุณาตรวจสอบอีกครั้ง',
      });
    }

    // 4. ผูกบัญชีใหม่
    await pool.query(
      `INSERT INTO employee_account
        (employee_id, provider, provider_user_id, display_name, picture_url, status, linked_at, last_login)
        VALUES (?, 'LINE', ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
      [employeeId, lineUserId, displayName, pictureUrl]
    );

    issueSessionCookie(res, employeeId);
    res.json({ linked: true, employeeId, displayName });
  } catch (err) {
    console.error('line-login error:', err);
    res.status(500).json({ message: 'internal error' });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`server running on port ${process.env.PORT}`);
});