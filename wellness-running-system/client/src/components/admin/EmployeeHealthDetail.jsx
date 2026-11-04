import { useState } from 'react';
import useApiData from '../../hooks/useApiData';
import { ErrorAlert } from './AdminUi';

// ---- Employee Health Detail (Admin) — detail panel ----
// แท็บของ detail panel ตรงกับ step ของ HealthAssessmentWizard.jsx (ดู STEP_FIELD_KEYS) — ยกเว้น
// step 'consent' (ไม่มีอะไรให้แสดง) และไม่มีแท็บคะแนนแยก (คะแนนคงเหลือย้ายไปอยู่ header การ์ดพนักงานแล้ว)
// source 'employee': ฟิลด์นี้เก็บที่ตาราง employee ไม่ใช่ health_assessment (jobPosition/yearsOfService/shiftType
// ถูก sync มาจาก Pulse ตอน onboarding ดู POST /api/health-assessments ใน server.js)
// weightKg/heightCm/bmi/metMinutesPerWeek ไม่อยู่ในแท็บไหนเพราะแสดงเป็นการ์ดสรุป 4 อันด้านบนแล้ว (ไม่ซ้ำ)
const HEALTH_DETAIL_TABS = [
  {
    key: 'general',
    title: 'ทั่วไป',
    source: 'employee',
    fields: [
      { key: 'job_position', label: 'ตำแหน่ง/สายงาน' },
      { key: 'service_months', label: 'อายุงาน' }, // คำนวณสดจากที่ตอบไว้ + เวลาที่ผ่านไป (server)
      { key: 'shift_type', label: 'ลักษณะเวร' },
    ],
  },
  {
    key: 'anthro',
    title: 'สุขภาพพื้นฐาน',
    source: 'assessment',
    trend: 'weight',
    fields: [
      { key: 'age', label: 'อายุ', source: 'employee' },
      { key: 'waist_cm', label: 'รอบเอว' },
      { key: 'bp_systolic', label: 'ความดันโลหิต (ค่าบน)' },
      { key: 'bp_diastolic', label: 'ความดันโลหิต (ค่าล่าง)' },
    ],
  },
  {
    key: 'history',
    title: 'ประวัติ/ปัจจัยเสี่ยง',
    source: 'assessment',
    fields: [
      { key: 'chronic_disease', label: 'โรคประจำตัว' },
      { key: 'chronic_disease_other', label: 'โรคประจำตัวอื่นๆ' },
      { key: 'smoking_status', label: 'การสูบบุหรี่' },
      { key: 'alcohol_status', label: 'การดื่มแอลกอฮอล์' },
      { key: 'physical_limitation', label: 'ข้อจำกัดทางร่างกาย' },
      { key: 'physical_limitation_note', label: 'รายละเอียดข้อจำกัด' },
    ],
  },
  {
    key: 'ipaq',
    title: 'พฤติกรรมออกกำลังกาย',
    source: 'assessment',
    trend: 'met',
    fields: [
      { key: 'vigorous_days', label: 'ออกกำลังกายหนัก (วัน/สัปดาห์)' },
      { key: 'vigorous_minutes', label: 'ออกกำลังกายหนัก (นาที/ครั้ง)' },
      { key: 'moderate_days', label: 'ออกกำลังกายปานกลาง (วัน/สัปดาห์)' },
      { key: 'moderate_minutes', label: 'ออกกำลังกายปานกลาง (นาที/ครั้ง)' },
      { key: 'walking_days', label: 'การเดิน (วัน/สัปดาห์)' },
      { key: 'walking_minutes', label: 'การเดิน (นาที/ครั้ง)' },
      { key: 'exercise_pattern', label: 'รูปแบบการออกกำลังกาย' },
      { key: 'exercise_barrier', label: 'อุปสรรคในการออกกำลังกาย' },
    ],
  },
  {
    key: 'diet',
    title: 'พฤติกรรมกิน',
    source: 'assessment',
    fields: [
      { key: 'meals_per_day', label: 'จำนวนมื้อต่อวัน' },
      { key: 'fried_food_freq', label: 'ความถี่อาหารทอด/มัน' },
      { key: 'sweet_food_freq', label: 'ความถี่ของหวาน' },
      { key: 'veggie_fruit_freq', label: 'ความถี่ผัก/ผลไม้' },
      { key: 'late_night_eating', label: 'พฤติกรรมกินมื้อดึก' },
      { key: 'past_dieting', label: 'ประวัติควบคุมอาหาร' },
    ],
  },
  {
    key: 'goals',
    title: 'เป้าหมาย',
    source: 'assessment',
    fields: [
      { key: 'goal_type', label: 'เป้าหมายหลัก' },
      { key: 'stage_of_change', label: 'ขั้นความพร้อมเปลี่ยนพฤติกรรม' },
      { key: 'target_weight_kg', label: 'น้ำหนักเป้าหมาย' },
    ],
  },
];

