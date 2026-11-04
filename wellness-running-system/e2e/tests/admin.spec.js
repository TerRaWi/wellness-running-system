// ทดสอบการทำงานของหน้าแอดมินทุกแท็บ (ฐานข้อมูลทดสอบถูกล้างและใส่ข้อมูลใหม่ก่อนเริ่มไฟล์นี้)
const { test, expect } = require('@playwright/test');
const { resetDb } = require('../db/seed');
const { trackPageErrors, loginAdmin, openAdminTab, openSettingsTab } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let pageErrors;

test.beforeAll(async () => {
  await resetDb();
});

test.beforeEach(async ({ page }) => {
  pageErrors = trackPageErrors(page);
  page.on('dialog', (dialog) => dialog.accept()); // ปุ่มที่ถาม window.confirm ให้ตอบ "ตกลง"
  await loginAdmin(page);
});

test.afterEach(() => {
  expect(pageErrors, 'หน้าเว็บมี error').toEqual([]);
});

// แท็บที่ซ่อนอยู่ยังค้างอยู่ใน DOM (hidden) → ค้นหาข้อความ/ช่องกรอกเฉพาะที่มองเห็นเสมอ
const main = (page) => page.locator('main');
const rowWith = (page, text) => main(page).locator('tr:visible', { hasText: text });

test('ล็อกอินผิดรหัสผ่านแล้วขึ้นข้อความ และออกจากระบบได้', async ({ page }) => {
  await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบแอดมิน' })).toBeVisible();
  await page.getByLabel('รหัสพนักงาน').filter({ visible: true }).fill('EMP0001');
  await page.getByLabel('รหัสผ่าน').filter({ visible: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page.getByText('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง').filter({ visible: true })).toBeVisible();
});

test('รีเฟรชหน้าแล้วยังล็อกอินอยู่', async ({ page }) => {
  await page.reload();
  await expect(page.getByRole('heading', { name: 'แดชบอร์ดแอดมิน' })).toBeVisible();
  await expect(page.getByText('เข้าสู่ระบบเป็น').filter({ visible: true })).toContainText('EMP0001');
});

test('แดชบอร์ด: ตัวเลขสรุป + กดการ์ดไปหน้าตรวจสอบกิจกรรม', async ({ page }) => {
  const pendingCard = page.locator('.ws-stat-card', { hasText: 'กิจกรรม รอดำเนินการ' });
  await expect(pendingCard.locator('.ws-stat-value')).toHaveText('2');
  await expect(page.locator('.ws-stat-card', { hasText: 'แลกของรางวัล รอดำเนินการ' }).locator('.ws-stat-value')).toHaveText('1');
  await expect(rowWith(page, 'ชาเลนจ์วิ่งสู้ฝน')).toBeVisible();

  // เปลี่ยนตัวกรองหน้าตรวจสอบกิจกรรมไปก่อน แล้วกดการ์ดจากแดชบอร์ด → ต้องกลับมาเป็น PENDING
  await openAdminTab(page, 'ตรวจสอบกิจกรรม');
  await page.locator('#statusFilter').selectOption('APPROVED');
  await openAdminTab(page, 'แดชบอร์ด');
  await pendingCard.click();
  await expect(page.locator('#statusFilter')).toHaveValue('PENDING');
  await expect(rowWith(page, 'สมชาย ใจดี')).toHaveCount(1);
  await expect(rowWith(page, 'สมหญิง รักวิ่ง')).toHaveCount(1);
});

test('แดชบอร์ด: กดการ์ดแลกของรางวัล และกดแถวชาเลนจ์แล้วเปิดรายชื่อผู้เข้าร่วม', async ({ page }) => {
  await page.locator('.ws-stat-card', { hasText: 'แลกของรางวัล รอดำเนินการ' }).click();
  await expect(page.locator('#redeemStatusFilter')).toHaveValue('PENDING');
  await expect(rowWith(page, 'สมหญิง รักวิ่ง')).toBeVisible();

  await openAdminTab(page, 'แดชบอร์ด');
  await rowWith(page, 'ชาเลนจ์วิ่งสู้ฝน').click();
  const modal = page.locator('.ws-modal:visible');
  await expect(modal.getByRole('heading', { name: 'ผู้เข้าร่วม: ชาเลนจ์วิ่งสู้ฝน' })).toBeVisible();
  await expect(modal.locator('tbody tr')).toHaveCount(2);
  await expect(modal).toContainText('ไม่ระบุตัวตน');
  await modal.getByRole('button', { name: 'ปิด' }).click();
  await expect(page.locator('.ws-modal:visible')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'รายการ ชาเลนจ์ ทั้งหมด' })).toBeVisible();
});

