// สร้าง/ล้างฐานข้อมูลทดสอบแล้วใส่ข้อมูลตัวอย่าง (ข้อมูลสมมติทั้งหมด ไม่มีข้อมูลพนักงานจริง)
// ใช้: node db/seed.js            → ล้างตาราง + ใส่ข้อมูลใหม่ (สร้าง schema ให้ถ้ายังไม่มี)
//      node db/seed.js --recreate → DROP แล้วสร้าง schema ใหม่จาก wellness.sql ก่อน
const fs = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { DB, SCHEMA_FILE, ADMIN } = require('../test-env');

// กันพลาดชี้ไปฐานข้อมูลจริง: อนุญาตเฉพาะเครื่องตัวเอง
function assertLocalDb() {
  if (!['127.0.0.1', 'localhost', '::1'].includes(DB.host)) {
    throw new Error(`seed ใช้ได้กับฐานข้อมูลบนเครื่องนี้เท่านั้น (ได้ host=${DB.host})`);
  }
}

async function connect(withDatabase) {
  return mysql.createConnection({
    host: DB.host,
    port: DB.port,
    user: DB.user,
    password: DB.password,
    ...(withDatabase && { database: DB.database }),
    multipleStatements: true,
    timezone: '+07:00',
  });
}

// wellness.sql มาจาก MySQL Workbench และใช้ DELIMITER $$ กับ trigger ซึ่ง mysql2 ไม่รู้จัก
async function loadSchema(conn) {
  const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const [main, rest = ''] = sql.split(/^DELIMITER \$\$\s*$/m);
  await conn.query(main);
  const [triggerBlock, tail = ''] = rest.split(/^DELIMITER ;\s*$/m);
  for (const stmt of triggerBlock.split('$$').map((s) => s.trim()).filter(Boolean)) {
    await conn.query(stmt);
  }
  if (tail.trim()) await conn.query(tail);
}

async function ensureSchema(recreate) {
  const conn = await connect(false);
  try {
    if (recreate) await conn.query(`DROP DATABASE IF EXISTS \`${DB.database}\``);
    const [rows] = await conn.query(
      'SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      [DB.database]
    );
    if (rows[0].n === 0) await loadSchema(conn);
  } finally {
    await conn.end();
  }
}

const JSON_COLS = (v) => JSON.stringify(v);