// ค่า enum จาก DB → ข้อความไทย
const ENUM_LABEL_TH = {
  smoking_status: { NONE: 'ไม่สูบ', SMOKER: 'สูบ', FORMER: 'เลิกแล้ว' },
  alcohol_status: { NONE: 'ไม่ดื่ม', OCCASIONAL: 'ครั้งคราว', REGULAR: 'เป็นประจำ' },
  shift_type: { DAY: 'เวรทำการ', SHIFT: 'เวรผลัด' },
  meals_per_day: { 1: '1 มื้อ', 2: '2 มื้อ', 3: '3 มื้อ', MORE_THAN_3: 'มากกว่า 3 มื้อ' },
  veggie_fruit_freq: {
    NONE: 'ไม่ทาน',
    '1_SERVING': '1 ส่วน/วัน',
    '2_SERVINGS': '2 ส่วน/วัน',
    '3_PLUS_SERVINGS': '3 ส่วนขึ้นไป/วัน',
  },
  late_night_eating: { NEVER: 'ไม่เลย', SOMETIMES: 'บางครั้ง', REGULARLY: 'เป็นประจำ' },
  past_dieting: { NEVER: 'ไม่เคย', CURRENTLY: 'กำลังควบคุมอยู่', PAST_ONLY: 'เคยควบคุมในอดีต' },
  stage_of_change: {
    NOT_CONSIDERING: 'ยังไม่คิดจะเปลี่ยน',
    CONSIDERING_6M: 'กำลังคิดอยู่ (ภายใน 6 เดือน)',
    PLANNING_1M: 'วางแผนจะเริ่ม (ภายใน 1 เดือน)',
    ACTIVE_UNDER_6M: 'เริ่มทำแล้ว (ไม่ถึง 6 เดือน)',
    ACTIVE_OVER_6M: 'ทำต่อเนื่อง (เกิน 6 เดือน)',
  },
};
const FOOD_FREQ_LABEL_TH = {
  NEVER: 'ไม่เลย',
  '1_2_PER_WEEK': '1-2 ครั้ง/สัปดาห์',
  '3_4_PER_WEEK': '3-4 ครั้ง/สัปดาห์',
  '5_PLUS_PER_WEEK': '5 ครั้งขึ้นไป/สัปดาห์',
};
ENUM_LABEL_TH.fried_food_freq = FOOD_FREQ_LABEL_TH;
ENUM_LABEL_TH.sweet_food_freq = FOOD_FREQ_LABEL_TH;

// หน่วยต่อท้ายตัวเลข
const UNIT_SUFFIX = {
  age: ' ปี',
  waist_cm: ' ซม.',
  target_weight_kg: ' กก.',
  bp_systolic: ' mmHg',
  bp_diastolic: ' mmHg',
  vigorous_days: ' วัน/สัปดาห์',
  moderate_days: ' วัน/สัปดาห์',
  walking_days: ' วัน/สัปดาห์',
  vigorous_minutes: ' นาที/ครั้ง',
  moderate_minutes: ' นาที/ครั้ง',
  walking_minutes: ' นาที/ครั้ง',
};

