import { useState } from 'react';
import useApiData from '../../hooks/useApiData';
import ThaiDatePicker from '../ThaiDatePicker';
import { CreateCard, ErrorAlert, FormField, ListHeader, ListState, SubmitButton, TableScroll } from './AdminUi';

// ฟิลด์ที่ถูกใช้คำนวณค่า generated column ในตาราง health_assessment (ดู wellness.sql)
// ใช้ mark สีบนปุ่มเลือกฟิลด์ + เตือน admin ตอนสร้างรอบ follow-up ว่าเลือกไม่ครบกลุ่ม
// mode 'required': เลือกไม่ครบคู่ -> DB คำนวณค่าไม่ได้เลย (เป็น NULL)
// mode 'recommended': เลือกไม่ครบ -> ยังคำนวณได้ แต่ส่วนที่ไม่ได้เลือกจะถูกนับเป็น 0 ในสูตร (ค่าคลาดเคลื่อน)
const CALC_RULES = {
  bmi: {
    label: 'BMI',
    icon: '⚖️',
    color: 'var(--ws-info)',
    bg: 'var(--ws-info-bg)',
    keys: ['weightKg', 'heightCm'],
    mode: 'required',
    formula: 'BMI = น้ำหนัก(กก.) ÷ ส่วนสูง(ม.)²',
  },
  met: {
    label: 'คะแนนกิจกรรม MET',
    icon: '🏃',
    color: 'var(--ws-warning)',
    bg: 'var(--ws-warning-bg)',
    keys: ['vigorousDays', 'moderateDays', 'walkingDays'],
    mode: 'recommended',
    formula: 'MET-min/week = (8.0×วันหนัก×นาที) + (4.0×วันปานกลาง×นาที) + (3.3×วันเดิน×นาที)',
  },
};

// หา calc rule ที่ field นี้เป็นส่วนหนึ่ง (ถ้ามี) — ใช้ mark badge สีบนปุ่มเลือกฟิลด์
function findCalcRuleForField(fieldKey) {
  const entry = Object.entries(CALC_RULES).find(([, rule]) => rule.keys.includes(fieldKey));
  return entry ? { calcKey: entry[0], ...entry[1] } : null;
}

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

const FIELD_LABEL_BY_KEY = Object.fromEntries(CAMPAIGN_FIELD_GROUPS.flatMap((g) => g.fields).map((f) => [f.key, f.label]));

const CAMPAIGN_STATUS_LABEL_TH = {
  DRAFT: 'ร่าง (ยังไม่เปิด)',
  OPEN: 'เปิดอยู่',
  CLOSED: 'ปิดแล้ว',
};

const CAMPAIGN_STATUS_BADGE = { OPEN: 'ws-badge-success', CLOSED: 'ws-badge-neutral' };

// ข้อความ + สีป้าย บอกว่าฟิลด์ที่เลือกพอให้ระบบคำนวณ BMI / MET ได้ไหม
function describeCalcStatus(rule, includedFields) {
  const selectedCount = rule.keys.filter((k) => includedFields.includes(k)).length;
  const total = rule.keys.length;
  if (selectedCount === total) {
    return { badgeClass: 'ws-badge-success', text: `เลือกครบ — ระบบจะคำนวณ ${rule.label} ให้อัตโนมัติ` };
  }
  if (selectedCount > 0 && rule.mode === 'required') {
    return {
      badgeClass: 'ws-badge-danger',
      text: `เลือกแค่ ${selectedCount}/${total} — ${rule.label} จะคำนวณไม่ได้ (ค่าว่าง) เพราะต้องมีทั้ง ${rule.keys
        .map((k) => FIELD_LABEL_BY_KEY[k] || k)
        .join(' + ')}`,
    };
  }
  if (selectedCount > 0 && rule.mode === 'recommended') {
    return {
      badgeClass: 'ws-badge-warning',
      text: `เลือกแค่ ${selectedCount}/${total} — ${rule.label} จะยังคำนวณได้ แต่ระดับที่ไม่เลือกจะถูกนับเป็น 0 (ค่าอาจคลาดเคลื่อน)`,
    };
  }
  return { badgeClass: 'ws-badge-neutral', text: `ยังไม่ได้เลือกฟิลด์ในกลุ่มนี้ — จะไม่มี ${rule.label} ให้ในรอบนี้` };
}