test('ตรวจสอบกิจกรรม: อนุมัติ ปฏิเสธ (เหตุผลอื่นๆ ต้องระบุ) และดูตามสถานะ', async ({ page }) => {
  await openAdminTab(page, 'ตรวจสอบกิจกรรม');
  await rowWith(page, 'สมชาย ใจดี').getByRole('button', { name: 'อนุมัติ' }).click();
  await expect(rowWith(page, 'สมชาย ใจดี')).toHaveCount(0);

  await rowWith(page, 'สมหญิง รักวิ่ง').getByRole('button', { name: 'ปฏิเสธ' }).click();
  const modal = page.locator('.ws-modal:visible');
  await expect(modal.getByRole('heading', { name: 'ปฏิเสธ submission #4' })).toBeVisible();
  await modal.getByRole('button', { name: 'ยืนยันปฏิเสธ' }).click();
  await expect(modal.getByText('กรุณาเลือกเหตุผลที่ปฏิเสธ').filter({ visible: true })).toBeVisible();
  await modal.getByLabel('เหตุผล').filter({ visible: true }).selectOption({ label: 'อื่นๆ (โปรดระบุ)' });
  await modal.getByRole('button', { name: 'ยืนยันปฏิเสธ' }).click();
  await expect(modal.getByText('กรุณาระบุเหตุผลเพิ่มเติม').filter({ visible: true })).toBeVisible();
  await modal.getByLabel('ระบุเหตุผลเพิ่มเติม').filter({ visible: true }).fill('รูปเป็นของวันอื่น');
  await modal.getByRole('button', { name: 'ยืนยันปฏิเสธ' }).click();
  await expect(page.locator('.ws-modal:visible')).toHaveCount(0);
  await expect(main(page).getByText('ไม่มีรายการในสถานะนี้').filter({ visible: true })).toBeVisible();

  await page.locator('#statusFilter').selectOption('REJECTED');
  await expect(rowWith(page, 'รูปเป็นของวันอื่น')).toBeVisible();
  await expect(rowWith(page, 'รูปหลักฐานไม่ชัดเจน')).toBeVisible();

  await page.locator('#statusFilter').selectOption('APPROVED');
  await expect(main(page).locator('tbody tr:visible')).toHaveCount(3);
  await main(page).getByRole('button', { name: 'รีเฟรช' }).click();
  await expect(main(page).locator('tbody tr:visible')).toHaveCount(3);
});

test('คำขอแลกของรางวัล: อนุมัติแล้วย้ายไปสถานะอนุมัติ', async ({ page }) => {
  await openAdminTab(page, 'คำขอแลกของรางวัล');
  await rowWith(page, 'สมหญิง รักวิ่ง').getByRole('button', { name: 'อนุมัติ (มอบของแล้ว)' }).click();
  await expect(main(page).getByText('ไม่มีรายการในสถานะนี้').filter({ visible: true })).toBeVisible();
  await page.locator('#redeemStatusFilter').selectOption('APPROVED');
  await expect(main(page).locator('tbody tr:visible')).toHaveCount(2);
  await page.locator('#redeemStatusFilter').selectOption('CANCELLED');
  await expect(main(page).getByText('ไม่มีรายการในสถานะนี้').filter({ visible: true })).toBeVisible();
});