const hasValue = (v) => v !== null && v !== undefined && v !== '';

const JSON_LIST_FIELDS = ['chronic_disease', 'exercise_pattern', 'goal_type'];

// หาค่าล่าสุดที่ "มีค่า" ของฟิลด์นี้จากทุกแถว assessment (baseline+follow-up เรียงเก่า->ใหม่) —
// ไม่ใช่แถวล่าสุดเฉยๆ เพราะ follow-up บางรอบอาจไม่ได้ถามทุกฟิลด์ (ตรรกะเดียวกับ endpoint รายชื่อ)
function getLatestAssessmentValue(assessments, field) {
  const rowsWithValue = assessments.filter((a) => hasValue(a[field]));
  if (rowsWithValue.length === 0) return null;
  return rowsWithValue[rowsWithValue.length - 1][field];
}

function parseJsonList(rawValue) {
  if (Array.isArray(rawValue)) return rawValue;
  try {
    return JSON.parse(rawValue);
  } catch {
    return [];
  }
}

function formatServiceMonths(rawValue) {
  const total = Number(rawValue);
  const years = Math.floor(total / 12);
  const months = total % 12;
  if (years === 0 && months === 0) return 'น้อยกว่า 1 เดือน';
  return [years > 0 && `${years} ปี`, months > 0 && `${months} เดือน`].filter(Boolean).join(' ');
}

// แปลงค่าดิบจาก DB ให้เป็นข้อความไทยอ่านง่ายสำหรับ detail panel — คืน null ถ้าไม่มีค่า (ใช้ซ่อนแถวนั้น)
function formatHealthFieldValue(fieldKey, rawValue) {
  if (!hasValue(rawValue)) return null;
  if (JSON_LIST_FIELDS.includes(fieldKey)) {
    const arr = parseJsonList(rawValue);
    return arr.length ? arr.join(', ') : null;
  }
  if (fieldKey === 'physical_limitation') return rawValue ? 'มี' : 'ไม่มี';
  if (fieldKey === 'service_months') return formatServiceMonths(rawValue);
  if (ENUM_LABEL_TH[fieldKey]) return ENUM_LABEL_TH[fieldKey][rawValue] || rawValue;
  if (UNIT_SUFFIX[fieldKey]) return `${rawValue}${UNIT_SUFFIX[fieldKey]}`;
  return String(rawValue);
}

function getFieldRawValue(detail, tab, field) {
  return (field.source || tab.source) === 'employee'
    ? detail.employee[field.key]
    : getLatestAssessmentValue(detail.assessments, field.key);
}

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
      <path d={pathD} fill="none" stroke="var(--ws-primary)" strokeWidth="2" />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="4" fill="var(--ws-primary)" />
          <text x={c.x} y={height - 4} textAnchor="middle" fontSize="11" fill="var(--ws-text-muted)">{c.label}</text>
          <text x={c.x} y={c.y - 10} textAnchor="middle" fontSize="11" fill="var(--ws-text-secondary)">{c.value}</text>
        </g>
      ))}
    </svg>
  );
}

const TRENDS = {
  weight: { title: 'แนวโน้มน้ำหนัก (baseline → follow-up)', field: 'weight_kg', unit: ' กก.' },
  met: { title: 'แนวโน้ม MET-minutes/สัปดาห์', field: 'met_minutes_per_week', unit: '' },
};

function TrendSection({ trend, assessments }) {
  const { title, field, unit } = TRENDS[trend];
  const points = assessments
    .filter((a) => a[field] !== null && a[field] !== undefined)
    .map((a) => ({
      label: a.assessment_type === 'BASELINE' ? 'Baseline' : new Date(a.created_at).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
      value: Number(a[field]),
    }));
  return (
    <div style={{ marginTop: 20 }}>
      <h4 style={{ margin: '0 0 8px' }}>{title}</h4>
      <HealthTrendChart unit={unit} points={points} />
    </div>
  );
}

