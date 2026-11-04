// ตัวจำลอง @line/liff สำหรับชุดทดสอบ Playwright เท่านั้น (vite --mode e2e สลับมาใช้ไฟล์นี้)
// ทำเหมือนล็อกอิน LINE แล้ว และคืน ID token ปลอม — ชุดทดสอบดักคำขอ /api/auth/line-login แล้วตอบแทนเซิร์ฟเวอร์
const liff = {
  async init() {},
  isLoggedIn: () => true,
  login() {},
  getIDToken: () => 'e2e-line-id-token',
};

export default liff;
