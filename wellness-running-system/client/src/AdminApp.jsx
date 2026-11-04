import { useEffect, useMemo, useState } from 'react';
import { createApiClient } from './lib/apiClient';
import AdminReportSection from './components/AdminReportSection';
import AdminAuditLogSection from './components/AdminAuditLogSection';
import AdminLogin from './components/admin/AdminLogin';
import DashboardTab from './components/admin/DashboardTab';
import SubmissionsTab from './components/admin/SubmissionsTab';
import RedeemsTab from './components/admin/RedeemsTab';
import ChallengesTab from './components/admin/ChallengesTab';
import RewardsTab from './components/admin/RewardsTab';
import BadgesTab from './components/admin/BadgesTab';
import CategoriesTab from './components/admin/CategoriesTab';
import ActivityTypesTab from './components/admin/ActivityTypesTab';
import CampaignsTab from './components/admin/CampaignsTab';
import EmployeesTab from './components/admin/EmployeesTab';
import AdminsTab from './components/admin/AdminsTab';

// แท็บหลักแถวบน (ปุ่ม "ตั้งค่า" ต่อท้าย)
const MAIN_TABS = [
  { key: 'dashboard', label: 'แดชบอร์ด' },
  { key: 'submissions', label: 'ตรวจสอบกิจกรรม' },
  { key: 'redeems', label: 'คำขอแลกของรางวัล' },
  { key: 'reports', label: 'รายงาน' },
];

// เมนูย่อยที่ถูกจัดกลุ่มไว้ใต้แท็บ "ตั้งค่า"
const SETTINGS_TABS = [
  { key: 'challenges', label: 'ชาเลนจ์' },
  { key: 'rewards', label: 'ของรางวัล' },
  { key: 'badges', label: 'เหรียญตรา' },
  { key: 'categories', label: 'หมวดหมู่กิจกรรม' },
  { key: 'activityTypes', label: 'ประเภทกิจกรรม' },
  { key: 'healthCampaigns', label: 'แบบสอบถามติดตามผล' },
  { key: 'healthResults', label: 'ข้อมูลพนักงาน' },
  { key: 'admins', label: 'จัดการสิทธิ์แอดมิน' },
  { key: 'auditLog', label: 'ประวัติการใช้งาน' },
];

const isSettingsTab = (key) => SETTINGS_TABS.some((t) => t.key === key);

