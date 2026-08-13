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
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // timezone ฝั่ง client driver — ใช้ตอนแปลง DATETIME ที่อ่าน/เขียนระหว่าง JS Date กับ MySQL
  timezone: '+07:00',
  // Aiven บังคับต่อผ่าน SSL เสมอ — DB_SSL_CA คือเนื้อหาไฟล์ ca.pem ทั้งไฟล์
  // (วางเป็น env var ตรงๆ บน Render แทนการอ่านจากไฟล์ เพราะ Render ไม่มี persistent disk)
  ...(process.env.DB_SSL_CA && {
    ssl: {
      ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'),
    },
  }),
});

// สำคัญ: บังคับ session time_zone ของ MySQL เองด้วย (ไม่ใช่แค่ client driver ด้านบน)
// เพราะ NOW()/CURRENT_TIMESTAMP ที่ใช้ทั้งใน DEFAULT column และใน query (เช่น sync สถานะ challenge)
// ถูกคำนวณฝั่ง MySQL server เอง ถ้าไม่ตั้งตรงนี้ Aiven จะใช้ UTC ของตัวเซิร์ฟเวอร์แทน
// ทำให้ NOW() กับค่าที่เราเก็บเป็นเวลาไทย literal เทียบกันผิดอยู่ 7 ชม. เสมอ
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+07:00'");
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

// ---- Phase 4: badge icon upload (แอดมินอัปโหลดรูปไอคอนที่วาด/ดีไซน์เองได้ ไม่ต้องมี URL ภายนอก) ----
const BADGE_ICON_ROOT = path.join(__dirname, 'uploads', 'badges');
if (!fs.existsSync(BADGE_ICON_ROOT)) {
  fs.mkdirSync(BADGE_ICON_ROOT, { recursive: true });
}

const badgeIconStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BADGE_ICON_ROOT),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `badge_${Date.now()}${ext}`);
  },
});

const uploadBadgeIcon = multer({
  storage: badgeIconStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB พอสำหรับไอคอน ไม่ควรใหญ่กว่านี้
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP เท่านั้น'));
    }
    cb(null, true);
  },
});

// ครอบ multer เพื่อโยน error ที่อ่านง่ายกลับไป (ไฟล์ใหญ่เกิน/ชนิดไฟล์ผิด) เหมือน handleProofUpload
function handleBadgeIconUpload(req, res, next) {
  uploadBadgeIcon.single('iconFile')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'ไฟล์รูปใหญ่เกินไป (สูงสุด 2MB)' });
    }
    return res.status(400).json({ message: err.message || 'อัปโหลดไฟล์ไม่สำเร็จ' });
  });
}

// ---- Phase 5: reward image upload (แอดมินอัปโหลดรูปของรางวัล) ----
const REWARD_IMAGE_ROOT = path.join(__dirname, 'uploads', 'rewards');
if (!fs.existsSync(REWARD_IMAGE_ROOT)) {
  fs.mkdirSync(REWARD_IMAGE_ROOT, { recursive: true });
}

const rewardImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, REWARD_IMAGE_ROOT),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `reward_${Date.now()}${ext}`);
  },
});

const uploadRewardImage = multer({
  storage: rewardImageStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP เท่านั้น'));
    }
    cb(null, true);
  },
});

function handleRewardImageUpload(req, res, next) {
  uploadRewardImage.single('imageFile')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'ไฟล์รูปใหญ่เกินไป (สูงสุด 2MB)' });
    }
    return res.status(400).json({ message: err.message || 'อัปโหลดไฟล์ไม่สำเร็จ' });
  });
}

app.get('/api/health', async (req, res) => {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM employee');
  res.json({ status: 'ok', employeeCount: rows[0].total });
});

// แปลง string จาก <input type="datetime-local"> (เช่น "2026-08-11T15:06", ไม่มี timezone กำกับ)
// ให้เป็นเวลาไทยเสมอ ไม่พึ่ง timezone ของเครื่อง/container ที่รันโค้ด
function parseThaiLocalDateTime(value) {
  if (!value) return new Date(NaN);
  const hasSeconds = /T\d{2}:\d{2}:\d{2}/.test(value);
  const withSeconds = hasSeconds ? value : `${value}:00`;
  return new Date(`${withSeconds}+07:00`);
}

