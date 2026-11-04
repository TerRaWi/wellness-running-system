import { useState } from 'react';
import useApiData from '../../hooks/useApiData';
import {
  ActiveStatusBadge,
  ActiveStatusSelect,
  CreateCard,
  EditRowActions,
  ErrorAlert,
  FormField,
  ListHeader,
  ListState,
  RowActions,
  SubmitButton,
  TableScroll,
} from './AdminUi';

function CreateCategoryForm({ api, onCreated }) {
  const [categoryName, setCategoryName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!categoryName.trim()) {
      setError('กรุณากรอกชื่อหมวดหมู่');
      return;
    }
    setSubmitting(true);
    try {
      await api.request('/api/admin/categories', {
        method: 'POST',
        json: { categoryName: categoryName.trim() },
        errorMessage: 'สร้างหมวดหมู่ไม่สำเร็จ',
      });
      setCategoryName('');
      onCreated();
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CreateCard title="สร้างหมวดหมู่กิจกรรมใหม่" onSubmit={handleSubmit}>
      <FormField id="newCategoryName" label="ชื่อหมวดหมู่">
        <input
          id="newCategoryName"
          type="text"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          placeholder="เช่น วิ่ง, ปั่นจักรยาน, ว่ายน้ำ"
          className="ws-input"
        />
      </FormField>

      <ErrorAlert message={error} />

      <SubmitButton busy={submitting}>สร้างหมวดหมู่</SubmitButton>
    </CreateCard>
  );
}

function saveCategory(api, categoryId, categoryName, status, errorMessage) {
  return api.request(`/api/admin/categories/${categoryId}`, {
    method: 'PUT',
    json: { categoryName, status },
    errorMessage,
  });
}

function CategoryEditRow({ api, category, onSaved, onCancel }) {
  const [form, setForm] = useState({ categoryName: category.category_name, status: category.status });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError('');
    if (!form.categoryName.trim()) {
      setError('กรุณากรอกชื่อหมวดหมู่');
      return;
    }
    setSaving(true);
    try {
      await saveCategory(api, category.category_id, form.categoryName.trim(), form.status, 'แก้ไขหมวดหมู่ไม่สำเร็จ');
      onSaved();
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{category.category_id}</td>
      <td>
        <input
          type="text"
          value={form.categoryName}
          onChange={(e) => setForm((prev) => ({ ...prev, categoryName: e.target.value }))}
          className="ws-input"
        />
      </td>
      <td>
        <ActiveStatusSelect value={form.status} onChange={(status) => setForm((prev) => ({ ...prev, status }))} />
      </td>
      <td>{category.activity_type_count}</td>
      <EditRowActions error={error} busy={saving} onSave={handleSave} onCancel={onCancel} />
    </tr>
  );
}

export default function CategoriesTab({ api, refreshKey }) {
  const categories = useApiData(api, '/api/admin/categories', {
    enabled: refreshKey !== null,
    refreshKey,
    initialData: [],
    errorMessage: 'โหลดรายการหมวดหมู่ไม่สำเร็จ',
  });
  const [editingId, setEditingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  async function handleToggleStatus(cat) {
    setTogglingId(cat.category_id);
    try {
      await saveCategory(
        api,
        cat.category_id,
        cat.category_name,
        cat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        'เปลี่ยนสถานะไม่สำเร็จ'
      );
      categories.reload();
    } catch (err) {
      categories.setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setTogglingId(null);
    }
  }

  function handleSaved() {
    setEditingId(null);
    categories.reload();
  }

  return (
    <>
      <CreateCategoryForm api={api} onCreated={categories.reload} />

      <ListHeader title="รายการหมวดหมู่กิจกรรมทั้งหมด" onRefresh={categories.reload} />

      <ListState error={categories.error} loading={categories.loading} isEmpty={categories.data.length === 0} emptyText="ยังไม่มีหมวดหมู่">
        <TableScroll>
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
            {categories.data.map((cat) =>
              editingId === cat.category_id ? (
                <CategoryEditRow key={cat.category_id} api={api} category={cat} onSaved={handleSaved} onCancel={() => setEditingId(null)} />
              ) : (
                <tr key={cat.category_id}>
                  <td>{cat.category_id}</td>
                  <td>{cat.category_name}</td>
                  <td><ActiveStatusBadge status={cat.status} /></td>
                  <td>{cat.activity_type_count}</td>
                  <RowActions
                    status={cat.status}
                    busy={togglingId === cat.category_id}
                    onEdit={() => setEditingId(cat.category_id)}
                    onToggle={() => handleToggleStatus(cat)}
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