test('ชาเลนจ์: ตรวจฟอร์ม สร้างใหม่ และยกเลิก', async ({ page }) => {
  await openSettingsTab(page, 'ชาเลนจ์');
  await page.getByRole('button', { name: 'สร้าง ชาเลนจ์' }).click();
  await expect(page.getByText('กรุณากรอกข้อมูลให้ครบ').filter({ visible: true })).toBeVisible();

  await page.getByLabel('หมวดกิจกรรมที่ใช้วัด').filter({ visible: true }).selectOption({ label: 'เดิน' });
  await page.getByLabel('ชื่อ ชาเลนจ์').filter({ visible: true }).fill('ชาเลนจ์ทดสอบ E2E');
  await page.getByLabel('รายละเอียด (ถ้ามี)').filter({ visible: true }).fill('สร้างจากชุดทดสอบ');
  await page.locator('#newChallengeStart').fill('15/01/2570');
  await page.locator('#newChallengeStart').press('Enter');
  await page.getByLabel('ชั่วโมงเริ่ม').filter({ visible: true }).selectOption('08');
  await page.locator('#newChallengeEnd').fill('20/01/2570');
  await page.locator('#newChallengeEnd').press('Enter');
  await page.getByLabel('ชั่วโมงจบ').filter({ visible: true }).selectOption('18');
  await page.getByLabel('นาทีจบ').filter({ visible: true }).selectOption('30');
  await page.getByRole('button', { name: 'สร้าง ชาเลนจ์' }).click();

  const row = rowWith(page, 'ชาเลนจ์ทดสอบ E2E');
  await expect(row).toBeVisible();
  await expect(row).toContainText('ยังไม่เริ่ม');
  await expect(page.getByLabel('ชื่อ ชาเลนจ์').filter({ visible: true })).toHaveValue('');

  await row.getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(row).toContainText('ยกเลิกแล้ว');

  await row.getByRole('button', { name: 'ดูผู้เข้าร่วม' }).click();
  await expect(page.locator('.ws-modal:visible').getByText('ยังไม่มีผู้เข้าร่วม').filter({ visible: true })).toBeVisible();
  await page.locator('.ws-modal:visible').getByRole('button', { name: 'ปิด' }).click();
});

test('เหรียญตรา: สร้าง แก้ไข และปิดใช้งาน', async ({ page }) => {
  await openSettingsTab(page, 'เหรียญตรา');
  await page.getByRole('button', { name: 'สร้าง เหรียญตรา' }).click();
  await expect(page.getByText('กรุณากรอกชื่อ เหรียญตรา และค่าเงื่อนไข').filter({ visible: true })).toBeVisible();

  await page.getByLabel('ชื่อ เหรียญตรา').filter({ visible: true }).fill('ส่งครบ 3 ครั้ง');
  await page.getByLabel('ประเภทเงื่อนไข').filter({ visible: true }).selectOption('SUBMISSION_COUNT');
  await page.getByLabel('ค่าที่ต้องถึง').filter({ visible: true }).fill('3');
  await page.getByRole('button', { name: 'สร้าง เหรียญตรา' }).click();
  const row = rowWith(page, 'ส่งครบ 3 ครั้ง');
  await expect(row).toContainText('จำนวนครั้งที่อนุมัติ ≥ 3');

  await row.getByRole('button', { name: 'แก้ไข' }).click();
  const editRow = main(page).locator('tr:visible', { has: page.getByRole('button', { name: 'บันทึก' }) });
  await editRow.locator('input[type="text"]').fill('ส่งครบ 5 ครั้ง');
  await editRow.locator('input[type="number"]').fill('5');
  await editRow.getByRole('button', { name: 'บันทึก' }).click();
  const updated = rowWith(page, 'ส่งครบ 5 ครั้ง');
  await expect(updated).toContainText('≥ 5');

  await updated.getByRole('button', { name: 'ปิดใช้งาน' }).click();
  await expect(updated).toContainText('INACTIVE');
  await updated.getByRole('button', { name: 'เปิดใช้งาน' }).click();
  await expect(updated).toContainText('ACTIVE');

  await updated.getByRole('button', { name: 'แก้ไข' }).click();
  await main(page).locator('tr:visible', { has: page.getByRole('button', { name: 'บันทึก' }) }).getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(main(page).getByRole('button', { name: 'บันทึก' })).toHaveCount(0);
});

