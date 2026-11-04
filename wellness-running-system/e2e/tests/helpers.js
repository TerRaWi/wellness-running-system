const { expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { ADMIN, EMPLOYEE, JWT_SECRET } = require('../test-env');

// เก็บ error ของหน้าเว็บระหว่างเทสต์ (JS error + console.error) แล้วให้ assertNoPageErrors เช็คตอนจบ
// ข้าม "Failed to load resource" เพราะเป็นคำขอที่ตั้งใจให้ได้ 4xx เช่น /api/admin/me ก่อนล็อกอิน
function trackPageErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Failed to load resource/.test(text)) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

async function loginAdmin(page) {
  await page.goto('/admin');
  await page.getByLabel('รหัสพนักงาน').fill(ADMIN.employeeId);
  await page.getByLabel('รหัสผ่าน').fill(ADMIN.password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page.getByRole('heading', { name: 'แดชบอร์ดแอดมิน' })).toBeVisible();
}

// แท็บหลัก (แถวบน) ของหน้าแอดมิน
async function openAdminTab(page, label) {
  await page.locator('.ws-tabs').first().getByRole('button', { name: label, exact: true }).click();
}

// เมนูย่อยใต้ "ตั้งค่า"
async function openSettingsTab(page, label) {
  await openAdminTab(page, 'ตั้งค่า');
  await page.locator('.ws-tabs').nth(1).getByRole('button', { name: label, exact: true }).click();
}

// แอปพนักงานล็อกอินผ่าน LINE — ชุดทดสอบตอบ /api/auth/line-login แทนเซิร์ฟเวอร์ (ตรวจ LINE token จริงไม่ได้)
// token ที่ออกให้เซ็นด้วย JWT_SECRET เดียวกับ API ทดสอบ คำขออื่นทั้งหมดจึงวิ่งไปที่เซิร์ฟเวอร์จริงตามปกติ
async function loginEmployee(page, { needsHealthAssessment = false, lastSeenBadgeAt } = {}) {
  const token = jwt.sign({ employeeId: EMPLOYEE.employeeId }, JWT_SECRET, { expiresIn: '1h' });
  await page.route('**/api/auth/line-login', (route) =>
    route.fulfill({
      json: {
        linked: true,
        employeeId: EMPLOYEE.employeeId,
        displayName: EMPLOYEE.displayName,
        needsHealthAssessment,
        token,
      },
    })
  );
  if (lastSeenBadgeAt) {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [`wellness_last_seen_badge_${EMPLOYEE.employeeId}`, lastSeenBadgeAt]
    );
  }
  await page.goto('/');
}

module.exports = { trackPageErrors, loginAdmin, openAdminTab, openSettingsTab, loginEmployee };
