import { useEffect, useState } from 'react';
import liff from '@line/liff';
import BadgesSection from './components/BadgesSection.jsx';
import SubmitActivitySection from './components/SubmitActivitySection.jsx';
import SubmissionHistorySection from './components/SubmissionHistorySection.jsx';
import RewardsSection from './components/RewardsSection.jsx';
import ChallengesSection from './components/ChallengesSection.jsx';
import NewBadgePopup from './components/NewBadgePopup.jsx';
import LeaderboardModal from './components/LeaderboardModal.jsx';
import HealthAssessmentWizard from './components/HealthAssessmentWizard.jsx';

const LIFF_ID = import.meta.env.VITE_LIFF_ID;
const API_BASE = import.meta.env.VITE_API_BASE;

// แท็บหน้าพนักงาน — สลับกันแสดงทีละหน้าแทนการยาวสกอลรวด
const TABS = [
  { key: 'submit', label: 'ส่งกิจกรรม' },
  { key: 'challenges', label: 'ชาเลนจ์' },
  { key: 'rewards', label: 'แลกของรางวัล' },
  { key: 'badges', label: 'เหรียญตรา' },
];

export default function App() {
  const [status, setStatus] = useState('initializing'); // initializing | loading | needsEmployeeId | needsHealthAssessment | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [idToken, setIdToken] = useState(null);
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [user, setUser] = useState(null);

  // แท็บที่กำลังเปิดอยู่ในหน้าพนักงาน
  const [activeTab, setActiveTab] = useState('submit');

  // ---- Phase 1 Part B: activity submission ----
  const [activities, setActivities] = useState([]);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submitState, setSubmitState] = useState('idle'); // idle | submitting | success | error
  const [submitMessage, setSubmitMessage] = useState('');
  const [mySubmissions, setMySubmissions] = useState([]);

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

  // ---- Phase 5: follow-up health assessment campaign (ไม่ block การใช้แอป แค่เตือน) ----
  const [pendingCampaign, setPendingCampaign] = useState(null); // { campaignId, campaignName, includedFields } | null
  const [showFollowupWizard, setShowFollowupWizard] = useState(false);

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
        setStatus(data.needsHealthAssessment ? 'needsHealthAssessment' : 'done');
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

  async function loadSubmissionData() {
    try {
      const res = await fetch(`${API_BASE}/api/my-submissions`, { credentials: 'include' });
      const data = await res.json().catch(() => []);
      if (res.ok) {
        setMySubmissions(data);
      }
    } catch (err) {
      console.error('load submission data error:', err);
    }
  }

  useEffect(() => {
    if (status !== 'done') return;
    loadSubmissionData();
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

  // เช็คว่ามีรอบ follow-up ที่เปิดอยู่และยังไม่เคยตอบไหม — เรียกครั้งเดียวหลังเข้าแอปสำเร็จ
  // ไม่ block การใช้งาน แค่โชว์เป็น banner เตือนเฉยๆ
  useEffect(() => {
    if (status !== 'done') return;

    let cancelled = false;

    async function loadPendingCampaign() {
      try {
        const res = await fetch(`${API_BASE}/api/health-assessment/pending-campaign`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.campaign) {
          setPendingCampaign(data.campaign);
        }
      } catch (err) {
        console.error('load pending campaign error:', err);
      }
    }

    loadPendingCampaign();
    return () => {
      cancelled = true;
    };
  }, [status]);

  function handleFollowupComplete() {
    setShowFollowupWizard(false);
    setPendingCampaign(null);
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
      await loadSubmissionData();
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
      setStatus(data.needsHealthAssessment ? 'needsHealthAssessment' : 'done');
    } catch (err) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาด');
      setStatus('needsEmployeeId');
    }
  }

  function handleHealthAssessmentComplete() {
    setStatus('done');
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

  if (status === 'needsHealthAssessment') {
    return (
      <HealthAssessmentWizard
        apiBase={API_BASE}
        onComplete={handleHealthAssessmentComplete}
      />
    );
  }

  if (status === 'done') {
    if (showFollowupWizard && pendingCampaign) {
      return (
        <HealthAssessmentWizard
          apiBase={API_BASE}
          assessmentType="FOLLOWUP"
          campaignId={pendingCampaign.campaignId}
          includedFields={pendingCampaign.includedFields}
          onComplete={handleFollowupComplete}
        />
      );
    }

    return (
      <>
        <div className="ws-app" style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' }}>
            <p>เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ {user?.displayName}</p>
            <p>รหัสพนักงาน: {user?.employeeId}</p>
          </div>

          {pendingCampaign && (
            <div className="ws-alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span>มีแบบประเมินติดตามผลรอกรอก: {pendingCampaign.campaignName}</span>
              <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => setShowFollowupWizard(true)}>
                กรอกเลย
              </button>
            </div>
          )}

          <div className="ws-tabs ws-tabs-fill">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`ws-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'badges' && (
            <BadgesSection badges={badges} apiBase={API_BASE} />
          )}

          {activeTab === 'submit' && (
            <SubmitActivitySection
              activities={activities}
              selectedActivityId={selectedActivityId}
              setSelectedActivityId={setSelectedActivityId}
              distance={distance}
              setDistance={setDistance}
              duration={duration}
              setDuration={setDuration}
              note={note}
              setNote={setNote}
              setProofFile={setProofFile}
              photoRequired={photoRequired}
              submitState={submitState}
              submitMessage={submitMessage}
              onSubmit={handleSubmitActivity}
            />
          )}

          {activeTab === 'submit' && (
            <SubmissionHistorySection mySubmissions={mySubmissions} apiBase={API_BASE} />
          )}

          {activeTab === 'rewards' && (
            <RewardsSection
              rewards={rewards}
              scoreBalance={scoreBalance}
              rewardMessage={rewardMessage}
              rewardMessageType={rewardMessageType}
              redeemingRewardId={redeemingRewardId}
              onRedeem={handleRedeem}
              apiBase={API_BASE}
              myRedeems={myRedeems}
              cancelingRedeemId={cancelingRedeemId}
              onCancelRedeem={handleCancelRedeem}
            />
          )}

          {activeTab === 'challenges' && (
            <ChallengesSection
              myChallenges={myChallenges}
              challenges={challenges}
              challengeMessage={challengeMessage}
              challengeMessageType={challengeMessageType}
              joiningChallengeId={joiningChallengeId}
              joinModeByChallenge={joinModeByChallenge}
              setJoinModeByChallenge={setJoinModeByChallenge}
              onJoinChallenge={handleJoinChallenge}
              onOpenLeaderboard={openLeaderboard}
            />
          )}
        </div>

        <NewBadgePopup badges={newBadgesToShow} apiBase={API_BASE} onClose={closeNewBadgePopup} />

        <LeaderboardModal
          challengeId={leaderboardChallengeId}
          leaderboard={leaderboard}
          loading={leaderboardLoading}
          error={leaderboardError}
          onClose={closeLeaderboard}
        />
      </>
    );
  }

  return (
    <div className="ws-app" style={{ padding: 24, textAlign: 'center' }}>
      <p>กำลังเข้าสู่ระบบผ่าน LINE...</p>
    </div>
  );
}