test('หมวดหมู่ + ประเภทกิจกรรม: สร้างหมวดใหม่แล้วใช้ในประเภทกิจกรรมได้ทันที', async ({ page }) => {
  await openSettingsTab(page, 'หมวดหมู่กิจกรรม');
  await page.getByLabel('ชื่อหมวดหมู่').filter({ visible: true }).fill('ปั่นจักรยาน');
  await page.getByRole('button', { name: 'สร้างหมวดหมู่' }).click();
  const catRow = rowWith(page, 'ปั่นจักรยาน');
  await expect(catRow).toContainText('ACTIVE');

  await catRow.getByRole('button', { name: 'แก้ไข' }).click();
  const editRow = main(page).locator('tr:visible', { has: page.getByRole('button', { name: 'บันทึก' }) });
  await editRow.locator('input[type="text"]').fill('ปั่นจักรยานทางไกล');
  await editRow.getByRole('button', { name: 'บันทึก' }).click();
  await expect(rowWith(page, 'ปั่นจักรยานทางไกล')).toBeVisible();

  await openSettingsTab(page, 'ประเภทกิจกรรม');
  await expect(rowWith(page, 'วิ่ง 5 กม.')).toBeVisible();
  await page.getByLabel('หมวดหมู่').filter({ visible: true }).selectOption({ label: 'ปั่นจักรยานทางไกล' });
  await page.getByLabel('ชื่อกิจกรรม').filter({ visible: true }).fill('ปั่น 20 กม.');
  await page.getByLabel('คะแนน').filter({ visible: true }).fill('12');
  await page.getByLabel('บังคับแนบรูปหลักฐาน').filter({ visible: true }).uncheck();
  await page.getByRole('button', { name: 'สร้างประเภทกิจกรรม' }).click();
  const typeRow = rowWith(page, 'ปั่น 20 กม.');
  await expect(typeRow).toContainText('ไม่บังคับ');
  await expect(typeRow).toContainText('12');

  await typeRow.getByRole('button', { name: 'ปิดใช้งาน' }).click();
  await expect(typeRow).toContainText('INACTIVE');

  await typeRow.getByRole('button', { name: 'แก้ไข' }).click();
  const typeEdit = main(page).locator('tr:visible', { has: page.getByRole('button', { name: 'บันทึก' }) });
  await typeEdit.locator('input[type="number"]').fill('15');
  await typeEdit.getByRole('button', { name: 'บันทึก' }).click();
  await expect(rowWith(page, 'ปั่น 20 กม.')).toContainText('15');
});

test('ของรางวัล: สร้าง แก้ไขจำนวน และปิดใช้งาน', async ({ page }) => {
  await openSettingsTab(page, 'ของรางวัล');
  await page.getByRole('button', { name: 'สร้างของรางวัล' }).click();
  await expect(page.getByText('กรุณากรอกชื่อ คะแนนที่ใช้แลก และจำนวนคงเหลือให้ครบ').filter({ visible: true })).toBeVisible();

  await page.getByLabel('ชื่อของรางวัล').filter({ visible: true }).fill('ผ้าเช็ดตัว');
  await page.getByLabel('คะแนนที่ใช้แลก').filter({ visible: true }).fill('80');
  await page.getByLabel('จำนวนคงเหลือ').filter({ visible: true }).fill('5');
  await page.getByRole('button', { name: 'สร้างของรางวัล' }).click();
  const row = rowWith(page, 'ผ้าเช็ดตัว');
  await expect(row).toContainText('80');

  await row.getByRole('button', { name: 'แก้ไข' }).click();
  const editRow = main(page).locator('tr:visible', { has: page.getByRole('button', { name: 'บันทึก' }) });
  await editRow.locator('input[type="number"]').nth(1).fill('9');
  await editRow.getByRole('button', { name: 'บันทึก' }).click();
  await expect(rowWith(page, 'ผ้าเช็ดตัว').locator('td').nth(4)).toHaveText('9');

  await rowWith(page, 'ผ้าเช็ดตัว').getByRole('button', { name: 'ปิดใช้งาน' }).click();
  await expect(rowWith(page, 'ผ้าเช็ดตัว')).toContainText('INACTIVE');
});

