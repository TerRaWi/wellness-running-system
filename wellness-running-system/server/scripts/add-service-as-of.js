// อายุงานเพิ่มเองตามเวลา: เก็บ "ตอบว่ากี่ปี" + "ตอบวันไหน" แล้วคำนวณตอนแสดงผล (รันครั้งเดียว ซ้ำได้ไม่พัง)
// - years_of_service เป็น DECIMAL(5,2) เพื่อเก็บ ปี + เดือน ได้ตรง (เดิม 1 ตำแหน่ง: 3 เดือน = 0.3 ปี → แปลงกลับได้ 4 เดือน)
// - เพิ่ม years_of_service_as_of = วันที่พนักงานตอบ
// - ข้อมูลเดิม: ใช้วันที่ทำแบบสอบถาม BASELINE (คำถามอายุงานถามเฉพาะตอน baseline)
// วิธีใช้: cd server && node scripts/add-service-as-of.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

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
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME, NUMERIC_SCALE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee'
         AND COLUMN_NAME IN ('years_of_service', 'years_of_service_as_of')`
    );
    const byName = Object.fromEntries(cols.map((c) => [c.COLUMN_NAME, c]));

    if (Number(byName.years_of_service?.NUMERIC_SCALE) !== 2) {
      await connection.query(
        `ALTER TABLE employee MODIFY COLUMN years_of_service DECIMAL(5,2) NULL DEFAULT NULL
         COMMENT 'อายุงานที่พนักงานตอบ (ปี, ทศนิยม = เดือน/12) ณ วันที่ years_of_service_as_of — อายุงานปัจจุบันคำนวณตอนแสดงผล'`
      );
      console.log('years_of_service: DECIMAL(5,2)');
    } else {
      console.log('years_of_service: already DECIMAL(5,2)');
    }

    if (!byName.years_of_service_as_of) {
      await connection.query(
        `ALTER TABLE employee ADD COLUMN years_of_service_as_of DATE NULL DEFAULT NULL
         COMMENT 'วันที่พนักงานตอบอายุงาน — อายุงานปัจจุบัน = years_of_service + เดือนที่ผ่านไปนับจากวันนี้'
         AFTER years_of_service`
      );
      console.log('years_of_service_as_of: added');
    } else {
      console.log('years_of_service_as_of: already exists');
    }

    const [result] = await connection.query(
      `UPDATE employee e
       JOIN (
         SELECT employee_id, DATE(MIN(created_at)) AS answered_on
         FROM health_assessment WHERE assessment_type = 'BASELINE'
         GROUP BY employee_id
       ) b ON b.employee_id = e.employee_id
       SET e.years_of_service_as_of = b.answered_on
       WHERE e.years_of_service IS NOT NULL AND e.years_of_service_as_of IS NULL`
    );
    console.log(`backfilled answer date from baseline: ${result.affectedRows} employee(s)`);

    const [[left]] = await connection.query(
      `SELECT COUNT(*) AS n FROM employee WHERE years_of_service IS NOT NULL AND years_of_service_as_of IS NULL`
    );
    if (left.n > 0) console.log(`note: ${left.n} employee(s) have years_of_service but no baseline date (will not auto-increase)`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('add years_of_service_as_of failed:', err.code || '', err.message);
  process.exit(1);
});