async function insertFixtures(conn) {
  const adminHash = await bcrypt.hash(ADMIN.password, 4);
  const nationalIdHash = await bcrypt.hash('1100100100101', 4);

  await conn.query(
    `INSERT INTO employee (employee_id, full_name, department, job_position, years_of_service, years_of_service_as_of,
       shift_type, date_of_birth, employment_status, role, national_id_hash) VALUES ?`,
    [[
      ['EMP0001', 'ผู้ดูแล ระบบทดสอบ', 'นักวิชาการคอมพิวเตอร์', 'สายสนับสนุน', 5, '2026-01-15', 'DAY', '1985-03-02', 'ACTIVE', 'ADMIN', null],
      ['EMP0002', 'สมชาย ใจดี', 'พยาบาลวิชาชีพ', 'สายวิชาชีพ', 3.5, '2026-09-01', 'SHIFT', '1990-07-12', 'ACTIVE', 'EMPLOYEE', null],
      ['EMP0003', 'สมหญิง รักวิ่ง', 'เภสัชกร', 'สายวิชาชีพ', 8, '2026-09-01', 'DAY', '1988-11-30', 'ACTIVE', 'EMPLOYEE', null],
      ['EMP0004', 'วิชัย ขยันเดิน', 'พนักงานบริการ', 'สายสนับสนุน', null, null, null, '1995-01-20', 'ACTIVE', 'EMPLOYEE', nationalIdHash],
      ['EMP0005', 'มานี ลาออกแล้ว', 'ผู้ช่วยพยาบาล', 'สายสนับสนุน', 2, '2025-06-01', 'SHIFT', '1993-05-05', 'RESIGNED', 'EMPLOYEE', null],
    ]]
  );
  await conn.query('INSERT INTO admin_credential (employee_id, password_hash, created_at) VALUES (?, ?, ?)', [
    ADMIN.employeeId, adminHash, '2026-08-01 09:00:00',
  ]);
  await conn.query(
    `INSERT INTO employee_account (employee_id, provider, provider_user_id, display_name, linked_at, last_login, status) VALUES ?`,
    [[
      ['EMP0002', 'LINE', 'U-e2e-somchai', 'สมชาย (LINE)', '2026-09-01 08:00:00', '2026-11-01 08:00:00', 'ACTIVE'],
      ['EMP0003', 'LINE', 'U-e2e-somying', 'สมหญิง (LINE)', '2026-09-01 08:00:00', '2026-11-01 08:00:00', 'ACTIVE'],
    ]]
  );

  await conn.query(
    'INSERT INTO activity_category (category_id, category_name, status) VALUES ?',
    [[[1, 'วิ่ง', 'ACTIVE'], [2, 'เดิน', 'ACTIVE'], [3, 'ว่ายน้ำ', 'INACTIVE']]]
  );
  await conn.query(
    'INSERT INTO activity_type (activity_id, category_id, activity_name, score, require_image, description, status) VALUES ?',
    [[
      [1, 1, 'วิ่ง 5 กม.', 10, 0, 'วิ่งต่อเนื่องอย่างน้อย 5 กิโลเมตร', 'ACTIVE'],
      [2, 2, 'เดินเร็ว 30 นาที', 5, 1, null, 'ACTIVE'],
      [3, 3, 'ว่ายน้ำ 20 รอบ', 8, 1, null, 'INACTIVE'],
    ]]
  );
  await conn.query(
    'INSERT INTO reject_reason (reason_id, reason_text, is_other, status) VALUES ?',
    [[[1, 'รูปหลักฐานไม่ชัดเจน', 0, 'ACTIVE'], [2, 'ข้อมูลไม่ตรงกับรูป', 0, 'ACTIVE'], [3, 'อื่นๆ (โปรดระบุ)', 1, 'ACTIVE']]]
  );

  await conn.query(
    `INSERT INTO running_submission (submission_id, employee_id, activity_id, distance, duration, proof_image, note,
       reject_reason_id, reject_reason_note, status, approved_by, approved_at, submitted_at) VALUES ?`,
    [[
      [1, 'EMP0002', 1, 5.2, 32, null, 'วิ่งรอบสวน', null, null, 'APPROVED', 'EMP0001', '2026-10-02 10:00:00', '2026-10-02 07:10:00'],
      [2, 'EMP0002', 1, 6.0, 40, null, null, null, null, 'PENDING', null, null, '2026-11-01 06:30:00'],
      [3, 'EMP0002', 2, null, 30, null, null, 1, null, 'REJECTED', 'EMP0001', '2026-10-05 12:00:00', '2026-10-05 18:00:00'],
      [4, 'EMP0003', 1, 5.5, 35, null, 'วิ่งเช้า', null, null, 'PENDING', null, null, '2026-11-02 05:45:00'],
      [5, 'EMP0003', 1, 10.0, 65, null, null, null, null, 'APPROVED', 'EMP0001', '2026-10-10 10:00:00', '2026-10-10 06:00:00'],
    ]]
  );

  await conn.query(
    'INSERT INTO reward (reward_id, reward_name, required_score, stock, image, description, status) VALUES ?',
    [[
      [1, 'กระบอกน้ำ', 50, 10, null, 'กระบอกน้ำเก็บความเย็น 600 มล.', 'ACTIVE'],
      [2, 'เสื้อวิ่ง', 300, 2, null, null, 'ACTIVE'],
      [3, 'หมวกวิ่ง', 100, 0, null, null, 'INACTIVE'],
    ]]
  );
  await conn.query(
    'INSERT INTO reward_redeem (redeem_id, employee_id, reward_id, used_score, status, redeem_date) VALUES ?',
    [[
      [1, 'EMP0002', 1, 50, 'APPROVED', '2026-10-03 12:00:00'],
      [2, 'EMP0003', 1, 50, 'PENDING', '2026-11-02 12:00:00'],
    ]]
  );
  await conn.query(
    `INSERT INTO score_transaction (submission_id, redeem_id, employee_id, score, transaction_type, remark, created_by, created_at) VALUES ?`,
    [[
      [1, null, 'EMP0002', 10, 'EARN', null, 'EMP0001', '2026-10-02 10:00:00'],
      [null, null, 'EMP0002', 200, 'ADJUST', 'คะแนนตั้งต้นสำหรับทดสอบ', 'EMP0001', '2026-10-01 09:00:00'],
      [null, 1, 'EMP0002', -50, 'REDEEM', null, null, '2026-10-03 12:00:00'],
      [5, null, 'EMP0003', 10, 'EARN', null, 'EMP0001', '2026-10-10 10:00:00'],
      [null, null, 'EMP0003', 100, 'ADJUST', 'คะแนนตั้งต้นสำหรับทดสอบ', 'EMP0001', '2026-10-01 09:00:00'],
      [null, 2, 'EMP0003', -50, 'REDEEM', null, null, '2026-11-02 12:00:00'],
    ]]
  );

  await conn.query(
    'INSERT INTO badge (badge_id, badge_name, description, icon, condition_type, condition_value, status) VALUES ?',
    [[
      [1, 'ก้าวแรก', 'ส่งกิจกรรมผ่านการอนุมัติครั้งแรก', null, 'SUBMISSION_COUNT', 1, 'ACTIVE'],
      [2, 'นักวิ่ง 10K', 'ระยะทางสะสมครบ 10 กม.', null, 'DISTANCE', 10, 'ACTIVE'],
      [3, 'สะสม 500 คะแนน', null, null, 'SCORE', 500, 'INACTIVE'],
    ]]
  );
  await conn.query('INSERT INTO employee_badge (employee_id, badge_id, received_at) VALUES ?', [[
    ['EMP0002', 1, '2026-10-02 10:00:00'],
    ['EMP0003', 1, '2026-10-10 10:00:00'],
    ['EMP0003', 2, '2026-10-10 10:00:00'],
  ]]);

  await conn.query(
    'INSERT INTO challenge (challenge_id, category_id, challenge_name, description, ranking_type, start_date, end_date, status) VALUES ?',
    [[
      [1, 1, 'ชาเลนจ์วิ่งสู้ฝน', 'สะสมระยะวิ่งให้ได้มากที่สุด', 'DISTANCE', '2026-10-01 00:00:00', '2026-12-31 23:59:00', 'ONGOING'],
      [2, 1, 'ชาเลนจ์ปีใหม่', null, 'DISTANCE', '2027-01-01 06:00:00', '2027-01-31 23:59:00', 'UPCOMING'],
      [3, 2, 'ชาเลนจ์เดินกันยา', null, 'DISTANCE', '2026-09-01 00:00:00', '2026-09-30 23:59:00', 'ENDED'],
    ]]
  );
  await conn.query(
    'INSERT INTO challenge_participant (participant_id, challenge_id, employee_id, join_mode, display_alias, joined_at) VALUES ?',
    [[
      [1, 1, 'EMP0002', 'PUBLIC', null, '2026-10-01 08:00:00'],
      [2, 1, 'EMP0003', 'ANONYMOUS', 'นักวิ่งเงา', '2026-10-01 09:00:00'],
    ]]
  );
  await conn.query('INSERT INTO challenge_submission (participant_id, submission_id, added_at) VALUES ?', [[
    [1, 1, '2026-10-02 10:00:00'],
    [2, 5, '2026-10-10 10:00:00'],
  ]]);

  await conn.query(
    'INSERT INTO assessment_campaign (campaign_id, campaign_name, release_date, close_date, included_fields, status, created_by, created_at) VALUES ?',
    [[
      [1, 'ติดตามผล 8 สัปดาห์ รอบที่ 1', '2026-10-15', null, JSON_COLS(['weightKg', 'heightCm', 'waistCm']), 'OPEN', 'EMP0001', '2026-10-14 09:00:00'],
      [2, 'ติดตามผล รอบร่าง', '2026-12-01', '2026-12-15', JSON_COLS(['weightKg']), 'DRAFT', 'EMP0001', '2026-10-20 09:00:00'],
    ]]
  );

  const baseline = (id, employeeId, weight, createdAt) => [
    id, employeeId, 'BASELINE', null, createdAt, weight, 170.0, 85.0, 120, 80, createdAt.slice(0, 10),
    JSON_COLS(['ไม่มี']), null, 'NONE', 'OCCASIONAL', 0, null, 2, 30, 3, 30, 5, 20,
    JSON_COLS(['วิ่ง', 'เดิน']), 'ไม่มีเวลา', '3', '1_2_PER_WEEK', '3_4_PER_WEEK', '2_SERVINGS', 'SOMETIMES', 'NEVER',
    JSON_COLS(['ลดน้ำหนัก']), 'PLANNING_1M', weight - 5, createdAt,
  ];
  await conn.query(
    `INSERT INTO health_assessment (assessment_id, employee_id, assessment_type, campaign_id, consent_accepted_at,
       weight_kg, height_cm, waist_cm, bp_systolic, bp_diastolic, assessment_date, chronic_disease, chronic_disease_other,
       smoking_status, alcohol_status, physical_limitation, physical_limitation_note, vigorous_days, vigorous_minutes,
       moderate_days, moderate_minutes, walking_days, walking_minutes, exercise_pattern, exercise_barrier, meals_per_day,
       fried_food_freq, sweet_food_freq, veggie_fruit_freq, late_night_eating, past_dieting, goal_type, stage_of_change,
       target_weight_kg, created_at) VALUES ?`,
    [[baseline(1, 'EMP0002', 72.5, '2026-09-01 08:30:00'), baseline(2, 'EMP0003', 61.0, '2026-09-01 09:30:00')]]
  );
  await conn.query(
    `INSERT INTO health_assessment (assessment_id, employee_id, assessment_type, campaign_id, consent_accepted_at,
       weight_kg, height_cm, waist_cm, assessment_date, created_at)
     VALUES (3, 'EMP0003', 'FOLLOWUP', 1, '2026-10-20 08:00:00', 59.5, 170.0, 82.0, '2026-10-20', '2026-10-20 08:00:00')`
  );
}

async function resetDb({ recreate = false } = {}) {
  assertLocalDb();
  await ensureSchema(recreate);
  const conn = await connect(true);
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    const [tables] = await conn.query(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
      [DB.database]
    );
    // TRUNCATE ไม่เรียก trigger ของ audit_log (ที่กันลบแถวอายุไม่ถึง 90 วัน) จึงล้างได้
    for (const { name } of tables) await conn.query(`TRUNCATE TABLE \`${name}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await insertFixtures(conn);
  } finally {
    await conn.end();
  }
}

module.exports = { resetDb };

if (require.main === module) {
  resetDb({ recreate: process.argv.includes('--recreate') })
    .then(() => console.log(`seed เสร็จ: ${DB.host}:${DB.port}/${DB.database}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