test('แบบสอบถามติดตามผล: สถานะการคำนวณ สร้างรอบ และปิดรอบ', async ({ page }) => {
  await openSettingsTab(page, 'แบบสอบถามติดตามผล');
  const status = page.locator('.ws-card', { hasText: 'สถานะการคำนวณอัตโนมัติ' }).last();
  await expect(status).toContainText('ยังไม่ได้เลือกฟิลด์ในกลุ่มนี้ — จะไม่มี BMI ให้ในรอบนี้');

  await page.getByRole('button', { name: 'น้ำหนัก', exact: true }).click();
  await expect(status).toContainText('เลือกแค่ 1/2 — BMI จะคำนวณไม่ได้');
  await page.getByRole('button', { name: 'ส่วนสูง', exact: true }).click();
  await expect(status).toContainText('เลือกครบ — ระบบจะคำนวณ BMI ให้อัตโนมัติ');
  await page.getByRole('button', { name: 'การเดิน', exact: true }).click();
  await expect(status).toContainText('เลือกแค่ 1/3 — คะแนนกิจกรรม MET จะยังคำนวณได้');

  await page.getByLabel('ชื่อรอบ').filter({ visible: true }).fill('ติดตามผล E2E');
  await page.locator('#newCampaignReleaseDate').fill('01/02/2570');
  await page.locator('#newCampaignReleaseDate').press('Enter');
  await page.getByRole('button', { name: 'สร้างรอบ (สถานะร่าง)' }).click();
  const row = rowWith(page, 'ติดตามผล E2E');
  await expect(row).toContainText('ร่าง (ยังไม่เปิด)');
  await expect(page.getByLabel('ชื่อรอบ').filter({ visible: true })).toHaveValue('');

  const openRow = rowWith(page, 'ติดตามผล 8 สัปดาห์ รอบที่ 1');
  await expect(openRow).toContainText('1 / 4');
  await openRow.getByRole('button', { name: 'ปิดรอบ' }).click();
  await expect(openRow).toContainText('ปิดแล้ว');
});

test('ข้อมูลพนักงาน: ค้นหา กรองสถานะ ดูข้อมูลสุขภาพ และเปิดฟอร์มจัดการ', async ({ page }) => {
  await openSettingsTab(page, 'ข้อมูลพนักงาน');
  await expect(main(page).locator('tbody tr:visible')).toHaveCount(4);
  await page.getByPlaceholder('ค้นหาชื่อ รหัส หรือแผนก').filter({ visible: true }).fill('เภสัช');
  await expect(main(page).locator('tbody tr:visible')).toHaveCount(1);
  await expect(rowWith(page, 'สมหญิง รักวิ่ง')).toContainText('ผูกแล้ว');
  await page.getByPlaceholder('ค้นหาชื่อ รหัส หรือแผนก').filter({ visible: true }).fill('');

  await page.getByLabel('สถานะพนักงาน').filter({ visible: true }).selectOption('RESIGNED');
  await expect(main(page).locator('tbody tr:visible')).toHaveCount(1);
  await expect(rowWith(page, 'มานี ลาออกแล้ว')).toContainText('ปิดใช้งาน');
  await page.getByLabel('สถานะพนักงาน').filter({ visible: true }).selectOption('ACTIVE');
  await expect(main(page).locator('tbody tr:visible')).toHaveCount(4);

  await expect(rowWith(page, 'วิชัย ขยันเดิน').getByRole('button', { name: 'ข้อมูลสุขภาพ' })).toBeDisabled();
  await rowWith(page, 'สมหญิง รักวิ่ง').getByRole('button', { name: 'ข้อมูลสุขภาพ' }).click();
  await expect(main(page).getByText('EMP0003 ·').filter({ visible: true })).toBeVisible();
  await expect(main(page).locator('.ws-card', { hasText: 'น้ำหนักล่าสุด (กก.)' }).last()).toContainText('59.5');
  await expect(main(page).locator('.ws-card', { hasText: 'จำนวนรอบที่ตอบ' }).last()).toContainText('2');
  await main(page).getByRole('button', { name: 'สุขภาพพื้นฐาน' }).click();
  await expect(main(page).getByText('แนวโน้มน้ำหนัก (baseline → follow-up)').filter({ visible: true })).toBeVisible();
  await expect(main(page).getByText(/^82(.0)? ซม.$/).filter({ visible: true })).toBeVisible();
  await main(page).getByRole('button', { name: 'พฤติกรรมออกกำลังกาย' }).click();
  await expect(main(page).getByText('แนวโน้ม MET-minutes/สัปดาห์').filter({ visible: true })).toBeVisible();
  await main(page).getByRole('button', { name: 'พฤติกรรมกิน' }).click();
  await expect(main(page).getByText('1-2 ครั้ง/สัปดาห์').filter({ visible: true })).toBeVisible();
  await main(page).getByRole('button', { name: '← รายชื่อพนักงาน' }).click();
  await expect(main(page).locator('tbody tr:visible')).toHaveCount(4);

  await rowWith(page, 'สมชาย ใจดี').getByRole('button', { name: 'จัดการ' }).click();
  await expect(main(page).locator('input[value="สมชาย ใจดี"]')).toBeVisible();
  // กดเมนูย่อยเดิมซ้ำ = ปิดฟอร์มกลับไปหน้ารายชื่อ
  await page.locator('.ws-tabs').nth(1).getByRole('button', { name: 'ข้อมูลพนักงาน', exact: true }).click();
  await expect(main(page).locator('tbody tr:visible')).toHaveCount(4);

  await main(page).getByRole('button', { name: '+ เพิ่มพนักงาน' }).click();
  await expect(main(page).getByPlaceholder('ค้นหาชื่อ รหัส หรือแผนก').filter({ visible: true })).toHaveCount(0);
});

