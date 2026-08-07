import { useEffect, useState } from 'react';
import { formatDateTimeShort } from './utils/formatDateTime';

const API_BASE = import.meta.env.VITE_API_BASE;

// แปลงเวลาปัจจุบันของเครื่องเป็นรูปแบบที่ input type=datetime-local ต้องการ (YYYY-MM-DDTHH:mm)
// ใช้เป็นค่า min กันแอดมินเลือกวัน-เวลาที่ผ่านมาแล้ว
function getNowForDatetimeInput() {
  const now = new Date();
  now.setSeconds(0, 0);
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

// รายการชั่วโมง (00-23) และนาที (00-59) แบบ 24 ชม. ใช้กับ dropdown เลือกเวลาของ Challenge
// ทำแบบนี้แทนพึ่ง input type=datetime-local เพราะ popup ปฏิทินของ browser จะโชว์ AM/PM ตาม
// ค่า locale ของเครื่อง OS ผู้ใช้แต่ละคน ซึ่งเราบังคับผ่าน lang attribute ไม่ได้ 100%
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// แยกค่า "YYYY-MM-DDTHH:mm" ออกเป็นวัน/ชั่วโมง/นาที สำหรับ bind กับ input+select แยกกัน
function splitDatetimeLocal(value) {
  if (!value) return { date: '', hour: '', minute: '' };
  const [date, time] = value.split('T');
  const [hour, minute] = (time || '').split(':');
  return { date: date || '', hour: hour || '', minute: minute || '' };
}

// รวมวัน/ชั่วโมง/นาทีกลับเป็น "YYYY-MM-DDTHH:mm" (format เดียวกับที่ backend และ validation ใช้อยู่)
function joinDatetimeLocal(date, hour, minute) {
  if (!date) return '';
  return `${date}T${hour || '00'}:${minute || '00'}`;
}

// เมนูย่อยที่ถูกจัดกลุ่มไว้ใต้แท็บ "ตั้งค่า" (เดิมเป็นแท็บหลักแยกกันหมด)
const SETTINGS_TABS = [
  { key: 'challenges', label: 'ชาเลนจ์' },
    { key: 'rewards', label: 'ของรางวัล' },
  { key: 'badges', label: 'เหรียญตรา' },
  { key: 'categories', label: 'หมวดหมู่กิจกรรม' },
  { key: 'activityTypes', label: 'ประเภทกิจกรรม' },
  { key: 'healthCampaigns', label: 'แบบสอบถามติดตามผล' },
  { key: 'healthResults', label: 'ผลข้อมูลสุขภาพ' },
  { key: 'admins', label: 'จัดการสิทธิ์แอดมิน' },
];

// ฟิลด์ที่เลือกได้ตอนสร้างรอบ follow-up จัดกลุ่มตามหมวดของแบบสอบถาม (ตรงกับ field key ใน HealthAssessmentWizard)
const CAMPAIGN_FIELD_GROUPS = [
  {
    group: 'ข้อมูลสุขภาพพื้นฐาน',
    fields: [
      { key: 'weightKg', label: 'น้ำหนัก' },
      { key: 'heightCm', label: 'ส่วนสูง' },
      { key: 'waistCm', label: 'รอบเอว' },
      { key: 'bpSystolic', label: 'ความดันโลหิต' },
    ],
  },
  {
    group: 'ประวัติสุขภาพและปัจจัยเสี่ยง',
    fields: [
      { key: 'chronicDisease', label: 'โรคประจำตัว' },
      { key: 'smokingStatus', label: 'การสูบบุหรี่' },
      { key: 'alcoholStatus', label: 'การดื่มแอลกอฮอล์' },
      { key: 'physicalLimitation', label: 'ข้อจำกัดทางร่างกาย' },
    ],
  },
  {
    group: 'พฤติกรรมการออกกำลังกาย',
    fields: [
      { key: 'vigorousDays', label: 'ออกกำลังกายระดับหนัก' },
      { key: 'moderateDays', label: 'ออกกำลังกายระดับปานกลาง' },
      { key: 'walkingDays', label: 'การเดิน' },
      { key: 'exercisePattern', label: 'รูปแบบการออกกำลังกาย' },
      { key: 'exerciseBarrier', label: 'อุปสรรคในการออกกำลังกาย' },
    ],
  },
  {
    group: 'พฤติกรรมการรับประทานอาหาร',
    fields: [
      { key: 'mealsPerDay', label: 'จำนวนมื้อต่อวัน' },
      { key: 'friedFoodFreq', label: 'ความถี่อาหารทอด/มัน' },
      { key: 'sweetFoodFreq', label: 'ความถี่ของหวาน' },
      { key: 'veggieFruitFreq', label: 'ความถี่ผัก/ผลไม้' },
      { key: 'lateNightEating', label: 'พฤติกรรมกินมื้อดึก' },
      { key: 'pastDieting', label: 'ประวัติควบคุมอาหาร' },
    ],
  },
  {
    group: 'เป้าหมายและความพร้อม',
    fields: [
      { key: 'goalType', label: 'เป้าหมายหลัก' },
      { key: 'stageOfChange', label: 'ขั้นความพร้อมเปลี่ยนพฤติกรรม' },
      { key: 'targetWeightKg', label: 'น้ำหนักเป้าหมาย' },
    ],
  },
];

const CAMPAIGN_STATUS_LABEL_TH = {
  DRAFT: 'ร่าง (ยังไม่เปิด)',
  OPEN: 'เปิดอยู่',
  CLOSED: 'ปิดแล้ว',
};

// กราฟเส้นแนวโน้มอย่างง่ายด้วย SVG ล้วน (ไม่พึ่ง library ภายนอก) — ใช้แสดงค่า metric ของพนักงาน
// ข้าม baseline ไปจนถึง follow-up ล่าสุด points: [{ label, value }], ค่า null จะถูกกรองออกก่อนเรียกใช้แล้ว
function HealthTrendChart({ points, unit }) {
  if (points.length === 0) {
    return <p className="ws-empty">ยังไม่มีข้อมูลพอสำหรับกราฟ</p>;
  }
  if (points.length === 1) {
    return (
      <p style={{ fontSize: 14 }}>
        {points[0].label}: <strong>{points[0].value}{unit}</strong> (มีข้อมูลจุดเดียว ยังลากกราฟแนวโน้มไม่ได้)
      </p>
    );
  }

  const width = 560;
  const height = 160;
  const padX = 32;
  const padY = 20;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((p.value - min) / range) * (height - padY * 2);
    return { x, y, ...p };
  });

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={`กราฟแนวโน้ม ${points.map((p) => `${p.label} ${p.value}${unit}`).join(', ')}`}>
      <path d={pathD} fill="none" stroke="#2a78d6" strokeWidth="2" />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="4" fill="#2a78d6" />
          <text x={c.x} y={height - 4} textAnchor="middle" fontSize="11" fill="var(--ws-text-muted)">{c.label}</text>
          <text x={c.x} y={c.y - 10} textAnchor="middle" fontSize="11" fill="var(--ws-text-secondary)">{c.value}</text>
        </g>
      ))}
    </svg>
  );
}

