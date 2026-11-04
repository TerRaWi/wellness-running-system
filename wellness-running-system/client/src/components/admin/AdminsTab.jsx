import { useState } from 'react';
import useApiData from '../../hooks/useApiData';
import { CreateCard, ErrorAlert, FormField, ListHeader, ListState, SubmitButton, TableScroll } from './AdminUi';

const emptyForm = { employeeId: '', password: '' };

function GrantAdminForm({ api, onGranted }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.employeeId.trim() || !form.password) {
      setError('กรุณากรอกรหัสพนักงานและรหัสผ่าน');
      return;
    }
    if (form.password.length < 8) {
      setError('รหัสผ่านควรยาวอย่างน้อย 8 ตัวอักษร');
      return;
    }
    setSubmitting(true);
    try {
      await api.request('/api/admin/admins', {
        method: 'POST',
        json: { employeeId: form.employeeId.trim(), password: form.password },
        errorMessage: 'ตั้งค่าแอดมินไม่สำเร็จ',
      });
      setForm(emptyForm);
      onGranted();
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CreateCard
      title="ให้สิทธิ์แอดมินใหม่"
      onSubmit={handleSubmit}
      footer={
        <p style={{ fontSize: 13, color: 'var(--ws-text-muted)', marginBottom: 0 }}>
          {/* รหัสพนักงานต้องมีอยู่ในตาราง employee อยู่แล้ว (sync จาก Pulse หรือเพิ่มเอง) ระบบจะตั้งสิทธิ์เป็น ADMIN ให้อัตโนมัติ */}
        </p>
      }
    >
      <FormField id="newAdminEmployeeId" label="รหัสพนักงาน">
        <input
          id="newAdminEmployeeId"
          type="text"
          value={form.employeeId}
          onChange={setField('employeeId')}
          placeholder="เช่น EMP045"
          className="ws-input"
        />
      </FormField>
      <FormField id="newAdminPassword" label="รหัสผ่าน">
        <input
          id="newAdminPassword"
          type="password"
          value={form.password}
          onChange={setField('password')}
          placeholder="อย่างน้อย 8 ตัวอักษร"
          className="ws-input"
        />
      </FormField>

      <ErrorAlert message={error} />

      <SubmitButton busy={submitting} busyText="กำลังบันทึก...">ให้สิทธิ์แอดมิน</SubmitButton>
    </CreateCard>
  );
}

// จัดการสิทธิ์แอดมิน (ให้สิทธิ์ / ถอดสิทธิ์) — ถอดสิทธิ์ตัวเองไม่ได้
export default function AdminsTab({ api, refreshKey, adminId }) {
  const admins = useApiData(api, '/api/admin/admins', {
    enabled: refreshKey !== null,
    refreshKey,
    initialData: [],
    errorMessage: 'โหลดรายชื่อแอดมินไม่สำเร็จ',
  });
  const [actioningId, setActioningId] = useState(null);

  async function handleRevoke(employeeId) {
    if (!window.confirm(`ยืนยันถอดสิทธิ์แอดมินของ ${employeeId}?`)) return;
    setActioningId(employeeId);
    try {
      await api.request(`/api/admin/admins/${employeeId}/revoke`, { method: 'POST', errorMessage: 'ถอดสิทธิ์แอดมินไม่สำเร็จ' });
      admins.reload();
    } catch (err) {
      admins.setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActioningId(null);
    }
  }

  return (
    <>
      <GrantAdminForm api={api} onGranted={admins.reload} />

      <ListHeader title="รายชื่อแอดมินปัจจุบัน" onRefresh={admins.reload} />

      <ListState error={admins.error} loading={admins.loading} isEmpty={admins.data.length === 0} emptyText="ยังไม่มีแอดมิน">
        <TableScroll>
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
            {admins.data.map((a) => (
              <tr key={a.employee_id}>
                <td>{a.employee_id}</td>
                <td>{a.full_name}</td>
                <td>{a.department || '-'}</td>
                <td>{new Date(a.created_at).toLocaleString('th-TH')}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {a.employee_id === adminId ? (
                    <span className="ws-badge ws-badge-neutral">คุณ</span>
                  ) : (
                    <button
                      className="ws-btn ws-btn-ghost ws-btn-sm"
                      onClick={() => handleRevoke(a.employee_id)}
                      disabled={actioningId === a.employee_id}
                    >
                      {actioningId === a.employee_id ? '...' : 'ถอดสิทธิ์'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableScroll>
      </ListState>
    </>
  );
}
