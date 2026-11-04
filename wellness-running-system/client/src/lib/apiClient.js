export const API_BASE = import.meta.env.VITE_API_BASE;

// ตัวเรียก API กลาง ใช้ทั้งฝั่งแอดมินและพนักงาน — แนบ token เป็น Authorization header ทุกคำขอ
// (cross-site cookie ระหว่าง frontend (Vercel) กับ backend (Render) มักถูกเบราว์เซอร์บล็อก
// โดยเฉพาะ LINE in-app browser) และส่ง cookie ไปด้วยเผื่อเบราว์เซอร์ที่ยังใช้ cookie ได้
export function createApiClient(token) {
  function fetchOptions(extra = {}) {
    return {
      ...extra,
      credentials: 'include',
      headers: {
        ...(extra.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  }

  // json → ส่งเป็น application/json, body → ส่งตามที่ให้มา (เช่น FormData — ห้ามตั้ง Content-Type เอง
  // ให้ browser ใส่ boundary ของ multipart ให้) — ถ้า response ไม่ ok จะ throw Error(ข้อความจากเซิร์ฟเวอร์ หรือ errorMessage)
  async function request(path, { method, json, body, errorMessage = 'เกิดข้อผิดพลาด' } = {}) {
    const init = { method };
    if (json !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(json);
    } else if (body !== undefined) {
      init.body = body;
    }
    const res = await fetch(`${API_BASE}${path}`, fetchOptions(init));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || errorMessage);
    }
    return data;
  }

  // apiBase + fetchOptions ส่งต่อให้ component เดิมที่ยังเรียก fetch เอง (รายงาน, ประวัติการใช้งาน, ฟอร์มพนักงาน, แบบสอบถามสุขภาพ)
  return { apiBase: API_BASE, fetchOptions, request };
}
