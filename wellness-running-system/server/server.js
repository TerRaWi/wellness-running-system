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

// ---- reward redemption (Phase 2) ----
// ใช้ตารางจริงจาก wellness.sql: reward, reward_redeem, score_transaction
// หลักการ: หัก stock+คะแนนทันทีตอนกดแลก (status PENDING) แล้วคืนกลับถ้า CANCELLED/REJECTED ภายหลัง
// คะแนนคงเหลือของพนักงาน = SUM(score_transaction.score) ไม่มีคอลัมน์ balance แยกเก็บไว้ต่างหาก

// รายการของรางวัลที่แลกได้ (เฉพาะที่เปิดใช้งาน)
app.get('/api/rewards', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT reward_id, reward_name, required_score, stock, image, description
       FROM reward
       WHERE status = 'ACTIVE'
       ORDER BY required_score ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('get rewards error:', err);
    res.status(500).json({ message: 'โหลดรายการของรางวัลไม่สำเร็จ' });
  }
});

// คะแนนคงเหลือของพนักงานที่ login อยู่ (คำนวณสดจาก ledger ทุกครั้ง ไม่มีคอลัมน์ cache)
app.get('/api/my-score', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COALESCE(SUM(score), 0) AS balance
       FROM score_transaction
       WHERE employee_id = ?`,
      [req.employeeId]
    );
    res.json({ balance: rows[0].balance });
  } catch (err) {
    console.error('get my score error:', err);
    res.status(500).json({ message: 'โหลดคะแนนไม่สำเร็จ' });
  }
});

// พนักงานกดแลกของรางวัล -> หัก stock + หักคะแนนทันที (PENDING รอแอดมินมอบของจริง)
// ล็อกทั้งแถว employee และแถว reward ด้วย FOR UPDATE กันแลกซ้ำพร้อมกันจนคะแนน/stock ติดลบ
app.post('/api/redeem', requireAuth, async (req, res) => {
  const { rewardId } = req.body;

  if (!rewardId) {
    return res.status(400).json({ message: 'กรุณาเลือกของรางวัล' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // ล็อกแถวพนักงานตัวเองไว้ก่อน กันพนักงานคนเดียวกันกดแลกพร้อมกันหลายครั้งจนคะแนนติดลบ
    await connection.query(`SELECT employee_id FROM employee WHERE employee_id = ? FOR UPDATE`, [
      req.employeeId,
    ]);

    const [rewardRows] = await connection.query(
      `SELECT reward_id, reward_name, required_score, stock, status
       FROM reward
       WHERE reward_id = ?
       FOR UPDATE`,
      [rewardId]
    );

    if (rewardRows.length === 0 || rewardRows[0].status !== 'ACTIVE') {
      await connection.rollback();
      return res.status(400).json({ message: 'ไม่พบของรางวัลนี้ หรือถูกปิดใช้งานแล้ว' });
    }

    const reward = rewardRows[0];

    if (reward.stock <= 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'ของรางวัลนี้หมดแล้ว' });
    }

    const [balanceRows] = await connection.query(
      `SELECT COALESCE(SUM(score), 0) AS balance FROM score_transaction WHERE employee_id = ?`,
      [req.employeeId]
    );
    const currentBalance = balanceRows[0].balance;

    if (currentBalance < reward.required_score) {
      await connection.rollback();
      return res.status(400).json({
        message: `คะแนนไม่พอ (มี ${currentBalance} คะแนน ต้องใช้ ${reward.required_score} คะแนน)`,
      });
    }

    const [redeemResult] = await connection.query(
      `INSERT INTO reward_redeem (employee_id, reward_id, used_score, status, redeem_date)
       VALUES (?, ?, ?, 'PENDING', NOW())`,
      [req.employeeId, rewardId, reward.required_score]
    );
    const redeemId = redeemResult.insertId;

    await connection.query(`UPDATE reward SET stock = stock - 1 WHERE reward_id = ?`, [rewardId]);

    await connection.query(
      `INSERT INTO score_transaction
        (redeem_id, employee_id, score, transaction_type, remark, created_by, created_at)
        VALUES (?, ?, ?, 'REDEEM', ?, NULL, NOW())`,
      [
        redeemId,
        req.employeeId,
        -reward.required_score,
        `หักคะแนนจากการแลกของรางวัล #${redeemId} (${reward.reward_name})`,
      ]
    );

    await connection.commit();
    res.status(201).json({
      redeemId,
      status: 'PENDING',
      scoreDeducted: reward.required_score,
      message: 'แลกของรางวัลสำเร็จ กรุณารอการดำเนินการจากแอดมิน',
    });
  } catch (err) {
    await connection.rollback();
    console.error('redeem error:', err);
    res.status(500).json({ message: 'แลกของรางวัลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  } finally {
    connection.release();
  }
});

