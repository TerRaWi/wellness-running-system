import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE;

export default function AdminApp() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminId, setAdminId] = useState(null);

  const [loginEmployeeId, setLoginEmployeeId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // สลับระหว่างหน้าตรวจสอบกิจกรรม กับหน้าตรวจสอบการแลกของรางวัล (Phase 2)
  const [activeTab, setActiveTab] = useState('submissions'); // 'submissions' | 'redeems'

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
      setBadgeFormError('กรุณากรอกชื่อ badge และค่าเงื่อนไข');
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
        throw new Error(data.message || 'สร้าง badge ไม่สำเร็จ');
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
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>กำลังตรวจสอบสิทธิ์...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div style={{ padding: 24, maxWidth: 360, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center' }}>เข้าสู่ระบบแอดมิน</h2>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="loginEmployeeId">รหัสพนักงาน</label>
            <br />
            <input
              id="loginEmployeeId"
              type="text"
              value={loginEmployeeId}
              onChange={(e) => setLoginEmployeeId(e.target.value)}
              style={{ padding: 8, fontSize: 16, width: '100%' }}
              autoComplete="username"
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="loginPassword">รหัสผ่าน</label>
            <br />
            <input
              id="loginPassword"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              style={{ padding: 8, fontSize: 16, width: '100%' }}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={loginSubmitting} style={{ width: '100%', padding: 10 }}>
            {loginSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
        {loginError && <p style={{ color: 'red', textAlign: 'center' }}>{loginError}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h2 style={{ margin: 0 }}>แดชบอร์ดแอดมิน</h2>
        <div>
          <span style={{ marginRight: 12 }}>เข้าสู่ระบบเป็น: {adminId}</span>
          <button onClick={handleLogout}>ออกจากระบบ</button>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <button
          onClick={() => setActiveTab('submissions')}
          style={{ fontWeight: activeTab === 'submissions' ? 'bold' : 'normal' }}
        >
          ตรวจสอบกิจกรรม
        </button>
        <button
          onClick={() => setActiveTab('redeems')}
          style={{ fontWeight: activeTab === 'redeems' ? 'bold' : 'normal' }}
        >
          คำขอแลกของรางวัล
        </button>
        <button
          onClick={() => setActiveTab('challenges')}
          style={{ fontWeight: activeTab === 'challenges' ? 'bold' : 'normal' }}
        >
          Challenge
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          style={{ fontWeight: activeTab === 'badges' ? 'bold' : 'normal' }}
        >
          Badge
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          style={{ fontWeight: activeTab === 'categories' ? 'bold' : 'normal' }}
        >
          หมวดหมู่กิจกรรม
        </button>
        <button
          onClick={() => setActiveTab('activityTypes')}
          style={{ fontWeight: activeTab === 'activityTypes' ? 'bold' : 'normal' }}
        >
          ประเภทกิจกรรม
        </button>
        <button
          onClick={() => setActiveTab('rewards')}
          style={{ fontWeight: activeTab === 'rewards' ? 'bold' : 'normal' }}
        >
          ของรางวัล
        </button>
      </div>

      {activeTab === 'submissions' && (
        <>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="statusFilter">สถานะ: </label>
        <select
          id="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: 6, fontSize: 14 }}
        >
          <option value="PENDING">รอตรวจสอบ (PENDING)</option>
          <option value="APPROVED">อนุมัติแล้ว (APPROVED)</option>
          <option value="REJECTED">ถูกปฏิเสธ (REJECTED)</option>
        </select>
        <button onClick={loadSubmissions} style={{ marginLeft: 8 }}>
          รีเฟรช
        </button>
      </div>

      {actionError && <p style={{ color: 'red' }}>{actionError}</p>}
      {listError && <p style={{ color: 'red' }}>{listError}</p>}
      {listLoading && <p>กำลังโหลด...</p>}

      {!listLoading && submissions.length === 0 && <p>ไม่มีรายการในสถานะนี้</p>}

      {!listLoading && submissions.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>#</th>
                <th style={{ padding: 8 }}>พนักงาน</th>
                <th style={{ padding: 8 }}>แผนก</th>
                <th style={{ padding: 8 }}>กิจกรรม</th>
                <th style={{ padding: 8 }}>คะแนน</th>
                <th style={{ padding: 8 }}>ระยะทาง</th>
                <th style={{ padding: 8 }}>เวลา</th>
                <th style={{ padding: 8 }}>รูปหลักฐาน</th>
                <th style={{ padding: 8 }}>หมายเหตุ</th>
                <th style={{ padding: 8 }}>ส่งเมื่อ</th>
                {statusFilter === 'REJECTED' && <th style={{ padding: 8 }}>เหตุผลที่ปฏิเสธ</th>}
                {statusFilter === 'PENDING' && <th style={{ padding: 8 }}>จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.submission_id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{s.submission_id}</td>
                  <td style={{ padding: 8 }}>
                    {s.full_name}
                    <br />
                    <small style={{ color: '#888' }}>{s.employee_id}</small>
                  </td>
                  <td style={{ padding: 8 }}>{s.department || '-'}</td>
                  <td style={{ padding: 8 }}>{s.activity_name}</td>
                  <td style={{ padding: 8 }}>{s.score}</td>
                  <td style={{ padding: 8 }}>{s.distance != null ? `${s.distance} กม.` : '-'}</td>
                  <td style={{ padding: 8 }}>{s.duration != null ? `${s.duration} นาที` : '-'}</td>
                  <td style={{ padding: 8 }}>
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
                  <td style={{ padding: 8 }}>{s.note || '-'}</td>
                  <td style={{ padding: 8 }}>{new Date(s.submitted_at).toLocaleString('th-TH')}</td>
                  {statusFilter === 'REJECTED' && (
                    <td style={{ padding: 8 }}>
                      {s.reject_reason_text || '-'}
                      {s.reject_reason_note && (
                        <>
                          <br />
                          <small style={{ color: '#888' }}>{s.reject_reason_note}</small>
                        </>
                      )}
                    </td>
                  )}
                  {statusFilter === 'PENDING' && (
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleApprove(s.submission_id)}
                        disabled={actioningId === s.submission_id}
                        style={{ marginRight: 6 }}
                      >
                        {actioningId === s.submission_id ? '...' : 'อนุมัติ'}
                      </button>
                      <button
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
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 8,
              padding: 24,
              width: '90%',
              maxWidth: 420,
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              ปฏิเสธ submission #{rejectModalSubmissionId}
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="rejectReasonSelect">เหตุผล</label>
              <br />
              <select
                id="rejectReasonSelect"
                value={rejectReasonId}
                onChange={(e) => setRejectReasonId(e.target.value)}
                style={{ padding: 8, fontSize: 16, width: '100%' }}
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
                <label htmlFor="rejectNote">ระบุเหตุผลเพิ่มเติม</label>
                <br />
                <textarea
                  id="rejectNote"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  rows={3}
                  style={{ padding: 8, fontSize: 16, width: '100%' }}
                />
              </div>
            )}

            {rejectError && <p style={{ color: 'red' }}>{rejectError}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={closeRejectModal} disabled={rejectSubmitting}>
                ยกเลิก
              </button>
              <button onClick={handleConfirmReject} disabled={rejectSubmitting}>
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
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="redeemStatusFilter">สถานะ: </label>
            <select
              id="redeemStatusFilter"
              value={redeemStatusFilter}
              onChange={(e) => setRedeemStatusFilter(e.target.value)}
              style={{ padding: 6, fontSize: 14 }}
            >
              <option value="PENDING">รอดำเนินการ (PENDING)</option>
              <option value="APPROVED">อนุมัติแล้ว (APPROVED)</option>
              <option value="REJECTED">ถูกปฏิเสธ (REJECTED)</option>
              <option value="CANCELLED">ยกเลิกแล้ว (CANCELLED)</option>
            </select>
            <button onClick={loadRedeems} style={{ marginLeft: 8 }}>
              รีเฟรช
            </button>
          </div>

          {redeemActionError && <p style={{ color: 'red' }}>{redeemActionError}</p>}
          {redeemListError && <p style={{ color: 'red' }}>{redeemListError}</p>}
          {redeemListLoading && <p>กำลังโหลด...</p>}

          {!redeemListLoading && redeems.length === 0 && <p>ไม่มีรายการในสถานะนี้</p>}

          {!redeemListLoading && redeems.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>#</th>
                    <th style={{ padding: 8 }}>พนักงาน</th>
                    <th style={{ padding: 8 }}>แผนก</th>
                    <th style={{ padding: 8 }}>ของรางวัล</th>
                    <th style={{ padding: 8 }}>คะแนนที่ใช้</th>
                    <th style={{ padding: 8 }}>วันที่แลก</th>
                    {redeemStatusFilter === 'PENDING' && <th style={{ padding: 8 }}>จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {redeems.map((rd) => (
                    <tr key={rd.redeem_id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 8 }}>{rd.redeem_id}</td>
                      <td style={{ padding: 8 }}>
                        {rd.full_name}
                        <br />
                        <small style={{ color: '#888' }}>{rd.employee_id}</small>
                      </td>
                      <td style={{ padding: 8 }}>{rd.department || '-'}</td>
                      <td style={{ padding: 8 }}>{rd.reward_name}</td>
                      <td style={{ padding: 8 }}>{rd.used_score}</td>
                      <td style={{ padding: 8 }}>{new Date(rd.redeem_date).toLocaleString('th-TH')}</td>
                      {redeemStatusFilter === 'PENDING' && (
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleApproveRedeem(rd.redeem_id)}
                            disabled={redeemActioningId === rd.redeem_id}
                            style={{ marginRight: 6 }}
                          >
                            {redeemActioningId === rd.redeem_id ? '...' : 'อนุมัติ (มอบของแล้ว)'}
                          </button>
                          <button
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
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 6,
              padding: 16,
              marginBottom: 16,
              maxWidth: 480,
            }}
          >
            <h3 style={{ marginTop: 0 }}>สร้าง Challenge ใหม่</h3>
            <form onSubmit={handleCreateChallenge}>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newChallengeCategory">หมวดกิจกรรมที่ใช้วัด (รวมระยะทางทุกกิจกรรมในหมวดนี้)</label>
                <br />
                <select
                  id="newChallengeCategory"
                  value={newChallengeCategoryId}
                  onChange={(e) => setNewChallengeCategoryId(e.target.value)}
                  style={{ padding: 8, fontSize: 16, width: '100%' }}
                >
                  <option value="">-- เลือกหมวดกิจกรรม --</option>
                  {challengeCategories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newChallengeName">ชื่อ Challenge</label>
                <br />
                <input
                  id="newChallengeName"
                  type="text"
                  value={newChallengeName}
                  onChange={(e) => setNewChallengeName(e.target.value)}
                  placeholder="เช่น July Run Challenge"
                  style={{ padding: 8, fontSize: 16, width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newChallengeDescription">รายละเอียด (ถ้ามี)</label>
                <br />
                <textarea
                  id="newChallengeDescription"
                  value={newChallengeDescription}
                  onChange={(e) => setNewChallengeDescription(e.target.value)}
                  rows={2}
                  style={{ padding: 8, fontSize: 16, width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="newChallengeStart">วันเริ่ม</label>
                  <br />
                  <input
                    id="newChallengeStart"
                    type="datetime-local"
                    value={newChallengeStartDate}
                    onChange={(e) => setNewChallengeStartDate(e.target.value)}
                    style={{ padding: 8, fontSize: 16, width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="newChallengeEnd">วันจบ</label>
                  <br />
                  <input
                    id="newChallengeEnd"
                    type="datetime-local"
                    value={newChallengeEndDate}
                    onChange={(e) => setNewChallengeEndDate(e.target.value)}
                    style={{ padding: 8, fontSize: 16, width: '100%' }}
                  />
                </div>
              </div>

              {createChallengeError && <p style={{ color: 'red' }}>{createChallengeError}</p>}

              <button type="submit" disabled={createChallengeSubmitting}>
                {createChallengeSubmitting ? 'กำลังสร้าง...' : 'สร้าง Challenge'}
              </button>
            </form>
          </div>

          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>รายการ Challenge ทั้งหมด</h3>
            <button onClick={loadChallenges}>รีเฟรช</button>
          </div>

          {challengeActionError && <p style={{ color: 'red' }}>{challengeActionError}</p>}
          {challengeListError && <p style={{ color: 'red' }}>{challengeListError}</p>}
          {challengeListLoading && <p>กำลังโหลด...</p>}

          {!challengeListLoading && challenges.length === 0 && <p>ยังไม่มี challenge</p>}

          {!challengeListLoading && challenges.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>#</th>
                    <th style={{ padding: 8 }}>ชื่อ Challenge</th>
                    <th style={{ padding: 8 }}>หมวดกิจกรรม</th>
                    <th style={{ padding: 8 }}>ช่วงเวลา</th>
                    <th style={{ padding: 8 }}>สถานะ</th>
                    <th style={{ padding: 8 }}>ผู้เข้าร่วม</th>
                    <th style={{ padding: 8 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((c) => (
                    <tr key={c.challenge_id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 8 }}>{c.challenge_id}</td>
                      <td style={{ padding: 8 }}>
                        {c.challenge_name}
                        {c.description && (
                          <>
                            <br />
                            <small style={{ color: '#888' }}>{c.description}</small>
                          </>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>{c.category_name}</td>
                      <td style={{ padding: 8 }}>
                        {new Date(c.start_date).toLocaleDateString('th-TH')} -{' '}
                        {new Date(c.end_date).toLocaleDateString('th-TH')}
                      </td>
                      <td style={{ padding: 8 }}>{CHALLENGE_STATUS_LABEL_TH[c.status] || c.status}</td>
                      <td style={{ padding: 8 }}>{c.participant_count}</td>
                      <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                        {['UPCOMING', 'ONGOING'].includes(c.status) ? (
                          <button
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
        </>
      )}

      {activeTab === 'badges' && (
        <>
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 6,
              padding: 16,
              marginBottom: 16,
              maxWidth: 480,
            }}
          >
            <h3 style={{ marginTop: 0 }}>สร้าง Badge ใหม่</h3>
            <form onSubmit={handleCreateBadge}>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newBadgeName">ชื่อ Badge</label>
                <br />
                <input
                  id="newBadgeName"
                  type="text"
                  value={badgeForm.badgeName}
                  onChange={(e) => setBadgeForm((prev) => ({ ...prev, badgeName: e.target.value }))}
                  placeholder="เช่น วิ่งติดกัน 3 วัน"
                  style={{ padding: 8, fontSize: 16, width: '100%' }}
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
                  style={{ padding: 8, fontSize: 16, width: '100%' }}
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
                    style={{ padding: 8, fontSize: 16, width: '100%' }}
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
                    style={{ padding: 8, fontSize: 16, width: '100%' }}
                  />
                </div>
              </div>

              {badgeFormError && <p style={{ color: 'red' }}>{badgeFormError}</p>}

              <button type="submit" disabled={badgeFormSubmitting}>
                {badgeFormSubmitting ? 'กำลังสร้าง...' : 'สร้าง Badge'}
              </button>
            </form>
          </div>

          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>รายการ Badge ทั้งหมด</h3>
            <button onClick={loadBadges}>รีเฟรช</button>
          </div>

          {badgeListError && <p style={{ color: 'red' }}>{badgeListError}</p>}
          {badgeListLoading && <p>กำลังโหลด...</p>}

          {!badgeListLoading && badges.length === 0 && <p>ยังไม่มี badge</p>}

          {!badgeListLoading && badges.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>#</th>
                    <th style={{ padding: 8 }}>ไอคอน</th>
                    <th style={{ padding: 8 }}>ชื่อ Badge</th>
                    <th style={{ padding: 8 }}>เงื่อนไข</th>
                    <th style={{ padding: 8 }}>สถานะ</th>
                    <th style={{ padding: 8 }}>ได้รับแล้ว</th>
                    <th style={{ padding: 8 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {badges.map((b) => {
                    const isEditing = editingBadgeId === b.badge_id;
                    const isActioning = badgeActioningId === b.badge_id;

                    if (isEditing) {
                      return (
                        <tr key={b.badge_id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: 8 }}>{b.badge_id}</td>
                          <td style={{ padding: 8 }}>
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
                          <td style={{ padding: 8 }}>
                            <input
                              type="text"
                              value={editBadgeForm.badgeName}
                              onChange={(e) =>
                                setEditBadgeForm((prev) => ({ ...prev, badgeName: e.target.value }))
                              }
                              style={{ padding: 6, width: '100%', marginBottom: 6 }}
                            />
                            <textarea
                              value={editBadgeForm.description}
                              onChange={(e) =>
                                setEditBadgeForm((prev) => ({ ...prev, description: e.target.value }))
                              }
                              rows={2}
                              style={{ padding: 6, width: '100%' }}
                              placeholder="คำอธิบาย"
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <select
                              value={editBadgeForm.conditionType}
                              onChange={(e) =>
                                setEditBadgeForm((prev) => ({ ...prev, conditionType: e.target.value }))
                              }
                              style={{ padding: 6, width: '100%', marginBottom: 6 }}
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
                              style={{ padding: 6, width: '100%' }}
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <select
                              value={editBadgeForm.status}
                              onChange={(e) =>
                                setEditBadgeForm((prev) => ({ ...prev, status: e.target.value }))
                              }
                              style={{ padding: 6 }}
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          </td>
                          <td style={{ padding: 8 }}>{b.earned_count} คน</td>
                          <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                            {editBadgeError && (
                              <p style={{ color: 'red', margin: '0 0 6px' }}>{editBadgeError}</p>
                            )}
                            <button onClick={() => handleSaveBadge(b.badge_id)} disabled={isActioning}>
                              {isActioning ? '...' : 'บันทึก'}
                            </button>{' '}
                            <button onClick={cancelEditBadge} disabled={isActioning}>
                              ยกเลิก
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={b.badge_id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: 8 }}>{b.badge_id}</td>
                        <td style={{ padding: 8 }}>
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
                        <td style={{ padding: 8 }}>
                          {b.badge_name}
                          {b.description && (
                            <>
                              <br />
                              <small style={{ color: '#888' }}>{b.description}</small>
                            </>
                          )}
                        </td>
                        <td style={{ padding: 8 }}>
                          {BADGE_CONDITION_LABEL_TH[b.condition_type] || b.condition_type} ≥ {b.condition_value}
                        </td>
                        <td style={{ padding: 8 }}>{b.status}</td>
                        <td style={{ padding: 8 }}>{b.earned_count} คน</td>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                          <button onClick={() => startEditBadge(b)} disabled={isActioning}>
                            แก้ไข
                          </button>{' '}
                          <button onClick={() => handleToggleBadgeStatus(b)} disabled={isActioning}>
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
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 6,
              padding: 16,
              marginBottom: 16,
              maxWidth: 480,
            }}
          >
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
                  style={{ padding: 8, fontSize: 16, width: '100%' }}
                />
              </div>

              {categoryFormError && <p style={{ color: 'red' }}>{categoryFormError}</p>}

              <button type="submit" disabled={categoryFormSubmitting}>
                {categoryFormSubmitting ? 'กำลังสร้าง...' : 'สร้างหมวดหมู่'}
              </button>
            </form>
          </div>

          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>รายการหมวดหมู่กิจกรรมทั้งหมด</h3>
            <button onClick={loadCategories}>รีเฟรช</button>
          </div>

          {categoryListError && <p style={{ color: 'red' }}>{categoryListError}</p>}
          {categoryListLoading && <p>กำลังโหลด...</p>}
          {!categoryListLoading && categories.length === 0 && <p>ยังไม่มีหมวดหมู่</p>}

          {!categoryListLoading && categories.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>#</th>
                    <th style={{ padding: 8 }}>ชื่อหมวดหมู่</th>
                    <th style={{ padding: 8 }}>สถานะ</th>
                    <th style={{ padding: 8 }}>จำนวนประเภทกิจกรรมย่อย</th>
                    <th style={{ padding: 8 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => {
                    const isEditing = editingCategoryId === cat.category_id;
                    const isActioning = categoryActioningId === cat.category_id;

                    if (isEditing) {
                      return (
                        <tr key={cat.category_id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: 8 }}>{cat.category_id}</td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="text"
                              value={editCategoryForm.categoryName}
                              onChange={(e) =>
                                setEditCategoryForm((prev) => ({ ...prev, categoryName: e.target.value }))
                              }
                              style={{ padding: 6, width: '100%' }}
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <select
                              value={editCategoryForm.status}
                              onChange={(e) =>
                                setEditCategoryForm((prev) => ({ ...prev, status: e.target.value }))
                              }
                              style={{ padding: 6 }}
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          </td>
                          <td style={{ padding: 8 }}>{cat.activity_type_count}</td>
                          <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                            {editCategoryError && (
                              <p style={{ color: 'red', margin: '0 0 6px' }}>{editCategoryError}</p>
                            )}
                            <button onClick={() => handleSaveCategory(cat.category_id)} disabled={isActioning}>
                              {isActioning ? '...' : 'บันทึก'}
                            </button>{' '}
                            <button onClick={cancelEditCategory} disabled={isActioning}>
                              ยกเลิก
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={cat.category_id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: 8 }}>{cat.category_id}</td>
                        <td style={{ padding: 8 }}>{cat.category_name}</td>
                        <td style={{ padding: 8 }}>{cat.status}</td>
                        <td style={{ padding: 8 }}>{cat.activity_type_count}</td>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                          <button onClick={() => startEditCategory(cat)} disabled={isActioning}>
                            แก้ไข
                          </button>{' '}
                          <button onClick={() => handleToggleCategoryStatus(cat)} disabled={isActioning}>
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
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 6,
              padding: 16,
              marginBottom: 16,
              maxWidth: 480,
            }}
          >
            <h3 style={{ marginTop: 0 }}>สร้างประเภทกิจกรรมใหม่</h3>
            <form onSubmit={handleCreateActivityType}>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="newActivityCategory">หมวดหมู่</label>
                <br />
                <select
                  id="newActivityCategory"
                  value={activityTypeForm.categoryId}
                  onChange={(e) => setActivityTypeForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                  style={{ padding: 8, fontSize: 16, width: '100%' }}
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
                  style={{ padding: 8, fontSize: 16, width: '100%' }}
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
                    style={{ padding: 8, fontSize: 16, width: '100%' }}
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
                  style={{ padding: 8, fontSize: 16, width: '100%' }}
                />
              </div>

              {activityTypeFormError && <p style={{ color: 'red' }}>{activityTypeFormError}</p>}

              <button type="submit" disabled={activityTypeFormSubmitting}>
                {activityTypeFormSubmitting ? 'กำลังสร้าง...' : 'สร้างประเภทกิจกรรม'}
              </button>
            </form>
          </div>

          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>รายการประเภทกิจกรรมทั้งหมด</h3>
            <button onClick={loadActivityTypes}>รีเฟรช</button>
          </div>

          {activityTypeListError && <p style={{ color: 'red' }}>{activityTypeListError}</p>}
          {activityTypeListLoading && <p>กำลังโหลด...</p>}
          {!activityTypeListLoading && activityTypes.length === 0 && <p>ยังไม่มีประเภทกิจกรรม</p>}

          {!activityTypeListLoading && activityTypes.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>#</th>
                    <th style={{ padding: 8 }}>หมวดหมู่</th>
                    <th style={{ padding: 8 }}>ชื่อกิจกรรม</th>
                    <th style={{ padding: 8 }}>คะแนน</th>
                    <th style={{ padding: 8 }}>บังคับรูป</th>
                    <th style={{ padding: 8 }}>สถานะ</th>
                    <th style={{ padding: 8 }}>เคยส่งแล้ว</th>
                    <th style={{ padding: 8 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {activityTypes.map((a) => {
                    const isEditing = editingActivityTypeId === a.activity_id;
                    const isActioning = activityTypeActioningId === a.activity_id;

                    if (isEditing) {
                      return (
                        <tr key={a.activity_id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: 8 }}>{a.activity_id}</td>
                          <td style={{ padding: 8 }}>
                            <select
                              value={editActivityTypeForm.categoryId}
                              onChange={(e) =>
                                setEditActivityTypeForm((prev) => ({ ...prev, categoryId: e.target.value }))
                              }
                              style={{ padding: 6, width: '100%' }}
                            >
                              {categories.map((c) => (
                                <option key={c.category_id} value={c.category_id}>
                                  {c.category_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="text"
                              value={editActivityTypeForm.activityName}
                              onChange={(e) =>
                                setEditActivityTypeForm((prev) => ({ ...prev, activityName: e.target.value }))
                              }
                              style={{ padding: 6, width: '100%' }}
                            />
                            <textarea
                              value={editActivityTypeForm.description}
                              onChange={(e) =>
                                setEditActivityTypeForm((prev) => ({ ...prev, description: e.target.value }))
                              }
                              rows={2}
                              style={{ padding: 6, width: '100%', marginTop: 6 }}
                              placeholder="รายละเอียด"
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={editActivityTypeForm.score}
                              onChange={(e) =>
                                setEditActivityTypeForm((prev) => ({ ...prev, score: e.target.value }))
                              }
                              style={{ padding: 6, width: 70 }}
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="checkbox"
                              checked={editActivityTypeForm.requireImage}
                              onChange={(e) =>
                                setEditActivityTypeForm((prev) => ({ ...prev, requireImage: e.target.checked }))
                              }
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <select
                              value={editActivityTypeForm.status}
                              onChange={(e) =>
                                setEditActivityTypeForm((prev) => ({ ...prev, status: e.target.value }))
                              }
                              style={{ padding: 6 }}
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          </td>
                          <td style={{ padding: 8 }}>{a.submission_count}</td>
                          <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                            {editActivityTypeError && (
                              <p style={{ color: 'red', margin: '0 0 6px' }}>{editActivityTypeError}</p>
                            )}
                            <button
                              onClick={() => handleSaveActivityType(a.activity_id)}
                              disabled={isActioning}
                            >
                              {isActioning ? '...' : 'บันทึก'}
                            </button>{' '}
                            <button onClick={cancelEditActivityType} disabled={isActioning}>
                              ยกเลิก
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={a.activity_id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: 8 }}>{a.activity_id}</td>
                        <td style={{ padding: 8 }}>{a.category_name}</td>
                        <td style={{ padding: 8 }}>
                          {a.activity_name}
                          {a.description && (
                            <>
                              <br />
                              <small style={{ color: '#888' }}>{a.description}</small>
                            </>
                          )}
                        </td>
                        <td style={{ padding: 8 }}>{a.score}</td>
                        <td style={{ padding: 8 }}>{a.require_image ? 'ต้องแนบ' : 'ไม่บังคับ'}</td>
                        <td style={{ padding: 8 }}>{a.status}</td>
                        <td style={{ padding: 8 }}>{a.submission_count}</td>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                          <button onClick={() => startEditActivityType(a)} disabled={isActioning}>
                            แก้ไข
                          </button>{' '}
                          <button onClick={() => handleToggleActivityTypeStatus(a)} disabled={isActioning}>
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
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 6,
              padding: 16,
              marginBottom: 16,
              maxWidth: 480,
            }}
          >
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
                  style={{ padding: 8, fontSize: 16, width: '100%' }}
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
                    style={{ padding: 8, fontSize: 16, width: '100%' }}
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
                    style={{ padding: 8, fontSize: 16, width: '100%' }}
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
                  style={{ padding: 8, fontSize: 16, width: '100%' }}
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

              {rewardFormError && <p style={{ color: 'red' }}>{rewardFormError}</p>}

              <button type="submit" disabled={rewardFormSubmitting}>
                {rewardFormSubmitting ? 'กำลังสร้าง...' : 'สร้างของรางวัล'}
              </button>
            </form>
          </div>

          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>รายการของรางวัลทั้งหมด</h3>
            <button onClick={loadRewards}>รีเฟรช</button>
          </div>

          {rewardListError && <p style={{ color: 'red' }}>{rewardListError}</p>}
          {rewardListLoading && <p>กำลังโหลด...</p>}
          {!rewardListLoading && rewards.length === 0 && <p>ยังไม่มีของรางวัล</p>}

          {!rewardListLoading && rewards.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>#</th>
                    <th style={{ padding: 8 }}>รูป</th>
                    <th style={{ padding: 8 }}>ชื่อของรางวัล</th>
                    <th style={{ padding: 8 }}>คะแนนที่ใช้แลก</th>
                    <th style={{ padding: 8 }}>คงเหลือ</th>
                    <th style={{ padding: 8 }}>สถานะ</th>
                    <th style={{ padding: 8 }}>เคยแลกแล้ว</th>
                    <th style={{ padding: 8 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map((r) => {
                    const isEditing = editingRewardId === r.reward_id;
                    const isActioning = rewardActioningId === r.reward_id;

                    if (isEditing) {
                      return (
                        <tr key={r.reward_id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: 8 }}>{r.reward_id}</td>
                          <td style={{ padding: 8 }}>
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
                          <td style={{ padding: 8 }}>
                            <input
                              type="text"
                              value={editRewardForm.rewardName}
                              onChange={(e) =>
                                setEditRewardForm((prev) => ({ ...prev, rewardName: e.target.value }))
                              }
                              style={{ padding: 6, width: '100%', marginBottom: 6 }}
                            />
                            <textarea
                              value={editRewardForm.description}
                              onChange={(e) =>
                                setEditRewardForm((prev) => ({ ...prev, description: e.target.value }))
                              }
                              rows={2}
                              style={{ padding: 6, width: '100%' }}
                              placeholder="รายละเอียด"
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={editRewardForm.requiredScore}
                              onChange={(e) =>
                                setEditRewardForm((prev) => ({ ...prev, requiredScore: e.target.value }))
                              }
                              style={{ padding: 6, width: 80 }}
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={editRewardForm.stock}
                              onChange={(e) =>
                                setEditRewardForm((prev) => ({ ...prev, stock: e.target.value }))
                              }
                              style={{ padding: 6, width: 70 }}
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <select
                              value={editRewardForm.status}
                              onChange={(e) =>
                                setEditRewardForm((prev) => ({ ...prev, status: e.target.value }))
                              }
                              style={{ padding: 6 }}
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          </td>
                          <td style={{ padding: 8 }}>{r.redeem_count}</td>
                          <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                            {editRewardError && (
                              <p style={{ color: 'red', margin: '0 0 6px' }}>{editRewardError}</p>
                            )}
                            <button onClick={() => handleSaveReward(r.reward_id)} disabled={isActioning}>
                              {isActioning ? '...' : 'บันทึก'}
                            </button>{' '}
                            <button onClick={cancelEditReward} disabled={isActioning}>
                              ยกเลิก
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={r.reward_id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: 8 }}>{r.reward_id}</td>
                        <td style={{ padding: 8 }}>
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
                        <td style={{ padding: 8 }}>
                          {r.reward_name}
                          {r.description && (
                            <>
                              <br />
                              <small style={{ color: '#888' }}>{r.description}</small>
                            </>
                          )}
                        </td>
                        <td style={{ padding: 8 }}>{r.required_score}</td>
                        <td style={{ padding: 8 }}>{r.stock}</td>
                        <td style={{ padding: 8 }}>{r.status}</td>
                        <td style={{ padding: 8 }}>{r.redeem_count}</td>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                          <button onClick={() => startEditReward(r)} disabled={isActioning}>
                            แก้ไข
                          </button>{' '}
                          <button onClick={() => handleToggleRewardStatus(r)} disabled={isActioning}>
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
    </div>
  );
}