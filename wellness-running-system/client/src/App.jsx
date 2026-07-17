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

  // ---- Phase 2: reward redemption ----
  const [scoreBalance, setScoreBalance] = useState(0);
  const [rewards, setRewards] = useState([]);
  const [myRedeems, setMyRedeems] = useState([]);
  const [redeemingRewardId, setRedeemingRewardId] = useState(null);
  const [cancelingRedeemId, setCancelingRedeemId] = useState(null);
  const [rewardMessage, setRewardMessage] = useState('');
  const [rewardMessageType, setRewardMessageType] = useState('info'); // 'success' | 'error'

  // ---- Phase 3: challenge + leaderboard ----
  const [challenges, setChallenges] = useState([]);
  const [myChallenges, setMyChallenges] = useState([]);
  const [challengeMessage, setChallengeMessage] = useState('');
  const [challengeMessageType, setChallengeMessageType] = useState('info'); // 'success' | 'error'
  const [joiningChallengeId, setJoiningChallengeId] = useState(null);
  const [joinModeByChallenge, setJoinModeByChallenge] = useState({}); // { [challengeId]: 'PUBLIC' | 'ANONYMOUS' }
  const [leaderboardChallengeId, setLeaderboardChallengeId] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState('');

  // ---- Phase 4: badge ----
  const [badges, setBadges] = useState([]);
  const [newBadgesToShow, setNewBadgesToShow] = useState([]); // badge ที่เพิ่งได้ใหม่ รอเด้ง popup

  const BADGE_CONDITION_LABEL_TH = {
    DISTANCE: 'สะสมระยะทาง',
    SUBMISSION_COUNT: 'ส่งกิจกรรมสำเร็จ',
    SCORE: 'สะสมคะแนน',
    STREAK_DAYS: 'วิ่งติดต่อกัน',
  };

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

  async function loadRewardData() {
    try {
      const [balanceRes, rewardsRes, myRedeemsRes] = await Promise.all([
        fetch(`${API_BASE}/api/my-score`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/rewards`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/my-redeems`, { credentials: 'include' }),
      ]);

      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setScoreBalance(balanceData.balance);
      }
      if (rewardsRes.ok) {
        setRewards(await rewardsRes.json());
      }
      if (myRedeemsRes.ok) {
        setMyRedeems(await myRedeemsRes.json());
      }
    } catch (err) {
      console.error('load reward data error:', err);
    }
  }

  useEffect(() => {
    if (status !== 'done') return;
    loadRewardData();
  }, [status]);

  async function loadChallengeData() {
    try {
      const [challengesRes, myChallengesRes] = await Promise.all([
        fetch(`${API_BASE}/api/challenges`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/my-challenges`, { credentials: 'include' }),
      ]);

      if (challengesRes.ok) {
        setChallenges(await challengesRes.json());
      }
      if (myChallengesRes.ok) {
        setMyChallenges(await myChallengesRes.json());
      }
    } catch (err) {
      console.error('load challenge data error:', err);
    }
  }

  useEffect(() => {
    if (status !== 'done') return;
    loadChallengeData();
  }, [status]);

  // localStorage เก็บเวลา badge ล่าสุดที่พนักงานคนนี้ "เห็น" popup ไปแล้ว กันเด้งซ้ำทุกครั้งที่เปิดแอป
  function getLastSeenBadgeAt(employeeId) {
    return localStorage.getItem(`wellness_last_seen_badge_${employeeId}`);
  }
  function setLastSeenBadgeAt(employeeId, isoString) {
    localStorage.setItem(`wellness_last_seen_badge_${employeeId}`, isoString);
  }

  async function loadBadgeData() {
    try {
      const res = await fetch(`${API_BASE}/api/my-badges`, { credentials: 'include' });
      const data = await res.json().catch(() => []);
      if (!res.ok) return;
      setBadges(data);
      return data;
    } catch (err) {
      console.error('load badge data error:', err);
      return [];
    }
  }

  useEffect(() => {
    if (status !== 'done' || !user?.employeeId) return;

    (async () => {
      const data = await loadBadgeData();
      const lastSeen = getLastSeenBadgeAt(user.employeeId);
      const earned = (data || []).filter((b) => b.earned);
      const unseen = lastSeen
        ? earned.filter((b) => new Date(b.receivedAt).getTime() > new Date(lastSeen).getTime())
        : earned; // ยังไม่เคยเปิดแอปนี้เลย ให้เห็น badge ที่มีอยู่ทั้งหมดเป็น "ใหม่" ครั้งแรกครั้งเดียว
      if (unseen.length > 0) {
        setNewBadgesToShow(unseen);
      }
    })();
  }, [status, user?.employeeId]);

  function closeNewBadgePopup() {
    if (user?.employeeId) {
      setLastSeenBadgeAt(user.employeeId, new Date().toISOString());
    }
    setNewBadgesToShow([]);
  }

  async function handleJoinChallenge(challengeId) {
    setJoiningChallengeId(challengeId);
    setChallengeMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/challenges/${challengeId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ joinMode: joinModeByChallenge[challengeId] || 'PUBLIC' }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'เข้าร่วม challenge ไม่สำเร็จ');
      }

      setChallengeMessageType('success');
      setChallengeMessage(data.message || 'เข้าร่วม challenge สำเร็จ');
      await loadChallengeData();
    } catch (err) {
      setChallengeMessageType('error');
      setChallengeMessage(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setJoiningChallengeId(null);
    }
  }

  async function openLeaderboard(challengeId) {
    setLeaderboardChallengeId(challengeId);
    setLeaderboardLoading(true);
    setLeaderboardError('');
    setLeaderboard([]);

    try {
      const res = await fetch(`${API_BASE}/api/challenges/${challengeId}/leaderboard`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || 'โหลด leaderboard ไม่สำเร็จ');
      }
      setLeaderboard(data);
    } catch (err) {
      setLeaderboardError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLeaderboardLoading(false);
    }
  }

  function closeLeaderboard() {
    setLeaderboardChallengeId(null);
    setLeaderboard([]);
    setLeaderboardError('');
  }

  const CHALLENGE_STATUS_LABEL_TH = {
    UPCOMING: 'ยังไม่เริ่ม',
    ONGOING: 'กำลังแข่งขัน',
    ENDED: 'จบแล้ว',
    CANCELLED: 'ยกเลิกแล้ว',
  };

  async function handleRedeem(rewardId) {
    setRedeemingRewardId(rewardId);
    setRewardMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rewardId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'แลกของรางวัลไม่สำเร็จ');
      }

      setRewardMessageType('success');
      setRewardMessage(data.message || 'แลกของรางวัลสำเร็จ');
      await loadRewardData();
    } catch (err) {
      setRewardMessageType('error');
      setRewardMessage(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRedeemingRewardId(null);
    }
  }

  async function handleCancelRedeem(redeemId) {
    setCancelingRedeemId(redeemId);
    setRewardMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/redeem/${redeemId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'ยกเลิกไม่สำเร็จ');
      }

      setRewardMessageType('success');
      setRewardMessage('ยกเลิกรายการแลกของสำเร็จ คืนคะแนนแล้ว');
      await loadRewardData();
    } catch (err) {
      setRewardMessageType('error');
      setRewardMessage(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setCancelingRedeemId(null);
    }
  }

  const STATUS_LABEL_TH = {
    PENDING: 'รอดำเนินการ',
    APPROVED: 'อนุมัติแล้ว',
    REJECTED: 'ถูกปฏิเสธ',
    CANCELLED: 'ยกเลิกแล้ว',
  };

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
      <div className="ws-app" style={{ padding: 24, textAlign: 'center' }}>
        <p>เข้าสู่ระบบไม่สำเร็จ: {errorMsg}</p>
        <button className="ws-btn ws-btn-primary" onClick={() => window.location.reload()}>ลองอีกครั้ง</button>
      </div>
    );
  }

  if (status === 'needsEmployeeId') {
    return (
      <div className="ws-app" style={{ padding: 24, textAlign: 'center' }}>
        <p>ยืนยันตัวตนครั้งแรก กรุณากรอกรหัสพนักงาน</p>
        <form onSubmit={handleSubmitEmployeeId} className="ws-row" style={{ justifyContent: 'center' }}>
          <input
            type="text"
            value={employeeIdInput}
            onChange={(e) => setEmployeeIdInput(e.target.value)}
            placeholder="เช่น EMP001"
            className="ws-input"
            style={{ maxWidth: 220 }}
          />
          <button type="submit" className="ws-btn ws-btn-primary">ยืนยัน</button>
        </form>
        {errorMsg && <div className="ws-alert ws-alert-danger" style={{ maxWidth: 320, margin: '12px auto 0' }}>{errorMsg}</div>}
      </div>
    );
  }

  if (status === 'done') {
    return (
      <>
      <div className="ws-app" style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center' }}>
          <p>เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ {user?.displayName}</p>
          <p>รหัสพนักงาน: {user?.employeeId}</p>
        </div>

        <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--ws-border)' }} />

        <h3>เหรียญตราของฉัน</h3>
        {badges.length === 0 && <p className="ws-empty">ยังไม่มี badge ให้เก็บตอนนี้</p>}
        {badges.length > 0 && (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {badges.map((b) => (
              <div
                key={b.badgeId}
                title={b.description || ''}
                style={{
                  minWidth: 100,
                  textAlign: 'center',
                  opacity: b.earned ? 1 : 0.35,
                  flexShrink: 0,
                }}
              >
                <div className="ws-icon-circle" style={{ width: 64, height: 64, margin: '0 auto 6px' }}>
                  {b.icon ? (
                    <img src={`${API_BASE}/${b.icon}`} alt={b.badgeName} />
                  ) : (
                    <span style={{ fontSize: 24 }}>🏅</span>
                  )}
                </div>
                <div style={{ fontSize: 12, fontWeight: 'bold' }}>{b.badgeName}</div>
                <div style={{ fontSize: 11, color: 'var(--ws-text-muted)' }}>
                  {BADGE_CONDITION_LABEL_TH[b.conditionType] || b.conditionType} ≥ {b.conditionValue}
                </div>
              </div>
            ))}
          </div>
        )}

        <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--ws-border)' }} />

        <h3>ส่งกิจกรรมวิ่ง/เดิน</h3>
        <form onSubmit={handleSubmitActivity} className="ws-stack" style={{ textAlign: 'left' }}>
          <div>
            <label htmlFor="activitySelect" className="ws-label">ประเภทกิจกรรม</label>
            <select
              id="activitySelect"
              value={selectedActivityId}
              onChange={(e) => setSelectedActivityId(e.target.value)}
              className="ws-select"
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

          <div>
            <label htmlFor="distanceInput" className="ws-label">ระยะทาง (กม.)</label>
            <input
              id="distanceInput"
              type="number"
              step="0.1"
              min="0"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="ws-input"
            />
          </div>

          <div>
            <label htmlFor="durationInput" className="ws-label">ระยะเวลา (นาที)</label>
            <input
              id="durationInput"
              type="number"
              step="1"
              min="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="ws-input"
            />
          </div>

          <div>
            <label htmlFor="noteInput" className="ws-label">หมายเหตุ (ถ้ามี)</label>
            <textarea
              id="noteInput"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="ws-textarea"
            />
          </div>

          <div>
            <label htmlFor="proofInput" className="ws-label">
              รูปหลักฐาน {photoRequired ? '(บังคับ)' : '(ไม่บังคับ)'}
            </label>
            <input
              id="proofInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
            />
          </div>

          <button type="submit" className="ws-btn ws-btn-primary" disabled={submitState === 'submitting'}>
            {submitState === 'submitting' ? 'กำลังส่ง...' : 'ส่งข้อมูล'}
          </button>
        </form>

        {submitMessage && (
          <div className={`ws-alert ${submitState === 'error' ? 'ws-alert-danger' : 'ws-alert-success'}`}>{submitMessage}</div>
        )}

        <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--ws-border)' }} />

        <div className="ws-row-between">
          <h3 style={{ margin: 0 }}>แลกของรางวัล</h3>
          <span>
            คะแนนคงเหลือ: <strong style={{ color: 'var(--ws-primary)' }}>{scoreBalance}</strong>
          </span>
        </div>

        {rewardMessage && (
          <div className={`ws-alert ${rewardMessageType === 'error' ? 'ws-alert-danger' : 'ws-alert-success'}`}>{rewardMessage}</div>
        )}

        {rewards.length === 0 && <p className="ws-empty">ยังไม่มีของรางวัลให้แลกตอนนี้</p>}

        <div className="ws-stack">
          {rewards.map((r) => {
            const canAfford = scoreBalance >= r.required_score;
            const inStock = r.stock > 0;
            const isRedeeming = redeemingRewardId === r.reward_id;
            return (
              <div key={r.reward_id} className="ws-card ws-card-row">
                <div>
                  <div style={{ fontWeight: 'bold' }}>{r.reward_name}</div>
                  <div style={{ fontSize: 14, color: 'var(--ws-text-secondary)' }}>
                    {r.required_score} คะแนน · เหลือ {r.stock} ชิ้น
                  </div>
                  {r.description && (
                    <div style={{ fontSize: 13, color: 'var(--ws-text-muted)' }}>{r.description}</div>
                  )}
                </div>
                <button
                  className="ws-btn ws-btn-primary"
                  onClick={() => handleRedeem(r.reward_id)}
                  disabled={!canAfford || !inStock || isRedeeming}
                >
                  {isRedeeming ? 'กำลังแลก...' : !inStock ? 'ของหมด' : !canAfford ? 'คะแนนไม่พอ' : 'แลก'}
                </button>
              </div>
            );
          })}
        </div>

        <h4 style={{ marginTop: 20 }}>ประวัติการแลกของ</h4>
        {myRedeems.length === 0 && <p className="ws-empty">ยังไม่มีประวัติการแลกของ</p>}
        {myRedeems.length > 0 && (
          <div className="ws-stack">
            {myRedeems.map((rd) => (
              <div key={rd.redeem_id} className="ws-card ws-card-row">
                <div>
                  <div style={{ fontWeight: 'bold' }}>{rd.reward_name}</div>
                  <div style={{ fontSize: 14, color: 'var(--ws-text-secondary)' }}>
                    ใช้ {rd.used_score} คะแนน ·{' '}
                    <span className={`ws-badge ${
                      rd.status === 'APPROVED' ? 'ws-badge-success' :
                      rd.status === 'REJECTED' || rd.status === 'CANCELLED' ? 'ws-badge-danger' :
                      'ws-badge-warning'
                    }`}>{STATUS_LABEL_TH[rd.status] || rd.status}</span>
                    {' '}· {new Date(rd.redeem_date).toLocaleString('th-TH')}
                  </div>
                </div>
                {rd.status === 'PENDING' && (
                  <button
                    className="ws-btn ws-btn-danger ws-btn-sm"
                    onClick={() => handleCancelRedeem(rd.redeem_id)}
                    disabled={cancelingRedeemId === rd.redeem_id}
                  >
                    {cancelingRedeemId === rd.redeem_id ? 'กำลังยกเลิก...' : 'ยกเลิก'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--ws-border)' }} />

        <h3>Challenge</h3>

        {challengeMessage && (
          <div className={`ws-alert ${challengeMessageType === 'error' ? 'ws-alert-danger' : 'ws-alert-success'}`}>{challengeMessage}</div>
        )}

        {myChallenges.length > 0 && (
          <>
            <h4>Challenge ที่เข้าร่วมอยู่</h4>
            <div className="ws-stack" style={{ marginBottom: 16 }}>
              {myChallenges.map((mc) => (
                <div key={mc.participant_id} className="ws-card ws-card-row">
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{mc.challenge_name}</div>
                    <div style={{ fontSize: 14, color: 'var(--ws-text-secondary)' }}>
                      {mc.category_name} · <span className="ws-badge ws-badge-info">{CHALLENGE_STATUS_LABEL_TH[mc.status] || mc.status}</span> · ระยะทางสะสมของฉัน{' '}
                      {mc.my_distance} กม.
                      {mc.join_mode === 'ANONYMOUS' && ' · เข้าร่วมแบบไม่ระบุตัวตน'}
                    </div>
                  </div>
                  <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => openLeaderboard(mc.challenge_id)}>ดู Leaderboard</button>
                </div>
              ))}
            </div>
          </>
        )}

        <h4>Challenge ที่เปิดอยู่</h4>
        {challenges.length === 0 && <p className="ws-empty">ยังไม่มี challenge ที่เปิดอยู่ตอนนี้</p>}

        <div className="ws-stack">
          {challenges.map((c) => {
            const isJoining = joiningChallengeId === c.challenge_id;
            return (
              <div key={c.challenge_id} className="ws-card ws-card-row">
                <div>
                  <div style={{ fontWeight: 'bold' }}>{c.challenge_name}</div>
                  <div style={{ fontSize: 14, color: 'var(--ws-text-secondary)' }}>
                    {c.category_name} · <span className="ws-badge ws-badge-info">{CHALLENGE_STATUS_LABEL_TH[c.status] || c.status}</span> · ผู้เข้าร่วม{' '}
                    {c.participant_count} คน
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ws-text-muted)' }}>
                    {new Date(c.start_date).toLocaleDateString('th-TH')} -{' '}
                    {new Date(c.end_date).toLocaleDateString('th-TH')}
                  </div>
                  {c.description && <div style={{ fontSize: 13, color: 'var(--ws-text-muted)' }}>{c.description}</div>}
                </div>

                <div className="ws-row">
                  {c.joined ? (
                    <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => openLeaderboard(c.challenge_id)}>ดู Leaderboard</button>
                  ) : (
                    <>
                      <select
                        value={joinModeByChallenge[c.challenge_id] || 'PUBLIC'}
                        onChange={(e) =>
                          setJoinModeByChallenge((prev) => ({ ...prev, [c.challenge_id]: e.target.value }))
                        }
                        className="ws-select"
                        style={{ width: 'auto' }}
                      >
                        <option value="PUBLIC">แสดงชื่อจริง</option>
                        <option value="ANONYMOUS">ไม่ระบุตัวตน</option>
                      </select>
                      <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => handleJoinChallenge(c.challenge_id)} disabled={isJoining}>
                        {isJoining ? 'กำลังเข้าร่วม...' : 'เข้าร่วม'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {newBadgesToShow.length > 0 && (
        <div className="ws-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="ws-modal" style={{ maxWidth: 360, textAlign: 'center' }}>
            <h3>🎉 ได้ Badge ใหม่!</h3>
            <div className="ws-stack" style={{ marginBottom: 16 }}>
              {newBadgesToShow.map((b) => (
                <div key={b.badgeId}>
                  <div className="ws-icon-circle" style={{ width: 72, height: 72, margin: '0 auto 6px' }}>
                    {b.icon ? (
                      <img src={`${API_BASE}/${b.icon}`} alt={b.badgeName} />
                    ) : (
                      <span style={{ fontSize: 32 }}>🏅</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 'bold' }}>{b.badgeName}</div>
                  {b.description && <div style={{ fontSize: 13, color: 'var(--ws-text-secondary)' }}>{b.description}</div>}
                </div>
              ))}
            </div>
            <button className="ws-btn ws-btn-primary" onClick={closeNewBadgePopup}>รับทราบ</button>
          </div>
        </div>
      )}

      {leaderboardChallengeId !== null && (
        <div className="ws-modal-overlay">
          <div className="ws-modal" style={{ maxWidth: 420 }}>
            <h3>Leaderboard</h3>

            {leaderboardLoading && <p className="ws-empty">กำลังโหลด...</p>}
            {leaderboardError && <div className="ws-alert ws-alert-danger">{leaderboardError}</div>}

            {!leaderboardLoading && !leaderboardError && leaderboard.length === 0 && (
              <p className="ws-empty">ยังไม่มีผู้เข้าร่วม</p>
            )}

            {!leaderboardLoading && leaderboard.length > 0 && (
              <div className="ws-stack" style={{ gap: 6 }}>
                {leaderboard.map((row) => (
                  <div
                    key={row.rank}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: '1px solid var(--ws-border)',
                      fontWeight: row.isMe ? 'bold' : 'normal',
                      color: row.isMe ? 'var(--ws-primary)' : 'inherit',
                    }}
                  >
                    <span>
                      #{row.rank} {row.displayName} {row.isMe && '(คุณ)'}
                    </span>
                    <span>
                      {row.totalDistance} กม. · {row.runCount} ครั้ง
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="ws-modal-actions">
              <button className="ws-btn ws-btn-secondary" onClick={closeLeaderboard}>ปิด</button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <div className="ws-app" style={{ padding: 24, textAlign: 'center' }}>
      <p>กำลังเข้าสู่ระบบผ่าน LINE...</p>
    </div>
  );
}