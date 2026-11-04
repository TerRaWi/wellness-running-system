import { useState } from 'react';
import useApiData from '../../hooks/useApiData';
import {
  ActiveStatusBadge,
  ActiveStatusSelect,
  CreateCard,
  EditRowActions,
  ErrorAlert,
  FieldRow,
  FormField,
  ImageEditField,
  ImageFileInput,
  ListHeader,
  ListState,
  RowActions,
  SubmitButton,
  SubText,
  TableImage,
  TableScroll,
} from './AdminUi';

const BADGE_CONDITION_LABEL_TH = {
  DISTANCE: 'ระยะทางสะสม (กม.)',
  SUBMISSION_COUNT: 'จำนวนครั้งที่อนุมัติ',
  SCORE: 'คะแนนสะสมที่เคยได้',
  STREAK_DAYS: 'จำนวนวันติดกัน',
};

const emptyForm = { badgeName: '', description: '', conditionType: 'DISTANCE', conditionValue: '' };

function ConditionTypeOptions() {
  return Object.entries(BADGE_CONDITION_LABEL_TH).map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));
}

// ส่งเป็น multipart เพราะแนบไฟล์รูปได้ — iconFile = แทนที่รูปเดิม, removeIcon = ล้างรูป, ไม่ส่งทั้งคู่ = คงรูปเดิม
function toBadgeFormData(form, { iconFile, removeIcon, status } = {}) {
  const formData = new FormData();
  formData.append('badgeName', form.badgeName.trim());
  formData.append('description', form.description.trim());
  formData.append('conditionType', form.conditionType);
  formData.append('conditionValue', form.conditionValue);
  if (status) formData.append('status', status);
  if (iconFile) {
    formData.append('iconFile', iconFile);
  } else if (removeIcon) {
    formData.append('removeIcon', 'true');
  }
  return formData;
}