export default function AdminApp() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminId, setAdminId] = useState(null);

  const [loginEmployeeId, setLoginEmployeeId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // สลับระหว่างแท็บต่างๆ ของหน้าแอดมิน เริ่มที่ dashboard เป็นหน้าแรกเสมอ
  const [activeTab, setActiveTab] = useState('dashboard');
  // จำแท็บย่อยล่าสุดที่เปิดไว้ในกลุ่ม "ตั้งค่า" เผื่อกดกลับเข้าไปใหม่ให้ไปหน้าเดิม
  const [lastSettingsTab, setLastSettingsTab] = useState(SETTINGS_TABS[0].key);

  // ---- Phase 5: dashboard สรุปภาพรวม ----
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');

  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [submissions, setSubmissions] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [actioningId, setActioningId] = useState(null);
  const [actionError, setActionError] = useState('');

  const [rejectReasons, setRejectReasons] = useState([]);
  const [rejectModalSubmissionId, setRejectModalSubmissionId] = useState(null);
  const [rejectReasonId, setRejectReasonId] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  // ---- Phase 2: reward redemption review ----
  const [redeemStatusFilter, setRedeemStatusFilter] = useState('PENDING');
  const [redeems, setRedeems] = useState([]);
  const [redeemListLoading, setRedeemListLoading] = useState(false);
  const [redeemListError, setRedeemListError] = useState('');
  const [redeemActioningId, setRedeemActioningId] = useState(null);
  const [redeemActionError, setRedeemActionError] = useState('');

  // ---- Phase 3: challenge management ----
  const [challengeCategories, setChallengeCategories] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [challengeListLoading, setChallengeListLoading] = useState(false);
  const [challengeListError, setChallengeListError] = useState('');
  const [challengeActioningId, setChallengeActioningId] = useState(null);
  const [challengeActionError, setChallengeActionError] = useState('');

  const [newChallengeCategoryId, setNewChallengeCategoryId] = useState('');
  const [newChallengeName, setNewChallengeName] = useState('');
  const [newChallengeDescription, setNewChallengeDescription] = useState('');
  const [newChallengeStartDate, setNewChallengeStartDate] = useState('');
  const [newChallengeEndDate, setNewChallengeEndDate] = useState('');
  const [createChallengeSubmitting, setCreateChallengeSubmitting] = useState(false);
  const [createChallengeError, setCreateChallengeError] = useState('');

  // ---- ดูรายชื่อผู้เข้าร่วม / leaderboard ของ challenge (ฝั่งแอดมิน) ----
  const [participantsChallengeId, setParticipantsChallengeId] = useState(null);
  const [participantsChallengeName, setParticipantsChallengeName] = useState('');
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState('');

  // ---- Phase 4: badge management ----
  const BADGE_CONDITION_LABEL_TH = {
    DISTANCE: 'ระยะทางสะสม (กม.)',
    SUBMISSION_COUNT: 'จำนวนครั้งที่อนุมัติ',
    SCORE: 'คะแนนสะสมที่เคยได้',
    STREAK_DAYS: 'จำนวนวันติดกัน',
  };
  const emptyBadgeForm = { badgeName: '', description: '', conditionType: 'DISTANCE', conditionValue: '' };

  const [badges, setBadges] = useState([]);
  const [badgeListLoading, setBadgeListLoading] = useState(false);
  const [badgeListError, setBadgeListError] = useState('');

  const [badgeForm, setBadgeForm] = useState(emptyBadgeForm);
  const [badgeIconFile, setBadgeIconFile] = useState(null);
  const [badgeFormError, setBadgeFormError] = useState('');
  const [badgeFormSubmitting, setBadgeFormSubmitting] = useState(false);

  const [editingBadgeId, setEditingBadgeId] = useState(null);
  const [editBadgeForm, setEditBadgeForm] = useState(emptyBadgeForm);
  const [editBadgeIconFile, setEditBadgeIconFile] = useState(null);
  const [editRemoveIcon, setEditRemoveIcon] = useState(false);
  const [editBadgeError, setEditBadgeError] = useState('');
  const [badgeActioningId, setBadgeActioningId] = useState(null);

  // ---- Phase 5: activity-category CRUD state ----
  const emptyCategoryForm = { categoryName: '' };
  const [categories, setCategories] = useState([]);
  const [categoryListLoading, setCategoryListLoading] = useState(false);
  const [categoryListError, setCategoryListError] = useState('');
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [categoryFormError, setCategoryFormError] = useState('');
  const [categoryFormSubmitting, setCategoryFormSubmitting] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryForm, setEditCategoryForm] = useState({ categoryName: '', status: 'ACTIVE' });
  const [editCategoryError, setEditCategoryError] = useState('');
  const [categoryActioningId, setCategoryActioningId] = useState(null);

  // ---- Phase 5: activity-type CRUD state ----
  const emptyActivityTypeForm = {
    categoryId: '',
    activityName: '',
    score: '',
    requireImage: true,
    description: '',
  };
  const [activityTypes, setActivityTypes] = useState([]);
  const [activityTypeListLoading, setActivityTypeListLoading] = useState(false);
  const [activityTypeListError, setActivityTypeListError] = useState('');
  const [activityTypeForm, setActivityTypeForm] = useState(emptyActivityTypeForm);
  const [activityTypeFormError, setActivityTypeFormError] = useState('');
  const [activityTypeFormSubmitting, setActivityTypeFormSubmitting] = useState(false);
  const [editingActivityTypeId, setEditingActivityTypeId] = useState(null);
  const [editActivityTypeForm, setEditActivityTypeForm] = useState({ ...emptyActivityTypeForm, status: 'ACTIVE' });
  const [editActivityTypeError, setEditActivityTypeError] = useState('');
  const [activityTypeActioningId, setActivityTypeActioningId] = useState(null);

  // ---- Phase 5: reward CRUD state ----
  const emptyRewardForm = { rewardName: '', requiredScore: '', stock: '', description: '' };
  const [rewards, setRewards] = useState([]);
  const [rewardListLoading, setRewardListLoading] = useState(false);
  const [rewardListError, setRewardListError] = useState('');
  const [rewardForm, setRewardForm] = useState(emptyRewardForm);
  const [rewardImageFile, setRewardImageFile] = useState(null);
  const [rewardFormError, setRewardFormError] = useState('');
  const [rewardFormSubmitting, setRewardFormSubmitting] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState(null);
  const [editRewardForm, setEditRewardForm] = useState({ ...emptyRewardForm, image: '', status: 'ACTIVE' });
  const [editRewardImageFile, setEditRewardImageFile] = useState(null);
  const [editRemoveRewardImage, setEditRemoveRewardImage] = useState(false);
  const [editRewardError, setEditRewardError] = useState('');
  const [rewardActioningId, setRewardActioningId] = useState(null);

  // ---- Phase 5: จัดการสิทธิ์แอดมิน (grant/revoke) state ----
  const emptyAdminForm = { employeeId: '', password: '' };
  const [admins, setAdmins] = useState([]);
  const [adminListLoading, setAdminListLoading] = useState(false);
  const [adminListError, setAdminListError] = useState('');
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [adminFormError, setAdminFormError] = useState('');
  const [adminFormSubmitting, setAdminFormSubmitting] = useState(false);
  const [adminActioningId, setAdminActioningId] = useState(null);

  // ---- Phase 5: แบบสอบถามติดตามผล (follow-up campaign) state ----
  const emptyCampaignForm = { campaignName: '', releaseDate: '', closeDate: '', includedFields: [] };
  const [campaigns, setCampaigns] = useState([]);
  const [campaignListLoading, setCampaignListLoading] = useState(false);
  const [campaignListError, setCampaignListError] = useState('');
  const [campaignForm, setCampaignForm] = useState(emptyCampaignForm);
  const [campaignFormError, setCampaignFormError] = useState('');
  const [campaignFormSubmitting, setCampaignFormSubmitting] = useState(false);
  const [campaignActioningId, setCampaignActioningId] = useState(null);

  // ---- Phase 5: ผลข้อมูลสุขภาพรายบุคคล (operational view) state ----
  const [healthList, setHealthList] = useState([]);
  const [healthListLoading, setHealthListLoading] = useState(false);
  const [healthListError, setHealthListError] = useState('');
  const [healthSearch, setHealthSearch] = useState('');
  const [selectedHealthEmployeeId, setSelectedHealthEmployeeId] = useState(null);
  const [healthDetail, setHealthDetail] = useState(null); // { employee, assessments }
  const [healthDetailLoading, setHealthDetailLoading] = useState(false);
  const [healthDetailError, setHealthDetailError] = useState('');

  // เช็คว่ามี admin session ที่ยัง valid อยู่ไหมตอนโหลดหน้า กันต้อง login ใหม่ทุกครั้งที่ refresh
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/me`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setAdminId(data.employeeId);
          setIsLoggedIn(true);
        }
      } catch (err) {
        console.error('check admin auth error:', err);
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
  }, []);

  async function loadDashboard() {
    setDashboardLoading(true);
    setDashboardError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/dashboard`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'โหลดข้อมูลแดชบอร์ดไม่สำเร็จ');
      }
      setDashboardData(data);
    } catch (err) {
      setDashboardError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn && activeTab === 'dashboard') {
      loadDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, activeTab]);

  async function loadSubmissions() {
    setListLoading(true);
    setListError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/submissions?status=${statusFilter}`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || 'โหลดรายการไม่สำเร็จ');
      }
      setSubmissions(data);
    } catch (err) {
      setListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      loadSubmissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, statusFilter]);

  // โหลดรายการ preset เหตุผลปฏิเสธไว้ล่วงหน้า (ใช้ตอนเปิด modal ปฏิเสธ)
  useEffect(() => {
    if (!isLoggedIn) return;

    async function loadRejectReasons() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/reject-reasons`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => []);
        if (res.ok) {
          setRejectReasons(data);
        }
      } catch (err) {
        console.error('load reject reasons error:', err);
      }
    }

    loadRejectReasons();
  }, [isLoggedIn]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginSubmitting(true);
    setLoginError('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ employeeId: loginEmployeeId.trim(), password: loginPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'เข้าสู่ระบบไม่สำเร็จ');
      }

      setAdminId(data.employeeId);
      setIsLoggedIn(true);
      setLoginPassword('');
    } catch (err) {
      setLoginError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${API_BASE}/api/admin/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('logout error:', err);
    } finally {
      setIsLoggedIn(false);
      setAdminId(null);
      setSubmissions([]);
      setRedeems([]);
      setChallenges([]);
    }
  }

  async function loadRedeems() {
    setRedeemListLoading(true);
    setRedeemListError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/redeems?status=${redeemStatusFilter}`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || 'โหลดรายการไม่สำเร็จ');
      }
      setRedeems(data);
    } catch (err) {
      setRedeemListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRedeemListLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn && activeTab === 'redeems') {
      loadRedeems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, activeTab, redeemStatusFilter]);

  async function handleApproveRedeem(redeemId) {
    setRedeemActioningId(redeemId);
    setRedeemActionError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/redeems/${redeemId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'อนุมัติไม่สำเร็จ');
      }
      setRedeems((prev) => prev.filter((r) => r.redeem_id !== redeemId));
    } catch (err) {
      setRedeemActionError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRedeemActioningId(null);
    }
  }

  async function handleRejectRedeem(redeemId) {
    const confirmed = window.confirm(
      'ยืนยันปฏิเสธรายการนี้? ระบบจะคืน stock และคืนคะแนนให้พนักงานอัตโนมัติ'
    );
    if (!confirmed) return;

    setRedeemActioningId(redeemId);
    setRedeemActionError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/redeems/${redeemId}/reject`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'ปฏิเสธไม่สำเร็จ');
      }
      setRedeems((prev) => prev.filter((r) => r.redeem_id !== redeemId));
    } catch (err) {
      setRedeemActionError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRedeemActioningId(null);
    }
  }

  async function loadChallenges() {
    setChallengeListLoading(true);
    setChallengeListError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/challenges`, { credentials: 'include' });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || 'โหลดรายการ challenge ไม่สำเร็จ');
      }
      setChallenges(data);
    } catch (err) {
      setChallengeListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setChallengeListLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'challenges') return;
    loadChallenges();

    async function loadChallengeCategories() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/activity-categories`, { credentials: 'include' });
        if (res.ok) {
          setChallengeCategories(await res.json());
        }
      } catch (err) {
        console.error('load challenge categories error:', err);
      }
    }
    loadChallengeCategories();
  }, [isLoggedIn, activeTab]);

  async function handleCreateChallenge(e) {
    e.preventDefault();
    setCreateChallengeError('');

    if (!newChallengeCategoryId || !newChallengeName.trim() || !newChallengeStartDate || !newChallengeEndDate) {
      setCreateChallengeError('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    const startDateObj = new Date(newChallengeStartDate);
    const endDateObj = new Date(newChallengeEndDate);

    if (startDateObj.getTime() < Date.now()) {
      setCreateChallengeError('วันเริ่มต้องไม่ใช่วัน-เวลาที่ผ่านมาแล้ว');
      return;
    }
    if (endDateObj.getTime() <= startDateObj.getTime()) {
      setCreateChallengeError('วันจบต้องอยู่หลังวันเริ่ม');
      return;
    }

    setCreateChallengeSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          categoryId: newChallengeCategoryId,
          challengeName: newChallengeName.trim(),
          description: newChallengeDescription.trim(),
          startDate: newChallengeStartDate,
          endDate: newChallengeEndDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'สร้าง challenge ไม่สำเร็จ');
      }

      setNewChallengeCategoryId('');
      setNewChallengeName('');
      setNewChallengeDescription('');
      setNewChallengeStartDate('');
      setNewChallengeEndDate('');
      await loadChallenges();
    } catch (err) {
      setCreateChallengeError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setCreateChallengeSubmitting(false);
    }
  }

  async function handleCancelChallenge(challengeId) {
    const confirmed = window.confirm('ยืนยันยกเลิก challenge นี้?');
    if (!confirmed) return;

    setChallengeActioningId(challengeId);
    setChallengeActionError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/challenges/${challengeId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'ยกเลิกไม่สำเร็จ');
      }
      await loadChallenges();
    } catch (err) {
      setChallengeActionError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setChallengeActioningId(null);
    }
  }

  async function openParticipants(challengeId, challengeName) {
    setParticipantsChallengeId(challengeId);
    setParticipantsChallengeName(challengeName);
    setParticipantsLoading(true);
    setParticipantsError('');
    setParticipants([]);

    try {
      const res = await fetch(`${API_BASE}/api/admin/challenges/${challengeId}/participants`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'โหลดรายชื่อผู้เข้าร่วมไม่สำเร็จ');
      }
      setParticipants(data.participants || []);
    } catch (err) {
      setParticipantsError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setParticipantsLoading(false);
    }
  }

  function closeParticipants() {
    setParticipantsChallengeId(null);
    setParticipantsChallengeName('');
    setParticipants([]);
    setParticipantsError('');
  }

  const CHALLENGE_STATUS_LABEL_TH = {
    UPCOMING: 'ยังไม่เริ่ม',
    ONGOING: 'กำลังแข่งขัน',
    ENDED: 'จบแล้ว',
    CANCELLED: 'ยกเลิกแล้ว',
  };

  async function loadBadges() {
    setBadgeListLoading(true);
    setBadgeListError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/badges`, { credentials: 'include' });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || 'โหลดรายการ badge ไม่สำเร็จ');
      }
      setBadges(data);
    } catch (err) {
      setBadgeListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setBadgeListLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'badges') return;
    loadBadges();
  }, [isLoggedIn, activeTab]);

  async function handleCreateBadge(e) {
    e.preventDefault();
    setBadgeFormError('');

    if (!badgeForm.badgeName.trim() || !badgeForm.conditionValue) {
      setBadgeFormError('กรุณากรอกชื่อ เหรียญตรา และค่าเงื่อนไข');
      return;
    }

    setBadgeFormSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('badgeName', badgeForm.badgeName.trim());
      formData.append('description', badgeForm.description.trim());
      formData.append('conditionType', badgeForm.conditionType);
      formData.append('conditionValue', badgeForm.conditionValue);
      if (badgeIconFile) {
        formData.append('iconFile', badgeIconFile);
      }

      // ห้ามใส่ header Content-Type เอง ปล่อยให้ browser ตั้ง boundary ของ multipart ให้อัตโนมัติ
      const res = await fetch(`${API_BASE}/api/admin/badges`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'สร้าง เหรียญตรา ไม่สำเร็จ');
      }
      setBadgeForm(emptyBadgeForm);
      setBadgeIconFile(null);
      await loadBadges();
    } catch (err) {
      setBadgeFormError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setBadgeFormSubmitting(false);
    }
  }

  function startEditBadge(badge) {
    setEditingBadgeId(badge.badge_id);
    setEditBadgeError('');
    setEditBadgeIconFile(null);
    setEditRemoveIcon(false);
    setEditBadgeForm({
      badgeName: badge.badge_name,
      description: badge.description || '',
      icon: badge.icon || '', // เก็บไว้แค่โชว์รูปปัจจุบัน ไม่ได้ส่งกลับเป็น text field
      conditionType: badge.condition_type,
      conditionValue: String(badge.condition_value),
      status: badge.status,
    });
  }

  function cancelEditBadge() {
    setEditingBadgeId(null);
    setEditBadgeError('');
    setEditBadgeIconFile(null);
    setEditRemoveIcon(false);
  }

  async function handleSaveBadge(badgeId) {
    setEditBadgeError('');
    if (!editBadgeForm.badgeName.trim() || !editBadgeForm.conditionValue) {
      setEditBadgeError('กรุณากรอกชื่อ badge และค่าเงื่อนไข');
      return;
    }

    setBadgeActioningId(badgeId);
    try {
      const formData = new FormData();
      formData.append('badgeName', editBadgeForm.badgeName.trim());
      formData.append('description', editBadgeForm.description.trim());
      formData.append('conditionType', editBadgeForm.conditionType);
      formData.append('conditionValue', editBadgeForm.conditionValue);
      formData.append('status', editBadgeForm.status);
      if (editBadgeIconFile) {
        formData.append('iconFile', editBadgeIconFile); // แนบไฟล์ใหม่ -> เซิร์ฟเวอร์แทนที่รูปเดิมให้อัตโนมัติ
      } else if (editRemoveIcon) {
        formData.append('removeIcon', 'true'); // ไม่แนบไฟล์ใหม่ แต่ติ๊กลบรูป -> เซิร์ฟเวอร์ล้าง icon เป็น NULL
      }
      // ไม่แนบทั้งไฟล์ใหม่และ removeIcon -> เซิร์ฟเวอร์คงรูปเดิมไว้ตามปกติ

      const res = await fetch(`${API_BASE}/api/admin/badges/${badgeId}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'แก้ไข badge ไม่สำเร็จ');
      }
      setEditingBadgeId(null);
      setEditBadgeIconFile(null);
      setEditRemoveIcon(false);
      await loadBadges();
    } catch (err) {
      setEditBadgeError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setBadgeActioningId(null);
    }
  }

  async function handleToggleBadgeStatus(badge) {
    setBadgeActioningId(badge.badge_id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/badges/${badge.badge_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          badgeName: badge.badge_name,
          description: badge.description,
          conditionType: badge.condition_type,
          conditionValue: badge.condition_value,
          status: badge.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'เปลี่ยนสถานะไม่สำเร็จ');
      }
      await loadBadges();
    } catch (err) {
      setBadgeListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setBadgeActioningId(null);
    }
  }

  // ---- Phase 5: activity-category CRUD handlers ----
  async function loadCategories() {
    setCategoryListLoading(true);
    setCategoryListError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/categories`, { credentials: 'include' });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || 'โหลดรายการหมวดหมู่ไม่สำเร็จ');
      }
      setCategories(data);
    } catch (err) {
      setCategoryListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setCategoryListLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'categories') return;
    loadCategories();
  }, [isLoggedIn, activeTab]);

  async function handleCreateCategory(e) {
    e.preventDefault();
    setCategoryFormError('');
    if (!categoryForm.categoryName.trim()) {
      setCategoryFormError('กรุณากรอกชื่อหมวดหมู่');
      return;
    }
    setCategoryFormSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ categoryName: categoryForm.categoryName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'สร้างหมวดหมู่ไม่สำเร็จ');
      }
      setCategoryForm(emptyCategoryForm);
      await loadCategories();
    } catch (err) {
      setCategoryFormError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setCategoryFormSubmitting(false);
    }
  }

  function startEditCategory(cat) {
    setEditingCategoryId(cat.category_id);
    setEditCategoryError('');
    setEditCategoryForm({ categoryName: cat.category_name, status: cat.status });
  }

  function cancelEditCategory() {
    setEditingCategoryId(null);
    setEditCategoryError('');
  }

  async function handleSaveCategory(categoryId) {
    setEditCategoryError('');
    if (!editCategoryForm.categoryName.trim()) {
      setEditCategoryError('กรุณากรอกชื่อหมวดหมู่');
      return;
    }
    setCategoryActioningId(categoryId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          categoryName: editCategoryForm.categoryName.trim(),
          status: editCategoryForm.status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'แก้ไขหมวดหมู่ไม่สำเร็จ');
      }
      setEditingCategoryId(null);
      await loadCategories();
    } catch (err) {
      setEditCategoryError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setCategoryActioningId(null);
    }
  }

  async function handleToggleCategoryStatus(cat) {
    setCategoryActioningId(cat.category_id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/categories/${cat.category_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          categoryName: cat.category_name,
          status: cat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'เปลี่ยนสถานะไม่สำเร็จ');
      }
      await loadCategories();
    } catch (err) {
      setCategoryListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setCategoryActioningId(null);
    }
  }

  // ---- Phase 5: จัดการสิทธิ์แอดมิน handlers ----
  async function loadAdmins() {
    setAdminListLoading(true);
    setAdminListError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/admins`, { credentials: 'include' });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || 'โหลดรายชื่อแอดมินไม่สำเร็จ');
      }
      setAdmins(data);
    } catch (err) {
      setAdminListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setAdminListLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'admins') return;
    loadAdmins();
  }, [isLoggedIn, activeTab]);

  async function handleGrantAdmin(e) {
    e.preventDefault();
    setAdminFormError('');
    if (!adminForm.employeeId.trim() || !adminForm.password) {
      setAdminFormError('กรุณากรอกรหัสพนักงานและรหัสผ่าน');
      return;
    }
    if (adminForm.password.length < 8) {
      setAdminFormError('รหัสผ่านควรยาวอย่างน้อย 8 ตัวอักษร');
      return;
    }
    setAdminFormSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employeeId: adminForm.employeeId.trim(),
          password: adminForm.password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'ตั้งค่าแอดมินไม่สำเร็จ');
      }
      setAdminForm(emptyAdminForm);
      await loadAdmins();
    } catch (err) {
      setAdminFormError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setAdminFormSubmitting(false);
    }
  }

  async function handleRevokeAdmin(employeeId) {
    if (!window.confirm(`ยืนยันถอดสิทธิ์แอดมินของ ${employeeId}?`)) return;
    setAdminActioningId(employeeId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/admins/${employeeId}/revoke`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'ถอดสิทธิ์แอดมินไม่สำเร็จ');
      }
      await loadAdmins();
    } catch (err) {
      setAdminListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setAdminActioningId(null);
    }
  }

  // ---- Phase 5: แบบสอบถามติดตามผล (follow-up campaign) handlers ----
  async function loadCampaigns() {
    setCampaignListLoading(true);
    setCampaignListError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/campaigns`, { credentials: 'include' });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || 'โหลดรายการรอบ follow-up ไม่สำเร็จ');
      }
      setCampaigns(data);
    } catch (err) {
      setCampaignListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setCampaignListLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'healthCampaigns') return;
    loadCampaigns();
  }, [isLoggedIn, activeTab]);

  function toggleCampaignField(fieldKey) {
    setCampaignForm((prev) => {
      const has = prev.includedFields.includes(fieldKey);
      return {
        ...prev,
        includedFields: has
          ? prev.includedFields.filter((f) => f !== fieldKey)
          : [...prev.includedFields, fieldKey],
      };
    });
  }

  async function handleCreateCampaign(e) {
    e.preventDefault();
    setCampaignFormError('');

    if (!campaignForm.campaignName.trim() || !campaignForm.releaseDate || campaignForm.includedFields.length === 0) {
      setCampaignFormError('กรุณากรอกชื่อรอบ วันที่เปิด และเลือกอย่างน้อย 1 ฟิลด์');
      return;
    }

    setCampaignFormSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          campaignName: campaignForm.campaignName.trim(),
          releaseDate: campaignForm.releaseDate,
          closeDate: campaignForm.closeDate || null,
          includedFields: campaignForm.includedFields,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'สร้างรอบ follow-up ไม่สำเร็จ');
      }
      setCampaignForm(emptyCampaignForm);
      await loadCampaigns();
    } catch (err) {
      setCampaignFormError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setCampaignFormSubmitting(false);
    }
  }

  async function handleToggleCampaignStatus(campaign) {
    const action = campaign.status === 'OPEN' ? 'close' : 'open';
    setCampaignActioningId(campaign.campaign_id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/campaigns/${campaign.campaign_id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'เปลี่ยนสถานะไม่สำเร็จ');
      }
      await loadCampaigns();
    } catch (err) {
      setCampaignListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setCampaignActioningId(null);
    }
  }

  // ---- Phase 5: ผลข้อมูลสุขภาพรายบุคคล (operational view) handlers ----
  async function loadHealthList() {
    setHealthListLoading(true);
    setHealthListError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/health-assessments`, { credentials: 'include' });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || 'โหลดข้อมูลสุขภาพพนักงานไม่สำเร็จ');
      }
      setHealthList(data);
    } catch (err) {
      setHealthListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setHealthListLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'healthResults') return;
    loadHealthList();
  }, [isLoggedIn, activeTab]);

  async function openHealthDetail(employeeId) {
    setSelectedHealthEmployeeId(employeeId);
    setHealthDetail(null);
    setHealthDetailError('');
    setHealthDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/health-assessments/${employeeId}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'โหลดรายละเอียดไม่สำเร็จ');
      }
      setHealthDetail(data);
    } catch (err) {
      setHealthDetailError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setHealthDetailLoading(false);
    }
  }

  function closeHealthDetail() {
    setSelectedHealthEmployeeId(null);
    setHealthDetail(null);
    setHealthDetailError('');
  }

  // ---- Phase 5: activity-type CRUD handlers ----
  async function loadActivityTypes() {
    setActivityTypeListLoading(true);
    setActivityTypeListError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/activity-types`, { credentials: 'include' });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || 'โหลดรายการประเภทกิจกรรมไม่สำเร็จ');
      }
      setActivityTypes(data);
    } catch (err) {
      setActivityTypeListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActivityTypeListLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'activityTypes') return;
    loadActivityTypes();
    // โหลดหมวดหมู่ (ACTIVE) มาเติม dropdown ตอนสร้าง/แก้ไขกิจกรรมด้วย ถ้ายังไม่มีข้อมูล
    if (categories.length === 0) loadCategories();
  }, [isLoggedIn, activeTab]);

  async function handleCreateActivityType(e) {
    e.preventDefault();
    setActivityTypeFormError('');
    if (!activityTypeForm.categoryId || !activityTypeForm.activityName.trim() || activityTypeForm.score === '') {
      setActivityTypeFormError('กรุณากรอกหมวดหมู่ ชื่อกิจกรรม และคะแนนให้ครบ');
      return;
    }
    setActivityTypeFormSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/activity-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          categoryId: activityTypeForm.categoryId,
          activityName: activityTypeForm.activityName.trim(),
          score: activityTypeForm.score,
          requireImage: activityTypeForm.requireImage,
          description: activityTypeForm.description.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'สร้างประเภทกิจกรรมไม่สำเร็จ');
      }
      setActivityTypeForm(emptyActivityTypeForm);
      await loadActivityTypes();
    } catch (err) {
      setActivityTypeFormError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActivityTypeFormSubmitting(false);
    }
  }

  function startEditActivityType(a) {
    setEditingActivityTypeId(a.activity_id);
    setEditActivityTypeError('');
    setEditActivityTypeForm({
      categoryId: a.category_id,
      activityName: a.activity_name,
      score: String(a.score),
      requireImage: !!a.require_image,
      description: a.description || '',
      status: a.status,
    });
  }

  function cancelEditActivityType() {
    setEditingActivityTypeId(null);
    setEditActivityTypeError('');
  }

  async function handleSaveActivityType(activityId) {
    setEditActivityTypeError('');
    if (
      !editActivityTypeForm.categoryId ||
      !editActivityTypeForm.activityName.trim() ||
      editActivityTypeForm.score === ''
    ) {
      setEditActivityTypeError('กรุณากรอกหมวดหมู่ ชื่อกิจกรรม และคะแนนให้ครบ');
      return;
    }
    setActivityTypeActioningId(activityId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/activity-types/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          categoryId: editActivityTypeForm.categoryId,
          activityName: editActivityTypeForm.activityName.trim(),
          score: editActivityTypeForm.score,
          requireImage: editActivityTypeForm.requireImage,
          description: editActivityTypeForm.description.trim(),
          status: editActivityTypeForm.status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'แก้ไขประเภทกิจกรรมไม่สำเร็จ');
      }
      setEditingActivityTypeId(null);
      await loadActivityTypes();
    } catch (err) {
      setEditActivityTypeError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActivityTypeActioningId(null);
    }
  }

  async function handleToggleActivityTypeStatus(a) {
    setActivityTypeActioningId(a.activity_id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/activity-types/${a.activity_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          categoryId: a.category_id,
          activityName: a.activity_name,
          score: a.score,
          requireImage: !!a.require_image,
          description: a.description,
          status: a.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'เปลี่ยนสถานะไม่สำเร็จ');
      }
      await loadActivityTypes();
    } catch (err) {
      setActivityTypeListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActivityTypeActioningId(null);
    }
  }

  // ---- Phase 5: reward CRUD handlers ----
  async function loadRewards() {
    setRewardListLoading(true);
    setRewardListError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/rewards`, { credentials: 'include' });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || 'โหลดรายการของรางวัลไม่สำเร็จ');
      }
      setRewards(data);
    } catch (err) {
      setRewardListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRewardListLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'rewards') return;
    loadRewards();
  }, [isLoggedIn, activeTab]);

  async function handleCreateReward(e) {
    e.preventDefault();
    setRewardFormError('');
    if (!rewardForm.rewardName.trim() || !rewardForm.requiredScore || rewardForm.stock === '') {
      setRewardFormError('กรุณากรอกชื่อ คะแนนที่ใช้แลก และจำนวนคงเหลือให้ครบ');
      return;
    }
    setRewardFormSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('rewardName', rewardForm.rewardName.trim());
      formData.append('requiredScore', rewardForm.requiredScore);
      formData.append('stock', rewardForm.stock);
      formData.append('description', rewardForm.description.trim());
      if (rewardImageFile) {
        formData.append('imageFile', rewardImageFile);
      }

      const res = await fetch(`${API_BASE}/api/admin/rewards`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'สร้างของรางวัลไม่สำเร็จ');
      }
      setRewardForm(emptyRewardForm);
      setRewardImageFile(null);
      await loadRewards();
    } catch (err) {
      setRewardFormError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRewardFormSubmitting(false);
    }
  }

  function startEditReward(r) {
    setEditingRewardId(r.reward_id);
    setEditRewardError('');
    setEditRewardImageFile(null);
    setEditRemoveRewardImage(false);
    setEditRewardForm({
      rewardName: r.reward_name,
      requiredScore: String(r.required_score),
      stock: String(r.stock),
      description: r.description || '',
      image: r.image || '',
      status: r.status,
    });
  }

  function cancelEditReward() {
    setEditingRewardId(null);
    setEditRewardError('');
    setEditRewardImageFile(null);
    setEditRemoveRewardImage(false);
  }

  async function handleSaveReward(rewardId) {
    setEditRewardError('');
    if (!editRewardForm.rewardName.trim() || !editRewardForm.requiredScore || editRewardForm.stock === '') {
      setEditRewardError('กรุณากรอกชื่อ คะแนนที่ใช้แลก และจำนวนคงเหลือให้ครบ');
      return;
    }
    setRewardActioningId(rewardId);
    try {
      const formData = new FormData();
      formData.append('rewardName', editRewardForm.rewardName.trim());
      formData.append('requiredScore', editRewardForm.requiredScore);
      formData.append('stock', editRewardForm.stock);
      formData.append('description', editRewardForm.description.trim());
      formData.append('status', editRewardForm.status);
      if (editRewardImageFile) {
        formData.append('imageFile', editRewardImageFile);
      } else if (editRemoveRewardImage) {
        formData.append('removeImage', 'true');
      }

      const res = await fetch(`${API_BASE}/api/admin/rewards/${rewardId}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'แก้ไขของรางวัลไม่สำเร็จ');
      }
      setEditingRewardId(null);
      setEditRewardImageFile(null);
      setEditRemoveRewardImage(false);
      await loadRewards();
    } catch (err) {
      setEditRewardError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRewardActioningId(null);
    }
  }

  async function handleToggleRewardStatus(r) {
    setRewardActioningId(r.reward_id);
    try {
      const formData = new FormData();
      formData.append('rewardName', r.reward_name);
      formData.append('requiredScore', r.required_score);
      formData.append('stock', r.stock);
      formData.append('description', r.description || '');
      formData.append('status', r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');

      const res = await fetch(`${API_BASE}/api/admin/rewards/${r.reward_id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'เปลี่ยนสถานะไม่สำเร็จ');
      }
      await loadRewards();
    } catch (err) {
      setRewardListError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRewardActioningId(null);
    }
  }

  async function handleApprove(submissionId) {
    setActioningId(submissionId);
    setActionError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/submissions/${submissionId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'อนุมัติไม่สำเร็จ');
      }
      // ลบออกจาก list ปัจจุบัน เพราะสถานะเปลี่ยนไปแล้ว ไม่ตรง filter เดิมอีกต่อไป
      setSubmissions((prev) => prev.filter((s) => s.submission_id !== submissionId));
    } catch (err) {
      setActionError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActioningId(null);
    }
  }

  function openRejectModal(submissionId) {
    setRejectModalSubmissionId(submissionId);
    setRejectReasonId('');
    setRejectNote('');
    setRejectError('');
  }

  function closeRejectModal() {
    setRejectModalSubmissionId(null);
    setRejectReasonId('');
    setRejectNote('');
    setRejectError('');
  }

  const selectedRejectReason = rejectReasons.find(
    (r) => String(r.reason_id) === String(rejectReasonId)
  );
  const rejectNoteRequired = Boolean(selectedRejectReason?.is_other);

  async function handleConfirmReject() {
    if (!rejectReasonId) {
      setRejectError('กรุณาเลือกเหตุผลที่ปฏิเสธ');
      return;
    }
    if (rejectNoteRequired && !rejectNote.trim()) {
      setRejectError('กรุณาระบุเหตุผลเพิ่มเติม');
      return;
    }

    const submissionId = rejectModalSubmissionId;
    setRejectSubmitting(true);
    setRejectError('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/submissions/${submissionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reasonId: rejectReasonId,
          note: rejectNoteRequired ? rejectNote.trim() : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'ปฏิเสธไม่สำเร็จ');
      }
      setSubmissions((prev) => prev.filter((s) => s.submission_id !== submissionId));
      closeRejectModal();
    } catch (err) {
      setRejectError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRejectSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="ws-app" style={{ padding: 24, textAlign: 'center' }}>
        <p>กำลังตรวจสอบสิทธิ์...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="ws-app" style={{ padding: 24, maxWidth: 360, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center' }}>เข้าสู่ระบบแอดมิน</h2>
        <form onSubmit={handleLogin} className="ws-stack">
          <div>
            <label htmlFor="loginEmployeeId" className="ws-label">รหัสพนักงาน</label>
            <input
              id="loginEmployeeId"
              type="text"
              value={loginEmployeeId}
              onChange={(e) => setLoginEmployeeId(e.target.value)}
              className="ws-input"
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="loginPassword" className="ws-label">รหัสผ่าน</label>
            <input
              id="loginPassword"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="ws-input"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="ws-btn ws-btn-primary" disabled={loginSubmitting} style={{ width: '100%' }}>
            {loginSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
        {loginError && <div className="ws-alert ws-alert-danger" style={{ textAlign: 'center' }}>{loginError}</div>}
      </div>
    );
  }

  return (
    <div className="ws-app" style={{ padding: 24 }}>
      <div className="ws-row-between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>แดชบอร์ดแอดมิน</h2>
        <div className="ws-row">
          <span style={{ color: 'var(--ws-text-secondary)' }}>เข้าสู่ระบบเป็น: {adminId}</span>
          <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={handleLogout}>ออกจากระบบ</button>
        </div>
      </div>

      <div className="ws-tabs">
        <button className={`ws-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          แดชบอร์ด
        </button>
        <button className={`ws-tab ${activeTab === 'submissions' ? 'active' : ''}`} onClick={() => setActiveTab('submissions')}>
          ตรวจสอบกิจกรรม
        </button>
        <button className={`ws-tab ${activeTab === 'redeems' ? 'active' : ''}`} onClick={() => setActiveTab('redeems')}>
          คำขอแลกของรางวัล
        </button>
        <button
          className={`ws-tab ${SETTINGS_TABS.some(t => t.key === activeTab) ? 'active' : ''}`}
          onClick={() => setActiveTab(lastSettingsTab)}
        >
          ตั้งค่า
        </button>
      </div>

      {SETTINGS_TABS.some(t => t.key === activeTab) && (
        <div className="ws-tabs" style={{ marginTop: -8 }}>
          {SETTINGS_TABS.map(t => (
            <button
              key={t.key}
              className={`ws-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => { setActiveTab(t.key); setLastSettingsTab(t.key); }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div>
          {dashboardLoading && <p className="ws-empty">กำลังโหลด...</p>}
          {dashboardError && <div className="ws-alert ws-alert-danger">{dashboardError}</div>}

          {dashboardData && (
            <>
              <div className="ws-grid-stats" style={{ marginBottom: 24 }}>
                <div className="ws-stat-card">
                  <div className="ws-stat-label">พนักงาน active</div>
                  <div className="ws-stat-value">{dashboardData.activeEmployeeCount}</div>
                </div>
                <div
                  className="ws-stat-card ws-card-hover"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setStatusFilter('PENDING');
                    setActiveTab('submissions');
                  }}
                >
                  <div className="ws-stat-label">กิจกรรม รอดำเนินการ</div>
                  <div className="ws-stat-value">{dashboardData.pendingSubmissionCount}</div>
                </div>
                <div
                  className="ws-stat-card ws-card-hover"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setRedeemStatusFilter('PENDING');
                    setActiveTab('redeems');
                  }}
                >
                  <div className="ws-stat-label">แลกของรางวัล รอดำเนินการ</div>
                  <div className="ws-stat-value">{dashboardData.pendingRedeemCount}</div>
                </div>
                <div className="ws-stat-card">
                  <div className="ws-stat-label">เหรียญตรา ทั้งหมด</div>
                  <div className="ws-stat-value">{dashboardData.totalBadgeCount}</div>
                </div>
                <div className="ws-stat-card">
                  <div className="ws-stat-label">ชาเลนจ์ กำลังดำเนินอยู่</div>
                  <div className="ws-stat-value">{dashboardData.ongoingChallengeCount}</div>
                </div>
              </div>

              <h3>ชาเลนจ์ ที่กำลังดำเนินอยู่ตอนนี้</h3>
              {dashboardData.ongoingChallenges.length === 0 ? (
                <p style={{ color: 'var(--ws-text-secondary)' }}>ไม่มี ชาเลนจ์ ที่กำลังดำเนินอยู่ตอนนี้</p>
              ) : (
                <table className="ws-table">
                  <thead>
                    <tr>
                      <th>ชื่อ ชาเลนจ์</th>
                      <th>หมวดหมู่</th>
                      <th>ช่วงเวลา</th>
                      <th>ผู้เข้าร่วม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.ongoingChallenges.map((c) => (
                      <tr
                        key={c.challenge_id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setActiveTab('challenges');
                          openParticipants(c.challenge_id, c.challenge_name);
                        }}
                      >
                        <td>{c.challenge_name}</td>
                        <td>{c.category_name}</td>
                        <td>
                          {formatDateTimeShort(c.start_date)} - {formatDateTimeShort(c.end_date)}
                        </td>
                        <td>{c.participant_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'submissions' && (
        <>
      <div className="ws-row" style={{ marginBottom: 16 }}>
        <label htmlFor="statusFilter" className="ws-label" style={{ margin: 0 }}>สถานะ: </label>
        <select
          id="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="ws-select"
          style={{ width: 'auto' }}
        >
          <option value="PENDING">รอดำเนินการ (PENDING)</option>
          <option value="APPROVED">อนุมัติแล้ว (APPROVED)</option>
          <option value="REJECTED">ถูกปฏิเสธ (REJECTED)</option>
        </select>
        <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={loadSubmissions}>
          รีเฟรช
        </button>
      </div>

      {actionError && <div className="ws-alert ws-alert-danger">{actionError}</div>}
      {listError && <div className="ws-alert ws-alert-danger">{listError}</div>}
      {listLoading && <p className="ws-empty">กำลังโหลด...</p>}

      {!listLoading && submissions.length === 0 && <p className="ws-empty">ไม่มีรายการในสถานะนี้</p>}

      {!listLoading && submissions.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="ws-table">
            <thead>
              <tr>
                <th>#</th>
                <th>พนักงาน</th>
                <th>แผนก</th>
                <th>กิจกรรม</th>
                <th>คะแนน</th>
                <th>ระยะทาง</th>
                <th>เวลา</th>
                <th>รูปหลักฐาน</th>
                <th>หมายเหตุ</th>
                <th>ส่งเมื่อ</th>
                {statusFilter === 'REJECTED' && <th>เหตุผลที่ปฏิเสธ</th>}
                {statusFilter === 'PENDING' && <th>จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.submission_id}>
                  <td>{s.submission_id}</td>
                  <td>
                    {s.full_name}
                    <br />
                    <small style={{ color: 'var(--ws-text-muted)' }}>{s.employee_id}</small>
                  </td>
                  <td>{s.department || '-'}</td>
                  <td>{s.activity_name}</td>
                  <td>{s.score}</td>
                  <td>{s.distance != null ? `${s.distance} กม.` : '-'}</td>
                  <td>{s.duration != null ? `${s.duration} นาที` : '-'}</td>
                  <td>
                    {s.proof_image ? (
                      <a href={`${API_BASE}/${s.proof_image}`} target="_blank" rel="noreferrer">
                        <img
                          src={`${API_BASE}/${s.proof_image}`}
                          alt="proof"
                          style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                        />
                      </a>
                    ) : (
                      'ไม่มีรูป'
                    )}
                  </td>
                  <td>{s.note || '-'}</td>
                  <td>{formatDateTimeShort(s.submitted_at)}</td>
                  {statusFilter === 'REJECTED' && (
                    <td>
                      {s.reject_reason_text || '-'}
                      {s.reject_reason_note && (
                        <>
                          <br />
                          <small style={{ color: 'var(--ws-text-muted)' }}>{s.reject_reason_note}</small>
                        </>
                      )}
                    </td>
                  )}
                  {statusFilter === 'PENDING' && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="ws-btn ws-btn-primary ws-btn-sm"
                        onClick={() => handleApprove(s.submission_id)}
                        disabled={actioningId === s.submission_id}
                        style={{ marginRight: 6 }}
                      >
                        {actioningId === s.submission_id ? '...' : 'อนุมัติ'}
                      </button>
                      <button
                        className="ws-btn ws-btn-danger ws-btn-sm"
                        onClick={() => openRejectModal(s.submission_id)}
                        disabled={actioningId === s.submission_id}
                      >
                        ปฏิเสธ
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectModalSubmissionId !== null && (
        <div className="ws-modal-overlay">
          <div className="ws-modal" style={{ maxWidth: 420 }}>
            <h3>
              ปฏิเสธ submission #{rejectModalSubmissionId}
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="rejectReasonSelect" className="ws-label">เหตุผล</label>
              <select
                id="rejectReasonSelect"
                value={rejectReasonId}
                onChange={(e) => setRejectReasonId(e.target.value)}
                className="ws-select"
              >
                <option value="">-- เลือกเหตุผล --</option>
                {rejectReasons.map((r) => (
                  <option key={r.reason_id} value={r.reason_id}>
                    {r.reason_text}
                  </option>
                ))}
              </select>
            </div>

            {rejectNoteRequired && (
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="rejectNote" className="ws-label">ระบุเหตุผลเพิ่มเติม</label>
                <textarea
                  id="rejectNote"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  rows={3}
                  className="ws-textarea"
                />
              </div>
            )}

            {rejectError && <div className="ws-alert ws-alert-danger">{rejectError}</div>}

            <div className="ws-modal-actions">
              <button className="ws-btn ws-btn-ghost" onClick={closeRejectModal} disabled={rejectSubmitting}>
                ยกเลิก
              </button>
              <button className="ws-btn ws-btn-danger" onClick={handleConfirmReject} disabled={rejectSubmitting}>
                {rejectSubmitting ? 'กำลังบันทึก...' : 'ยืนยันปฏิเสธ'}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {activeTab === 'redeems' && (
        <>
          <div className="ws-row" style={{ marginBottom: 16 }}>
            <label htmlFor="redeemStatusFilter" className="ws-label" style={{ margin: 0 }}>สถานะ: </label>
            <select
              id="redeemStatusFilter"
              value={redeemStatusFilter}
              onChange={(e) => setRedeemStatusFilter(e.target.value)}
              className="ws-select" style={{ width: 'auto' }}
            >
              <option value="PENDING">รอดำเนินการ (PENDING)</option>
              <option value="APPROVED">อนุมัติแล้ว (APPROVED)</option>
              <option value="REJECTED">ถูกปฏิเสธ (REJECTED)</option>
              <option value="CANCELLED">ยกเลิกแล้ว (CANCELLED)</option>
            </select>
            <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={loadRedeems}>
              รีเฟรช
            </button>
          </div>

          {redeemActionError && <div className="ws-alert ws-alert-danger">{redeemActionError}</div>}
          {redeemListError && <div className="ws-alert ws-alert-danger">{redeemListError}</div>}
          {redeemListLoading && <p className="ws-empty">กำลังโหลด...</p>}

          {!redeemListLoading && redeems.length === 0 && <p className="ws-empty">ไม่มีรายการในสถานะนี้</p>}

          {!redeemListLoading && redeems.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>พนักงาน</th>
                    <th>แผนก</th>
                    <th>ของรางวัล</th>
                    <th>คะแนนที่ใช้</th>
                    <th>วันที่แลก</th>
                    {redeemStatusFilter === 'PENDING' && <th>จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {redeems.map((rd) => (
                    <tr key={rd.redeem_id} >
                      <td>{rd.redeem_id}</td>
                      <td>
                        {rd.full_name}
                        <br />
                        <small style={{ color: 'var(--ws-text-muted)' }}>{rd.employee_id}</small>
                      </td>
                      <td>{rd.department || '-'}</td>
                      <td>{rd.reward_name}</td>
                      <td>{rd.used_score}</td>
                      <td>{formatDateTimeShort(rd.redeem_date)}</td>
                      {redeemStatusFilter === 'PENDING' && (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            className="ws-btn ws-btn-primary ws-btn-sm"
                            onClick={() => handleApproveRedeem(rd.redeem_id)}
                            disabled={redeemActioningId === rd.redeem_id}
                            style={{ marginRight: 6 }}
                          >
                            {redeemActioningId === rd.redeem_id ? '...' : 'อนุมัติ (มอบของแล้ว)'}
                          </button>
                          <button
                            className="ws-btn ws-btn-danger ws-btn-sm"
                            onClick={() => handleRejectRedeem(rd.redeem_id)}
                            disabled={redeemActioningId === rd.redeem_id}
                          >
                            {redeemActioningId === rd.redeem_id ? '...' : 'ปฏิเสธ'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'challenges' && (
        <>
          <div className="ws-card" style={{ marginBottom: 16, maxWidth: 720 }}>
            <h3 style={{ marginTop: 0 }}>สร้าง ชาเลนจ์ ใหม่</h3>
            <form onSubmit={handleCreateChallenge}>
              <div className="ws-form-grid">
                <div>
                  <label htmlFor="newChallengeCategory" className="ws-label">หมวดกิจกรรมที่ใช้วัด (รวมระยะทางทุกกิจกรรมในหมวดนี้)</label>
                  <select
                    id="newChallengeCategory"
                    value={newChallengeCategoryId}
                    onChange={(e) => setNewChallengeCategoryId(e.target.value)}
                    className="ws-select"
                  >
                    <option value="">-- เลือกหมวดกิจกรรม --</option>
                    {challengeCategories.map((cat) => (
                      <option key={cat.category_id} value={cat.category_id}>
                        {cat.category_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="newChallengeName" className="ws-label">ชื่อ ชาเลนจ์</label>
                  <input
                    id="newChallengeName"
                    type="text"
                    value={newChallengeName}
                    onChange={(e) => setNewChallengeName(e.target.value)}
                    placeholder="เช่น July Run Challenge"
                    className="ws-input"
                  />
                </div>

                <div className="ws-field-full">
                  <label htmlFor="newChallengeDescription" className="ws-label">รายละเอียด (ถ้ามี)</label>
                  <textarea
                    id="newChallengeDescription"
                    value={newChallengeDescription}
                    onChange={(e) => setNewChallengeDescription(e.target.value)}
                    rows={2}
                    className="ws-textarea"
                  />
                </div>

                <div>
                  <label htmlFor="newChallengeStart" className="ws-label">วันและเวลาเริ่ม</label>
                  {(() => {
                    const startParts = splitDatetimeLocal(newChallengeStartDate);
                    return (
                      <div className="ws-row" style={{ gap: 6 }}>
                        <input
                          id="newChallengeStart"
                          type="date"
                          value={startParts.date}
                          min={getNowForDatetimeInput().slice(0, 10)}
                          onChange={(e) =>
                            setNewChallengeStartDate(
                              joinDatetimeLocal(e.target.value, startParts.hour || '00', startParts.minute || '00')
                            )
                          }
                          className="ws-input"
                          style={{ flex: 1 }}
                        />
                        <select
                          aria-label="ชั่วโมงเริ่ม"
                          value={startParts.hour || '00'}
                          onChange={(e) =>
                            setNewChallengeStartDate(joinDatetimeLocal(startParts.date, e.target.value, startParts.minute || '00'))
                          }
                          className="ws-select"
                          style={{ width: 'auto' }}
                        >
                          {HOUR_OPTIONS.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span>:</span>
                        <select
                          aria-label="นาทีเริ่ม"
                          value={startParts.minute || '00'}
                          onChange={(e) =>
                            setNewChallengeStartDate(joinDatetimeLocal(startParts.date, startParts.hour || '00', e.target.value))
                          }
                          className="ws-select"
                          style={{ width: 'auto' }}
                        >
                          {MINUTE_OPTIONS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                  {newChallengeStartDate && (
                    <div style={{ fontSize: 12, color: 'var(--ws-text-muted)', marginTop: 4 }}>
                      เริ่ม: {formatDateTimeShort(newChallengeStartDate)}
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="newChallengeEnd" className="ws-label">วันและเวลาจบ</label>
                  {(() => {
                    const endParts = splitDatetimeLocal(newChallengeEndDate);
                    return (
                      <div className="ws-row" style={{ gap: 6 }}>
                        <input
                          id="newChallengeEnd"
                          type="date"
                          value={endParts.date}
                          min={(newChallengeStartDate || getNowForDatetimeInput()).slice(0, 10)}
                          onChange={(e) =>
                            setNewChallengeEndDate(
                              joinDatetimeLocal(e.target.value, endParts.hour || '00', endParts.minute || '00')
                            )
                          }
                          className="ws-input"
                          style={{ flex: 1 }}
                        />
                        <select
                          aria-label="ชั่วโมงจบ"
                          value={endParts.hour || '00'}
                          onChange={(e) =>
                            setNewChallengeEndDate(joinDatetimeLocal(endParts.date, e.target.value, endParts.minute || '00'))
                          }
                          className="ws-select"
                          style={{ width: 'auto' }}
                        >
                          {HOUR_OPTIONS.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span>:</span>
                        <select
                          aria-label="นาทีจบ"
                          value={endParts.minute || '00'}
                          onChange={(e) =>
                            setNewChallengeEndDate(joinDatetimeLocal(endParts.date, endParts.hour || '00', e.target.value))
                          }
                          className="ws-select"
                          style={{ width: 'auto' }}
                        >
                          {MINUTE_OPTIONS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                  {newChallengeEndDate && (
                    <div style={{ fontSize: 12, color: 'var(--ws-text-muted)', marginTop: 4 }}>
                      จบ: {formatDateTimeShort(newChallengeEndDate)}
                    </div>
                  )}
                </div>
              </div>

              {createChallengeError && <div className="ws-alert ws-alert-danger">{createChallengeError}</div>}

              <button type="submit" className="ws-btn ws-btn-primary" disabled={createChallengeSubmitting}>
                {createChallengeSubmitting ? 'กำลังสร้าง...' : 'สร้าง ชาเลนจ์'}
              </button>
            </form>
          </div>

          <div className="ws-row-between" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>รายการ ชาเลนจ์ ทั้งหมด</h3>
            <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={loadChallenges}>รีเฟรช</button>
          </div>

          {challengeActionError && <div className="ws-alert ws-alert-danger">{challengeActionError}</div>}
          {challengeListError && <div className="ws-alert ws-alert-danger">{challengeListError}</div>}
          {challengeListLoading && <p className="ws-empty">กำลังโหลด...</p>}

          {!challengeListLoading && challenges.length === 0 && <p className="ws-empty">ยังไม่มี challenge</p>}

          {!challengeListLoading && challenges.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ชื่อ ชาเลนจ์</th>
                    <th>หมวดกิจกรรม</th>
                    <th>ช่วงเวลา</th>
                    <th>สถานะ</th>
                    <th>ผู้เข้าร่วม</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((c) => (
                    <tr key={c.challenge_id} >
                      <td>{c.challenge_id}</td>
                      <td>
                        {c.challenge_name}
                        {c.description && (
                          <>
                            <br />
                            <small style={{ color: 'var(--ws-text-muted)' }}>{c.description}</small>
                          </>
                        )}
                      </td>
                      <td>{c.category_name}</td>
                      <td>
                        {formatDateTimeShort(c.start_date)} - {formatDateTimeShort(c.end_date)}
                      </td>
                      <td><span className="ws-badge ws-badge-info">{CHALLENGE_STATUS_LABEL_TH[c.status] || c.status}</span></td>
                      <td>{c.participant_count}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="ws-btn ws-btn-secondary ws-btn-sm"
                          onClick={() => openParticipants(c.challenge_id, c.challenge_name)}
                          style={{ marginRight: 6 }}
                        >
                          ดูผู้เข้าร่วม
                        </button>
                        {['UPCOMING', 'ONGOING'].includes(c.status) ? (
                          <button
                            className="ws-btn ws-btn-danger ws-btn-sm"
                            onClick={() => handleCancelChallenge(c.challenge_id)}
                            disabled={challengeActioningId === c.challenge_id}
                          >
                            {challengeActioningId === c.challenge_id ? '...' : 'ยกเลิก'}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {participantsChallengeId !== null && (
            <div className="ws-modal-overlay">
              <div className="ws-modal" style={{ maxWidth: 560 }}>
                <h3>ผู้เข้าร่วม: {participantsChallengeName}</h3>

                {participantsLoading && <p className="ws-empty">กำลังโหลด...</p>}
                {participantsError && <div className="ws-alert ws-alert-danger">{participantsError}</div>}

                {!participantsLoading && !participantsError && participants.length === 0 && (
                  <p className="ws-empty">ยังไม่มีผู้เข้าร่วม</p>
                )}

                {!participantsLoading && participants.length > 0 && (
                  <table className="ws-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>ชื่อ-สกุล</th>
                        <th>แผนก</th>
                        <th>โหมด</th>
                        <th>ระยะทางสะสม</th>
                        <th>จำนวนครั้ง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p) => (
                        <tr key={p.participantId} >
                          <td>{p.rank}</td>
                          <td>
                            {p.fullName}
                            <br />
                            <small style={{ color: 'var(--ws-text-muted)' }}>{p.employeeId}</small>
                          </td>
                          <td>{p.department || '-'}</td>
                          <td>
                            {p.joinMode === 'ANONYMOUS' ? 'ไม่ระบุตัวตน (leaderboard พนักงาน)' : 'แสดงชื่อ'}
                          </td>
                          <td>{p.totalDistance} กม.</td>
                          <td>{p.runCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="ws-modal-actions">
                  <button className="ws-btn ws-btn-secondary" onClick={closeParticipants}>ปิด</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'badges' && (
        <>
          <div className="ws-card" style={{ marginBottom: 16, maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>สร้าง เหรียญตรา ใหม่</h3>
            <form onSubmit={handleCreateBadge}>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newBadgeName">ชื่อ เหรียญตรา</label>
                <br />
                <input
                  id="newBadgeName"
                  type="text"
                  value={badgeForm.badgeName}
                  onChange={(e) => setBadgeForm((prev) => ({ ...prev, badgeName: e.target.value }))}
                  placeholder="เช่น วิ่งติดกัน 3 วัน"
                  className="ws-input"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newBadgeDescription">คำอธิบาย (ถ้ามี)</label>
                <br />
                <textarea
                  id="newBadgeDescription"
                  value={badgeForm.description}
                  onChange={(e) => setBadgeForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="ws-textarea"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newBadgeIcon">รูปไอคอน (ถ้ามี — อัปโหลดรูปBadge JPG/PNG/WEBP ไม่เกิน 2MB)</label>
                <br />
                <input
                  id="newBadgeIcon"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setBadgeIconFile(e.target.files?.[0] || null)}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="newBadgeConditionType">ประเภทเงื่อนไข</label>
                  <br />
                  <select
                    id="newBadgeConditionType"
                    value={badgeForm.conditionType}
                    onChange={(e) => setBadgeForm((prev) => ({ ...prev, conditionType: e.target.value }))}
                    className="ws-select"
                  >
                    {Object.entries(BADGE_CONDITION_LABEL_TH).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="newBadgeConditionValue">ค่าที่ต้องถึง</label>
                  <br />
                  <input
                    id="newBadgeConditionValue"
                    type="number"
                    min="1"
                    step="1"
                    value={badgeForm.conditionValue}
                    onChange={(e) => setBadgeForm((prev) => ({ ...prev, conditionValue: e.target.value }))}
                    className="ws-input"
                  />
                </div>
              </div>

              {badgeFormError && <div className="ws-alert ws-alert-danger">{badgeFormError}</div>}

              <button type="submit" className="ws-btn ws-btn-primary" disabled={badgeFormSubmitting}>
                {badgeFormSubmitting ? 'กำลังสร้าง...' : 'สร้าง เหรียญตรา'}
              </button>
            </form>
          </div>

          <div className="ws-row-between" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>รายการ เหรียญตรา ทั้งหมด</h3>
            <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={loadBadges}>รีเฟรช</button>
          </div>

          {badgeListError && <div className="ws-alert ws-alert-danger">{badgeListError}</div>}
          {badgeListLoading && <p className="ws-empty">กำลังโหลด...</p>}

          {!badgeListLoading && badges.length === 0 && <p className="ws-empty">ยังไม่มี badge</p>}

          {!badgeListLoading && badges.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ไอคอน</th>
                    <th>ชื่อ เหรียญตรา</th>
                    <th>เงื่อนไข</th>
                    <th>สถานะ</th>
                    <th>ได้รับแล้ว</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {badges.map((b) => {
                    const isEditing = editingBadgeId === b.badge_id;
                    const isActioning = badgeActioningId === b.badge_id;

                    if (isEditing) {
                      return (
                        <tr key={b.badge_id} >
                          <td>{b.badge_id}</td>
                          <td>
                            {editBadgeForm.icon && !editRemoveIcon && (
                              <img
                                src={`${API_BASE}/${editBadgeForm.icon}`}
                                alt=""
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  display: 'block',
                                  marginBottom: 6,
                                }}
                              />
                            )}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) => {
                                setEditBadgeIconFile(e.target.files?.[0] || null);
                                setEditRemoveIcon(false);
                              }}
                              style={{ fontSize: 12, width: 110 }}
                            />
                            {editBadgeForm.icon && (
                              <label style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                                <input
                                  type="checkbox"
                                  checked={editRemoveIcon}
                                  onChange={(e) => {
                                    setEditRemoveIcon(e.target.checked);
                                    if (e.target.checked) setEditBadgeIconFile(null);
                                  }}
                                />{' '}
                                ลบรูป
                              </label>
                            )}
                          </td>
                          <td>
                            <input
                              type="text"
                              value={editBadgeForm.badgeName}
                              onChange={(e) =>
                                setEditBadgeForm((prev) => ({ ...prev, badgeName: e.target.value }))
                              }
                              className="ws-input"
                              style={{ marginBottom: 6 }}
                            />
                            <textarea
                              value={editBadgeForm.description}
                              onChange={(e) =>
                                setEditBadgeForm((prev) => ({ ...prev, description: e.target.value }))
                              }
                              rows={2}
                              className="ws-textarea"
                              placeholder="คำอธิบาย"
                            />
                          </td>
                          <td>
                            <select
                              value={editBadgeForm.conditionType}
                              onChange={(e) =>
                                setEditBadgeForm((prev) => ({ ...prev, conditionType: e.target.value }))
                              }
                              className="ws-select"
                              style={{ marginBottom: 6 }}
                            >
                              {Object.entries(BADGE_CONDITION_LABEL_TH).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={editBadgeForm.conditionValue}
                              onChange={(e) =>
                                setEditBadgeForm((prev) => ({ ...prev, conditionValue: e.target.value }))
                              }
                              className="ws-input"
                            />
                          </td>
                          <td>
                            <select
                              value={editBadgeForm.status}
                              onChange={(e) =>
                                setEditBadgeForm((prev) => ({ ...prev, status: e.target.value }))
                              }
                              className="ws-select"
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          </td>
                          <td>{b.earned_count} คน</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {editBadgeError && (
                              <div className="ws-alert ws-alert-danger" style={{ margin: '0 0 6px' }}>{editBadgeError}</div>
                            )}
                            <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => handleSaveBadge(b.badge_id)} disabled={isActioning}>
                              {isActioning ? '...' : 'บันทึก'}
                            </button>{' '}
                            <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={cancelEditBadge} disabled={isActioning}>
                              ยกเลิก
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={b.badge_id} >
                        <td>{b.badge_id}</td>
                        <td>
                          {b.icon ? (
                            <img
                              src={`${API_BASE}/${b.icon}`}
                              alt=""
                              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <span style={{ fontSize: 24 }}>🏅</span>
                          )}
                        </td>
                        <td>
                          {b.badge_name}
                          {b.description && (
                            <>
                              <br />
                              <small style={{ color: 'var(--ws-text-muted)' }}>{b.description}</small>
                            </>
                          )}
                        </td>
                        <td>
                          {BADGE_CONDITION_LABEL_TH[b.condition_type] || b.condition_type} ≥ {b.condition_value}
                        </td>
                        <td><span className={`ws-badge ${b.status === 'ACTIVE' ? 'ws-badge-success' : 'ws-badge-neutral'}`}>{b.status}</span></td>
                        <td>{b.earned_count} คน</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => startEditBadge(b)} disabled={isActioning}>
                            แก้ไข
                          </button>{' '}
                          <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={() => handleToggleBadgeStatus(b)} disabled={isActioning}>
                            {isActioning ? '...' : b.status === 'ACTIVE' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'categories' && (
        <>
          <div className="ws-card" style={{ marginBottom: 16, maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>สร้างหมวดหมู่กิจกรรมใหม่</h3>
            <form onSubmit={handleCreateCategory}>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newCategoryName">ชื่อหมวดหมู่</label>
                <br />
                <input
                  id="newCategoryName"
                  type="text"
                  value={categoryForm.categoryName}
                  onChange={(e) => setCategoryForm({ categoryName: e.target.value })}
                  placeholder="เช่น วิ่ง, ปั่นจักรยาน, ว่ายน้ำ"
                  className="ws-input"
                />
              </div>

              {categoryFormError && <div className="ws-alert ws-alert-danger">{categoryFormError}</div>}

              <button type="submit" className="ws-btn ws-btn-primary" disabled={categoryFormSubmitting}>
                {categoryFormSubmitting ? 'กำลังสร้าง...' : 'สร้างหมวดหมู่'}
              </button>
            </form>
          </div>

          <div className="ws-row-between" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>รายการหมวดหมู่กิจกรรมทั้งหมด</h3>
            <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={loadCategories}>รีเฟรช</button>
          </div>

          {categoryListError && <div className="ws-alert ws-alert-danger">{categoryListError}</div>}
          {categoryListLoading && <p className="ws-empty">กำลังโหลด...</p>}
          {!categoryListLoading && categories.length === 0 && <p className="ws-empty">ยังไม่มีหมวดหมู่</p>}

          {!categoryListLoading && categories.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ชื่อหมวดหมู่</th>
                    <th>สถานะ</th>
                    <th>จำนวนประเภทกิจกรรมย่อย</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => {
                    const isEditing = editingCategoryId === cat.category_id;
                    const isActioning = categoryActioningId === cat.category_id;

                    if (isEditing) {
                      return (
                        <tr key={cat.category_id} >
                          <td>{cat.category_id}</td>
                          <td>
                            <input
                              type="text"
                              value={editCategoryForm.categoryName}
                              onChange={(e) =>
                                setEditCategoryForm((prev) => ({ ...prev, categoryName: e.target.value }))
                              }
                              className="ws-input"
                            />
                          </td>
                          <td>
                            <select
                              value={editCategoryForm.status}
                              onChange={(e) =>
                                setEditCategoryForm((prev) => ({ ...prev, status: e.target.value }))
                              }
                              className="ws-select"
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          </td>
                          <td>{cat.activity_type_count}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {editCategoryError && (
                              <div className="ws-alert ws-alert-danger" style={{ margin: '0 0 6px' }}>{editCategoryError}</div>
                            )}
                            <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => handleSaveCategory(cat.category_id)} disabled={isActioning}>
                              {isActioning ? '...' : 'บันทึก'}
                            </button>{' '}
                            <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={cancelEditCategory} disabled={isActioning}>
                              ยกเลิก
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={cat.category_id} >
                        <td>{cat.category_id}</td>
                        <td>{cat.category_name}</td>
                        <td><span className={`ws-badge ${cat.status === 'ACTIVE' ? 'ws-badge-success' : 'ws-badge-neutral'}`}>{cat.status}</span></td>
                        <td>{cat.activity_type_count}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => startEditCategory(cat)} disabled={isActioning}>
                            แก้ไข
                          </button>{' '}
                          <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={() => handleToggleCategoryStatus(cat)} disabled={isActioning}>
                            {isActioning ? '...' : cat.status === 'ACTIVE' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'activityTypes' && (
        <>
          <div className="ws-card" style={{ marginBottom: 16, maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>สร้างประเภทกิจกรรมใหม่</h3>
            <form onSubmit={handleCreateActivityType}>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newActivityCategory">หมวดหมู่</label>
                <br />
                <select
                  id="newActivityCategory"
                  value={activityTypeForm.categoryId}
                  onChange={(e) => setActivityTypeForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                  className="ws-select"
                >
                  <option value="">-- เลือกหมวดหมู่ --</option>
                  {categories
                    .filter((c) => c.status === 'ACTIVE')
                    .map((c) => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.category_name}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newActivityName">ชื่อกิจกรรม</label>
                <br />
                <input
                  id="newActivityName"
                  type="text"
                  value={activityTypeForm.activityName}
                  onChange={(e) => setActivityTypeForm((prev) => ({ ...prev, activityName: e.target.value }))}
                  placeholder='เช่น "วิ่ง 5 km"'
                  className="ws-input"
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="newActivityScore">คะแนน</label>
                  <br />
                  <input
                    id="newActivityScore"
                    type="number"
                    min="0"
                    step="1"
                    value={activityTypeForm.score}
                    onChange={(e) => setActivityTypeForm((prev) => ({ ...prev, score: e.target.value }))}
                    className="ws-input"
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={activityTypeForm.requireImage}
                      onChange={(e) =>
                        setActivityTypeForm((prev) => ({ ...prev, requireImage: e.target.checked }))
                      }
                    />{' '}
                    บังคับแนบรูปหลักฐาน
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newActivityDescription">รายละเอียด (ถ้ามี)</label>
                <br />
                <textarea
                  id="newActivityDescription"
                  value={activityTypeForm.description}
                  onChange={(e) => setActivityTypeForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="ws-textarea"
                />
              </div>

              {activityTypeFormError && <div className="ws-alert ws-alert-danger">{activityTypeFormError}</div>}

              <button type="submit" className="ws-btn ws-btn-primary" disabled={activityTypeFormSubmitting}>
                {activityTypeFormSubmitting ? 'กำลังสร้าง...' : 'สร้างประเภทกิจกรรม'}
              </button>
            </form>
          </div>

          <div className="ws-row-between" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>รายการประเภทกิจกรรมทั้งหมด</h3>
            <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={loadActivityTypes}>รีเฟรช</button>
          </div>

          {activityTypeListError && <div className="ws-alert ws-alert-danger">{activityTypeListError}</div>}
          {activityTypeListLoading && <p className="ws-empty">กำลังโหลด...</p>}
          {!activityTypeListLoading && activityTypes.length === 0 && <p className="ws-empty">ยังไม่มีประเภทกิจกรรม</p>}

          {!activityTypeListLoading && activityTypes.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>หมวดหมู่</th>
                    <th>ชื่อกิจกรรม</th>
                    <th>คะแนน</th>
                    <th>บังคับรูป</th>
                    <th>สถานะ</th>
                    <th>เคยส่งแล้ว</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {activityTypes.map((a) => {
                    const isEditing = editingActivityTypeId === a.activity_id;
                    const isActioning = activityTypeActioningId === a.activity_id;

                    if (isEditing) {
                      return (
                        <tr key={a.activity_id} >
                          <td>{a.activity_id}</td>
                          <td>
                            <select
                              value={editActivityTypeForm.categoryId}
                              onChange={(e) =>
                                setEditActivityTypeForm((prev) => ({ ...prev, categoryId: e.target.value }))
                              }
                              className="ws-select"
                            >
                              {categories.map((c) => (
                                <option key={c.category_id} value={c.category_id}>
                                  {c.category_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              value={editActivityTypeForm.activityName}
                              onChange={(e) =>
                                setEditActivityTypeForm((prev) => ({ ...prev, activityName: e.target.value }))
                              }
                              className="ws-input"
                            />
                            <textarea
                              value={editActivityTypeForm.description}
                              onChange={(e) =>
                                setEditActivityTypeForm((prev) => ({ ...prev, description: e.target.value }))
                              }
                              rows={2}
                              className="ws-textarea"
                              style={{ marginTop: 6 }}
                              placeholder="รายละเอียด"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={editActivityTypeForm.score}
                              onChange={(e) =>
                                setEditActivityTypeForm((prev) => ({ ...prev, score: e.target.value }))
                              }
                              className="ws-input"
                              style={{ width: 70 }}
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={editActivityTypeForm.requireImage}
                              onChange={(e) =>
                                setEditActivityTypeForm((prev) => ({ ...prev, requireImage: e.target.checked }))
                              }
                            />
                          </td>
                          <td>
                            <select
                              value={editActivityTypeForm.status}
                              onChange={(e) =>
                                setEditActivityTypeForm((prev) => ({ ...prev, status: e.target.value }))
                              }
                              className="ws-select"
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          </td>
                          <td>{a.submission_count}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {editActivityTypeError && (
                              <div className="ws-alert ws-alert-danger" style={{ margin: '0 0 6px' }}>{editActivityTypeError}</div>
                            )}
                            <button
                              className="ws-btn ws-btn-primary ws-btn-sm"
                              onClick={() => handleSaveActivityType(a.activity_id)}
                              disabled={isActioning}
                            >
                              {isActioning ? '...' : 'บันทึก'}
                            </button>{' '}
                            <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={cancelEditActivityType} disabled={isActioning}>
                              ยกเลิก
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={a.activity_id} >
                        <td>{a.activity_id}</td>
                        <td>{a.category_name}</td>
                        <td>
                          {a.activity_name}
                          {a.description && (
                            <>
                              <br />
                              <small style={{ color: 'var(--ws-text-muted)' }}>{a.description}</small>
                            </>
                          )}
                        </td>
                        <td>{a.score}</td>
                        <td>{a.require_image ? 'ต้องแนบ' : 'ไม่บังคับ'}</td>
                        <td><span className={`ws-badge ${a.status === 'ACTIVE' ? 'ws-badge-success' : 'ws-badge-neutral'}`}>{a.status}</span></td>
                        <td>{a.submission_count}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => startEditActivityType(a)} disabled={isActioning}>
                            แก้ไข
                          </button>{' '}
                          <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={() => handleToggleActivityTypeStatus(a)} disabled={isActioning}>
                            {isActioning ? '...' : a.status === 'ACTIVE' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'rewards' && (
        <>
          <div className="ws-card" style={{ marginBottom: 16, maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>สร้างของรางวัลใหม่</h3>
            <form onSubmit={handleCreateReward}>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newRewardName">ชื่อของรางวัล</label>
                <br />
                <input
                  id="newRewardName"
                  type="text"
                  value={rewardForm.rewardName}
                  onChange={(e) => setRewardForm((prev) => ({ ...prev, rewardName: e.target.value }))}
                  placeholder='เช่น "กระบอกน้ำ"'
                  className="ws-input"
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="newRewardScore">คะแนนที่ใช้แลก</label>
                  <br />
                  <input
                    id="newRewardScore"
                    type="number"
                    min="1"
                    step="1"
                    value={rewardForm.requiredScore}
                    onChange={(e) => setRewardForm((prev) => ({ ...prev, requiredScore: e.target.value }))}
                    className="ws-input"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="newRewardStock">จำนวนคงเหลือ</label>
                  <br />
                  <input
                    id="newRewardStock"
                    type="number"
                    min="0"
                    step="1"
                    value={rewardForm.stock}
                    onChange={(e) => setRewardForm((prev) => ({ ...prev, stock: e.target.value }))}
                    className="ws-input"
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newRewardDescription">รายละเอียด (ถ้ามี)</label>
                <br />
                <textarea
                  id="newRewardDescription"
                  value={rewardForm.description}
                  onChange={(e) => setRewardForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="ws-textarea"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newRewardImage">รูปของรางวัล (ถ้ามี — JPG/PNG/WEBP ไม่เกิน 2MB)</label>
                <br />
                <input
                  id="newRewardImage"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setRewardImageFile(e.target.files?.[0] || null)}
                />
              </div>

              {rewardFormError && <div className="ws-alert ws-alert-danger">{rewardFormError}</div>}

              <button type="submit" className="ws-btn ws-btn-primary" disabled={rewardFormSubmitting}>
                {rewardFormSubmitting ? 'กำลังสร้าง...' : 'สร้างของรางวัล'}
              </button>
            </form>
          </div>

          <div className="ws-row-between" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>รายการของรางวัลทั้งหมด</h3>
            <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={loadRewards}>รีเฟรช</button>
          </div>

          {rewardListError && <div className="ws-alert ws-alert-danger">{rewardListError}</div>}
          {rewardListLoading && <p className="ws-empty">กำลังโหลด...</p>}
          {!rewardListLoading && rewards.length === 0 && <p className="ws-empty">ยังไม่มีของรางวัล</p>}

          {!rewardListLoading && rewards.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>รูป</th>
                    <th>ชื่อของรางวัล</th>
                    <th>คะแนนที่ใช้แลก</th>
                    <th>คงเหลือ</th>
                    <th>สถานะ</th>
                    <th>เคยแลกแล้ว</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map((r) => {
                    const isEditing = editingRewardId === r.reward_id;
                    const isActioning = rewardActioningId === r.reward_id;

                    if (isEditing) {
                      return (
                        <tr key={r.reward_id} >
                          <td>{r.reward_id}</td>
                          <td>
                            {editRewardForm.image && !editRemoveRewardImage && (
                              <img
                                src={`${API_BASE}/${editRewardForm.image}`}
                                alt=""
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 4,
                                  objectFit: 'cover',
                                  display: 'block',
                                  marginBottom: 6,
                                }}
                              />
                            )}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) => {
                                setEditRewardImageFile(e.target.files?.[0] || null);
                                setEditRemoveRewardImage(false);
                              }}
                              style={{ fontSize: 12, width: 110 }}
                            />
                            {editRewardForm.image && (
                              <label style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                                <input
                                  type="checkbox"
                                  checked={editRemoveRewardImage}
                                  onChange={(e) => {
                                    setEditRemoveRewardImage(e.target.checked);
                                    if (e.target.checked) setEditRewardImageFile(null);
                                  }}
                                />{' '}
                                ลบรูป
                              </label>
                            )}
                          </td>
                          <td>
                            <input
                              type="text"
                              value={editRewardForm.rewardName}
                              onChange={(e) =>
                                setEditRewardForm((prev) => ({ ...prev, rewardName: e.target.value }))
                              }
                              className="ws-input"
                              style={{ marginBottom: 6 }}
                            />
                            <textarea
                              value={editRewardForm.description}
                              onChange={(e) =>
                                setEditRewardForm((prev) => ({ ...prev, description: e.target.value }))
                              }
                              rows={2}
                              className="ws-textarea"
                              placeholder="รายละเอียด"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={editRewardForm.requiredScore}
                              onChange={(e) =>
                                setEditRewardForm((prev) => ({ ...prev, requiredScore: e.target.value }))
                              }
                              className="ws-input"
                              style={{ width: 80 }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={editRewardForm.stock}
                              onChange={(e) =>
                                setEditRewardForm((prev) => ({ ...prev, stock: e.target.value }))
                              }
                              className="ws-input"
                              style={{ width: 70 }}
                            />
                          </td>
                          <td>
                            <select
                              value={editRewardForm.status}
                              onChange={(e) =>
                                setEditRewardForm((prev) => ({ ...prev, status: e.target.value }))
                              }
                              className="ws-select"
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          </td>
                          <td>{r.redeem_count}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {editRewardError && (
                              <div className="ws-alert ws-alert-danger" style={{ margin: '0 0 6px' }}>{editRewardError}</div>
                            )}
                            <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => handleSaveReward(r.reward_id)} disabled={isActioning}>
                              {isActioning ? '...' : 'บันทึก'}
                            </button>{' '}
                            <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={cancelEditReward} disabled={isActioning}>
                              ยกเลิก
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={r.reward_id} >
                        <td>{r.reward_id}</td>
                        <td>
                          {r.image ? (
                            <img
                              src={`${API_BASE}/${r.image}`}
                              alt=""
                              style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }}
                            />
                          ) : (
                            <span style={{ fontSize: 24 }}>🎁</span>
                          )}
                        </td>
                        <td>
                          {r.reward_name}
                          {r.description && (
                            <>
                              <br />
                              <small style={{ color: 'var(--ws-text-muted)' }}>{r.description}</small>
                            </>
                          )}
                        </td>
                        <td>{r.required_score}</td>
                        <td>{r.stock}</td>
                        <td><span className={`ws-badge ${r.status === 'ACTIVE' ? 'ws-badge-success' : 'ws-badge-neutral'}`}>{r.status}</span></td>
                        <td>{r.redeem_count}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => startEditReward(r)} disabled={isActioning}>
                            แก้ไข
                          </button>{' '}
                          <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={() => handleToggleRewardStatus(r)} disabled={isActioning}>
                            {isActioning ? '...' : r.status === 'ACTIVE' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'healthCampaigns' && (
        <>
          <div className="ws-card" style={{ marginBottom: 16, maxWidth: 560 }}>
            <h3 style={{ marginTop: 0 }}>สร้างรอบแบบสอบถามติดตามผลใหม่</h3>
            <form onSubmit={handleCreateCampaign}>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newCampaignName">ชื่อรอบ</label>
                <br />
                <input
                  id="newCampaignName"
                  type="text"
                  value={campaignForm.campaignName}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, campaignName: e.target.value }))}
                  placeholder="เช่น ติดตามผล 8 สัปดาห์ รอบที่ 1"
                  className="ws-input"
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="newCampaignReleaseDate">วันที่เปิดให้กรอก</label>
                  <br />
                  <input
                    id="newCampaignReleaseDate"
                    type="date"
                    value={campaignForm.releaseDate}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, releaseDate: e.target.value }))}
                    className="ws-input"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="newCampaignCloseDate">วันที่ปิดรับ (ถ้ามี)</label>
                  <br />
                  <input
                    id="newCampaignCloseDate"
                    type="date"
                    value={campaignForm.closeDate}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, closeDate: e.target.value }))}
                    className="ws-input"
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label>เลือกฟิลด์ที่จะให้พนักงานกรอกในรอบนี้</label>
                {CAMPAIGN_FIELD_GROUPS.map((g) => (
                  <div key={g.group} style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--ws-text-secondary)', marginBottom: 4 }}>{g.group}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {g.fields.map((f) => {
                        const active = campaignForm.includedFields.includes(f.key);
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => toggleCampaignField(f.key)}
                            className="ws-btn ws-btn-sm"
                            style={{
                              borderColor: active ? 'var(--ws-primary)' : undefined,
                              background: active ? 'var(--ws-primary)' : undefined,
                              color: active ? '#fff' : undefined,
                            }}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {campaignFormError && <div className="ws-alert ws-alert-danger">{campaignFormError}</div>}

              <button type="submit" className="ws-btn ws-btn-primary" disabled={campaignFormSubmitting}>
                {campaignFormSubmitting ? 'กำลังสร้าง...' : 'สร้างรอบ (สถานะร่าง)'}
              </button>
              <p style={{ fontSize: 13, color: 'var(--ws-text-muted)', marginTop: 8, marginBottom: 0 }}>
                สร้างเสร็จจะอยู่ในสถานะ "ร่าง" ก่อน — ต้องกด "เปิด" ในรายการด้านล่างให้พนักงานถึงจะเริ่มเห็นแบบฟอร์ม
              </p>
            </form>
          </div>

          <div className="ws-row-between" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>รายการรอบ follow-up ทั้งหมด</h3>
            <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={loadCampaigns}>รีเฟรช</button>
          </div>

          {campaignListError && <div className="ws-alert ws-alert-danger">{campaignListError}</div>}
          {campaignListLoading && <p className="ws-empty">กำลังโหลด...</p>}
          {!campaignListLoading && campaigns.length === 0 && <p className="ws-empty">ยังไม่มีรอบ follow-up</p>}

          {!campaignListLoading && campaigns.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>ชื่อรอบ</th>
                    <th>วันที่เปิด</th>
                    <th>วันที่ปิด</th>
                    <th>สถานะ</th>
                    <th>ตอบแล้ว</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const isActioning = campaignActioningId === c.campaign_id;
                    return (
                      <tr key={c.campaign_id}>
                        <td>{c.campaign_name}</td>
                        <td>{c.release_date ? new Date(c.release_date).toLocaleDateString('th-TH') : '-'}</td>
                        <td>{c.close_date ? new Date(c.close_date).toLocaleDateString('th-TH') : '-'}</td>
                        <td>
                          <span
                            className={`ws-badge ${
                              c.status === 'OPEN'
                                ? 'ws-badge-success'
                                : c.status === 'CLOSED'
                                ? 'ws-badge-neutral'
                                : 'ws-badge-warning'
                            }`}
                          >
                            {CAMPAIGN_STATUS_LABEL_TH[c.status] || c.status}
                          </span>
                        </td>
                        <td>{c.response_count} / {c.active_employee_count}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {c.status !== 'CLOSED' && (
                            <button
                              className="ws-btn ws-btn-secondary ws-btn-sm"
                              onClick={() => handleToggleCampaignStatus(c)}
                              disabled={isActioning}
                            >
                              {isActioning ? 'กำลังบันทึก...' : c.status === 'OPEN' ? 'ปิดรอบ' : 'เปิดรอบ'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'healthResults' && (
        <>
          {!selectedHealthEmployeeId && (
            <>
              <div className="ws-row-between" style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="ค้นหาชื่อหรือรหัสพนักงาน"
                  value={healthSearch}
                  onChange={(e) => setHealthSearch(e.target.value)}
                  className="ws-input"
                  style={{ maxWidth: 280 }}
                />
                <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={loadHealthList}>รีเฟรช</button>
              </div>

              {healthListError && <div className="ws-alert ws-alert-danger">{healthListError}</div>}
              {healthListLoading && <p className="ws-empty">กำลังโหลด...</p>}
              {!healthListLoading && healthList.length === 0 && <p className="ws-empty">ยังไม่มีข้อมูล</p>}

              {!healthListLoading && healthList.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="ws-table">
                    <thead>
                      <tr>
                        <th>พนักงาน</th>
                        <th>Baseline</th>
                        <th>น้ำหนักล่าสุด</th>
                        <th>BMI</th>
                        <th>MET-min/wk</th>
                        <th>Follow-up ตอบแล้ว</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {healthList
                        .filter((row) => {
                          const q = healthSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            row.full_name.toLowerCase().includes(q) ||
                            row.employee_id.toLowerCase().includes(q)
                          );
                        })
                        .map((row) => (
                          <tr key={row.employee_id}>
                            <td>
                              {row.full_name}
                              <div style={{ fontSize: 12, color: 'var(--ws-text-muted)' }}>{row.employee_id}</div>
                            </td>
                            <td>
                              {row.baseline_completed ? (
                                <span className="ws-badge ws-badge-success">ครบ</span>
                              ) : (
                                <span className="ws-badge ws-badge-warning">ยังไม่กรอก</span>
                              )}
                            </td>
                            <td>{row.latest_weight_kg ?? '-'}</td>
                            <td>{row.latest_bmi ?? '-'}</td>
                            <td>{row.latest_met_minutes_per_week ?? '-'}</td>
                            <td>{row.followup_count}</td>
                            <td>
                              <button
                                className="ws-btn ws-btn-secondary ws-btn-sm"
                                onClick={() => openHealthDetail(row.employee_id)}
                                disabled={!row.baseline_completed}
                              >
                                ดูรายละเอียด
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {selectedHealthEmployeeId && (
            <div>
              <button className="ws-btn ws-btn-secondary ws-btn-sm" style={{ marginBottom: 16 }} onClick={closeHealthDetail}>
                ← กลับไปรายชื่อ
              </button>

              {healthDetailLoading && <p className="ws-empty">กำลังโหลด...</p>}
              {healthDetailError && <div className="ws-alert ws-alert-danger">{healthDetailError}</div>}

              {healthDetail && (
                <>
                  <div className="ws-row-between" style={{ marginBottom: 16 }}>
                    <div>
                      <p style={{ fontWeight: 'bold', fontSize: 16, margin: 0 }}>{healthDetail.employee.full_name}</p>
                      <p style={{ fontSize: 13, color: 'var(--ws-text-secondary)', margin: 0 }}>
                        {healthDetail.employee.employee_id} · {healthDetail.employee.department || '-'} · {healthDetail.employee.job_position || '-'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                    {['weight_kg', 'bmi', 'met_minutes_per_week'].map((field) => {
                      const rowsWithValue = healthDetail.assessments.filter((a) => a[field] !== null && a[field] !== undefined);
                      const latest = rowsWithValue[rowsWithValue.length - 1];
                      const labelMap = { weight_kg: 'น้ำหนักล่าสุด (กก.)', bmi: 'BMI ล่าสุด', met_minutes_per_week: 'MET-min/wk ล่าสุด' };
                      return (
                        <div key={field} className="ws-card" style={{ padding: '1rem' }}>
                          <p style={{ fontSize: 13, color: 'var(--ws-text-secondary)', margin: '0 0 4px' }}>{labelMap[field]}</p>
                          <p style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>{latest ? latest[field] : '-'}</p>
                        </div>
                      );
                    })}
                    <div className="ws-card" style={{ padding: '1rem' }}>
                      <p style={{ fontSize: 13, color: 'var(--ws-text-secondary)', margin: '0 0 4px' }}>จำนวนรอบที่ตอบ</p>
                      <p style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>{healthDetail.assessments.length}</p>
                    </div>
                  </div>

                  <h4>แนวโน้มน้ำหนัก (baseline → follow-up)</h4>
                  <HealthTrendChart
                    unit=" กก."
                    points={healthDetail.assessments
                      .filter((a) => a.weight_kg !== null && a.weight_kg !== undefined)
                      .map((a) => ({
                        label: a.assessment_type === 'BASELINE' ? 'Baseline' : new Date(a.created_at).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
                        value: Number(a.weight_kg),
                      }))}
                  />

                  <h4 style={{ marginTop: 24 }}>แนวโน้ม MET-minutes/สัปดาห์</h4>
                  <HealthTrendChart
                    unit=""
                    points={healthDetail.assessments
                      .filter((a) => a.met_minutes_per_week !== null && a.met_minutes_per_week !== undefined)
                      .map((a) => ({
                        label: a.assessment_type === 'BASELINE' ? 'Baseline' : new Date(a.created_at).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
                        value: Number(a.met_minutes_per_week),
                      }))}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'admins' && (
        <>
          <div className="ws-card" style={{ marginBottom: 16, maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>ให้สิทธิ์แอดมินใหม่</h3>
            <form onSubmit={handleGrantAdmin}>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newAdminEmployeeId">รหัสพนักงาน</label>
                <br />
                <input
                  id="newAdminEmployeeId"
                  type="text"
                  value={adminForm.employeeId}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, employeeId: e.target.value }))}
                  placeholder="เช่น EMP045"
                  className="ws-input"
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newAdminPassword">รหัสผ่าน</label>
                <br />
                <input
                  id="newAdminPassword"
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  className="ws-input"
                />
              </div>

              {adminFormError && <div className="ws-alert ws-alert-danger">{adminFormError}</div>}

              <button type="submit" className="ws-btn ws-btn-primary" disabled={adminFormSubmitting}>
                {adminFormSubmitting ? 'กำลังบันทึก...' : 'ให้สิทธิ์แอดมิน'}
              </button>
            </form>
            <p style={{ fontSize: 13, color: 'var(--ws-text-muted)', marginBottom: 0 }}>
              {/* รหัสพนักงานต้องมีอยู่ในตาราง employee อยู่แล้ว (sync จาก Pulse หรือเพิ่มเอง) ระบบจะตั้งสิทธิ์เป็น ADMIN ให้อัตโนมัติ */}
            </p>
          </div>

          <div className="ws-row-between" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>รายชื่อแอดมินปัจจุบัน</h3>
            <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={loadAdmins}>รีเฟรช</button>
          </div>

          {adminListError && <div className="ws-alert ws-alert-danger">{adminListError}</div>}
          {adminListLoading && <p className="ws-empty">กำลังโหลด...</p>}
          {!adminListLoading && admins.length === 0 && <p className="ws-empty">ยังไม่มีแอดมิน</p>}

          {!adminListLoading && admins.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>รหัสพนักงาน</th>
                    <th>ชื่อ-สกุล</th>
                    <th>แผนก</th>
                    <th>ได้สิทธิ์เมื่อ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => {
                    const isSelf = a.employee_id === adminId;
                    const isActioning = adminActioningId === a.employee_id;
                    return (
                      <tr key={a.employee_id}>
                        <td>{a.employee_id}</td>
                        <td>{a.full_name}</td>
                        <td>{a.department || '-'}</td>
                        <td>{new Date(a.created_at).toLocaleString('th-TH')}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {isSelf ? (
                            <span className="ws-badge ws-badge-neutral">คุณ</span>
                          ) : (
                            <button
                              className="ws-btn ws-btn-ghost ws-btn-sm"
                              onClick={() => handleRevokeAdmin(a.employee_id)}
                              disabled={isActioning}
                            >
                              {isActioning ? '...' : 'ถอดสิทธิ์'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}