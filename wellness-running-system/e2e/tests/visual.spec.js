// ถ่ายภาพหน้าจอทุกหน้าแล้วเทียบกับภาพที่เก็บไว้ทีละพิกเซล — ใช้ตรวจว่า refactor แล้วหน้าตาไม่เปลี่ยน
// ขั้นตอน: ก่อนแก้โค้ด `npm run test:visual:update` (เก็บภาพต้นแบบ) → แก้โค้ด → `npm run test:visual` (เทียบ)
// ภาพขึ้นกับเครื่อง/ฟอนต์/วันที่ จึงไม่เก็บเข้า git (ดู .gitignore) — สร้างใหม่บนเครื่องที่ใช้เทียบทุกครั้ง
const { test, expect } = require('@playwright/test');
const { resetDb } = require('../db/seed');
const { loginAdmin, openAdminTab, openSettingsTab, loginEmployee } = require('./helpers');
const { EMPLOYEE } = require('../test-env');

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetDb();
});

const shot = (page, name, options = {}) =>
  expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, ...options });

test('แอดมิน: ทุกแท็บ', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบแอดมิน' })).toBeVisible();
  await shot(page, 'admin-login');

  await loginAdmin(page);
  await expect(page.locator('.ws-stat-card').first()).toBeVisible();
  await shot(page, 'admin-dashboard');

  await openAdminTab(page, 'ตรวจสอบกิจกรรม');
  await expect(page.locator('main tbody tr:visible').first()).toBeVisible();
  await shot(page, 'admin-submissions-pending');
  await page.locator('main tr:visible', { hasText: 'สมหญิง' }).getByRole('button', { name: 'ปฏิเสธ' }).click();
  await page.locator('.ws-modal:visible').getByLabel('เหตุผล').selectOption('3');
  await shot(page, 'admin-submissions-reject-modal');
  await page.locator('.ws-modal:visible').getByRole('button', { name: 'ยกเลิก' }).click();
  await page.locator('#statusFilter').selectOption('REJECTED');
  await expect(page.locator('main tbody tr:visible').first()).toBeVisible();
  await shot(page, 'admin-submissions-rejected');

  await openAdminTab(page, 'คำขอแลกของรางวัล');
  await expect(page.locator('main tbody tr:visible').first()).toBeVisible();
  await shot(page, 'admin-redeems');

  await openSettingsTab(page, 'ชาเลนจ์');
  await expect(page.locator('main tbody tr:visible').first()).toBeVisible();
  await shot(page, 'admin-challenges');
  await page.locator('main tr:visible', { hasText: 'ชาเลนจ์วิ่งสู้ฝน' }).getByRole('button', { name: 'ดูผู้เข้าร่วม' }).click();
  await expect(page.locator('.ws-modal:visible tbody tr').first()).toBeVisible();
  await shot(page, 'admin-challenge-participants');
  await page.locator('.ws-modal:visible').getByRole('button', { name: 'ปิด' }).click();

  await openSettingsTab(page, 'ของรางวัล');
  await expect(page.locator('main tbody tr:visible').first()).toBeVisible();
  await shot(page, 'admin-rewards');
  await page.locator('main tr:visible', { hasText: 'กระบอกน้ำ' }).getByRole('button', { name: 'แก้ไข' }).click();
  await shot(page, 'admin-rewards-edit');

  await openSettingsTab(page, 'เหรียญตรา');
  await expect(page.locator('main tbody tr:visible').first()).toBeVisible();
  await shot(page, 'admin-badges');
  await page.locator('main tr:visible', { hasText: 'ก้าวแรก' }).getByRole('button', { name: 'แก้ไข' }).click();
  await shot(page, 'admin-badges-edit');

  await openSettingsTab(page, 'หมวดหมู่กิจกรรม');
  await expect(page.locator('main tbody tr:visible').first()).toBeVisible();
  await page.locator('main tr:visible', { hasText: 'เดิน' }).getByRole('button', { name: 'แก้ไข' }).click();
  await shot(page, 'admin-categories-edit');

  await openSettingsTab(page, 'ประเภทกิจกรรม');
  await expect(page.locator('main tbody tr:visible').first()).toBeVisible();
  await shot(page, 'admin-activity-types');
  await page.locator('main tr:visible', { hasText: 'วิ่ง 5 กม.' }).getByRole('button', { name: 'แก้ไข' }).click();
  await shot(page, 'admin-activity-types-edit');

  await openSettingsTab(page, 'แบบสอบถามติดตามผล');
  await expect(page.locator('main tbody tr:visible').first()).toBeVisible();
  await page.getByRole('button', { name: 'น้ำหนัก', exact: true }).click();
  await page.getByRole('button', { name: 'การเดิน', exact: true }).click();
  await shot(page, 'admin-campaigns');

  await openSettingsTab(page, 'ข้อมูลพนักงาน');
  await expect(page.locator('main tbody tr:visible').first()).toBeVisible();
  await shot(page, 'admin-employees');
  await page.locator('main tr:visible', { hasText: 'สมหญิง' }).getByRole('button', { name: 'ข้อมูลสุขภาพ' }).click();
  await expect(page.getByText('จำนวนรอบที่ตอบ')).toBeVisible();
  for (const tab of ['ทั่วไป', 'สุขภาพพื้นฐาน', 'ประวัติ/ปัจจัยเสี่ยง', 'พฤติกรรมออกกำลังกาย', 'พฤติกรรมกิน', 'เป้าหมาย']) {
    await page.locator('main').getByRole('button', { name: tab, exact: true }).click();
    await shot(page, `admin-health-detail-${tab.replace('/', '-')}`);
  }
  await page.getByRole('button', { name: '← รายชื่อพนักงาน' }).click();
  await page.locator('main tr:visible', { hasText: 'สมชาย' }).getByRole('button', { name: 'จัดการ' }).click();
  await expect(page.locator('main input[value="สมชาย ใจดี"]')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await shot(page, 'admin-employee-editor');

  await openSettingsTab(page, 'จัดการสิทธิ์แอดมิน');
  await expect(page.locator('main tbody tr:visible').first()).toBeVisible();
  await shot(page, 'admin-admins');

  await openAdminTab(page, 'รายงาน');
  await page.waitForLoadState('networkidle');
  await shot(page, 'admin-reports');

  await openSettingsTab(page, 'ประวัติการใช้งาน');
  await expect(page.locator('main tbody tr:visible').first()).toBeVisible();
  // เวลาในประวัติการใช้งานเปลี่ยนทุกครั้งที่รัน → บังตารางไว้
  await shot(page, 'admin-audit-log', { mask: [page.locator('main table')] });
});