// ประวัติการแลกของของพนักงานที่ login อยู่ (ใช้โชว์สถานะ + ปุ่มยกเลิกในหน้า UI)
app.get('/api/my-redeems', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT rr.redeem_id, rr.reward_id, r.reward_name, r.image, rr.used_score, rr.status, rr.redeem_date
       FROM reward_redeem rr
       JOIN reward r ON r.reward_id = rr.reward_id
       WHERE rr.employee_id = ?
       ORDER BY rr.redeem_date DESC`,
      [req.employeeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('get my redeems error:', err);
    res.status(500).json({ message: 'โหลดประวัติการแลกของไม่สำเร็จ' });
  }
});

// พนักงานยกเลิกการแลกของตัวเอง (เฉพาะที่ยังไม่ถูกดำเนินการ) -> คืน stock + คืนคะแนน
app.post('/api/redeem/:id/cancel', requireAuth, async (req, res) => {
  const redeemId = req.params.id;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [redeemRows] = await connection.query(
      `SELECT redeem_id, employee_id, reward_id, used_score, status
       FROM reward_redeem
       WHERE redeem_id = ?
       FOR UPDATE`,
      [redeemId]
    );

    if (redeemRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'ไม่พบรายการแลกของนี้' });
    }

    const redeem = redeemRows[0];

    if (redeem.employee_id !== req.employeeId) {
      await connection.rollback();
      return res.status(403).json({ message: 'ไม่สามารถยกเลิกรายการของคนอื่นได้' });
    }

    if (redeem.status !== 'PENDING') {
      await connection.rollback();
      return res.status(400).json({
        message: `รายการนี้ถูกดำเนินการไปแล้ว ยกเลิกไม่ได้ (สถานะปัจจุบัน: ${redeem.status})`,
      });
    }

    await connection.query(`UPDATE reward_redeem SET status = 'CANCELLED' WHERE redeem_id = ?`, [
      redeemId,
    ]);

    await connection.query(`UPDATE reward SET stock = stock + 1 WHERE reward_id = ?`, [
      redeem.reward_id,
    ]);

    await connection.query(
      `INSERT INTO score_transaction
        (redeem_id, employee_id, score, transaction_type, remark, created_by, created_at)
        VALUES (?, ?, ?, 'ADJUST', ?, NULL, NOW())`,
      [redeemId, req.employeeId, redeem.used_score, `คืนคะแนนจากการยกเลิกแลกของ #${redeemId}`]
    );

    await connection.commit();
    res.json({ redeemId: Number(redeemId), status: 'CANCELLED' });
  } catch (err) {
    await connection.rollback();
    console.error('cancel redeem error:', err);
    res.status(500).json({ message: 'ยกเลิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  } finally {
    connection.release();
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
      `SELECT rs.submission_id, rs.employee_id, rs.status, rs.activity_id, at.category_id, rs.submitted_at, at.score
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

    // Phase 3: submission ที่เพิ่งอนุมัติ ถ้าอยู่ในหมวดกิจกรรมเดียวกับ challenge ที่กำลัง ONGOING อยู่
    // และพนักงานคนนี้ join challenge นั้นไว้ก่อนวันที่ส่ง submission -> นับเข้า challenge อัตโนมัติ
    // จับคู่ด้วย category_id ไม่ใช่ activity_id เพราะ challenge วัดระยะทางรวมทั้งหมวด (เช่น "วิ่ง" ทุกระยะ)
    await connection.query(
      `UPDATE challenge SET status = 'ONGOING'
       WHERE status = 'UPCOMING' AND start_date <= NOW() AND end_date > NOW()`
    );
    await connection.query(
      `UPDATE challenge SET status = 'ENDED'
       WHERE status IN ('UPCOMING', 'ONGOING') AND end_date <= NOW()`
    );

    const [matchingChallenges] = await connection.query(
      `SELECT challenge_id FROM challenge WHERE category_id = ? AND status = 'ONGOING'`,
      [submission.category_id]
    );

    for (const ch of matchingChallenges) {
      const [participantRows] = await connection.query(
        `SELECT participant_id FROM challenge_participant
         WHERE challenge_id = ? AND employee_id = ? AND joined_at <= ?`,
        [ch.challenge_id, submission.employee_id, submission.submitted_at]
      );

      if (participantRows.length > 0) {
        // INSERT IGNORE เผื่อกรณี edge case, ปกติ submission หนึ่งอนุมัติได้ครั้งเดียวอยู่แล้ว
        await connection.query(
          `INSERT IGNORE INTO challenge_submission (participant_id, submission_id, added_at)
           VALUES (?, ?, NOW())`,
          [participantRows[0].participant_id, submissionId]
        );
      }
    }

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

// ---- reward redemption: ฝั่งแอดมิน (Phase 2) ----

// รายการคำขอแลกของตามสถานะ (default PENDING) พร้อมชื่อพนักงาน+ชื่อของรางวัล
app.get('/api/admin/redeems', requireAdmin, async (req, res) => {
  const status = req.query.status || 'PENDING';
  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'status ไม่ถูกต้อง' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
        rr.redeem_id, rr.employee_id, e.full_name, e.department,
        rr.reward_id, r.reward_name, r.image,
        rr.used_score, rr.status, rr.redeem_date
       FROM reward_redeem rr
       JOIN employee e ON e.employee_id = rr.employee_id
       JOIN reward r ON r.reward_id = rr.reward_id
       WHERE rr.status = ?
       ORDER BY rr.redeem_date ASC`,
      [status]
    );
    res.json(rows);
  } catch (err) {
    console.error('get admin redeems error:', err);
    res.status(500).json({ message: 'โหลดรายการไม่สำเร็จ' });
  }
});