test('จัดการสิทธิ์แอดมิน: ให้สิทธิ์แล้วถอดสิทธิ์', async ({ page }) => {
  await openSettingsTab(page, 'จัดการสิทธิ์แอดมิน');
  await expect(rowWith(page, 'EMP0001')).toContainText('คุณ');
  await page.getByLabel('รหัสพนักงาน').filter({ visible: true }).fill('EMP0004');
  await page.getByLabel('รหัสผ่าน').filter({ visible: true }).fill('short');
  await page.getByRole('button', { name: 'ให้สิทธิ์แอดมิน' }).click();
  await expect(page.getByText('รหัสผ่านควรยาวอย่างน้อย 8 ตัวอักษร').filter({ visible: true })).toBeVisible();
  await page.getByLabel('รหัสผ่าน').filter({ visible: true }).fill('Second-admin-1');
  await page.getByRole('button', { name: 'ให้สิทธิ์แอดมิน' }).click();
  const row = rowWith(page, 'EMP0004');
  await expect(row).toContainText('วิชัย ขยันเดิน');
  await row.getByRole('button', { name: 'ถอดสิทธิ์' }).click();
  await expect(rowWith(page, 'EMP0004')).toHaveCount(0);
});

test('รายงาน และ ประวัติการใช้งาน เปิดได้', async ({ page }) => {
  await openAdminTab(page, 'รายงาน');
  await expect(main(page).getByRole('button', { name: /Excel/ })).toBeVisible();

  await openSettingsTab(page, 'ประวัติการใช้งาน');
  await expect(main(page).locator('tbody tr:visible').first()).toBeVisible();
  await expect(main(page)).toContainText('EMP0001');
});

test('สลับแท็บไปมาแล้วข้อมูลที่พิมพ์ค้างและตัวกรองยังอยู่ และจำเมนูย่อยล่าสุด', async ({ page }) => {
  await openSettingsTab(page, 'ของรางวัล');
  await page.getByLabel('ชื่อของรางวัล').filter({ visible: true }).fill('ร่างที่ยังไม่บันทึก');
  await openSettingsTab(page, 'ข้อมูลพนักงาน');
  await page.getByPlaceholder('ค้นหาชื่อ รหัส หรือแผนก').filter({ visible: true }).fill('สมชาย');
  await openAdminTab(page, 'คำขอแลกของรางวัล');
  await page.locator('#redeemStatusFilter').selectOption('APPROVED');
  await openAdminTab(page, 'แดชบอร์ด');

  await openAdminTab(page, 'ตั้งค่า');
  await expect(page.getByPlaceholder('ค้นหาชื่อ รหัส หรือแผนก').filter({ visible: true })).toHaveValue('สมชาย');
  await expect(main(page).locator('tbody tr:visible')).toHaveCount(1);
  await page.locator('.ws-tabs').nth(1).getByRole('button', { name: 'ของรางวัล', exact: true }).click();
  await expect(page.getByLabel('ชื่อของรางวัล').filter({ visible: true })).toHaveValue('ร่างที่ยังไม่บันทึก');
  await openAdminTab(page, 'คำขอแลกของรางวัล');
  await expect(page.locator('#redeemStatusFilter')).toHaveValue('APPROVED');
});
