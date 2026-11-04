// ทดสอบแอปพนักงาน (หน้า LINE) — ล็อกอินเป็น EMP0002 ผ่านตัวจำลอง LIFF
const { test, expect } = require('@playwright/test');
const { resetDb } = require('../db/seed');
const { trackPageErrors, loginEmployee } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let pageErrors;

test.beforeAll(async () => {
  await resetDb();
});

test.beforeEach(async ({ page }) => {
  pageErrors = trackPageErrors(page);
});

test.afterEach(() => {
  expect(pageErrors, 'หน้าเว็บมี error').toEqual([]);
});

const bib = (page) => page.locator('.ws-bib-number');
const nav = (page, label) => page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('button', { name: label });

test('เข้าครั้งแรก: เด้งเหรียญที่ได้ใหม่ กดรับทราบแล้วไม่เด้งซ้ำ', async ({ page }) => {
  await loginEmployee(page);
  await expect(page.getByText('ก้าวแรก').first()).toBeVisible();
  await page.getByRole('button', { name: 'รับทราบ' }).click();
  await expect(page.getByRole('button', { name: 'รับทราบ' })).toHaveCount(0);
  await page.reload();
  await expect(bib(page)).toHaveText('160');
  await expect(page.getByRole('button', { name: 'รับทราบ' })).toHaveCount(0);
});

test('หน้าแรก: คะแนนบนเบอร์วิ่ง แบนเนอร์แบบประเมิน และเปิดแบบประเมินได้', async ({ page }) => {
  await loginEmployee(page, { lastSeenBadgeAt: '2026-11-01T00:00:00.000Z' });
  await expect(bib(page)).toHaveText('160');
  await expect(page.locator('.ws-bib-id')).toHaveText('EMP0002');
  const callout = page.locator('.ws-callout');
  await expect(callout).toContainText('ติดตามผล 8 สัปดาห์ รอบที่ 1');
  await callout.getByRole('button', { name: 'กรอกเลย' }).click();
  await expect(page.locator('.ws-bib')).toHaveCount(0);
});

test('ส่งกิจกรรม: ต้องเลือกประเภท ส่งแล้วขึ้นในประวัติ', async ({ page }) => {
  await loginEmployee(page, { lastSeenBadgeAt: '2026-11-01T00:00:00.000Z' });
  await page.getByRole('button', { name: 'ส่งข้อมูล', exact: true }).click();
  await expect(page.getByText('กรุณาเลือกประเภทกิจกรรม')).toBeVisible();

  const activity = page.getByLabel('ประเภทกิจกรรม');
  await expect(activity.locator('option')).toContainText(['วิ่ง 5 กม.', 'เดินเร็ว 30 นาที']);
  await activity.selectOption({ label: 'เดินเร็ว 30 นาที (5 คะแนน)' });
  await page.getByLabel('ระยะเวลา (นาที)').fill('35');
  await page.getByRole('button', { name: 'ส่งข้อมูล', exact: true }).click();
  await expect(page.getByText('กิจกรรมนี้ต้องแนบรูปหลักฐาน')).toBeVisible();

  await activity.selectOption({ label: 'วิ่ง 5 กม. (10 คะแนน)' });
  await page.getByLabel('ระยะทาง (กม.)').fill('5.5');
  await page.getByLabel('ระยะเวลา (นาที)').fill('33');
  await page.getByLabel('หมายเหตุ (ถ้ามี)').fill('ส่งจากชุดทดสอบ');
  await page.getByRole('button', { name: 'ส่งข้อมูล', exact: true }).click();
  await expect(page.locator('.ws-alert-success')).toBeVisible();
  await expect(page.getByLabel('หมายเหตุ (ถ้ามี)')).toHaveValue('');
  await expect(page.getByText('ส่งจากชุดทดสอบ')).toBeVisible();
});

