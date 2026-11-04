import { useEffect, useMemo, useState } from 'react';
import liff from '@line/liff';
import { createApiClient } from './lib/apiClient';
import HealthAssessmentWizard from './components/HealthAssessmentWizard.jsx';
import EmployeeHome from './components/employee/EmployeeHome.jsx';

const LIFF_ID = import.meta.env.VITE_LIFF_ID;

// เข้าสู่ระบบด้วย LINE ID token — ส่ง nationalId มาด้วยเฉพาะตอนผูกบัญชีครั้งแรก
const loginApi = createApiClient(null);
function lineLogin(idToken, nationalId, errorMessage) {
  return loginApi.request('/api/auth/line-login', { method: 'POST', json: { idToken, nationalId }, errorMessage });
}

// แอปพนักงาน (เปิดใน LINE): ไฟล์นี้ดูแลเฉพาะขั้นตอนเข้าสู่ระบบ
// LIFF login → (ครั้งแรก) ยืนยันเลขบัตรประชาชน → (ครั้งแรก) แบบสอบถามสุขภาพ baseline → หน้าหลัก (EmployeeHome)
export default function App() {
  const [status, setStatus] = useState('initializing'); // initializing | loading | needsNationalId | needsHealthAssessment | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [idToken, setIdToken] = useState(null);
  const [nationalIdInput, setNationalIdInput] = useState('');
  const [user, setUser] = useState(null);
  // token สำหรับ header Authorization — ใช้แทน cookie เพราะ LINE in-app browser
  // (ITP) มักบล็อก cross-site cookie ระหว่าง frontend (Vercel) กับ backend (Render)
  const [authToken, setAuthToken] = useState(() => sessionStorage.getItem('authToken') || null);
  const api = useMemo(() => createApiClient(authToken), [authToken]);

  function saveAuthToken(token) {
    setAuthToken(token);
    if (token) {
      sessionStorage.setItem('authToken', token);
    } else {
      sessionStorage.removeItem('authToken');
    }
  }

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

        await callLogin(token);
      } catch (err) {
        if (cancelled) return;
        console.error('LIFF login error:', err);
        setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
        setStatus('error');
      }
    }

    async function callLogin(token) {
      const data = await lineLogin(token, null, 'เข้าสู่ระบบไม่สำเร็จ');
      if (data.linked) {
        saveAuthToken(data.token || null);
        setUser(data);
        setStatus(data.needsHealthAssessment ? 'needsHealthAssessment' : 'done');
      } else if (data.needsNationalId) {
        setStatus('needsNationalId');
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmitNationalId(e) {
    e.preventDefault();
    const trimmed = nationalIdInput.trim();
    if (!trimmed) return;
    if (!/^\d{13}$/.test(trimmed)) {
      setErrorMsg('เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const data = await lineLogin(idToken, trimmed, 'ผูกบัญชีไม่สำเร็จ');
      saveAuthToken(data.token || null);
      setUser(data);
      setStatus(data.needsHealthAssessment ? 'needsHealthAssessment' : 'done');
    } catch (err) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาด');
      setStatus('needsNationalId');
    }
  }

  function handleHealthAssessmentComplete() {
    setStatus('done');
  }

  if (status === 'error') {
    return (
      <div className="ws-app ws-gate">
        <div className="ws-gate-card">
          <div className="ws-wordmark">WELLNESS RUNNING</div>
          <h2>เข้าสู่ระบบไม่สำเร็จ</h2>
          <div className="ws-alert ws-alert-danger">{errorMsg}</div>
          <button className="ws-btn ws-btn-primary" style={{ width: '100%' }} onClick={() => window.location.reload()}>
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  if (status === 'needsNationalId') {
    return (
      <div className="ws-app ws-gate">
        <div className="ws-gate-card">
          <div className="ws-wordmark">WELLNESS RUNNING</div>
          <h2>ยืนยันตัวตนครั้งแรก</h2>
          <p>กรอกเลขบัตรประชาชน 13 หลัก เพื่อผูกบัญชี LINE กับข้อมูลพนักงาน ทำครั้งเดียว</p>
          <form onSubmit={handleSubmitNationalId} className="ws-stack">
            <div>
              <label htmlFor="nationalIdInput" className="ws-label">เลขบัตรประชาชน</label>
              <input
                id="nationalIdInput"
                type="text"
                inputMode="numeric"
                maxLength={13}
                value={nationalIdInput}
                onChange={(e) => setNationalIdInput(e.target.value.replace(/\D/g, ''))}
                placeholder="ตัวเลข 13 หลัก"
                className="ws-input"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
            <button type="submit" className="ws-btn ws-btn-primary">ยืนยัน</button>
          </form>
          {errorMsg && <div className="ws-alert ws-alert-danger" style={{ marginTop: 12, marginBottom: 0 }}>{errorMsg}</div>}
        </div>
      </div>
    );
  }

  if (status === 'needsHealthAssessment') {
    return (
      <HealthAssessmentWizard
        apiBase={api.apiBase}
        authToken={authToken}
        onComplete={handleHealthAssessmentComplete}
      />
    );
  }
  if (status === 'done') {
    return <EmployeeHome api={api} authToken={authToken} user={user} />;
  }

  return (
    <div className="ws-app ws-gate">
      <div>
        <div className="ws-track" aria-hidden="true" />
        <p className="ws-splash-text" role="status">กำลังเข้าสู่ระบบผ่าน LINE...</p>
      </div>
    </div>
  );
}