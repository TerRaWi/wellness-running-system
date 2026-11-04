import { useState } from 'react';
import { createApiClient } from '../../lib/apiClient';
import { ErrorAlert } from './AdminUi';

const loginApi = createApiClient(null);

// หน้าเข้าสู่ระบบแอดมิน — สำเร็จแล้วส่ง { employeeId, token } กลับให้ AdminApp
// รหัสพนักงานที่พิมพ์เก็บไว้ที่ AdminApp เพื่อให้ออกจากระบบแล้วยังกรอกค้างไว้ให้เหมือนเดิม
export default function AdminLogin({ employeeId, onEmployeeIdChange, onLoggedIn }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await loginApi.request('/api/admin/login', {
        method: 'POST',
        json: { employeeId: employeeId.trim(), password },
        errorMessage: 'เข้าสู่ระบบไม่สำเร็จ',
      });
      setPassword('');
      onLoggedIn(data);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
      setSubmitting(false);
    }
  }

  return (
    <div className="ws-app ws-gate">
      <div className="ws-gate-card">
        <div className="ws-wordmark">WELLNESS RUNNING</div>
        <h2>เข้าสู่ระบบแอดมิน</h2>
        <p>ใช้รหัสพนักงานและรหัสผ่านที่ได้รับจากผู้ดูแลระบบ</p>
        <form onSubmit={handleSubmit} className="ws-stack">
          <div>
            <label htmlFor="loginEmployeeId" className="ws-label">รหัสพนักงาน</label>
            <input
              id="loginEmployeeId"
              type="text"
              value={employeeId}
              onChange={(e) => onEmployeeIdChange(e.target.value)}
              className="ws-input"
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="loginPassword" className="ws-label">รหัสผ่าน</label>
            <input
              id="loginPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ws-input"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="ws-btn ws-btn-primary" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
        <ErrorAlert message={error} style={{ marginTop: 12, marginBottom: 0 }} />
      </div>
    </div>
  );
}