function CreateBadgeForm({ api, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [iconFile, setIconFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.badgeName.trim() || !form.conditionValue) {
      setError('กรุณากรอกชื่อ เหรียญตรา และค่าเงื่อนไข');
      return;
    }
    setSubmitting(true);
    try {
      await api.request('/api/admin/badges', {
        method: 'POST',
        body: toBadgeFormData(form, { iconFile }),
        errorMessage: 'สร้าง เหรียญตรา ไม่สำเร็จ',
      });
      setForm(emptyForm);
      setIconFile(null);
      onCreated();
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CreateCard title="สร้าง เหรียญตรา ใหม่" onSubmit={handleSubmit}>
      <FormField id="newBadgeName" label="ชื่อ เหรียญตรา">
        <input
          id="newBadgeName"
          type="text"
          value={form.badgeName}
          onChange={setField('badgeName')}
          placeholder="เช่น วิ่งติดกัน 3 วัน"
          className="ws-input"
        />
      </FormField>

      <FormField id="newBadgeDescription" label="คำอธิบาย (ถ้ามี)">
        <textarea id="newBadgeDescription" value={form.description} onChange={setField('description')} rows={2} className="ws-textarea" />
      </FormField>

      <FormField id="newBadgeIcon" label="รูปไอคอน (ถ้ามี — อัปโหลดรูปBadge JPG/PNG/WEBP ไม่เกิน 2MB)">
        <ImageFileInput id="newBadgeIcon" onChange={setIconFile} />
      </FormField>

      <FieldRow>
        <FormField id="newBadgeConditionType" label="ประเภทเงื่อนไข" style={{ flex: 1 }}>
          <select id="newBadgeConditionType" value={form.conditionType} onChange={setField('conditionType')} className="ws-select">
            <ConditionTypeOptions />
          </select>
        </FormField>
        <FormField id="newBadgeConditionValue" label="ค่าที่ต้องถึง" style={{ flex: 1 }}>
          <input
            id="newBadgeConditionValue"
            type="number"
            min="1"
            step="1"
            value={form.conditionValue}
            onChange={setField('conditionValue')}
            className="ws-input"
          />
        </FormField>
      </FieldRow>

      <ErrorAlert message={error} />

      <SubmitButton busy={submitting}>สร้าง เหรียญตรา</SubmitButton>
    </CreateCard>
  );
}

function BadgeEditRow({ api, badge, onSaved, onCancel }) {
  const [form, setForm] = useState({
    badgeName: badge.badge_name,
    description: badge.description || '',
    conditionType: badge.condition_type,
    conditionValue: String(badge.condition_value),
    status: badge.status,
  });
  const [iconFile, setIconFile] = useState(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const setField = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    setError('');
    if (!form.badgeName.trim() || !form.conditionValue) {
      setError('กรุณากรอกชื่อ badge และค่าเงื่อนไข');
      return;
    }
    setSaving(true);
    try {
      await api.request(`/api/admin/badges/${badge.badge_id}`, {
        method: 'PUT',
        body: toBadgeFormData(form, { iconFile, removeIcon, status: form.status }),
        errorMessage: 'แก้ไข badge ไม่สำเร็จ',
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{badge.badge_id}</td>
      <td>
        <ImageEditField
          currentImage={badge.icon || ''}
          removeImage={removeIcon}
          onFileChange={setIconFile}
          onRemoveChange={setRemoveIcon}
          round
        />
      </td>
      <td>
        <input
          type="text"
          value={form.badgeName}
          onChange={(e) => setField('badgeName')(e.target.value)}
          className="ws-input"
          style={{ marginBottom: 6 }}
        />
        <textarea
          value={form.description}
          onChange={(e) => setField('description')(e.target.value)}
          rows={2}
          className="ws-textarea"
          placeholder="คำอธิบาย"
        />
      </td>
      <td>
        <select
          value={form.conditionType}
          onChange={(e) => setField('conditionType')(e.target.value)}
          className="ws-select"
          style={{ marginBottom: 6 }}
        >
          <ConditionTypeOptions />
        </select>
        <input
          type="number"
          min="1"
          step="1"
          value={form.conditionValue}
          onChange={(e) => setField('conditionValue')(e.target.value)}
          className="ws-input"
        />
      </td>
      <td>
        <ActiveStatusSelect value={form.status} onChange={setField('status')} />
      </td>
      <td>{badge.earned_count} คน</td>
      <EditRowActions error={error} busy={saving} onSave={handleSave} onCancel={onCancel} />
    </tr>
  );
}

export default function BadgesTab({ api, refreshKey }) {
  const badges = useApiData(api, '/api/admin/badges', {
    enabled: refreshKey !== null,
    refreshKey,
    initialData: [],
    errorMessage: 'โหลดรายการ badge ไม่สำเร็จ',
  });
  const [editingId, setEditingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  async function handleToggleStatus(badge) {
    setTogglingId(badge.badge_id);
    try {
      await api.request(`/api/admin/badges/${badge.badge_id}`, {
        method: 'PUT',
        json: {
          badgeName: badge.badge_name,
          description: badge.description,
          conditionType: badge.condition_type,
          conditionValue: badge.condition_value,
          status: badge.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        },
        errorMessage: 'เปลี่ยนสถานะไม่สำเร็จ',
      });
      badges.reload();
    } catch (err) {
      badges.setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setTogglingId(null);
    }
  }

  function handleSaved() {
    setEditingId(null);
    badges.reload();
  }

  return (
    <>
      <CreateBadgeForm api={api} onCreated={badges.reload} />

      <ListHeader title="รายการ เหรียญตรา ทั้งหมด" onRefresh={badges.reload} />

      <ListState error={badges.error} loading={badges.loading} isEmpty={badges.data.length === 0} emptyText="ยังไม่มี badge">
        <TableScroll>
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
            {badges.data.map((b) =>
              editingId === b.badge_id ? (
                <BadgeEditRow key={b.badge_id} api={api} badge={b} onSaved={handleSaved} onCancel={() => setEditingId(null)} />
              ) : (
                <tr key={b.badge_id}>
                  <td>{b.badge_id}</td>
                  <td>
                    <TableImage src={b.icon} fallback="🏅" round />
                  </td>
                  <td>
                    {b.badge_name}
                    {b.description && <SubText>{b.description}</SubText>}
                  </td>
                  <td>
                    {BADGE_CONDITION_LABEL_TH[b.condition_type] || b.condition_type} ≥ {b.condition_value}
                  </td>
                  <td><ActiveStatusBadge status={b.status} /></td>
                  <td>{b.earned_count} คน</td>
                  <RowActions
                    status={b.status}
                    busy={togglingId === b.badge_id}
                    onEdit={() => setEditingId(b.badge_id)}
                    onToggle={() => handleToggleStatus(b)}
                  />
                </tr>
              )
            )}
          </tbody>
        </TableScroll>
      </ListState>
    </>
  );
}
