import { useState } from 'react';
import useApiData from '../../hooks/useApiData';
import BadgesSection from '../BadgesSection.jsx';
import SubmitActivitySection from '../SubmitActivitySection.jsx';
import SubmissionHistorySection from '../SubmissionHistorySection.jsx';
import RewardsSection from '../RewardsSection.jsx';
import ChallengesSection from '../ChallengesSection.jsx';
import NewBadgePopup from '../NewBadgePopup.jsx';
import LeaderboardModal from '../LeaderboardModal.jsx';
import HealthAssessmentWizard from '../HealthAssessmentWizard.jsx';
import useSubmitActivity from './useSubmitActivity';
import useRewards from './useRewards';
import useChallenges from './useChallenges';
import useBadgePopup from './useBadgePopup';

// แท็บหน้าพนักงาน — สลับกันแสดงทีละหน้าแทนการยาวสกอลรวด (เป็นแถบเมนูล่างจอ)
const TABS = [
  { key: 'submit', label: 'ส่งกิจกรรม', icon: <path d="M12 5v14M5 12h14" /> },
  { key: 'challenges', label: 'ชาเลนจ์', icon: <path d="M5 21V4h11l-2 4 2 4H5" /> },
  {
    key: 'rewards',
    label: 'ของรางวัล',
    icon: (
      <>
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M12 8v13M5 12v9h14v-9M12 8C10 4 6 4 6 6.5S9 8 12 8Zm0 0c2-4 6-4 6-1.5S15 8 12 8Z" />
      </>
    ),
  },
  {
    key: 'badges',
    label: 'เหรียญตรา',
    icon: (
      <>
        <circle cx="12" cy="15" r="6" />
        <path d="M8.5 10.2 6 3h4l2 5 2-5h4l-2.5 7.2" />
      </>
    ),
  },
];

// ปีบนเบอร์วิ่ง เป็น พ.ศ.
const BIB_YEAR = new Date().getFullYear() + 543;

// หน้าหลักของพนักงานหลังล็อกอิน + ทำ baseline แล้ว — ข้อมูลทุกแท็บโหลดครั้งเดียวตอนเข้าหน้านี้
// และเก็บไว้ตลอด (สลับแท็บแล้วสิ่งที่พิมพ์ค้างไว้ยังอยู่)
export default function EmployeeHome({ api, authToken, user }) {
  const [activeTab, setActiveTab] = useState('submit');
  const submit = useSubmitActivity(api);
  const rewards = useRewards(api);
  const challenges = useChallenges(api);
  const badgePopup = useBadgePopup(api, user?.employeeId);

  // รอบแบบประเมินติดตามผลที่เปิดอยู่และยังไม่เคยตอบ — ไม่ block การใช้งาน แค่โชว์เป็น banner เตือน
  const pendingCampaignData = useApiData(api, '/api/health-assessment/pending-campaign');
  const pendingCampaign = pendingCampaignData.data?.campaign || null; // { campaignId, campaignName, includedFields }
  const [showFollowupWizard, setShowFollowupWizard] = useState(false);

  function handleFollowupComplete() {
    setShowFollowupWizard(false);
    pendingCampaignData.setData(null);
  }

  if (showFollowupWizard && pendingCampaign) {
    return (
      <HealthAssessmentWizard
        apiBase={api.apiBase}
        authToken={authToken}
        assessmentType="FOLLOWUP"
        campaignId={pendingCampaign.campaignId}
        includedFields={pendingCampaign.includedFields}
        onComplete={handleFollowupComplete}
      />
    );
  }

  return (
    <>
      <div className="ws-app ws-shell">
        {/* เบอร์วิ่ง — ตัวเลขใหญ่คือคะแนนคงเหลือ */}
        <header className="ws-bib">
          <div className="ws-bib-band">
            <span>WELLNESS RUNNING</span>
            <span>{BIB_YEAR}</span>
          </div>
          <div className="ws-bib-body">
            <div className="ws-bib-number">{Number(rewards.scoreBalance || 0).toLocaleString('th-TH')}</div>
            <div className="ws-bib-unit">คะแนนคงเหลือ</div>
          </div>
          <div className="ws-bib-foot">
            <span className="ws-bib-name">{user?.displayName}</span>
            {user?.employeeId && <span className="ws-bib-id">{user.employeeId}</span>}
          </div>
        </header>

        {pendingCampaign && (
          <div className="ws-callout">
            <span>
              <strong>มีแบบประเมินติดตามผลรอกรอก</strong>
              {pendingCampaign.campaignName}
            </span>
            <button className="ws-btn ws-btn-volt ws-btn-sm" onClick={() => setShowFollowupWizard(true)}>
              กรอกเลย
            </button>
          </div>
        )}

        {activeTab === 'badges' && <BadgesSection badges={badgePopup.badges} apiBase={api.apiBase} />}

        {activeTab === 'submit' && (
          <>
            <SubmitActivitySection {...submit.formProps} />
            <SubmissionHistorySection mySubmissions={submit.mySubmissions} apiBase={api.apiBase} />
          </>
        )}

        {activeTab === 'rewards' && <RewardsSection {...rewards.sectionProps} apiBase={api.apiBase} />}

        {activeTab === 'challenges' && <ChallengesSection {...challenges.sectionProps} />}

        <nav className="ws-bottomnav" aria-label="เมนูหลัก">
          <div className="ws-bottomnav-inner">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`ws-bottomnav-item ${activeTab === tab.key ? 'active' : ''}`}
                aria-current={activeTab === tab.key ? 'page' : undefined}
                onClick={() => setActiveTab(tab.key)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">{tab.icon}</svg>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <NewBadgePopup badges={badgePopup.newBadges} apiBase={api.apiBase} onClose={badgePopup.closePopup} />

      <LeaderboardModal {...challenges.leaderboardProps} />
    </>
  );
}