function FieldPicker({ includedFields, onToggle }) {
  return CAMPAIGN_FIELD_GROUPS.map((g) => (
    <div key={g.group} style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, color: 'var(--ws-text-secondary)', marginBottom: 4 }}>{g.group}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {g.fields.map((f) => {
          const active = includedFields.includes(f.key);
          const calcRule = findCalcRuleForField(f.key);
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onToggle(f.key)}
              className="ws-btn ws-btn-sm"
              title={calcRule ? `ใช้คำนวณ ${calcRule.label}: ${calcRule.formula}` : undefined}
              style={{
                position: 'relative',
                borderColor: active ? 'var(--ws-primary)' : calcRule ? calcRule.color : undefined,
                background: active ? 'var(--ws-primary)' : undefined,
                color: active ? '#fff' : undefined,
                paddingRight: calcRule ? 22 : undefined,
              }}
            >
              {f.label}
              {calcRule && (
                <span aria-hidden="true" style={{ position: 'absolute', top: 2, right: 4, fontSize: 10, lineHeight: 1 }}>
                  {calcRule.icon}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  ));
}

function CalcStatusPanel({ includedFields }) {
  return (
    <div className="ws-card" style={{ marginTop: 12, padding: 12, background: 'var(--ws-surface-subtle, transparent)' }}>
      <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>สถานะการคำนวณอัตโนมัติ</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(CALC_RULES).map(([calcKey, rule]) => {
          const { badgeClass, text } = describeCalcStatus(rule, includedFields);
          return (
            <div key={calcKey} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span className={`ws-badge ${badgeClass}`} style={{ flexShrink: 0 }}>
                {rule.icon} {rule.label}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ws-text-secondary)' }}>{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const emptyForm = { campaignName: '', releaseDate: '', closeDate: '', includedFields: [] };

function CreateCampaignForm({ api, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  function toggleField(fieldKey) {
    setForm((prev) => ({
      ...prev,
      includedFields: prev.includedFields.includes(fieldKey)
        ? prev.includedFields.filter((f) => f !== fieldKey)
        : [...prev.includedFields, fieldKey],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.campaignName.trim() || !form.releaseDate || form.includedFields.length === 0) {
      setError('กรุณากรอกชื่อรอบ วันที่เปิด และเลือกอย่างน้อย 1 ฟิลด์');
      return;
    }
    setSubmitting(true);
    try {
      await api.request('/api/admin/campaigns', {
        method: 'POST',
        json: {
          campaignName: form.campaignName.trim(),
          releaseDate: form.releaseDate,
          closeDate: form.closeDate || null,
          includedFields: form.includedFields,
        },
        errorMessage: 'สร้างรอบ follow-up ไม่สำเร็จ',
      });
      setForm(emptyForm);
      onCreated();
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CreateCard title="สร้างรอบแบบสอบถามติดตามผลใหม่" maxWidth={560} onSubmit={handleSubmit}>
      <FormField id="newCampaignName" label="ชื่อรอบ">
        <input
          id="newCampaignName"
          type="text"
          value={form.campaignName}
          onChange={(e) => setField('campaignName', e.target.value)}
          placeholder="เช่น ติดตามผล 8 สัปดาห์ รอบที่ 1"
          className="ws-input"
        />
      </FormField>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <FormField id="newCampaignReleaseDate" label="วันที่เปิดให้กรอก" style={{ flex: 1 }}>
          <ThaiDatePicker
            id="newCampaignReleaseDate"
            value={form.releaseDate}
            max={form.closeDate || undefined}
            onChange={(v) => setField('releaseDate', v)}
          />
        </FormField>
        <FormField id="newCampaignCloseDate" label="วันที่ปิดรับ (ถ้ามี)" style={{ flex: 1 }}>
          <ThaiDatePicker
            id="newCampaignCloseDate"
            value={form.closeDate}
            min={form.releaseDate || undefined}
            placeholder="ไม่ระบุ = เปิดรับไปเรื่อยๆ"
            onChange={(v) => setField('closeDate', v)}
          />
        </FormField>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>เลือกฟิลด์ที่จะให้พนักงานกรอกในรอบนี้</label>
        <FieldPicker includedFields={form.includedFields} onToggle={toggleField} />
        <CalcStatusPanel includedFields={form.includedFields} />
      </div>

      <ErrorAlert message={error} />

      <SubmitButton busy={submitting}>สร้างรอบ (สถานะร่าง)</SubmitButton>
      <p style={{ fontSize: 13, color: 'var(--ws-text-muted)', marginTop: 8, marginBottom: 0 }}>
        สร้างเสร็จจะอยู่ในสถานะ "ร่าง" ก่อน — ต้องกด "เปิด" ในรายการด้านล่างให้พนักงานถึงจะเริ่มเห็นแบบฟอร์ม
      </p>
    </CreateCard>
  );
}

// แบบสอบถามติดตามผล (follow-up campaign)
export default function CampaignsTab({ api, refreshKey }) {
  const campaigns = useApiData(api, '/api/admin/campaigns', {
    enabled: refreshKey !== null,
    refreshKey,
    initialData: [],
    errorMessage: 'โหลดรายการรอบ follow-up ไม่สำเร็จ',
  });
  const [actioningId, setActioningId] = useState(null);

  async function handleToggleStatus(campaign) {
    const action = campaign.status === 'OPEN' ? 'close' : 'open';
    setActioningId(campaign.campaign_id);
    try {
      await api.request(`/api/admin/campaigns/${campaign.campaign_id}/${action}`, {
        method: 'POST',
        errorMessage: 'เปลี่ยนสถานะไม่สำเร็จ',
      });
      campaigns.reload();
    } catch (err) {
      campaigns.setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActioningId(null);
    }
  }

  return (
    <>
      <CreateCampaignForm api={api} onCreated={campaigns.reload} />

      <ListHeader title="รายการรอบ follow-up ทั้งหมด" onRefresh={campaigns.reload} />

      <ListState error={campaigns.error} loading={campaigns.loading} isEmpty={campaigns.data.length === 0} emptyText="ยังไม่มีรอบ follow-up">
        <TableScroll>
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
            {campaigns.data.map((c) => {
              const isActioning = actioningId === c.campaign_id;
              return (
                <tr key={c.campaign_id}>
                  <td>{c.campaign_name}</td>
                  <td>{c.release_date ? new Date(c.release_date).toLocaleDateString('th-TH') : '-'}</td>
                  <td>{c.close_date ? new Date(c.close_date).toLocaleDateString('th-TH') : '-'}</td>
                  <td>
                    <span className={`ws-badge ${CAMPAIGN_STATUS_BADGE[c.status] || 'ws-badge-warning'}`}>
                      {CAMPAIGN_STATUS_LABEL_TH[c.status] || c.status}
                    </span>
                  </td>
                  <td>{c.response_count} / {c.active_employee_count}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {c.status !== 'CLOSED' && (
                      <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => handleToggleStatus(c)} disabled={isActioning}>
                        {isActioning ? 'กำลังบันทึก...' : c.status === 'OPEN' ? 'ปิดรอบ' : 'เปิดรอบ'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableScroll>
      </ListState>
    </>
  );
}