const SUMMARY_FIELDS = [
  ['weight_kg', 'น้ำหนักล่าสุด (กก.)'],
  ['bmi', 'BMI ล่าสุด'],
  ['met_minutes_per_week', 'MET-min/wk ล่าสุด'],
];

function SummaryCard({ label, value }) {
  return (
    <div className="ws-card" style={{ padding: '1rem' }}>
      <p style={{ fontSize: 13, color: 'var(--ws-text-secondary)', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>{value}</p>
    </div>
  );
}

function HealthDetailBody({ detail }) {
  const [detailPanelTab, setDetailPanelTab] = useState(null);
  const initials = (detail.employee.full_name || '?').trim().charAt(0).toUpperCase();
  const visibleTabs = HEALTH_DETAIL_TABS.filter((tab) =>
    tab.fields.some((f) => hasValue(getFieldRawValue(detail, tab, f)))
  );
  const activeTab = visibleTabs.find((t) => t.key === detailPanelTab) || visibleTabs[0] || null;

  return (
    <>
      <div className="ws-card" style={{ marginBottom: 20, padding: '1rem' }}>
        <div className="ws-row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--ws-primary-light)',
              color: 'var(--ws-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontWeight: 'bold', fontSize: 16, margin: 0 }}>{(detail.employee.full_name || '').trim()}</p>
            <p style={{ fontSize: 13, color: 'var(--ws-text-secondary)', margin: 0 }}>
              {detail.employee.employee_id} · {detail.employee.age != null ? `${detail.employee.age} ปี` : '-'} · {detail.employee.job_position || '-'} · คะแนนคงเหลือ {detail.scoreBalance}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {SUMMARY_FIELDS.map(([field, label]) => (
          <SummaryCard key={field} label={label} value={getLatestAssessmentValue(detail.assessments, field) ?? '-'} />
        ))}
        <SummaryCard label="จำนวนรอบที่ตอบ" value={detail.assessments.length} />
      </div>

      {activeTab && (
        <div className="ws-card" style={{ padding: '1rem' }}>
          <div className="ws-tabs" style={{ marginTop: -4 }}>
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                className={`ws-tab ${activeTab.key === tab.key ? 'active' : ''}`}
                onClick={() => setDetailPanelTab(tab.key)}
              >
                {tab.title}
              </button>
            ))}
          </div>

          <div className="ws-stack" style={{ marginTop: 16 }}>
            {activeTab.fields.map((f) => {
              const displayValue = formatHealthFieldValue(f.key, getFieldRawValue(detail, activeTab, f));
              if (displayValue === null) return null;
              return (
                <div key={f.key} className="ws-row-between" style={{ borderBottom: '1px solid var(--ws-border)', paddingBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--ws-text-secondary)' }}>{f.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{displayValue}</span>
                </div>
              );
            })}
          </div>

          {activeTab.trend && <TrendSection trend={activeTab.trend} assessments={detail.assessments} />}
        </div>
      )}
    </>
  );
}

// หน้ารายละเอียดข้อมูลสุขภาพของพนักงานหนึ่งคน (โหลดตอนเปิด)
export default function EmployeeHealthDetail({ api, employeeId, onBack }) {
  const { data, loading, error } = useApiData(api, `/api/admin/health-assessments/${employeeId}`, {
    errorMessage: 'โหลดรายละเอียดไม่สำเร็จ',
  });

  return (
    <div>
      <button className="ws-btn ws-btn-ghost ws-btn-sm" style={{ marginBottom: 16, marginLeft: -14 }} onClick={onBack}>
        ← รายชื่อพนักงาน
      </button>

      {loading && <p className="ws-empty">กำลังโหลด...</p>}
      <ErrorAlert message={error} />

      {data && !loading && <HealthDetailBody detail={data} />}
    </div>
  );
}
