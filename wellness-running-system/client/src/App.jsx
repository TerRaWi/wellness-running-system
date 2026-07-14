import { useEffect, useState } from 'react';
import liff from '@line/liff';

const LIFF_ID = import.meta.env.VITE_LIFF_ID;
const API_BASE = import.meta.env.VITE_API_BASE;

export default function App() {
  const [status, setStatus] = useState('initializing'); // initializing | loading | needsEmployeeId | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [idToken, setIdToken] = useState(null);
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const token = liff.getIDToken();
        if (!token) throw new Error('ไม่พบ ID token กรุณาลองเปิดใหม่อีกครั้ง');

        if (cancelled) return;
        setIdToken(token);
        setStatus('loading');

        await callLogin(token, null);
      } catch (err) {
        if (cancelled) return;
        console.error('LIFF login error:', err);
        setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
        setStatus('error');
      }
    }

    async function callLogin(token, employeeId) {
      const res = await fetch(`${API_BASE}/api/auth/line-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token, employeeId }),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'เข้าสู่ระบบไม่สำเร็จ');
      }

      if (data.linked) {
        setUser(data);
        setStatus('done');
      } else if (data.needsEmployeeId) {
        setStatus('needsEmployeeId');
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmitEmployeeId(e) {
    e.preventDefault();
    if (!employeeIdInput.trim()) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/line-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, employeeId: employeeIdInput.trim() }),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'ผูกบัญชีไม่สำเร็จ');
      }

      setUser(data);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาด');
      setStatus('needsEmployeeId');
    }
  }

  if (status === 'error') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>เข้าสู่ระบบไม่สำเร็จ: {errorMsg}</p>
        <button onClick={() => window.location.reload()}>ลองอีกครั้ง</button>
      </div>
    );
  }

  if (status === 'needsEmployeeId') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>ยืนยันตัวตนครั้งแรก กรุณากรอกรหัสพนักงาน</p>
        <form onSubmit={handleSubmitEmployeeId}>
          <input
            type="text"
            value={employeeIdInput}
            onChange={(e) => setEmployeeIdInput(e.target.value)}
            placeholder="เช่น EMP001"
            style={{ padding: 8, fontSize: 16, marginRight: 8 }}
          />
          <button type="submit">ยืนยัน</button>
        </form>
        {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ {user?.displayName}</p>
        <p>รหัสพนักงาน: {user?.employeeId}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <p>กำลังเข้าสู่ระบบผ่าน LINE...</p>
    </div>
  );
}