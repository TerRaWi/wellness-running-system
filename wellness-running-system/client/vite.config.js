import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// โหมด e2e (ใช้โดย Playwright ในโฟลเดอร์ e2e/): สลับ @line/liff เป็นตัวจำลอง เพราะเครื่องทดสอบล็อกอิน LINE จริงไม่ได้
// และชี้ proxy ไปที่ API ของชุดทดสอบ (ฐานข้อมูลทดสอบ) แทน localhost:4000 ที่ใช้ตอนพัฒนา
export default defineConfig(({ mode }) => {
  const apiTarget = process.env.E2E_API_TARGET || 'http://localhost:4000'

  return {
    plugins: [react()],
    resolve: {
      alias:
        mode === 'e2e'
          ? { '@line/liff': fileURLToPath(new URL('./e2e-mocks/liff.js', import.meta.url)) }
          : {},
    },
    server: {
      allowedHosts: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
