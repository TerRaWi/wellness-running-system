// เปิด MySQL สำหรับชุดทดสอบ (แยกจาก MySQL ตัวที่ใช้งานอยู่ในเครื่อง) — ปล่อยหน้าต่างนี้เปิดค้างไว้ระหว่างรันเทสต์
// ครั้งแรกจะสร้างโฟลเดอร์ข้อมูลใหม่ให้เอง (root ไม่มีรหัสผ่าน, ฟังเฉพาะ 127.0.0.1)
// ปรับได้ด้วย env: E2E_MYSQLD (ที่อยู่ mysqld.exe), E2E_DB_DIR (โฟลเดอร์ข้อมูล), E2E_DB_PORT
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { DB } = require('../test-env');

const mysqld = process.env.E2E_MYSQLD || 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe';
const dataDir =
  process.env.E2E_DB_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), 'wellness-e2e-mysql', 'data');

if (!fs.existsSync(mysqld)) {
  console.error(`ไม่พบ mysqld ที่ ${mysqld} — ตั้ง E2E_MYSQLD ให้ชี้ไปที่ mysqld.exe ของ MySQL 8`);
  process.exit(1);
}

if (!fs.existsSync(dataDir)) {
  console.log(`สร้างฐานข้อมูลทดสอบใหม่ที่ ${dataDir} ...`);
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const init = spawnSync(mysqld, ['--no-defaults', '--initialize-insecure', `--datadir=${dataDir}`], { stdio: 'inherit' });
  if (init.status !== 0) process.exit(init.status || 1);
}

console.log(`MySQL ทดสอบ: 127.0.0.1:${DB.port} (ข้อมูลที่ ${dataDir}) — กด Ctrl+C เพื่อปิด`);
const server = spawn(
  mysqld,
  [
    '--no-defaults',
    `--datadir=${dataDir}`,
    `--port=${DB.port}`,
    '--mysqlx=OFF',
    '--bind-address=127.0.0.1',
    '--default-time-zone=+07:00',
    '--console',
  ],
  { stdio: 'inherit' }
);
server.on('exit', (code) => process.exit(code ?? 0));
