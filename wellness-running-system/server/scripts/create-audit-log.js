// สร้างตาราง audit_log + trigger กันแก้ไข/ลบก่อนกำหนด (รันครั้งเดียว ซ้ำได้ไม่พัง)
// วิธีใช้: cd server && node scripts/create-audit-log.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS audit_log (
  log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'เลขที่รายการ (PK)',
  occurred_at DATETIME(3) NOT NULL COMMENT 'วันเวลาที่เกิดเหตุการณ์ (เวลาไทย)',
  actor_type ENUM('ADMIN', 'EMPLOYEE', 'ANONYMOUS', 'SYSTEM') NOT NULL COMMENT 'ประเภทผู้กระทำ',
  actor_id VARCHAR(20) NULL DEFAULT NULL COMMENT 'employee_id ของผู้กระทำ (ล็อกอินแอดมินไม่สำเร็จ = รหัสที่พยายามใช้ อาจไม่มีอยู่จริง จึงไม่ทำ FK)',
  action VARCHAR(64) NOT NULL COMMENT 'การกระทำ เช่น ADMIN_LOGIN, HEALTH_RECORD_VIEW (ดู ACTION_LABELS ใน server/audit.js)',
  category ENUM('AUTH', 'DATA_CHANGE', 'DATA_ACCESS', 'EXPORT') NOT NULL COMMENT 'หมวดของเหตุการณ์',
  target_type VARCHAR(32) NULL DEFAULT NULL COMMENT 'ประเภทข้อมูลที่ถูกกระทำ เช่น EMPLOYEE, BADGE, CAMPAIGN',
  target_id VARCHAR(64) NULL DEFAULT NULL COMMENT 'รหัสของข้อมูลที่ถูกกระทำ',
  result ENUM('SUCCESS', 'FAILURE', 'BLOCKED') NOT NULL COMMENT 'ผลลัพธ์ (BLOCKED = โดน rate limit)',
  http_status SMALLINT UNSIGNED NULL DEFAULT NULL COMMENT 'HTTP status ที่ตอบกลับ',
  detail JSON NULL DEFAULT NULL COMMENT 'รายละเอียดเพิ่มเติม (ค่าก่อน/หลังแก้ ตัวกรองที่ใช้ ฯลฯ) ห้ามมีรหัสผ่าน เลขบัตรฯ หรือค่าสุขภาพ',
  ip VARCHAR(45) NULL DEFAULT NULL COMMENT 'IP ต้นทาง (อ่านผ่าน proxy ของ Render)',
  user_agent VARCHAR(255) NULL DEFAULT NULL COMMENT 'เบราว์เซอร์/อุปกรณ์',
  PRIMARY KEY (log_id),
  INDEX idx_audit_log_occurred (occurred_at),
  INDEX idx_audit_log_actor (actor_id, occurred_at),
  INDEX idx_audit_log_target (target_type, target_id, occurred_at),
  INDEX idx_audit_log_category (category, occurred_at)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci
COMMENT = 'บันทึกการเข้าถึง/แก้ไขข้อมูล (PDPA + พ.ร.บ.คอมพิวเตอร์ ม.26) append-only: แก้ไขไม่ได้ ลบได้เฉพาะแถวที่เก่ากว่า 90 วัน'`;

// แก้ไขแถวไม่ได้เลย
const TRIGGER_NO_UPDATE = `
CREATE TRIGGER audit_log_block_update BEFORE UPDATE ON audit_log
FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only: UPDATE is not allowed'`;

// ลบได้เฉพาะแถวที่เก่ากว่า 90 วัน (ระยะขั้นต่ำตามกฎหมาย) — กันลบทิ้งเพื่อปิดร่องรอย
const TRIGGER_NO_EARLY_DELETE = `
CREATE TRIGGER audit_log_block_early_delete BEFORE DELETE ON audit_log
FOR EACH ROW
BEGIN
  IF OLD.occurred_at > NOW() - INTERVAL 90 DAY THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log rows younger than 90 days cannot be deleted';
  END IF;
END`;

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ...(process.env.DB_SSL_CA && { ssl: { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } }),
  });
  await connection.query("SET time_zone = '+07:00'");

  try {
    await connection.query(CREATE_TABLE);
    console.log('table audit_log: ok');

    const [triggers] = await connection.query(
      `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
       WHERE EVENT_OBJECT_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = 'audit_log'`
    );
    const existing = new Set(triggers.map((t) => t.TRIGGER_NAME));

    for (const [name, sql] of [
      ['audit_log_block_update', TRIGGER_NO_UPDATE],
      ['audit_log_block_early_delete', TRIGGER_NO_EARLY_DELETE],
    ]) {
      if (existing.has(name)) {
        console.log(`trigger ${name}: already exists`);
        continue;
      }
      await connection.query(sql);
      console.log(`trigger ${name}: created`);
    }
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('create audit_log failed:', err.code || '', err.message);
  process.exit(1);
});