test('ของรางวัล: แลกแล้วคะแนนลด ยกเลิกแล้วคะแนนคืน', async ({ page }) => {
  await loginEmployee(page, { lastSeenBadgeAt: '2026-11-01T00:00:00.000Z' });
  await nav(page, 'ของรางวัล').click();
  const bottle = page.locator('.ws-card, .ws-tile', { hasText: 'กระบอกน้ำ' }).first();
  await expect(page.locator('.ws-tile, .ws-card', { hasText: 'เสื้อวิ่ง' }).first().getByRole('button', { name: 'คะแนนไม่พอ' })).toBeDisabled();
  await bottle.getByRole('button', { name: 'แลก' }).click();
  await expect(bib(page)).toHaveText('110');
  const pending = page.locator('.ws-card-row', { hasText: 'รอ' }).filter({ has: page.getByRole('button', { name: 'ยกเลิก' }) });
  await expect(pending).toHaveCount(1);
  await pending.getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(page.getByText('ยกเลิกรายการแลกของสำเร็จ คืนคะแนนแล้ว')).toBeVisible();
  await expect(bib(page)).toHaveText('160');
});

test('ชาเลนจ์: เข้าร่วมแบบไม่ระบุตัวตน แก้ชื่อที่แสดง และดู leaderboard', async ({ page }) => {
  await loginEmployee(page, { lastSeenBadgeAt: '2026-11-01T00:00:00.000Z' });
  await nav(page, 'ชาเลนจ์').click();
  const upcoming = page.locator('.ws-card-row', { hasText: 'ชาเลนจ์ปีใหม่' });
  await upcoming.locator('select').selectOption('ANONYMOUS');
  await upcoming.getByPlaceholder('ตั้งชื่อที่แสดง เช่น 🐱 นักวิ่งลึกลับ').fill('🐢 เต่าวิ่ง');
  await upcoming.getByRole('button', { name: 'เข้าร่วม' }).click();
  await expect(page.locator('.ws-alert-success').first()).toBeVisible();

  // การ์ดในหมวด "ชาเลนจ์ ที่เข้าร่วมอยู่" (มีระยะทางสะสมของฉัน)
  const mine = page.locator('.ws-card', { hasText: 'ระยะทางสะสมของฉัน' }).filter({ hasText: 'ชาเลนจ์ปีใหม่' });
  await expect(mine).toContainText('🐢 เต่าวิ่ง');
  await mine.getByRole('button', { name: 'แก้ไขชื่อที่แสดง' }).click();
  await mine.getByPlaceholder('ตั้งชื่อที่แสดง เช่น 🐱 นักวิ่งลึกลับ').fill('🐇 กระต่ายวิ่ง');
  await mine.getByRole('button', { name: 'บันทึก' }).click();
  await expect(mine).toContainText('🐇 กระต่ายวิ่ง');
  await expect(mine.getByRole('button', { name: 'แก้ไขชื่อที่แสดง' })).toBeVisible();

  await page.locator('.ws-card', { hasText: 'ชาเลนจ์วิ่งสู้ฝน' }).first().getByRole('button', { name: 'ดู Leaderboard' }).click();
  const modal = page.locator('.ws-modal');
  await expect(modal).toContainText('นักวิ่งเงา');
  await modal.getByRole('button', { name: 'ปิด' }).click();
  await expect(page.locator('.ws-modal')).toHaveCount(0);
});

test('เหรียญตรา และสลับแท็บแล้วข้อมูลที่พิมพ์ค้างยังอยู่', async ({ page }) => {
  await loginEmployee(page, { lastSeenBadgeAt: '2026-11-01T00:00:00.000Z' });
  await page.getByLabel('หมายเหตุ (ถ้ามี)').fill('ยังไม่ส่ง');
  await nav(page, 'เหรียญตรา').click();
  await expect(page.getByText('ก้าวแรก')).toBeVisible();
  await expect(page.getByText('นักวิ่ง 10K')).toBeVisible();
  await nav(page, 'ส่งกิจกรรม').click();
  await expect(page.getByLabel('หมายเหตุ (ถ้ามี)')).toHaveValue('ยังไม่ส่ง');
});
