require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function main() {
    const [, , employeeId, password] = process.argv;

    if (!employeeId || !password) {
    console.error('วิธีใช้: node scripts/seed-admin.js <employeeId> <password>');
    process.exit(1);
    }

    if (password.length < 8) {
    console.error('รหัสผ่านควรยาวอย่างน้อย 8 ตัวอักษร');
    process.exit(1);
    }

    const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    });

    try {
    const [empRows] = await pool.query(
        'SELECT employee_id FROM employee WHERE employee_id = ?',
        [employeeId]
    );

    if (empRows.length === 0) {
        console.error(
        `ไม่พบ employee_id "${employeeId}" ในตาราง employee กรุณาเพิ่มข้อมูลพนักงานนี้ก่อน (ผ่าน mirror sync หรือ insert เอง)`
        );
        process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(`UPDATE employee SET role = 'ADMIN' WHERE employee_id = ?`, [employeeId]);

    await pool.query(
        `INSERT INTO admin_credential (employee_id, password_hash)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
        [employeeId, passwordHash]
    );

    console.log(`ตั้งค่าแอดมินสำเร็จ: ${employeeId} (role = ADMIN, ตั้งรหัสผ่านใหม่แล้ว)`);
    } catch (err) {
    console.error('seed-admin error:', err);
    process.exit(1);
    } finally {
    await pool.end();
    }
}

main();