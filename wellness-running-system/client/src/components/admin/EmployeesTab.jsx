import { useState } from 'react';
import useApiData from '../../hooks/useApiData';
import AdminEmployeeEditor from '../AdminEmployeeEditor';
import EmployeeHealthDetail from './EmployeeHealthDetail';
import { ListState, TableScroll } from './AdminUi';

function matchesSearch(row, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.full_name.toLowerCase().includes(q) ||
    row.employee_id.toLowerCase().includes(q) ||
    (row.department || '').toLowerCase().includes(q)
  );
}

// หน้า "ข้อมูลพนักงาน": รายชื่อ + ข้อมูลสุขภาพรายคน + ฟอร์มเพิ่ม/แก้ไข
// editingEmployeeId (null = แสดงรายชื่อ, '' = เพิ่มใหม่, รหัส = แก้ไขคนนั้น) เก็บไว้ที่ AdminApp
// เพราะการกดเมนูย่อยด้านบนต้องปิดฟอร์มนี้ได้
export default function EmployeesTab({ api, refreshKey, adminId, editingEmployeeId, onEditEmployee, onOpenHistory }) {
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [search, setSearch] = useState('');
  const [selectedHealthEmployeeId, setSelectedHealthEmployeeId] = useState(null);
  const [editorNotice, setEditorNotice] = useState('');

  const healthList = useApiData(api, `/api/admin/health-assessments?status=${statusFilter}`, {
    enabled: refreshKey !== null,
    refreshKey,
    initialData: [],
    errorMessage: 'โหลดข้อมูลสุขภาพพนักงานไม่สำเร็จ',
  });

  function openEditor(employeeId) {
    setEditorNotice('');
    onEditEmployee(employeeId);
  }

  function closeEditor(changed) {
    onEditEmployee(null);
    setEditorNotice('');
    if (changed) healthList.reload();
  }

  // เพิ่มพนักงานสำเร็จ → เปิดหน้าของคนนั้นต่อ พร้อมบอกรหัสที่ระบบกำหนดให้
  function handleCreated(employeeId) {
    setEditorNotice(`เพิ่มพนักงานแล้ว รหัสพนักงาน ${employeeId}`);
    onEditEmployee(employeeId);
    healthList.reload();
  }

  if (editingEmployeeId !== null) {
    return (
      <AdminEmployeeEditor
        key={editingEmployeeId || 'new'}
        apiBase={api.apiBase}
        fetchOptions={api.fetchOptions}
        employeeId={editingEmployeeId || null}
        adminId={adminId}
        onClose={closeEditor}
        onCreated={handleCreated}
        onOpenHistory={onOpenHistory}
        initialNotice={editorNotice}
      />
    );
  }

  if (selectedHealthEmployeeId) {
    return <EmployeeHealthDetail api={api} employeeId={selectedHealthEmployeeId} onBack={() => setSelectedHealthEmployeeId(null)} />;
  }

  return (
    <>
      <div className="ws-row-between" style={{ marginBottom: 16 }}>
        <div className="ws-row" style={{ gap: 8 }}>
          <input
            type="text"
            placeholder="ค้นหาชื่อ รหัส หรือแผนก"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ws-input"
            style={{ maxWidth: 280 }}
          />
          <select
            aria-label="สถานะพนักงาน"
            className="ws-select"
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ACTIVE">ใช้งานอยู่</option>
            <option value="RESIGNED">ปิดใช้งาน (ลาออก)</option>
            <option value="ALL">ทั้งหมด</option>
          </select>
        </div>
        <div className="ws-row" style={{ gap: 8 }}>
          <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={healthList.reload}>รีเฟรช</button>
          <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => openEditor('')}>+ เพิ่มพนักงาน</button>
        </div>
      </div>

      <ListState error={healthList.error} loading={healthList.loading} isEmpty={healthList.data.length === 0} emptyText="ยังไม่มีข้อมูล">
        <TableScroll>
          <thead>
            <tr>
              <th>พนักงาน</th>
              <th>แผนก/ตำแหน่ง</th>
              <th>LINE</th>
              <th>น้ำหนักล่าสุด</th>
              <th>BMI</th>
              <th>MET-min/wk</th>
              <th>คะแนนคงเหลือ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {healthList.data
              .filter((row) => matchesSearch(row, search))
              .map((row) => (
                <tr key={row.employee_id}>
                  <td>
                    {row.full_name}
                    <div style={{ fontSize: 12, color: 'var(--ws-text-muted)' }}>
                      {row.employee_id}
                      {row.employment_status === 'RESIGNED' && (
                        <span className="ws-badge ws-badge-neutral" style={{ marginLeft: 6, fontSize: 11 }}>ปิดใช้งาน</span>
                      )}
                    </div>
                  </td>
                  <td>{row.department || '-'}</td>
                  <td>
                    {row.line_linked
                      ? <span className="ws-badge ws-badge-success">ผูกแล้ว</span>
                      : <span className="ws-badge ws-badge-neutral">ยังไม่ผูก</span>}
                  </td>
                  <td>{row.latest_weight_kg ?? '-'}</td>
                  <td>{row.latest_bmi ?? '-'}</td>
                  <td>{row.latest_met_minutes_per_week ?? '-'}</td>
                  <td>{row.score_balance}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="ws-btn ws-btn-secondary ws-btn-sm"
                      onClick={() => setSelectedHealthEmployeeId(row.employee_id)}
                      disabled={!row.baseline_completed}
                      title={row.baseline_completed ? '' : 'ยังไม่ได้กรอกแบบสอบถามสุขภาพ'}
                    >
                      ข้อมูลสุขภาพ
                    </button>{' '}
                    <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={() => openEditor(row.employee_id)}>
                      จัดการ
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </TableScroll>
      </ListState>
    </>
  );
}
