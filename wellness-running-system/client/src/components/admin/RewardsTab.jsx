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

const emptyForm = { rewardName: '', requiredScore: '', stock: '', description: '' };
const REQUIRED_MESSAGE = 'กรุณากรอกชื่อ คะแนนที่ใช้แลก และจำนวนคงเหลือให้ครบ';

// ส่งเป็น multipart เพราะแนบไฟล์รูปได้ — imageFile = แทนที่รูปเดิม, removeImage = ล้างรูป, ไม่ส่งทั้งคู่ = คงรูปเดิม
function toRewardFormData(form, { imageFile, removeImage, status } = {}) {
  const formData = new FormData();
  formData.append('rewardName', form.rewardName.trim());
  formData.append('requiredScore', form.requiredScore);
  formData.append('stock', form.stock);
  formData.append('description', form.description.trim());
  if (status) formData.append('status', status);
  if (imageFile) {
    formData.append('imageFile', imageFile);
  } else if (removeImage) {
    formData.append('removeImage', 'true');
  }
  return formData;
}

const isIncomplete = (form) => !form.rewardName.trim() || !form.requiredScore || form.stock === '';

function CreateRewardForm({ api, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (isIncomplete(form)) {
      setError(REQUIRED_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      await api.request('/api/admin/rewards', {
        method: 'POST',
        body: toRewardFormData(form, { imageFile }),
        errorMessage: 'สร้างของรางวัลไม่สำเร็จ',
      });
      setForm(emptyForm);
      setImageFile(null);
      onCreated();
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CreateCard title="สร้างของรางวัลใหม่" onSubmit={handleSubmit}>
      <FormField id="newRewardName" label="ชื่อของรางวัล">
        <input
          id="newRewardName"
          type="text"
          value={form.rewardName}
          onChange={setField('rewardName')}
          placeholder='เช่น "กระบอกน้ำ"'
          className="ws-input"
        />
      </FormField>

      <FieldRow>
        <FormField id="newRewardScore" label="คะแนนที่ใช้แลก" style={{ flex: 1 }}>
          <input
            id="newRewardScore"
            type="number"
            min="1"
            step="1"
            value={form.requiredScore}
            onChange={setField('requiredScore')}
            className="ws-input"
          />
        </FormField>
        <FormField id="newRewardStock" label="จำนวนคงเหลือ" style={{ flex: 1 }}>
          <input id="newRewardStock" type="number" min="0" step="1" value={form.stock} onChange={setField('stock')} className="ws-input" />
        </FormField>
      </FieldRow>

      <FormField id="newRewardDescription" label="รายละเอียด (ถ้ามี)">
        <textarea id="newRewardDescription" value={form.description} onChange={setField('description')} rows={2} className="ws-textarea" />
      </FormField>

      <FormField id="newRewardImage" label="รูปของรางวัล (ถ้ามี — JPG/PNG/WEBP ไม่เกิน 2MB)">
        <ImageFileInput id="newRewardImage" onChange={setImageFile} />
      </FormField>

      <ErrorAlert message={error} />

      <SubmitButton busy={submitting}>สร้างของรางวัล</SubmitButton>
    </CreateCard>
  );
}

function RewardEditRow({ api, reward, onSaved, onCancel }) {
  const [form, setForm] = useState({
    rewardName: reward.reward_name,
    requiredScore: String(reward.required_score),
    stock: String(reward.stock),
    description: reward.description || '',
    status: reward.status,
  });
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const setField = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    setError('');
    if (isIncomplete(form)) {
      setError(REQUIRED_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      await api.request(`/api/admin/rewards/${reward.reward_id}`, {
        method: 'PUT',
        body: toRewardFormData(form, { imageFile, removeImage, status: form.status }),
        errorMessage: 'แก้ไขของรางวัลไม่สำเร็จ',
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{reward.reward_id}</td>
      <td>
        <ImageEditField
          currentImage={reward.image || ''}
          removeImage={removeImage}
          onFileChange={setImageFile}
          onRemoveChange={setRemoveImage}
        />
      </td>
      <td>
        <input
          type="text"
          value={form.rewardName}
          onChange={(e) => setField('rewardName')(e.target.value)}
          className="ws-input"
          style={{ marginBottom: 6 }}
        />
        <textarea
          value={form.description}
          onChange={(e) => setField('description')(e.target.value)}
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
          value={form.requiredScore}
          onChange={(e) => setField('requiredScore')(e.target.value)}
          className="ws-input"
          style={{ width: 80 }}
        />
      </td>
      <td>
        <input
          type="number"
          min="0"
          step="1"
          value={form.stock}
          onChange={(e) => setField('stock')(e.target.value)}
          className="ws-input"
          style={{ width: 70 }}
        />
      </td>
      <td>
        <ActiveStatusSelect value={form.status} onChange={setField('status')} />
      </td>
      <td>{reward.redeem_count}</td>
      <EditRowActions error={error} busy={saving} onSave={handleSave} onCancel={onCancel} />
    </tr>
  );
}

export default function RewardsTab({ api, refreshKey }) {
  const rewards = useApiData(api, '/api/admin/rewards', {
    enabled: refreshKey !== null,
    refreshKey,
    initialData: [],
    errorMessage: 'โหลดรายการของรางวัลไม่สำเร็จ',
  });
  const [editingId, setEditingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  async function handleToggleStatus(r) {
    setTogglingId(r.reward_id);
    try {
      await api.request(`/api/admin/rewards/${r.reward_id}`, {
        method: 'PUT',
        body: toRewardFormData(
          {
            rewardName: r.reward_name,
            requiredScore: r.required_score,
            stock: r.stock,
            description: r.description || '',
          },
          { status: r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
        ),
        errorMessage: 'เปลี่ยนสถานะไม่สำเร็จ',
      });
      rewards.reload();
    } catch (err) {
      rewards.setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setTogglingId(null);
    }
  }

  function handleSaved() {
    setEditingId(null);
    rewards.reload();
  }

  return (
    <>
      <CreateRewardForm api={api} onCreated={rewards.reload} />

      <ListHeader title="รายการของรางวัลทั้งหมด" onRefresh={rewards.reload} />

      <ListState error={rewards.error} loading={rewards.loading} isEmpty={rewards.data.length === 0} emptyText="ยังไม่มีของรางวัล">
        <TableScroll>
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
            {rewards.data.map((r) =>
              editingId === r.reward_id ? (
                <RewardEditRow key={r.reward_id} api={api} reward={r} onSaved={handleSaved} onCancel={() => setEditingId(null)} />
              ) : (
                <tr key={r.reward_id}>
                  <td>{r.reward_id}</td>
                  <td>
                    <TableImage src={r.image} fallback="🎁" />
                  </td>
                  <td>
                    {r.reward_name}
                    {r.description && <SubText>{r.description}</SubText>}
                  </td>
                  <td>{r.required_score}</td>
                  <td>{r.stock}</td>
                  <td><ActiveStatusBadge status={r.status} /></td>
                  <td>{r.redeem_count}</td>
                  <RowActions
                    status={r.status}
                    busy={togglingId === r.reward_id}
                    onEdit={() => setEditingId(r.reward_id)}
                    onToggle={() => handleToggleStatus(r)}
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
