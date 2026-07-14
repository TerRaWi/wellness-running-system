require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

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