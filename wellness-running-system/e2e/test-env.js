// ค่าคงที่ของสภาพแวดล้อมทดสอบ — ใช้ร่วมกันระหว่าง playwright.config.js, สคริปต์ seed และไฟล์ทดสอบ
// ฐานข้อมูลทดสอบต้องเป็น MySQL แยกต่างหาก (ห้ามชี้ไปที่ Aiven/ฐานข้อมูลจริง เพราะ seed จะล้างทุกตาราง)
const path = require('path');

const DB = {
  host: process.env.E2E_DB_HOST || '127.0.0.1',
  port: Number(process.env.E2E_DB_PORT || 3320),
  user: process.env.E2E_DB_USER || 'root',
  password: process.env.E2E_DB_PASSWORD || '',
  database: 'wellness_db', // ชื่อนี้ถูกเขียนตายตัวใน wellness.sql
};

module.exports = {
  DB,
  API_PORT: Number(process.env.E2E_API_PORT || 4100),
  CLIENT_PORT: Number(process.env.E2E_CLIENT_PORT || 5188),
  JWT_SECRET: 'e2e-only-secret',
  SCHEMA_FILE:
    process.env.E2E_SCHEMA_FILE || path.join(__dirname, '..', '..', 'Docs', 'EER Diagram', 'wellness.sql'),
  ADMIN: { employeeId: 'EMP0001', password: 'Admin-e2e-1234' },
  // พนักงานที่ชุดทดสอบฝั่ง LINE ใช้ล็อกอิน (ผูก LINE + ทำ baseline แล้ว และยังไม่ตอบรอบติดตามผลที่เปิดอยู่)
  EMPLOYEE: { employeeId: 'EMP0002', displayName: 'สมชาย (LINE)' },
};
