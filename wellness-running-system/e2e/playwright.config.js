// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { DB, API_PORT, CLIENT_PORT, JWT_SECRET } = require('./test-env');

const rootDir = path.join(__dirname, '..');

module.exports = defineConfig({
  testDir: './tests',
  // ทุกไฟล์ใช้ฐานข้อมูลก้อนเดียวกันและแก้ข้อมูลจริง → รันทีละไฟล์ ทีละเทสต์
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: require.resolve('./global-setup.js'),
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixels: 0, animations: 'disabled', caret: 'hide' },
  },
  projects: [
    {
      name: 'functional',
      testIgnore: /visual\.spec\.js/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } },
    },
    {
      name: 'visual',
      testMatch: /visual\.spec\.js/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } },
    },
  ],
  webServer: [
    {
      // cwd = โฟลเดอร์ e2e เพื่อไม่ให้ dotenv โหลด server/.env (ค่าฐานข้อมูลจริง)
      command: `node "${path.join(rootDir, 'server', 'server.js')}"`,
      cwd: __dirname,
      url: `http://localhost:${API_PORT}/api/admin/me`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DB_HOST: DB.host,
        DB_PORT: String(DB.port),
        DB_USER: DB.user,
        DB_PASSWORD: DB.password,
        DB_NAME: DB.database,
        JWT_SECRET,
        PORT: String(API_PORT),
        NODE_ENV: 'test',
        LINE_CHANNEL_ID: 'e2e',
        CLOUDINARY_CLOUD_NAME: 'e2e',
        CLOUDINARY_API_KEY: 'e2e',
        CLOUDINARY_API_SECRET: 'e2e',
      },
    },
    {
      command: `npx vite --mode e2e --port ${CLIENT_PORT} --strictPort`,
      cwd: path.join(rootDir, 'client'),
      url: `http://localhost:${CLIENT_PORT}/admin`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { E2E_API_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