// อนุมัติคำขอแลกของ -> แค่ยืนยันว่ามอบของจริงแล้ว ไม่กระทบคะแนน/stock เพิ่ม
// เพราะหักไปแล้วตั้งแต่ตอนกดแลก (PENDING)
app.post('/api/admin/redeems/:id/approve', requireAdmin, async (req, res) => {
  const redeemId = req.params.id;

  try {
    const [result] = await pool.query(
      `UPDATE reward_redeem
       SET status = 'APPROVED'
       WHERE redeem_id = ? AND status = 'PENDING'`,
      [redeemId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'ไม่พบรายการนี้ หรือถูกดำเนินการไปแล้ว' });
    }

    res.json({ redeemId: Number(redeemId), status: 'APPROVED' });
  } catch (err) {
    console.error('approve redeem error:', err);
    res.status(500).json({ message: 'อนุมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// ปฏิเสธคำขอแลกของ -> คืน stock + คืนคะแนนเสมอ (เปิด transaction เพราะกระทบ 2 ตารางพร้อมกัน)
app.post('/api/admin/redeems/:id/reject', requireAdmin, async (req, res) => {
  const redeemId = req.params.id;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [redeemRows] = await connection.query(
      `SELECT redeem_id, employee_id, reward_id, used_score, status
       FROM reward_redeem
       WHERE redeem_id = ?
       FOR UPDATE`,
      [redeemId]
    );

    if (redeemRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'ไม่พบรายการแลกของนี้' });
    }

    const redeem = redeemRows[0];

    if (redeem.status !== 'PENDING') {
      await connection.rollback();
      return res.status(400).json({
        message: `รายการนี้ถูกดำเนินการไปแล้ว (สถานะปัจจุบัน: ${redeem.status})`,
      });
    }

    await connection.query(`UPDATE reward_redeem SET status = 'REJECTED' WHERE redeem_id = ?`, [
      redeemId,
    ]);

    await connection.query(`UPDATE reward SET stock = stock + 1 WHERE reward_id = ?`, [
      redeem.reward_id,
    ]);

    await connection.query(
      `INSERT INTO score_transaction
        (redeem_id, employee_id, score, transaction_type, remark, created_by, created_at)
        VALUES (?, ?, ?, 'ADJUST', ?, ?, NOW())`,
      [
        redeemId,
        redeem.employee_id,
        redeem.used_score,
        `คืนคะแนนจากการปฏิเสธการแลกของ #${redeemId}`,
        req.adminEmployeeId,
      ]
    );

    await connection.commit();
    res.json({ redeemId: Number(redeemId), status: 'REJECTED' });
  } catch (err) {
    await connection.rollback();
    console.error('reject redeem error:', err);
    res.status(500).json({ message: 'ปฏิเสธไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  } finally {
    connection.release();
  }
});

// ---- Phase 3: challenge + leaderboard ----
// ใช้ตารางจริงจาก wellness.sql: challenge, challenge_participant, challenge_submission
// หลักการ: status ของ challenge ไม่ได้ผูก cron job แยก แต่ "lazy sync" ทุกครั้งก่อน query
// (UPCOMING -> ONGOING เมื่อถึง start_date, ONGOING/UPCOMING -> ENDED เมื่อเลย end_date)
// ไม่แตะ CANCELLED เพราะเป็นการยกเลิกโดย admin เท่านั้น ระบบจะไม่เปลี่ยนสถานะนี้เอง
async function syncChallengeStatuses(runner = pool) {
  await runner.query(
    `UPDATE challenge SET status = 'ONGOING'
     WHERE status = 'UPCOMING' AND start_date <= NOW() AND end_date > NOW()`
  );
  await runner.query(
    `UPDATE challenge SET status = 'ENDED'
     WHERE status IN ('UPCOMING', 'ONGOING') AND end_date <= NOW()`
  );
}

// รายการ challenge ที่เปิดให้เห็น/เข้าร่วมได้ (UPCOMING, ONGOING) พร้อมสถานะว่าพนักงานคนนี้เข้าร่วมแล้วหรือยัง
app.get('/api/challenges', requireAuth, async (req, res) => {
  try {
    await syncChallengeStatuses();

    const [rows] = await pool.query(
      `SELECT
        c.challenge_id, c.challenge_name, c.description, c.ranking_type,
        c.start_date, c.end_date, c.status,
        ac.category_id, ac.category_name,
        (SELECT COUNT(*) FROM challenge_participant cp WHERE cp.challenge_id = c.challenge_id) AS participant_count,
        me.join_mode AS my_join_mode
       FROM challenge c
       JOIN activity_category ac ON ac.category_id = c.category_id
       LEFT JOIN challenge_participant me
         ON me.challenge_id = c.challenge_id AND me.employee_id = ?
       WHERE c.status IN ('UPCOMING', 'ONGOING')
       ORDER BY c.start_date ASC`,
      [req.employeeId]
    );

    res.json(rows.map((r) => ({ ...r, joined: r.my_join_mode !== null })));
  } catch (err) {
    console.error('get challenges error:', err);
    res.status(500).json({ message: 'โหลดรายการ challenge ไม่สำเร็จ' });
  }
});

// challenge ที่พนักงานคนนี้เข้าร่วมอยู่ (ทุกสถานะ รวมที่จบไปแล้ว เพื่อดูประวัติ) พร้อมระยะทางสะสมของตัวเอง
app.get('/api/my-challenges', requireAuth, async (req, res) => {
  try {
    await syncChallengeStatuses();

    const [rows] = await pool.query(
      `SELECT
        c.challenge_id, c.challenge_name, c.status, c.start_date, c.end_date,
        ac.category_name,
        cp.participant_id, cp.join_mode, cp.joined_at,
        COALESCE(SUM(rs.distance), 0) AS my_distance
       FROM challenge_participant cp
       JOIN challenge c ON c.challenge_id = cp.challenge_id
       JOIN activity_category ac ON ac.category_id = c.category_id
       LEFT JOIN challenge_submission cs ON cs.participant_id = cp.participant_id
       LEFT JOIN running_submission rs ON rs.submission_id = cs.submission_id
       WHERE cp.employee_id = ?
       GROUP BY cp.participant_id
       ORDER BY c.start_date DESC`,
      [req.employeeId]
    );

    res.json(rows);
  } catch (err) {
    console.error('get my challenges error:', err);
    res.status(500).json({ message: 'โหลดรายการ challenge ของฉันไม่สำเร็จ' });
  }
});

// เข้าร่วม challenge -> joined_at คือจุดเริ่มนับ (submission ที่ส่งก่อนหน้านี้จะไม่ถูกนับย้อนหลัง)
app.post('/api/challenges/:id/join', requireAuth, async (req, res) => {
  const challengeId = req.params.id;
  const joinMode = req.body.joinMode === 'ANONYMOUS' ? 'ANONYMOUS' : 'PUBLIC';

  try {
    await syncChallengeStatuses();

    const [challengeRows] = await pool.query(`SELECT challenge_id, status FROM challenge WHERE challenge_id = ?`, [
      challengeId,
    ]);

    if (challengeRows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบ challenge นี้' });
    }
    if (!['UPCOMING', 'ONGOING'].includes(challengeRows[0].status)) {
      return res.status(400).json({ message: 'challenge นี้ปิดรับการเข้าร่วมแล้ว' });
    }

    await pool.query(
      `INSERT INTO challenge_participant (challenge_id, employee_id, join_mode, joined_at)
       VALUES (?, ?, ?, NOW())`,
      [challengeId, req.employeeId, joinMode]
    );

    res.status(201).json({ challengeId: Number(challengeId), joinMode, message: 'เข้าร่วม challenge สำเร็จ' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'คุณเข้าร่วม challenge นี้ไปแล้ว' });
    }
    console.error('join challenge error:', err);
    res.status(500).json({ message: 'เข้าร่วม challenge ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// leaderboard ของ challenge หนึ่งๆ จัดอันดับตามระยะทางสะสม (ranking_type = DISTANCE เท่านั้นตอนนี้)
// ผู้เข้าร่วมแบบ ANONYMOUS จะถูกซ่อนชื่อ/รหัสพนักงาน ยกเว้นแถวของตัวเอง
app.get('/api/challenges/:id/leaderboard', requireAuth, async (req, res) => {
  const challengeId = req.params.id;

  try {
    const [challengeRows] = await pool.query(`SELECT challenge_id FROM challenge WHERE challenge_id = ?`, [
      challengeId,
    ]);
    if (challengeRows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบ challenge นี้' });
    }

    const [rows] = await pool.query(
      `SELECT
        cp.participant_id, cp.employee_id, cp.join_mode, e.full_name,
        COALESCE(SUM(rs.distance), 0) AS total_distance,
        COUNT(cs.challenge_submission_id) AS run_count
       FROM challenge_participant cp
       JOIN employee e ON e.employee_id = cp.employee_id
       LEFT JOIN challenge_submission cs ON cs.participant_id = cp.participant_id
       LEFT JOIN running_submission rs ON rs.submission_id = cs.submission_id
       WHERE cp.challenge_id = ?
       GROUP BY cp.participant_id
       ORDER BY total_distance DESC, cp.joined_at ASC`,
      [challengeId]
    );

    const leaderboard = rows.map((r, index) => {
      const isMe = r.employee_id === req.employeeId;
      const isAnonymous = r.join_mode === 'ANONYMOUS' && !isMe;
      return {
        rank: index + 1,
        isMe,
        displayName: isAnonymous ? 'ผู้เข้าร่วมไม่ระบุตัวตน' : r.full_name,
        totalDistance: r.total_distance,
        runCount: r.run_count,
      };
    });

    res.json(leaderboard);
  } catch (err) {
    console.error('get leaderboard error:', err);
    res.status(500).json({ message: 'โหลด leaderboard ไม่สำเร็จ' });
  }
});

// ---- Phase 3: admin จัดการ challenge ----

// รายการกิจกรรมสำหรับ dropdown ตอนสร้าง challenge (แอดมินไม่มี session พนักงาน เลยต้องมี route แยก)
app.get('/api/admin/activities', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT at.activity_id, at.activity_name, ac.category_name
       FROM activity_type at
       JOIN activity_category ac ON ac.category_id = at.category_id
       WHERE at.status = 'ACTIVE' AND ac.status = 'ACTIVE'
       ORDER BY ac.category_name, at.activity_name`
    );
    res.json(rows);
  } catch (err) {
    console.error('get admin activities error:', err);
    res.status(500).json({ message: 'โหลดรายการกิจกรรมไม่สำเร็จ' });
  }
});

// รายการหมวดหมู่กิจกรรมสำหรับ dropdown ตอนสร้าง challenge (challenge วัดระยะทางรวมทั้งหมวด ไม่ผูกกับ activity_type เดียว)
app.get('/api/admin/activity-categories', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT category_id, category_name
       FROM activity_category
       WHERE status = 'ACTIVE'
       ORDER BY category_name`
    );
    res.json(rows);
  } catch (err) {
    console.error('get admin activity categories error:', err);
    res.status(500).json({ message: 'โหลดรายการหมวดหมู่กิจกรรมไม่สำเร็จ' });
  }
});

// รายการ challenge ทั้งหมดทุกสถานะ สำหรับหน้าแอดมิน
app.get('/api/admin/challenges', requireAdmin, async (req, res) => {
  try {
    await syncChallengeStatuses();

    const [rows] = await pool.query(
      `SELECT
        c.challenge_id, c.challenge_name, c.description, c.start_date, c.end_date, c.status,
        ac.category_id, ac.category_name,
        (SELECT COUNT(*) FROM challenge_participant cp WHERE cp.challenge_id = c.challenge_id) AS participant_count
       FROM challenge c
       JOIN activity_category ac ON ac.category_id = c.category_id
       ORDER BY c.start_date DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('get admin challenges error:', err);
    res.status(500).json({ message: 'โหลดรายการ challenge ไม่สำเร็จ' });
  }
});

// สร้าง challenge ใหม่
app.post('/api/admin/challenges', requireAdmin, async (req, res) => {
  const { categoryId, challengeName, description, startDate, endDate } = req.body;

  if (!categoryId || !challengeName || !startDate || !endDate) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ (หมวดกิจกรรม, ชื่อ, วันเริ่ม, วันจบ)' });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return res.status(400).json({ message: 'ช่วงวันที่ไม่ถูกต้อง (วันเริ่มต้องก่อนวันจบ)' });
  }

  try {
    const [categoryRows] = await pool.query(
      `SELECT category_id FROM activity_category WHERE category_id = ? AND status = 'ACTIVE'`,
      [categoryId]
    );
    if (categoryRows.length === 0) {
      return res.status(400).json({ message: 'ไม่พบหมวดหมู่กิจกรรมนี้ หรือถูกปิดใช้งานแล้ว' });
    }

    const now = new Date();
    const initialStatus = now < start ? 'UPCOMING' : now < end ? 'ONGOING' : 'ENDED';

    const [result] = await pool.query(
      `INSERT INTO challenge
        (category_id, challenge_name, description, ranking_type, start_date, end_date, status)
        VALUES (?, ?, ?, 'DISTANCE', ?, ?, ?)`,
      [categoryId, challengeName.trim(), description ? description.trim() : null, start, end, initialStatus]
    );

    res.status(201).json({ challengeId: result.insertId, status: initialStatus });
  } catch (err) {
    console.error('create challenge error:', err);
    res.status(500).json({ message: 'สร้าง challenge ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// ยกเลิก challenge (เฉพาะที่ยังไม่จบ) -> ไม่กระทบคะแนน เพราะ challenge ไม่มีระบบให้คะแนนโดยตรง
app.post('/api/admin/challenges/:id/cancel', requireAdmin, async (req, res) => {
  const challengeId = req.params.id;

  try {
    const [result] = await pool.query(
      `UPDATE challenge SET status = 'CANCELLED'
       WHERE challenge_id = ? AND status IN ('UPCOMING', 'ONGOING')`,
      [challengeId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'ไม่พบ challenge นี้ หรือจบ/ถูกยกเลิกไปแล้ว' });
    }

    res.json({ challengeId: Number(challengeId), status: 'CANCELLED' });
  } catch (err) {
    console.error('cancel challenge error:', err);
    res.status(500).json({ message: 'ยกเลิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
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