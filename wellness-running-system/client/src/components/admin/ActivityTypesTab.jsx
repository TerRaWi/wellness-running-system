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
  ListHeader,
  ListState,
  RowActions,
  SubmitButton,
  SubText,
  TableScroll,
} from './AdminUi';

const emptyForm = { categoryId: '', activityName: '', score: '', requireImage: true, description: '' };

function saveActivityType(api, activityId, fields, errorMessage) {
  return api.request(`/api/admin/activity-types/${activityId}`, { method: 'PUT', json: fields, errorMessage });
}

function CreateActivityTypeForm({ api, categories, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.categoryId || !form.activityName.trim() || form.score === '') {
      setError('กรุณากรอกหมวดหมู่ ชื่อกิจกรรม และคะแนนให้ครบ');
      return;
    }
    setSubmitting(true);
    try {
      await api.request('/api/admin/activity-types', {
        method: 'POST',
        json: {
          categoryId: form.categoryId,
          activityName: form.activityName.trim(),
          score: form.score,
          requireImage: form.requireImage,
          description: form.description.trim(),
        },
        errorMessage: 'สร้างประเภทกิจกรรมไม่สำเร็จ',
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
    <CreateCard title="สร้างประเภทกิจกรรมใหม่" onSubmit={handleSubmit}>
      <FormField id="newActivityCategory" label="หมวดหมู่">
        <select
          id="newActivityCategory"
          value={form.categoryId}
          onChange={(e) => setField('categoryId', e.target.value)}
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
      </FormField>

      <FormField id="newActivityName" label="ชื่อกิจกรรม">
        <input
          id="newActivityName"
          type="text"
          value={form.activityName}
          onChange={(e) => setField('activityName', e.target.value)}
          placeholder='เช่น "วิ่ง 5 km"'
          className="ws-input"
        />
      </FormField>

      <FieldRow>
        <FormField id="newActivityScore" label="คะแนน" style={{ flex: 1 }}>
          <input
            id="newActivityScore"
            type="number"
            min="0"
            step="1"
            value={form.score}
            onChange={(e) => setField('score', e.target.value)}
            className="ws-input"
          />
        </FormField>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
          <label>
            <input type="checkbox" checked={form.requireImage} onChange={(e) => setField('requireImage', e.target.checked)} />{' '}
            บังคับแนบรูปหลักฐาน
          </label>
        </div>
      </FieldRow>

      <FormField id="newActivityDescription" label="รายละเอียด (ถ้ามี)">
        <textarea
          id="newActivityDescription"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          rows={2}
          className="ws-textarea"
        />
      </FormField>

      <ErrorAlert message={error} />

      <SubmitButton busy={submitting}>สร้างประเภทกิจกรรม</SubmitButton>
    </CreateCard>
  );
}

function ActivityTypeEditRow({ api, activity, categories, onSaved, onCancel }) {
  const [form, setForm] = useState({
    categoryId: activity.category_id,
    activityName: activity.activity_name,
    score: String(activity.score),
    requireImage: !!activity.require_image,
    description: activity.description || '',
    status: activity.status,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    setError('');
    if (!form.categoryId || !form.activityName.trim() || form.score === '') {
      setError('กรุณากรอกหมวดหมู่ ชื่อกิจกรรม และคะแนนให้ครบ');
      return;
    }
    setSaving(true);
    try {
      await saveActivityType(
        api,
        activity.activity_id,
        { ...form, activityName: form.activityName.trim(), description: form.description.trim() },
        'แก้ไขประเภทกิจกรรมไม่สำเร็จ'
      );
      onSaved();
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{activity.activity_id}</td>
      <td>
        <select value={form.categoryId} onChange={(e) => setField('categoryId', e.target.value)} className="ws-select">
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
          value={form.activityName}
          onChange={(e) => setField('activityName', e.target.value)}
          className="ws-input"
        />
        <textarea
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
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
          value={form.score}
          onChange={(e) => setField('score', e.target.value)}
          className="ws-input"
          style={{ width: 70 }}
        />
      </td>
      <td>
        <input type="checkbox" checked={form.requireImage} onChange={(e) => setField('requireImage', e.target.checked)} />
      </td>
      <td>
        <ActiveStatusSelect value={form.status} onChange={(status) => setField('status', status)} />
      </td>
      <td>{activity.submission_count}</td>
      <EditRowActions error={error} busy={saving} onSave={handleSave} onCancel={onCancel} />
    </tr>
  );
}

// ประเภทกิจกรรม — โหลดรายการ + หมวดหมู่ (ไว้เติม dropdown) ใหม่ทุกครั้งที่เปิดแท็บ
export default function ActivityTypesTab({ api, refreshKey }) {
  const enabled = refreshKey !== null;
  const activityTypes = useApiData(api, '/api/admin/activity-types', {
    enabled,
    refreshKey,
    initialData: [],
    errorMessage: 'โหลดรายการประเภทกิจกรรมไม่สำเร็จ',
  });
  const { data: categories } = useApiData(api, '/api/admin/categories', { enabled, refreshKey, initialData: [] });
  const [editingId, setEditingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  async function handleToggleStatus(a) {
    setTogglingId(a.activity_id);
    try {
      await saveActivityType(
        api,
        a.activity_id,
        {
          categoryId: a.category_id,
          activityName: a.activity_name,
          score: a.score,
          requireImage: !!a.require_image,
          description: a.description,
          status: a.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        },
        'เปลี่ยนสถานะไม่สำเร็จ'
      );
      activityTypes.reload();
    } catch (err) {
      activityTypes.setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setTogglingId(null);
    }
  }

  function handleSaved() {
    setEditingId(null);
    activityTypes.reload();
  }

  return (
    <>
      <CreateActivityTypeForm api={api} categories={categories} onCreated={activityTypes.reload} />

      <ListHeader title="รายการประเภทกิจกรรมทั้งหมด" onRefresh={activityTypes.reload} />

      <ListState
        error={activityTypes.error}
        loading={activityTypes.loading}
        isEmpty={activityTypes.data.length === 0}
        emptyText="ยังไม่มีประเภทกิจกรรม"
      >
        <TableScroll>
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
            {activityTypes.data.map((a) =>
              editingId === a.activity_id ? (
                <ActivityTypeEditRow
                  key={a.activity_id}
                  api={api}
                  activity={a}
                  categories={categories}
                  onSaved={handleSaved}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr key={a.activity_id}>
                  <td>{a.activity_id}</td>
                  <td>{a.category_name}</td>
                  <td>
                    {a.activity_name}
                    {a.description && <SubText>{a.description}</SubText>}
                  </td>
                  <td>{a.score}</td>
                  <td>{a.require_image ? 'ต้องแนบ' : 'ไม่บังคับ'}</td>
                  <td><ActiveStatusBadge status={a.status} /></td>
                  <td>{a.submission_count}</td>
                  <RowActions
                    status={a.status}
                    busy={togglingId === a.activity_id}
                    onEdit={() => setEditingId(a.activity_id)}
                    onToggle={() => handleToggleStatus(a)}
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