function TabButton({ active, onClick, children }) {
  return (
    <button className={`ws-tab ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

// ทุกแท็บถูก mount ค้างไว้แล้วซ่อนด้วย hidden — สลับแท็บไปมาแล้วสิ่งที่พิมพ์ค้าง/ตัวกรอง/แถวที่กำลังแก้ยังอยู่
function TabPanel({ active, children }) {
  return <div hidden={!active}>{children}</div>;
}

export default function AdminApp() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminId, setAdminId] = useState(null);
  const [loginEmployeeId, setLoginEmployeeId] = useState('');
  // token สำหรับ header Authorization (cross-site cookie มักถูกเบราว์เซอร์บล็อก) — เก็บใน sessionStorage กันหายตอน refresh
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('adminToken') || null);
  const api = useMemo(() => createApiClient(adminToken), [adminToken]);

  const [activeTab, setActiveTab] = useState('dashboard');
  // เพิ่มทุกครั้งที่เปลี่ยนแท็บ → แท็บที่เพิ่งเปิดได้ refreshKey ใหม่และโหลดข้อมูลล่าสุด (แท็บที่ซ่อนอยู่ได้ null = ไม่โหลด)
  const [tabVisit, setTabVisit] = useState(0);
  // จำแท็บย่อยล่าสุดที่เปิดไว้ในกลุ่ม "ตั้งค่า" เผื่อกดกลับเข้าไปใหม่ให้ไปหน้าเดิม
  const [lastSettingsTab, setLastSettingsTab] = useState(SETTINGS_TABS[0].key);

  // state ที่แท็บอื่น (แดชบอร์ด / เมนูย่อย) สั่งเปลี่ยนได้ จึงเก็บไว้ที่นี่
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('PENDING');
  const [redeemStatusFilter, setRedeemStatusFilter] = useState('PENDING');
  const [participantsChallenge, setParticipantsChallenge] = useState(null); // { challengeId, challengeName } | null
  const [editingEmployeeId, setEditingEmployeeId] = useState(null); // null = รายชื่อ, '' = เพิ่มใหม่, รหัส = แก้ไข
  const [auditPresetEmployeeId, setAuditPresetEmployeeId] = useState(''); // เปิดประวัติการใช้งานแบบกรองพนักงานคนเดียว

  function saveAdminToken(token) {
    setAdminToken(token);
    if (token) {
      sessionStorage.setItem('adminToken', token);
    } else {
      sessionStorage.removeItem('adminToken');
    }
  }

  // เช็คว่ามี admin session ที่ยัง valid อยู่ไหมตอนโหลดหน้า กันต้อง login ใหม่ทุกครั้งที่ refresh
  useEffect(() => {
    let ignore = false;
    createApiClient(sessionStorage.getItem('adminToken'))
      .request('/api/admin/me')
      .then(
        (data) => {
          if (ignore) return;
          setAdminId(data.employeeId);
          setIsLoggedIn(true);
        },
        () => {} // ยังไม่ล็อกอิน / session หมดอายุ → แสดงหน้าเข้าสู่ระบบ
      )
      .finally(() => {
        if (!ignore) setAuthChecked(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  function handleLoggedIn(data) {
    setAdminId(data.employeeId);
    setIsLoggedIn(true);
    saveAdminToken(data.token);
  }

  async function handleLogout() {
    try {
      await api.request('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      console.error('logout error:', err);
    } finally {
      setIsLoggedIn(false);
      setAdminId(null);
      saveAdminToken(null);
    }
  }

  function goToTab(key) {
    if (key === activeTab) return;
    setActiveTab(key);
    setTabVisit((n) => n + 1);
  }

  function openSettingsGroup() {
    goToTab(lastSettingsTab);
    setAuditPresetEmployeeId('');
  }

  function openSettingsTab(key) {
    goToTab(key);
    setLastSettingsTab(key);
    setAuditPresetEmployeeId('');
    setEditingEmployeeId(null);
  }

  function openEmployeeHistory(employeeId) {
    setEditingEmployeeId(null);
    setAuditPresetEmployeeId(employeeId);
    goToTab('auditLog');
    setLastSettingsTab('auditLog');
  }

  // refreshKey ของแต่ละแท็บ: null ตอนซ่อนอยู่, เลขรอบการเปิดแท็บตอนแสดงอยู่
  const tabProps = (key) => ({ api, refreshKey: activeTab === key ? tabVisit : null });

  if (!authChecked) {
    return (
      <div className="ws-app ws-gate">
        <div>
          <div className="ws-track" aria-hidden="true" />
          <p className="ws-splash-text" role="status">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AdminLogin employeeId={loginEmployeeId} onEmployeeIdChange={setLoginEmployeeId} onLoggedIn={handleLoggedIn} />;
  }

  return (
    <div className="ws-app">
      <header className="ws-topbar">
        <div className="ws-topbar-inner">
          <div className="ws-topbar-brand">
            <span className="ws-wordmark">WELLNESS RUNNING</span>
            <h2 className="ws-topbar-title">แดชบอร์ดแอดมิน</h2>
          </div>
          <div className="ws-topbar-user">
            <span>เข้าสู่ระบบเป็น <strong>{adminId}</strong></span>
            <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={handleLogout}>ออกจากระบบ</button>
          </div>
        </div>
      </header>

      <main className="ws-admin-main">
        <div className="ws-tabs">
          {MAIN_TABS.map((t) => (
            <TabButton key={t.key} active={activeTab === t.key} onClick={() => goToTab(t.key)}>
              {t.label}
            </TabButton>
          ))}
          <TabButton active={isSettingsTab(activeTab)} onClick={openSettingsGroup}>
            ตั้งค่า
          </TabButton>
        </div>

        {isSettingsTab(activeTab) && (
          <div className="ws-tabs" style={{ marginTop: -8 }}>
            {SETTINGS_TABS.map((t) => (
              <TabButton key={t.key} active={activeTab === t.key} onClick={() => openSettingsTab(t.key)}>
                {t.label}
              </TabButton>
            ))}
          </div>
        )}

        {activeTab === 'reports' && <AdminReportSection apiBase={api.apiBase} fetchOptions={api.fetchOptions} />}

        {activeTab === 'auditLog' && (
          <AdminAuditLogSection
            key={auditPresetEmployeeId || 'all'}
            apiBase={api.apiBase}
            fetchOptions={api.fetchOptions}
            initialEmployeeId={auditPresetEmployeeId}
          />
        )}

        <TabPanel active={activeTab === 'dashboard'}>
          <DashboardTab
            {...tabProps('dashboard')}
            onOpenPendingSubmissions={() => {
              setSubmissionStatusFilter('PENDING');
              goToTab('submissions');
            }}
            onOpenPendingRedeems={() => {
              setRedeemStatusFilter('PENDING');
              goToTab('redeems');
            }}
            onOpenChallenge={(c) => {
              goToTab('challenges');
              setParticipantsChallenge({ challengeId: c.challenge_id, challengeName: c.challenge_name });
            }}
          />
        </TabPanel>

        <TabPanel active={activeTab === 'submissions'}>
          {/* โหลดตั้งแต่ล็อกอินและเมื่อเปลี่ยนตัวกรอง ไม่ผูกกับการเปิดแท็บ (เหมือนเดิม) */}
          <SubmissionsTab api={api} statusFilter={submissionStatusFilter} onStatusFilterChange={setSubmissionStatusFilter} />
        </TabPanel>

        <TabPanel active={activeTab === 'redeems'}>
          <RedeemsTab {...tabProps('redeems')} statusFilter={redeemStatusFilter} onStatusFilterChange={setRedeemStatusFilter} />
        </TabPanel>

        <TabPanel active={activeTab === 'challenges'}>
          <ChallengesTab
            {...tabProps('challenges')}
            participantsChallenge={participantsChallenge}
            onOpenParticipants={(c) => setParticipantsChallenge({ challengeId: c.challenge_id, challengeName: c.challenge_name })}
            onCloseParticipants={() => setParticipantsChallenge(null)}
          />
        </TabPanel>

        <TabPanel active={activeTab === 'badges'}>
          <BadgesTab {...tabProps('badges')} />
        </TabPanel>

        <TabPanel active={activeTab === 'categories'}>
          <CategoriesTab {...tabProps('categories')} />
        </TabPanel>

        <TabPanel active={activeTab === 'activityTypes'}>
          <ActivityTypesTab {...tabProps('activityTypes')} />
        </TabPanel>

        <TabPanel active={activeTab === 'rewards'}>
          <RewardsTab {...tabProps('rewards')} />
        </TabPanel>

        <TabPanel active={activeTab === 'healthCampaigns'}>
          <CampaignsTab {...tabProps('healthCampaigns')} />
        </TabPanel>

        <TabPanel active={activeTab === 'healthResults'}>
          <EmployeesTab
            {...tabProps('healthResults')}
            adminId={adminId}
            editingEmployeeId={editingEmployeeId}
            onEditEmployee={setEditingEmployeeId}
            onOpenHistory={openEmployeeHistory}
          />
        </TabPanel>

        <TabPanel active={activeTab === 'admins'}>
          <AdminsTab {...tabProps('admins')} adminId={adminId} />
        </TabPanel>
      </main>
    </div>
  );
}
