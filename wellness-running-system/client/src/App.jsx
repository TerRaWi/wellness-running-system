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

  // ---- Phase 1 Part B: activity submission ----
  const [activities, setActivities] = useState([]);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submitState, setSubmitState] = useState('idle'); // idle | submitting | success | error
  const [submitMessage, setSubmitMessage] = useState('');

  const selectedActivity = activities.find(
    (a) => String(a.activity_id) === String(selectedActivityId)
  );
  const photoRequired = Boolean(selectedActivity?.require_image);

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

  useEffect(() => {
    if (status !== 'done') return;

    let cancelled = false;

    async function loadActivities() {
      try {
        const res = await fetch(`${API_BASE}/api/activities`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => []);
        if (!cancelled && res.ok) {
          setActivities(data);
        }
      } catch (err) {
        console.error('load activities error:', err);
      }
    }

    loadActivities();
    return () => {
      cancelled = true;
    };
  }, [status]);

  async function handleSubmitActivity(e) {
    e.preventDefault();

    if (!selectedActivityId) {
      setSubmitState('error');
      setSubmitMessage('กรุณาเลือกประเภทกิจกรรม');
      return;
    }
    if (photoRequired && !proofFile) {
      setSubmitState('error');
      setSubmitMessage('กิจกรรมนี้ต้องแนบรูปหลักฐาน');
      return;
    }

    setSubmitState('submitting');
    setSubmitMessage('');

    try {
      const formData = new FormData();
      formData.append('activityId', selectedActivityId);
      formData.append('distance', distance);
      formData.append('duration', duration);
      formData.append('note', note);
      if (proofFile) {
        formData.append('proofImage', proofFile);
      }

      // ห้ามใส่ header Content-Type เอง ปล่อยให้ browser ตั้ง boundary ของ multipart ให้อัตโนมัติ
      const res = await fetch(`${API_BASE}/api/submissions`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'ส่งข้อมูลไม่สำเร็จ');
      }

      setSubmitState('success');
      setSubmitMessage(data.message || 'ส่งข้อมูลการวิ่งสำเร็จ กรุณารอการตรวจสอบจากแอดมิน');
      setSelectedActivityId('');
      setDistance('');
      setDuration('');
      setNote('');
      setProofFile(null);
    } catch (err) {
      setSubmitState('error');
      setSubmitMessage(err.message || 'เกิดข้อผิดพลาด');
    }
  }

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
      <div style={{ padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <p>เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ {user?.displayName}</p>
          <p>รหัสพนักงาน: {user?.employeeId}</p>
        </div>

        <hr style={{ margin: '16px 0' }} />

        <h3>ส่งกิจกรรมวิ่ง/เดิน</h3>
        <form onSubmit={handleSubmitActivity}>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="activitySelect">ประเภทกิจกรรม</label>
            <br />
            <select
              id="activitySelect"
              value={selectedActivityId}
              onChange={(e) => setSelectedActivityId(e.target.value)}
              style={{ padding: 8, fontSize: 16, width: '100%' }}
            >
              <option value="">-- เลือกกิจกรรม --</option>
              {Object.entries(
                activities.reduce((groups, a) => {
                  const key = a.category_name;
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(a);
                  return groups;
                }, {})
              ).map(([categoryName, items]) => (
                <optgroup key={categoryName} label={categoryName}>
                  {items.map((a) => (
                    <option key={a.activity_id} value={a.activity_id}>
                      {a.activity_name} ({a.score} คะแนน)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="distanceInput">ระยะทาง (กม.)</label>
            <br />
            <input
              id="distanceInput"
              type="number"
              step="0.1"
              min="0"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              style={{ padding: 8, fontSize: 16, width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="durationInput">ระยะเวลา (นาที)</label>
            <br />
            <input
              id="durationInput"
              type="number"
              step="1"
              min="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={{ padding: 8, fontSize: 16, width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="noteInput">หมายเหตุ (ถ้ามี)</label>
            <br />
            <textarea
              id="noteInput"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              style={{ padding: 8, fontSize: 16, width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="proofInput">
              รูปหลักฐาน {photoRequired ? '(บังคับ)' : '(ไม่บังคับ)'}
            </label>
            <br />
            <input
              id="proofInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
            />
          </div>

          <button type="submit" disabled={submitState === 'submitting'}>
            {submitState === 'submitting' ? 'กำลังส่ง...' : 'ส่งข้อมูล'}
          </button>
        </form>

        {submitMessage && (
          <p style={{ color: submitState === 'error' ? 'red' : 'green' }}>{submitMessage}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <p>กำลังเข้าสู่ระบบผ่าน LINE...</p>
    </div>
  );
}