// ---- session helpers ----
function issueSessionCookie(res, employeeId) {
  const token = jwt.sign({ employeeId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // ต้อง true เมื่อ deploy จริงผ่าน https (frontend/backend คนละโดเมนกัน)
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' จำเป็นสำหรับ cross-site cookie ตอน deploy จริง
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

// ---- baseline + follow-up health questionnaire ----
// BASELINE: ต้องกรอกครั้งเดียวหลังผูกบัญชี ก่อนใช้แอปจริง (block การใช้งาน)
// FOLLOWUP: แอดมินเปิดรอบเอง (assessment_campaign) พนักงานเห็นเป็น prompt เฉยๆ ไม่ block การใช้แอป
app.get('/api/health-assessment/status', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT assessment_id FROM health_assessment WHERE employee_id = ? AND assessment_type = 'BASELINE'`,
    [req.employeeId]
  );
  res.json({ completed: rows.length > 0 });
});

// เช็คว่ามีรอบ follow-up ที่เปิดอยู่และพนักงานคนนี้ยังไม่เคยตอบไหม — เรียกหลัง login สำเร็จ (status='done')
app.get('/api/health-assessment/pending-campaign', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.campaign_id, c.campaign_name, c.included_fields
       FROM assessment_campaign c
       WHERE c.status = 'OPEN'
         AND c.release_date <= CURDATE()
         AND (c.close_date IS NULL OR c.close_date >= CURDATE())
         AND NOT EXISTS (
           SELECT 1 FROM health_assessment ha
           WHERE ha.employee_id = ? AND ha.campaign_id = c.campaign_id
         )
       ORDER BY c.release_date ASC
       LIMIT 1`,
    [req.employeeId]
  );

  if (rows.length === 0) {
    return res.json({ campaign: null });
  }

  const row = rows[0];
  res.json({
    campaign: {
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      // mysql2 คืน JSON column เป็น object/array ที่ parse แล้วอยู่แล้ว
      includedFields: row.included_fields,
    },
  });
});

app.post('/api/health-assessment', requireAuth, async (req, res) => {
  const {
    assessmentType, // 'BASELINE' | 'FOLLOWUP' — ไม่ส่งมาถือว่าเป็น BASELINE (backward compatible)
    campaignId,
    jobPosition,
    yearsOfService,
    shiftType,
    weightKg,
    heightCm,
    waistCm,
    bpSystolic,
    bpDiastolic,
    chronicDisease,
    chronicDiseaseOther,
    smokingStatus,
    alcoholStatus,
    physicalLimitation,
    physicalLimitationNote,
    vigorousDays,
    vigorousMinutes,
    moderateDays,
    moderateMinutes,
    walkingDays,
    walkingMinutes,
    exercisePattern,
    exerciseBarrier,
    mealsPerDay,
    friedFoodFreq,
    sweetFoodFreq,
    veggieFruitFreq,
    lateNightEating,
    pastDieting,
    goalType,
    stageOfChange,
    targetWeightKg,
  } = req.body;

  const type = assessmentType === 'FOLLOWUP' ? 'FOLLOWUP' : 'BASELINE';

  if (type === 'BASELINE') {
    // BASELINE ต้องกรอกครบทุกข้อบังคับเหมือนเดิม
    if (
      !weightKg ||
      !heightCm ||
      !mealsPerDay ||
      !friedFoodFreq ||
      !sweetFoodFreq ||
      !veggieFruitFreq ||
      !lateNightEating ||
      !pastDieting ||
      !Array.isArray(goalType) ||
      goalType.length === 0 ||
      !stageOfChange
    ) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบทุกช่องที่จำเป็น' });
    }

    // กัน BASELINE ซ้ำที่ระดับ application (DB unique index คุมแค่ FOLLOWUP ต่อ campaign แล้ว ไม่คุม BASELINE)
    const [existingBaseline] = await pool.query(
      `SELECT assessment_id FROM health_assessment WHERE employee_id = ? AND assessment_type = 'BASELINE'`,
      [req.employeeId]
    );
    if (existingBaseline.length > 0) {
      return res.status(409).json({ message: 'คุณกรอกแบบสอบถาม baseline นี้ไปแล้ว' });
    }
  } else {
    // FOLLOWUP ต้องอ้างอิง campaign ที่มีจริงและยังเปิดอยู่
    if (!campaignId) {
      return res.status(400).json({ message: 'ไม่พบรอบ follow-up ที่อ้างอิง' });
    }
    const [campaignRows] = await pool.query(
      `SELECT campaign_id FROM assessment_campaign WHERE campaign_id = ? AND status = 'OPEN'`,
      [campaignId]
    );
    if (campaignRows.length === 0) {
      return res.status(400).json({ message: 'รอบ follow-up นี้ปิดรับหรือไม่มีอยู่จริง' });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ข้อมูลทั่วไปที่เก็บไว้ที่ employee (ไม่ใช่ time-series แบบ health_assessment)
    // อัปเดตเฉพาะตอน BASELINE หรือถ้า follow-up รอบนั้นตั้งใจถามซ้ำ (ส่งค่ามาไม่ null)
    if (jobPosition !== undefined || yearsOfService !== undefined || shiftType !== undefined) {
      await conn.query(
        `UPDATE employee SET
           job_position = COALESCE(?, job_position),
           years_of_service = COALESCE(?, years_of_service),
           shift_type = COALESCE(?, shift_type)
         WHERE employee_id = ?`,
        [jobPosition || null, yearsOfService || null, shiftType || null, req.employeeId]
      );
    }

    await conn.query(
      `INSERT INTO health_assessment
        (employee_id, assessment_type, campaign_id, consent_accepted_at,
         weight_kg, height_cm, waist_cm, bp_systolic, bp_diastolic,
         assessment_date, chronic_disease, chronic_disease_other, smoking_status, alcohol_status,
         physical_limitation, physical_limitation_note,
         vigorous_days, vigorous_minutes, moderate_days, moderate_minutes, walking_days, walking_minutes,
         exercise_pattern, exercise_barrier,
         meals_per_day, fried_food_freq, sweet_food_freq, veggie_fruit_freq, late_night_eating, past_dieting,
         goal_type, stage_of_change, target_weight_kg)
       VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.employeeId,
        type,
        type === 'FOLLOWUP' ? campaignId : null,
        weightKg || null,
        heightCm || null,
        waistCm || null,
        bpSystolic || null,
        bpDiastolic || null,
        chronicDisease ? JSON.stringify(chronicDisease) : null,
        chronicDiseaseOther || null,
        smokingStatus || null,
        alcoholStatus || null,
        physicalLimitation === undefined ? null : physicalLimitation ? 1 : 0,
        physicalLimitationNote || null,
        vigorousDays || 0,
        vigorousMinutes || null,
        moderateDays || 0,
        moderateMinutes || null,
        walkingDays || 0,
        walkingMinutes || null,
        exercisePattern ? JSON.stringify(exercisePattern) : null,
        exerciseBarrier || null,
        mealsPerDay || null,
        friedFoodFreq || null,
        sweetFoodFreq || null,
        veggieFruitFreq || null,
        lateNightEating || null,
        pastDieting || null,
        goalType ? JSON.stringify(goalType) : null,
        stageOfChange || null,
        targetWeightKg || null,
      ]
    );

    await conn.commit();
    res.json({ message: 'บันทึกข้อมูลสุขภาพเรียบร้อย' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'คุณกรอกแบบสอบถามรอบนี้ไปแล้ว' });
    }
    console.error('health-assessment submit error:', err);
    res.status(500).json({ message: 'บันทึกข้อมูลไม่สำเร็จ' });
  } finally {
    conn.release();
  }
});

// ---- admin: จัดการรอบ follow-up (assessment_campaign) ----
app.get('/api/admin/campaigns', requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*,
       (SELECT COUNT(*) FROM health_assessment ha WHERE ha.campaign_id = c.campaign_id) AS response_count,
       (SELECT COUNT(*) FROM employee WHERE employment_status = 'ACTIVE') AS active_employee_count
     FROM assessment_campaign c
     ORDER BY c.created_at DESC`
  );
  res.json(rows);
});

app.post('/api/admin/campaigns', requireAdmin, async (req, res) => {
  const { campaignName, releaseDate, closeDate, includedFields } = req.body;

  if (!campaignName || !releaseDate || !Array.isArray(includedFields) || includedFields.length === 0) {
    return res.status(400).json({ message: 'กรุณากรอกชื่อรอบ วันที่เปิด และเลือกอย่างน้อย 1 ฟิลด์' });
  }

  const [result] = await pool.query(
    `INSERT INTO assessment_campaign
      (campaign_name, release_date, close_date, included_fields, status, created_by)
     VALUES (?, ?, ?, ?, 'DRAFT', ?)`,
    [campaignName, releaseDate, closeDate || null, JSON.stringify(includedFields), req.adminEmployeeId]
  );

  res.json({ message: 'สร้างรอบ follow-up สำเร็จ', campaignId: result.insertId });
});

app.post('/api/admin/campaigns/:id/open', requireAdmin, async (req, res) => {
  await pool.query(`UPDATE assessment_campaign SET status = 'OPEN' WHERE campaign_id = ?`, [req.params.id]);
  res.json({ message: 'เปิดรอบ follow-up แล้ว พนักงานจะเริ่มเห็นแบบฟอร์มนี้' });
});

app.post('/api/admin/campaigns/:id/close', requireAdmin, async (req, res) => {
  await pool.query(`UPDATE assessment_campaign SET status = 'CLOSED' WHERE campaign_id = ?`, [req.params.id]);
  res.json({ message: 'ปิดรอบ follow-up แล้ว' });
});

// ---- admin: ดูผลลัพธ์แบบสอบถามสุขภาพรายบุคคล (operational view ไม่ใช่รายงานสรุปสำหรับผู้บริหาร) ----
// รายชื่อพนักงานพร้อมค่าล่าสุดที่มี (แต่ละ metric ดึงจากแถวล่าสุดที่ "มีค่านั้น" ไม่ใช่แถวล่าสุดเฉยๆ
// เพราะ follow-up บางรอบอาจไม่ได้ถามทุกฟิลด์)
app.get('/api/admin/health-assessments', requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT
       e.employee_id, e.full_name, e.department, e.job_position,
       EXISTS(
         SELECT 1 FROM health_assessment ha
         WHERE ha.employee_id = e.employee_id AND ha.assessment_type = 'BASELINE'
       ) AS baseline_completed,
       (SELECT ha.weight_kg FROM health_assessment ha
         WHERE ha.employee_id = e.employee_id AND ha.weight_kg IS NOT NULL
         ORDER BY ha.created_at DESC LIMIT 1) AS latest_weight_kg,
       (SELECT ha.bmi FROM health_assessment ha
         WHERE ha.employee_id = e.employee_id AND ha.bmi IS NOT NULL
         ORDER BY ha.created_at DESC LIMIT 1) AS latest_bmi,
       (SELECT ha.met_minutes_per_week FROM health_assessment ha
         WHERE ha.employee_id = e.employee_id AND ha.met_minutes_per_week IS NOT NULL
         ORDER BY ha.created_at DESC LIMIT 1) AS latest_met_minutes_per_week,
       (SELECT COUNT(*) FROM health_assessment ha
         WHERE ha.employee_id = e.employee_id AND ha.assessment_type = 'FOLLOWUP') AS followup_count
     FROM employee e
     WHERE e.employment_status = 'ACTIVE'
     ORDER BY e.full_name`
  );
  res.json(rows);
});

// ทุกแถว (baseline + follow-up ทั้งหมด) ของพนักงานคนเดียว เรียงเก่า -> ใหม่ ใช้ทำกราฟ trend
app.get('/api/admin/health-assessments/:employeeId', requireAdmin, async (req, res) => {
  const [empRows] = await pool.query(
    `SELECT employee_id, full_name, department, job_position FROM employee WHERE employee_id = ?`,
    [req.params.employeeId]
  );
  if (empRows.length === 0) {
    return res.status(404).json({ message: 'ไม่พบข้อมูลพนักงาน' });
  }

  const [assessments] = await pool.query(
    `SELECT * FROM health_assessment WHERE employee_id = ? ORDER BY created_at ASC`,
    [req.params.employeeId]
  );

  res.json({ employee: empRows[0], assessments });
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

// พนักงานดูประวัติการส่งกิจกรรมของตัวเอง (ทุกสถานะ) พร้อมเหตุผลที่ถูกปฏิเสธถ้ามี
app.get('/api/my-submissions', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        rs.submission_id, rs.activity_id, at.activity_name, ac.category_name,
        rs.distance, rs.duration, rs.proof_image, rs.note,
        rs.status, rs.approved_at, rs.submitted_at,
        rr.reason_text AS reject_reason_text, rs.reject_reason_note
       FROM running_submission rs
       JOIN activity_type at ON at.activity_id = rs.activity_id
       JOIN activity_category ac ON ac.category_id = at.category_id
       LEFT JOIN reject_reason rr ON rr.reason_id = rs.reject_reason_id
       WHERE rs.employee_id = ?
       ORDER BY rs.submitted_at DESC`,
      [req.employeeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('get my submissions error:', err);
    res.status(500).json({ message: 'โหลดประวัติการส่งกิจกรรมไม่สำเร็จ' });
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

// ---- Phase 4: badge (employee view) ----
// แสดง badge ทั้งหมดที่พนักงานคนนี้ "มองเห็นได้" คือ badge ที่ ACTIVE อยู่ (ยังไม่ได้ก็โชว์แบบล็อกไว้)
// รวมกับ badge ที่เคยได้ไปแล้วทุกใบแม้แอดมินจะปิด (INACTIVE) ไปทีหลัง เพราะที่ได้แล้วต้องไม่หายไปจากหน้าคอลเลกชัน
app.get('/api/my-badges', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.badge_id, b.badge_name, b.description, b.icon, b.condition_type, b.condition_value,
              eb.received_at
       FROM badge b
       LEFT JOIN employee_badge eb ON eb.badge_id = b.badge_id AND eb.employee_id = ?
       WHERE b.status = 'ACTIVE' OR eb.employee_badge_id IS NOT NULL
       ORDER BY (eb.received_at IS NULL), eb.received_at DESC, b.badge_id ASC`,
      [req.employeeId]
    );

    res.json(
      rows.map((r) => ({
        badgeId: r.badge_id,
        badgeName: r.badge_name,
        description: r.description,
        icon: r.icon,
        conditionType: r.condition_type,
        conditionValue: r.condition_value,
        earned: r.received_at !== null,
        receivedAt: r.received_at,
      }))
    );
  } catch (err) {
    console.error('get my badges error:', err);
    res.status(500).json({ message: 'โหลดรายการ badge ไม่สำเร็จ' });
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
      secure: process.env.NODE_ENV === 'production', // ต้อง true เมื่อ deploy จริงผ่าน https
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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

// ---- Phase 5: dashboard สรุปภาพรวมสำหรับหน้าแรกของแอดมิน ----
// นับพนักงาน active, งานค้างตรวจ (submission/redeem ที่ PENDING), badge ทั้งหมด, challenge ที่กำลังดำเนินอยู่ตอนนี้
app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    // sync สถานะ challenge ตามวันที่ก่อน เพื่อให้ตัวเลข ONGOING ตรงกับความเป็นจริง ณ ตอนนี้
    await syncChallengeStatuses();

    const [employeeRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM employee WHERE employment_status = 'ACTIVE'`
    );
    const [pendingSubRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM running_submission WHERE status = 'PENDING'`
    );
    const [pendingRedeemRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM reward_redeem WHERE status = 'PENDING'`
    );
    const [badgeRows] = await pool.query(`SELECT COUNT(*) AS count FROM badge`);
    const [ongoingChallenges] = await pool.query(
      `SELECT
        c.challenge_id, c.challenge_name, c.start_date, c.end_date,
        ac.category_name,
        (SELECT COUNT(*) FROM challenge_participant cp WHERE cp.challenge_id = c.challenge_id) AS participant_count
       FROM challenge c
       JOIN activity_category ac ON ac.category_id = c.category_id
       WHERE c.status = 'ONGOING'
       ORDER BY c.end_date ASC`
    );

    res.json({
      activeEmployeeCount: employeeRows[0].count,
      pendingSubmissionCount: pendingSubRows[0].count,
      pendingRedeemCount: pendingRedeemRows[0].count,
      totalBadgeCount: badgeRows[0].count,
      ongoingChallengeCount: ongoingChallenges.length,
      ongoingChallenges,
    });
  } catch (err) {
    console.error('get admin dashboard error:', err);
    res.status(500).json({ message: 'โหลดข้อมูลแดชบอร์ดไม่สำเร็จ' });
  }
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

// ---- Phase 4: badge automation ----
// เช็คเงื่อนไข badge ที่ยัง ACTIVE และพนักงานคนนี้ยังไม่เคยได้ แล้วแจกให้อัตโนมัติถ้าเงื่อนไขผ่าน
// เรียกในทรานแซกชันเดียวกับตอน approve submission เพื่อให้ atomic กับคะแนน/ระยะทาง/จำนวนครั้งที่เพิ่งนับเข้าไป
// คืนค่าเป็น array ของ badge ที่เพิ่งได้รับใหม่รอบนี้เท่านั้น (badge เก่าที่เคยได้แล้วไม่ส่งกลับซ้ำ)
async function checkAndAwardBadges(connection, employeeId) {
  const [badges] = await connection.query(
    `SELECT b.badge_id, b.badge_name, b.description, b.icon, b.condition_type, b.condition_value
     FROM badge b
     WHERE b.status = 'ACTIVE'
       AND NOT EXISTS (
         SELECT 1 FROM employee_badge eb
         WHERE eb.badge_id = b.badge_id AND eb.employee_id = ?
       )`,
    [employeeId]
  );

  if (badges.length === 0) return [];

  // ข้อมูลสะสมของพนักงาน ใช้ร่วมกันได้ทุก badge ประเภท DISTANCE / SUBMISSION_COUNT / SCORE
  const [[cumRow]] = await connection.query(
    `SELECT COALESCE(SUM(distance), 0) AS total_distance, COUNT(*) AS total_submissions
     FROM running_submission WHERE employee_id = ? AND status = 'APPROVED'`,
    [employeeId]
  );
  const [[scoreRow]] = await connection.query(
    `SELECT COALESCE(SUM(score), 0) AS total_score
     FROM score_transaction WHERE employee_id = ? AND transaction_type = 'EARN'`,
    [employeeId]
  );

  const totalDistance = Number(cumRow.total_distance);
  const totalSubmissions = Number(cumRow.total_submissions);
  const totalScore = Number(scoreRow.total_score);

  // STREAK_DAYS: หาช่วงวันติดกันที่ยาวที่สุดเท่าที่เคยทำได้ (นับวันที่มี submission APPROVED อย่างน้อย 1 ครั้ง/วัน)
  let longestStreak = 0;
  const needsStreak = badges.some((b) => b.condition_type === 'STREAK_DAYS');
  if (needsStreak) {
    const [dateRows] = await connection.query(
      `SELECT DISTINCT DATE(submitted_at) AS d
       FROM running_submission WHERE employee_id = ? AND status = 'APPROVED'
       ORDER BY d ASC`,
      [employeeId]
    );

    let current = 0;
    let prevTime = null;
    for (const row of dateRows) {
      const dayTime = new Date(row.d).getTime();
      current = prevTime !== null && dayTime - prevTime === 24 * 60 * 60 * 1000 ? current + 1 : 1;
      longestStreak = Math.max(longestStreak, current);
      prevTime = dayTime;
    }
  }

  const conditionCheckers = {
    DISTANCE: () => totalDistance,
    SUBMISSION_COUNT: () => totalSubmissions,
    SCORE: () => totalScore,
    STREAK_DAYS: () => longestStreak,
  };

  const newlyAwarded = [];

  for (const badge of badges) {
    const getValue = conditionCheckers[badge.condition_type];
    const achieved = getValue ? getValue() >= badge.condition_value : false;

    if (achieved) {
      // INSERT IGNORE กัน race condition ซ้ำ (uq_employee_badge)
      const [result] = await connection.query(
        `INSERT IGNORE INTO employee_badge (employee_id, badge_id) VALUES (?, ?)`,
        [employeeId, badge.badge_id]
      );
      if (result.affectedRows > 0) {
        newlyAwarded.push({
          badgeId: badge.badge_id,
          badgeName: badge.badge_name,
          description: badge.description,
          icon: badge.icon,
        });
      }
    }
  }

  return newlyAwarded;
}

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

    // Phase 4: เช็คแล้วแจก badge อัตโนมัติถ้าคะแนน/ระยะทาง/จำนวนครั้ง/streak ที่เพิ่งอัปเดตทำให้ผ่านเงื่อนไขแล้ว
    const newBadges = await checkAndAwardBadges(connection, submission.employee_id);

    await connection.commit();
    res.json({
      submissionId: Number(submissionId),
      status: 'APPROVED',
      scoreAwarded: submission.score,
      newBadges,
    });
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

  const start = parseThaiLocalDateTime(startDate);
  const end = parseThaiLocalDateTime(endDate);
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

// ผู้เข้าร่วม challenge หนึ่งๆ พร้อมระยะทางสะสม/จำนวนครั้ง เรียงจากระยะทางมาก-น้อย (เหมือน leaderboard ฝั่งพนักงาน)
// ฝั่งแอดมินเห็นชื่อจริงของทุกคนเสมอ แม้จะเลือก join_mode = ANONYMOUS ไว้ก็ตาม (การซ่อนชื่อมีผลแค่ฝั่งพนักงานด้วยกัน)
app.get('/api/admin/challenges/:id/participants', requireAdmin, async (req, res) => {
  const challengeId = req.params.id;

  try {
    const [challengeRows] = await pool.query(
      `SELECT challenge_id, challenge_name FROM challenge WHERE challenge_id = ?`,
      [challengeId]
    );
    if (challengeRows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบ challenge นี้' });
    }

    const [rows] = await pool.query(
      `SELECT
        cp.participant_id, cp.employee_id, cp.join_mode, cp.joined_at,
        e.full_name, e.department,
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

    const participants = rows.map((r, index) => ({
      rank: index + 1,
      participantId: r.participant_id,
      employeeId: r.employee_id,
      fullName: r.full_name,
      department: r.department,
      joinMode: r.join_mode,
      joinedAt: r.joined_at,
      totalDistance: r.total_distance,
      runCount: r.run_count,
    }));

    res.json({
      challengeId: challengeRows[0].challenge_id,
      challengeName: challengeRows[0].challenge_name,
      participants,
    });
  } catch (err) {
    console.error('get admin challenge participants error:', err);
    res.status(500).json({ message: 'โหลดรายชื่อผู้เข้าร่วมไม่สำเร็จ' });
  }
});

// ---- Phase 4: badge (admin CRUD) ----
const BADGE_CONDITION_TYPES = ['DISTANCE', 'SUBMISSION_COUNT', 'SCORE', 'STREAK_DAYS'];

// รายการ badge ทั้งหมดทุกสถานะ พร้อมจำนวนคนที่เคยได้ (ไว้เตือนแอดมินก่อนจะปิด/แก้เงื่อนไข)
app.get('/api/admin/badges', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.badge_id, b.badge_name, b.description, b.icon, b.condition_type, b.condition_value, b.status,
              COUNT(eb.employee_badge_id) AS earned_count
       FROM badge b
       LEFT JOIN employee_badge eb ON eb.badge_id = b.badge_id
       GROUP BY b.badge_id
       ORDER BY b.badge_id ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('get admin badges error:', err);
    res.status(500).json({ message: 'โหลดรายการ badge ไม่สำเร็จ' });
  }
});

function validateBadgeInput(body) {
  const { badgeName, conditionType, conditionValue } = body;
  if (!badgeName || !String(badgeName).trim()) {
    return 'กรุณากรอกชื่อ badge';
  }
  if (!BADGE_CONDITION_TYPES.includes(conditionType)) {
    return `ประเภทเงื่อนไขต้องเป็นหนึ่งใน ${BADGE_CONDITION_TYPES.join(', ')}`;
  }
  if (!Number.isFinite(Number(conditionValue)) || Number(conditionValue) <= 0) {
    return 'ค่าเงื่อนไขต้องเป็นตัวเลขมากกว่า 0';
  }
  return null;
}

// สร้าง badge ใหม่ — รับไฟล์ไอคอนที่แอดมินวาด/ดีไซน์เองผ่าน field 'iconFile' (multipart/form-data)
app.post('/api/admin/badges', requireAdmin, handleBadgeIconUpload, async (req, res) => {
  const cleanupUploadedFile = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  const { badgeName, description, conditionType, conditionValue } = req.body;
  const validationError = validateBadgeInput(req.body);
  if (validationError) {
    cleanupUploadedFile();
    return res.status(400).json({ message: validationError });
  }

  const iconPath = req.file ? path.posix.join('uploads', 'badges', req.file.filename) : null;

  try {
    const [result] = await pool.query(
      `INSERT INTO badge (badge_name, description, icon, condition_type, condition_value)
       VALUES (?, ?, ?, ?, ?)`,
      [badgeName.trim(), description || null, iconPath, conditionType, conditionValue]
    );
    res.status(201).json({ badgeId: result.insertId, icon: iconPath });
  } catch (err) {
    cleanupUploadedFile();
    console.error('create badge error:', err);
    res.status(500).json({ message: 'สร้าง badge ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// แก้ไข badge ที่มีอยู่ (ชื่อ/คำอธิบาย/ไอคอน/เงื่อนไข/สถานะ ACTIVE-INACTIVE)
// เปลี่ยนไอคอนได้ทีหลังเสมอ: ส่งไฟล์ใหม่มาใน 'iconFile' เพื่อแทนที่รูปเดิม หรือส่ง removeIcon=true เพื่อลบรูปออก (ไม่ส่งอะไรเลย = รูปเดิมยังอยู่)
// หมายเหตุ: แก้ condition_type/condition_value ของ badge ที่มีคนได้ไปแล้วจะไม่กระทบคนที่ได้ไปแล้ว (employee_badge ไม่ผูกค่า ณ ตอนนั้นไว้)
app.put('/api/admin/badges/:id', requireAdmin, handleBadgeIconUpload, async (req, res) => {
  const badgeId = req.params.id;
  const cleanupUploadedFile = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  const { badgeName, description, conditionType, conditionValue, status, removeIcon } = req.body;
  const validationError = validateBadgeInput(req.body);
  if (validationError) {
    cleanupUploadedFile();
    return res.status(400).json({ message: validationError });
  }
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    cleanupUploadedFile();
    return res.status(400).json({ message: 'สถานะต้องเป็น ACTIVE หรือ INACTIVE' });
  }

  try {
    const [existingRows] = await pool.query('SELECT icon FROM badge WHERE badge_id = ?', [badgeId]);
    if (existingRows.length === 0) {
      cleanupUploadedFile();
      return res.status(404).json({ message: 'ไม่พบ badge นี้' });
    }
    const oldIcon = existingRows[0].icon;

    // ลำดับความสำคัญ: มีไฟล์ใหม่ > สั่งลบ (removeIcon) > คงรูปเดิมไว้
    let newIcon = oldIcon;
    if (req.file) {
      newIcon = path.posix.join('uploads', 'badges', req.file.filename);
    } else if (removeIcon === 'true' || removeIcon === true) {
      newIcon = null;
    }

    await pool.query(
      `UPDATE badge
       SET badge_name = ?, description = ?, icon = ?, condition_type = ?, condition_value = ?, status = ?
       WHERE badge_id = ?`,
      [badgeName.trim(), description || null, newIcon, conditionType, conditionValue, status, badgeId]
    );

    // ลบไฟล์ไอคอนเก่าทิ้งถ้าถูกแทนที่/ลบไป และเป็นไฟล์ที่อัปโหลดไว้เอง (ไม่แตะถ้าเป็น URL ภายนอก) กันไฟล์ขยะสะสมบน disk
    if (oldIcon && oldIcon !== newIcon && oldIcon.startsWith('uploads/badges/')) {
      fs.unlink(path.join(__dirname, oldIcon), () => {});
    }

    res.json({ badgeId: Number(badgeId), status, icon: newIcon });
  } catch (err) {
    cleanupUploadedFile();
    console.error('update badge error:', err);
    res.status(500).json({ message: 'แก้ไข badge ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// ---- Phase 5: activity-category (admin CRUD) ----

// รายการหมวดหมู่กิจกรรมทั้งหมดทุกสถานะ พร้อมจำนวนประเภทกิจกรรมย่อยที่ผูกอยู่ (เตือนแอดมินก่อนปิดใช้งาน)
app.get('/api/admin/categories', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ac.category_id, ac.category_name, ac.status,
              COUNT(at.activity_id) AS activity_type_count
       FROM activity_category ac
       LEFT JOIN activity_type at ON at.category_id = ac.category_id
       GROUP BY ac.category_id
       ORDER BY ac.category_id ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('get admin categories error:', err);
    res.status(500).json({ message: 'โหลดรายการหมวดหมู่กิจกรรมไม่สำเร็จ' });
  }
});

function validateCategoryInput(body) {
  const { categoryName } = body;
  if (!categoryName || !String(categoryName).trim()) {
    return 'กรุณากรอกชื่อหมวดหมู่';
  }
  return null;
}

// สร้างหมวดหมู่กิจกรรมใหม่ (ค่าเริ่มต้น status = ACTIVE ตาม schema)
app.post('/api/admin/categories', requireAdmin, async (req, res) => {
  const validationError = validateCategoryInput(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }
  const { categoryName } = req.body;

  try {
    const [result] = await pool.query(`INSERT INTO activity_category (category_name) VALUES (?)`, [
      categoryName.trim(),
    ]);
    res.status(201).json({ categoryId: result.insertId });
  } catch (err) {
    console.error('create category error:', err);
    res.status(500).json({ message: 'สร้างหมวดหมู่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// แก้ไขหมวดหมู่ (ชื่อ/สถานะ) — ไม่มีปุ่มลบเพราะมีประเภทกิจกรรมย่อย/challenge ผูกอยู่ ใช้ INACTIVE แทนเสมอ
app.put('/api/admin/categories/:id', requireAdmin, async (req, res) => {
  const categoryId = req.params.id;
  const validationError = validateCategoryInput(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }
  const { categoryName, status } = req.body;
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ message: 'สถานะต้องเป็น ACTIVE หรือ INACTIVE' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE activity_category SET category_name = ?, status = ? WHERE category_id = ?`,
      [categoryName.trim(), status, categoryId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'ไม่พบหมวดหมู่นี้' });
    }
    res.json({ categoryId: Number(categoryId), status });
  } catch (err) {
    console.error('update category error:', err);
    res.status(500).json({ message: 'แก้ไขหมวดหมู่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// ---- Phase 5: activity-type (admin CRUD) ----

// รายการประเภทกิจกรรมย่อยทั้งหมดทุกสถานะ พร้อมจำนวนครั้งที่เคยถูกส่ง (เตือนแอดมินก่อนปิดใช้งาน/แก้คะแนน)
app.get('/api/admin/activity-types', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT at.activity_id, at.activity_name, at.score, at.require_image, at.description, at.status,
              ac.category_id, ac.category_name,
              (SELECT COUNT(*) FROM running_submission rs WHERE rs.activity_id = at.activity_id) AS submission_count
       FROM activity_type at
       JOIN activity_category ac ON ac.category_id = at.category_id
       ORDER BY ac.category_name, at.activity_name`
    );
    res.json(rows);
  } catch (err) {
    console.error('get admin activity types error:', err);
    res.status(500).json({ message: 'โหลดรายการประเภทกิจกรรมไม่สำเร็จ' });
  }
});

function validateActivityTypeInput(body) {
  const { categoryId, activityName, score } = body;
  if (!categoryId) {
    return 'กรุณาเลือกหมวดหมู่';
  }
  if (!activityName || !String(activityName).trim()) {
    return 'กรุณากรอกชื่อกิจกรรม';
  }
  if (!Number.isFinite(Number(score)) || Number(score) < 0) {
    return 'คะแนนต้องเป็นตัวเลขไม่ติดลบ';
  }
  return null;
}

// สร้างประเภทกิจกรรมย่อยใหม่ — ต้องผูกกับหมวดหมู่ที่ยัง ACTIVE เท่านั้น
app.post('/api/admin/activity-types', requireAdmin, async (req, res) => {
  const validationError = validateActivityTypeInput(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }
  const { categoryId, activityName, score, requireImage, description } = req.body;

  try {
    const [categoryRows] = await pool.query(
      `SELECT category_id FROM activity_category WHERE category_id = ? AND status = 'ACTIVE'`,
      [categoryId]
    );
    if (categoryRows.length === 0) {
      return res.status(400).json({ message: 'ไม่พบหมวดหมู่นี้ หรือถูกปิดใช้งานแล้ว' });
    }

    const [result] = await pool.query(
      `INSERT INTO activity_type (category_id, activity_name, score, require_image, description)
       VALUES (?, ?, ?, ?, ?)`,
      [
        categoryId,
        activityName.trim(),
        score,
        requireImage === true || requireImage === 'true' ? 1 : 0,
        description ? description.trim() : null,
      ]
    );
    res.status(201).json({ activityId: result.insertId });
  } catch (err) {
    console.error('create activity type error:', err);
    res.status(500).json({ message: 'สร้างประเภทกิจกรรมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// แก้ไขประเภทกิจกรรมย่อย (ชื่อ/คะแนน/บังคับรูป/หมวดหมู่/สถานะ)
// หมายเหตุ: แก้ score ของกิจกรรมที่มีคนส่งไปแล้วจะไม่กระทบคะแนนที่อนุมัติไปแล้ว (running_submission ไม่ snapshot score ไว้ ใช้ activity_type.score ปัจจุบัน ณ ตอน approve เท่านั้น)
app.put('/api/admin/activity-types/:id', requireAdmin, async (req, res) => {
  const activityId = req.params.id;
  const validationError = validateActivityTypeInput(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }
  const { categoryId, activityName, score, requireImage, description, status } = req.body;
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ message: 'สถานะต้องเป็น ACTIVE หรือ INACTIVE' });
  }

  try {
    const [categoryRows] = await pool.query(`SELECT category_id FROM activity_category WHERE category_id = ?`, [
      categoryId,
    ]);
    if (categoryRows.length === 0) {
      return res.status(400).json({ message: 'ไม่พบหมวดหมู่นี้' });
    }

    const [result] = await pool.query(
      `UPDATE activity_type
       SET category_id = ?, activity_name = ?, score = ?, require_image = ?, description = ?, status = ?
       WHERE activity_id = ?`,
      [
        categoryId,
        activityName.trim(),
        score,
        requireImage === true || requireImage === 'true' ? 1 : 0,
        description ? description.trim() : null,
        status,
        activityId,
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'ไม่พบประเภทกิจกรรมนี้' });
    }
    res.json({ activityId: Number(activityId), status });
  } catch (err) {
    console.error('update activity type error:', err);
    res.status(500).json({ message: 'แก้ไขประเภทกิจกรรมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// ---- Phase 5: reward (admin CRUD) ----

// รายการของรางวัลทั้งหมดทุกสถานะ พร้อมจำนวนครั้งที่เคยถูกแลก (เตือนแอดมินก่อนปิดใช้งาน)
app.get('/api/admin/rewards', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.reward_id, r.reward_name, r.required_score, r.stock, r.image, r.description, r.status,
              (SELECT COUNT(*) FROM reward_redeem rr WHERE rr.reward_id = r.reward_id) AS redeem_count
       FROM reward r
       ORDER BY r.reward_id ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('get admin rewards error:', err);
    res.status(500).json({ message: 'โหลดรายการของรางวัลไม่สำเร็จ' });
  }
});

function validateRewardInput(body) {
  const { rewardName, requiredScore, stock } = body;
  if (!rewardName || !String(rewardName).trim()) {
    return 'กรุณากรอกชื่อของรางวัล';
  }
  if (!Number.isFinite(Number(requiredScore)) || Number(requiredScore) <= 0) {
    return 'คะแนนที่ใช้แลกต้องเป็นตัวเลขมากกว่า 0';
  }
  if (!Number.isFinite(Number(stock)) || Number(stock) < 0) {
    return 'จำนวนคงเหลือต้องเป็นตัวเลขไม่ติดลบ';
  }
  return null;
}

// สร้างของรางวัลใหม่ — รับไฟล์รูปผ่าน field 'imageFile' (multipart/form-data) เหมือนแนวทาง badge icon
app.post('/api/admin/rewards', requireAdmin, handleRewardImageUpload, async (req, res) => {
  const cleanupUploadedFile = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  const { rewardName, requiredScore, stock, description } = req.body;
  const validationError = validateRewardInput(req.body);
  if (validationError) {
    cleanupUploadedFile();
    return res.status(400).json({ message: validationError });
  }

  const imagePath = req.file ? path.posix.join('uploads', 'rewards', req.file.filename) : null;

  try {
    const [result] = await pool.query(
      `INSERT INTO reward (reward_name, required_score, stock, image, description)
       VALUES (?, ?, ?, ?, ?)`,
      [rewardName.trim(), requiredScore, stock, imagePath, description ? description.trim() : null]
    );
    res.status(201).json({ rewardId: result.insertId, image: imagePath });
  } catch (err) {
    cleanupUploadedFile();
    console.error('create reward error:', err);
    res.status(500).json({ message: 'สร้างของรางวัลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// แก้ไขของรางวัล (ชื่อ/คะแนนที่ใช้แลก/จำนวนคงเหลือ/รูป/คำอธิบาย/สถานะ)
// เปลี่ยนรูปได้ทีหลังเสมอ: ส่งไฟล์ใหม่มาใน 'imageFile' เพื่อแทนที่รูปเดิม หรือส่ง removeImage=true เพื่อลบรูปออก (ไม่ส่งอะไรเลย = รูปเดิมยังอยู่)
// หมายเหตุ: แก้ stock ตรงนี้เป็นการ set ค่าตรงๆ แอดมินต้องเผื่อ stock ที่ถูกจองไว้จาก redeem สถานะ PENDING เอง
app.put('/api/admin/rewards/:id', requireAdmin, handleRewardImageUpload, async (req, res) => {
  const rewardId = req.params.id;
  const cleanupUploadedFile = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  const { rewardName, requiredScore, stock, description, status, removeImage } = req.body;
  const validationError = validateRewardInput(req.body);
  if (validationError) {
    cleanupUploadedFile();
    return res.status(400).json({ message: validationError });
  }
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    cleanupUploadedFile();
    return res.status(400).json({ message: 'สถานะต้องเป็น ACTIVE หรือ INACTIVE' });
  }

  try {
    const [existingRows] = await pool.query('SELECT image FROM reward WHERE reward_id = ?', [rewardId]);
    if (existingRows.length === 0) {
      cleanupUploadedFile();
      return res.status(404).json({ message: 'ไม่พบของรางวัลนี้' });
    }
    const oldImage = existingRows[0].image;

    // ลำดับความสำคัญ: มีไฟล์ใหม่ > สั่งลบ (removeImage) > คงรูปเดิมไว้
    let newImage = oldImage;
    if (req.file) {
      newImage = path.posix.join('uploads', 'rewards', req.file.filename);
    } else if (removeImage === 'true' || removeImage === true) {
      newImage = null;
    }

    await pool.query(
      `UPDATE reward
       SET reward_name = ?, required_score = ?, stock = ?, image = ?, description = ?, status = ?
       WHERE reward_id = ?`,
      [rewardName.trim(), requiredScore, stock, newImage, description ? description.trim() : null, status, rewardId]
    );

    // ลบไฟล์รูปเก่าทิ้งถ้าถูกแทนที่/ลบไป กันไฟล์ขยะสะสมบน disk
    if (oldImage && oldImage !== newImage && oldImage.startsWith('uploads/rewards/')) {
      fs.unlink(path.join(__dirname, oldImage), () => {});
    }

    res.json({ rewardId: Number(rewardId), status, image: newImage });
  } catch (err) {
    cleanupUploadedFile();
    console.error('update reward error:', err);
    res.status(500).json({ message: 'แก้ไขของรางวัลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

// ---- Phase 5: จัดการสิทธิ์แอดมิน (grant/revoke ผ่านหน้าเว็บ แทนการรัน seed-admin.js) ----

app.get('/api/admin/admins', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.employee_id, e.full_name, e.department, ac.created_at
       FROM employee e
       JOIN admin_credential ac ON ac.employee_id = e.employee_id
       ORDER BY ac.created_at ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('list admins error:', err);
    res.status(500).json({ message: 'โหลดรายชื่อแอดมินไม่สำเร็จ' });
  }
});

app.post('/api/admin/admins', requireAdmin, async (req, res) => {
  const { employeeId, password } = req.body;

  if (!employeeId || !password) {
    return res.status(400).json({ message: 'กรุณากรอกรหัสพนักงานและรหัสผ่าน' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'รหัสผ่านควรยาวอย่างน้อย 8 ตัวอักษร' });
  }

  try {
    const [empRows] = await pool.query(
      'SELECT employee_id FROM employee WHERE employee_id = ?',
      [employeeId]
    );
    if (empRows.length === 0) {
      return res.status(404).json({ message: `ไม่พบ employee_id "${employeeId}" ในตาราง employee` });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(`UPDATE employee SET role = 'ADMIN' WHERE employee_id = ?`, [employeeId]);
    await pool.query(
      `INSERT INTO admin_credential (employee_id, password_hash)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [employeeId, passwordHash]
    );

    res.json({ employeeId, role: 'ADMIN' });
  } catch (err) {
    console.error('grant admin error:', err);
    res.status(500).json({ message: 'ตั้งค่าแอดมินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
});

app.post('/api/admin/admins/:employeeId/revoke', requireAdmin, async (req, res) => {
  const { employeeId } = req.params;

  // กันถอดสิทธิ์ตัวเอง เพื่อไม่ให้เหลือแอดมิน 0 คนที่เข้าหน้านี้ได้
  if (employeeId === req.adminEmployeeId) {
    return res.status(400).json({ message: 'ไม่สามารถถอดสิทธิ์ตัวเองได้' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE employee SET role = 'EMPLOYEE' WHERE employee_id = ? AND role = 'ADMIN'`,
      [employeeId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'ไม่พบแอดมินคนนี้' });
    }

    await pool.query('DELETE FROM admin_credential WHERE employee_id = ?', [employeeId]);

    res.json({ employeeId, role: 'EMPLOYEE' });
  } catch (err) {
    console.error('revoke admin error:', err);
    res.status(500).json({ message: 'ถอดสิทธิ์แอดมินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
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

      // เช็คว่ากรอกแบบสอบถาม baseline สุขภาพไปแล้วหรือยัง (ต้องทำครั้งเดียวก่อนใช้แอปจริง)
      const [assessmentRows] = await pool.query(
        `SELECT assessment_id FROM health_assessment WHERE employee_id = ? AND assessment_type = 'BASELINE'`,
        [account.employee_id]
      );

      issueSessionCookie(res, account.employee_id);
      return res.json({
        linked: true,
        employeeId: account.employee_id,
        displayName,
        needsHealthAssessment: assessmentRows.length === 0,
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

    // 3.5 กันผูกซ้ำ: employee_id นี้เคยมี LINE บัญชีที่ ACTIVE ผูกอยู่แล้วหรือยัง
    const [dupRows] = await pool.query(
      `SELECT account_id FROM employee_account
       WHERE employee_id = ? AND provider = 'LINE' AND status = 'ACTIVE'`,
      [employeeId]
    );

    if (dupRows.length > 0) {
      return res.status(409).json({
        message: 'รหัสพนักงานนี้เชื่อมบัญชี LINE ไว้แล้ว กรุณาเข้าสู่ระบบด้วย LINE บัญชีเดิมที่เคยผูกไว้ หากเข้าไม่ได้ ติดต่อแอดมิน',
        code: 'ALREADY_LINKED',
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
    res.json({ linked: true, employeeId, displayName, needsHealthAssessment: true });
  } catch (err) {
    console.error('line-login error:', err);
    res.status(500).json({ message: 'internal error' });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`server running on port ${process.env.PORT}`);
});