test('พนักงาน: ทุกหน้า', async ({ page }) => {
  await loginEmployee(page);
  await expect(page.getByRole('button', { name: 'รับทราบ' })).toBeVisible();
  await shot(page, 'employee-new-badge-popup');
  await page.getByRole('button', { name: 'รับทราบ' }).click();
  await expect(page.locator('.ws-bib-number')).toHaveText('160');
  await page.waitForLoadState('networkidle');
  await shot(page, 'employee-submit');

  const nav = (label) => page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('button', { name: label });
  await nav('ชาเลนจ์').click();
  await shot(page, 'employee-challenges');
  await page.locator('.ws-card', { hasText: 'ชาเลนจ์วิ่งสู้ฝน' }).first().getByRole('button', { name: 'ดู Leaderboard' }).click();
  await expect(page.locator('.ws-modal')).toContainText('นักวิ่งเงา');
  await shot(page, 'employee-leaderboard');
  await page.locator('.ws-modal').getByRole('button', { name: 'ปิด' }).click();

  await nav('ของรางวัล').click();
  await shot(page, 'employee-rewards');
  await nav('เหรียญตรา').click();
  await shot(page, 'employee-badges');
});

test('พนักงาน: หน้ายืนยันเลขบัตร และหน้าเข้าสู่ระบบไม่สำเร็จ', async ({ page }) => {
  await page.route('**/api/auth/line-login', (route) =>
    route.fulfill({ json: { linked: false, needsNationalId: true, displayName: EMPLOYEE.displayName } })
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ยืนยันตัวตนครั้งแรก' })).toBeVisible();
  await page.getByLabel('เลขบัตรประชาชน').fill('123');
  await page.getByRole('button', { name: 'ยืนยัน' }).click();
  await shot(page, 'employee-national-id');

  await page.unroute('**/api/auth/line-login');
  await page.route('**/api/auth/line-login', (route) =>
    route.fulfill({ status: 403, json: { message: 'บัญชีพนักงานนี้ถูกปิดใช้งานแล้ว กรุณาติดต่อแอดมิน' } })
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบไม่สำเร็จ' })).toBeVisible();
  await shot(page, 'employee-login-error');
});
