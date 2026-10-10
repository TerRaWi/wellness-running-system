import { useEffect, useState } from 'react';
import ThaiDatePicker from './ThaiDatePicker';
import { formatDateTimeShort } from '../utils/formatDateTime';

// ฟอร์มเพิ่ม/แก้ไขพนักงาน ในแท็บ "ข้อมูลพนักงาน" (API อยู่ที่ server/employees.js)
// employeeId = null → เพิ่มพนักงานใหม่, มีค่า → แก้ไข + ปุ่มปิดใช้งาน/ยกเลิกผูก LINE/ลบ

const NEW_DEPARTMENT = '__new__';
const LINE_STATUS_LABELS = { ACTIVE: 'ผูกอยู่', INACTIVE: 'ไม่ได้ใช้งาน', REVOKED: 'ยกเลิกแล้ว' };

function isValidThaiNationalId(id) {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// onCreated(id): เพิ่มสำเร็จ → เปิดหน้าแก้ไขของคนที่เพิ่งเพิ่ม พร้อมข้อความแจ้งรหัสที่ได้ (initialNotice)
export default function AdminEmployeeEditor({ apiBase, fetchOptions, employeeId, adminId, onClose, onCreated, onOpenHistory, initialNotice = '' }) {
  const isNew = !employeeId;
  const [departments, setDepartments] = useState([]);
  const [info, setInfo] = useState(null); // { employee, lineAccounts, related, canDelete }
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ employeeId: '', fullName: '', department: '', newDepartment: '', nationalId: '', dateOfBirth: '' });
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialNotice);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const depRes = await fetch(`${apiBase}/api/admin/employees/departments`, fetchOptions());
        const depData = await depRes.json().catch(() => []);
        if (!cancelled && depRes.ok) setDepartments(depData);

        if (isNew) {
          // รหัสพนักงานระบบกำหนดเอง — แสดงให้เห็นก่อนว่าจะได้รหัสอะไร
          const idRes = await fetch(`${apiBase}/api/admin/employees/next-id`, fetchOptions());
          const idData = await idRes.json().catch(() => ({}));
          if (!cancelled && idRes.ok) setForm((prev) => ({ ...prev, employeeId: idData.employeeId }));
          return;
        }
        setLoading(true);
        const res = await fetch(`${apiBase}/api/admin/employees/${encodeURIComponent(employeeId)}`, fetchOptions());
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'โหลดข้อมูลพนักงานไม่สำเร็จ');
        if (cancelled) return;
        setInfo(data);
        setForm({
          employeeId: data.employee.employee_id,
          fullName: data.employee.full_name || '',
          department: data.employee.department || '',
          newDepartment: '',
          nationalId: '',
          dateOfBirth: data.employee.date_of_birth || '',
        });
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'เกิดข้อผิดพลาด');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, reloadKey]);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const nationalIdDigits = form.nationalId.replace(/[\s-]/g, '');
  const nationalIdInvalid = nationalIdDigits.length > 0 && !isValidThaiNationalId(nationalIdDigits);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    const department = form.department === NEW_DEPARTMENT ? form.newDepartment.trim() : form.department;
    if (form.department === NEW_DEPARTMENT && !department) {
      setError('กรุณาพิมพ์ชื่อแผนกใหม่');
      return;
    }
    if (nationalIdInvalid) {
      setError('เลขบัตรประชาชนไม่ถูกต้อง');
      return;
    }

    setSaving(true);
    try {
      const body = { fullName: form.fullName, department, dateOfBirth: form.dateOfBirth || null };
      if (nationalIdDigits) body.nationalId = nationalIdDigits;
      const res = await fetch(
        isNew ? `${apiBase}/api/admin/employees` : `${apiBase}/api/admin/employees/${encodeURIComponent(employeeId)}`,
        fetchOptions({
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'บันทึกไม่สำเร็จ');
      if (isNew) onCreated(data.employeeId);
      else onClose(true);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action, { method = 'POST', confirmText, doneText, closeAfter = false }) {
    if (!window.confirm(confirmText)) return;
    setActioning(action);
    setError('');
    setNotice('');
    try {
      const url = action === 'delete'
        ? `${apiBase}/api/admin/employees/${encodeURIComponent(employeeId)}`
        : `${apiBase}/api/admin/employees/${encodeURIComponent(employeeId)}/${action}`;
      const res = await fetch(url, fetchOptions({ method }));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
      if (closeAfter) {
        onClose(true);
        return;
      }
      setNotice(doneText);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActioning('');
    }
  }

  const emp = info?.employee;
  const isSelf = emp && emp.employee_id === adminId;
  const activeLine = info?.lineAccounts?.find((a) => a.status === 'ACTIVE');
  const departmentInList = departments.some((d) => d.department === form.department);

  return (
    <div style={{ textAlign: 'left' }}>
      <button className="ws-btn ws-btn-ghost ws-btn-sm" style={{ marginBottom: 16, marginLeft: -14 }} onClick={() => onClose(false)}>
        ← รายชื่อพนักงาน
      </button>

      {loading && <p className="ws-empty">กำลังโหลด...</p>}
      {loadError && <div className="ws-alert ws-alert-danger">{loadError}</div>}

      {!loading && !loadError && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
          <form className="ws-card" style={{ padding: 16 }} onSubmit={handleSave}>
            <h3 style={{ marginTop: 0 }}>{isNew ? 'เพิ่มพนักงาน' : 'แก้ไขข้อมูลพนักงาน'}</h3>

            <div style={{ marginBottom: 12 }}>
              <label className="ws-label" htmlFor="empId">รหัสพนักงาน</label>
              <input id="empId" className="ws-input" value={form.employeeId} placeholder="กำลังคำนวณ..." disabled readOnly />
              <div style={{ fontSize: 12, color: 'var(--ws-text-muted)', marginTop: 4 }}>
                {isNew
                  ? 'ระบบกำหนดให้อัตโนมัติ ต่อจากรหัสล่าสุดในฐานข้อมูล (ถ้ามีแอดมินอื่นเพิ่มพร้อมกัน รหัสอาจเลื่อนไป)'
                  : 'รหัสพนักงานแก้ไม่ได้ เพราะข้อมูลทุกส่วนผูกกับรหัสนี้'}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="ws-label" htmlFor="empName">ชื่อ-สกุล</label>
              <input id="empName" className="ws-input" value={form.fullName} onChange={(e) => update({ fullName: e.target.value })} required maxLength={150} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="ws-label" htmlFor="empDept">แผนก/ตำแหน่ง</label>
              <select
                id="empDept"
                className="ws-select"
                value={form.department}
                onChange={(e) => update({ department: e.target.value })}
              >
                <option value="">-- ไม่ระบุ --</option>
                {/* ค่าเดิมที่ไม่อยู่ในรายการ (กันหาย) */}
                {form.department && form.department !== NEW_DEPARTMENT && !departmentInList && (
                  <option value={form.department}>{form.department}</option>
                )}
                {departments.map((d) => (
                  <option key={d.department} value={d.department}>{d.department} ({d.employee_count})</option>
                ))}
                <option value={NEW_DEPARTMENT}>+ เพิ่มแผนกใหม่...</option>
              </select>
              {form.department === NEW_DEPARTMENT && (
                <input
                  className="ws-input"
                  style={{ marginTop: 8 }}
                  value={form.newDepartment}
                  onChange={(e) => update({ newDepartment: e.target.value })}
                  placeholder="พิมพ์ชื่อแผนกใหม่ (ตรวจตัวสะกดให้ดี)"
                  maxLength={100}
                />
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="ws-label" htmlFor="empNationalId">
                เลขบัตรประชาชน {isNew ? '' : '(เว้นว่าง = ไม่เปลี่ยน)'}
              </label>
              <input
                id="empNationalId"
                className="ws-input"
                inputMode="numeric"
                autoComplete="off"
                value={form.nationalId}
                onChange={(e) => update({ nationalId: e.target.value.replace(/[^\d\s-]/g, '') })}
                placeholder={isNew ? '13 หลัก' : emp?.has_national_id ? 'มีในระบบแล้ว (ไม่แสดง)' : 'ยังไม่มีในระบบ'}
                required={isNew}
                maxLength={17}
              />
              {nationalIdInvalid && nationalIdDigits.length >= 13 && (
                <div style={{ fontSize: 12, color: 'var(--ws-danger)', marginTop: 4 }}>เลขบัตรประชาชนไม่ถูกต้อง</div>
              )}
              <div style={{ fontSize: 12, color: 'var(--ws-text-muted)', marginTop: 4 }}>
                ใช้ยืนยันตัวตนตอนพนักงานผูก LINE · ระบบเก็บแบบเข้ารหัส ดูย้อนหลังไม่ได้
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="ws-label" htmlFor="empDob">วันเกิด (ถ้ามี)</label>
              <ThaiDatePicker id="empDob" value={form.dateOfBirth} max={todayIso()} onChange={(v) => update({ dateOfBirth: v })} />
            </div>

            {error && <div className="ws-alert ws-alert-danger">{error}</div>}
            {notice && <div className="ws-alert ws-alert-success">{notice}</div>}

            <div className="ws-row" style={{ gap: 8, marginTop: 8 }}>
              <button type="submit" className="ws-btn ws-btn-primary" disabled={saving}>
                {saving ? 'กำลังบันทึก...' : isNew ? 'เพิ่มพนักงาน' : 'บันทึก'}
              </button>
              <button type="button" className="ws-btn ws-btn-ghost" onClick={() => onClose(false)} disabled={saving}>ยกเลิก</button>
            </div>
          </form>

          {!isNew && emp && (
            <div className="ws-card" style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>สถานะและการจัดการ</h3>
              <div className="ws-stack" style={{ gap: 8, fontSize: 14 }}>
                <div className="ws-row-between">
                  <span>สถานะพนักงาน</span>
                  <span className={`ws-badge ${emp.employment_status === 'ACTIVE' ? 'ws-badge-success' : 'ws-badge-neutral'}`}>
                    {emp.employment_status === 'ACTIVE' ? 'ใช้งานอยู่' : 'ปิดใช้งาน (ลาออก)'}
                  </span>
                </div>
                <div className="ws-row-between">
                  <span>บัญชี LINE</span>
                  <span>
                    {activeLine
                      ? <>ผูกอยู่{activeLine.display_name ? ` (${activeLine.display_name})` : ''}</>
                      : 'ยังไม่ผูก'}
                  </span>
                </div>
                {activeLine?.last_login && (
                  <div className="ws-row-between">
                    <span>เข้าใช้ล่าสุด</span>
                    <span>{formatDateTimeShort(activeLine.last_login)}</span>
                  </div>
                )}
                {emp.role === 'ADMIN' && (
                  <div className="ws-row-between">
                    <span>สิทธิ์</span>
                    <span className="ws-badge ws-badge-accent">แอดมิน</span>
                  </div>
                )}
                {info.lineAccounts.filter((a) => a.status !== 'ACTIVE').length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--ws-text-muted)' }}>
                    ประวัติบัญชี LINE: {info.lineAccounts.filter((a) => a.status !== 'ACTIVE')
                      .map((a) => `${a.display_name || 'ไม่ทราบชื่อ'} (${LINE_STATUS_LABELS[a.status] || a.status})`).join(', ')}
                  </div>
                )}
              </div>

              <hr style={{ border: 0, borderTop: '1px solid var(--ws-border)', margin: '16px 0' }} />

              <div className="ws-stack" style={{ gap: 12 }}>
                {emp.employment_status === 'ACTIVE' ? (
                  <div>
                    <button
                      className="ws-btn ws-btn-secondary"
                      disabled={isSelf || !!actioning}
                      onClick={() => runAction('deactivate', {
                        confirmText: `ยืนยันปิดใช้งาน ${emp.full_name} (ลาออก)?\nพนักงานจะเข้าแอปไม่ได้ทันที บัญชี LINE และสิทธิ์แอดมิน (ถ้ามี) จะถูกยกเลิก ข้อมูลเดิมยังเก็บไว้`,
                        doneText: 'ปิดใช้งานแล้ว',
                      })}
                    >
                      {actioning === 'deactivate' ? 'กำลังดำเนินการ...' : 'ปิดใช้งาน (ลาออก)'}
                    </button>
                    <div style={{ fontSize: 12, color: 'var(--ws-text-muted)', marginTop: 4 }}>
                      {isSelf ? 'ปิดใช้งานบัญชีของตัวเองไม่ได้' : 'เข้าแอปไม่ได้ทันที แต่ข้อมูลและประวัติยังอยู่ เปิดใช้งานกลับได้'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      className="ws-btn ws-btn-primary"
                      disabled={!!actioning}
                      onClick={() => runAction('reactivate', {
                        confirmText: `ยืนยันเปิดใช้งาน ${emp.full_name} อีกครั้ง?\nพนักงานต้องผูก LINE ใหม่ด้วยเลขบัตรประชาชน`,
                        doneText: 'เปิดใช้งานแล้ว — พนักงานต้องผูก LINE ใหม่ด้วยเลขบัตรประชาชน',
                      })}
                    >
                      {actioning === 'reactivate' ? 'กำลังดำเนินการ...' : 'เปิดใช้งานอีกครั้ง'}
                    </button>
                  </div>
                )}

                {activeLine && (
                  <div>
                    <button
                      className="ws-btn ws-btn-secondary"
                      disabled={!!actioning}
                      onClick={() => runAction('unlink-line', {
                        confirmText: `ยืนยันยกเลิกการผูก LINE ของ ${emp.full_name}?\nพนักงานจะถูกออกจากระบบ และต้องผูกใหม่ด้วยเลขบัตรประชาชน`,
                        doneText: 'ยกเลิกการผูก LINE แล้ว',
                      })}
                    >
                      {actioning === 'unlink-line' ? 'กำลังดำเนินการ...' : 'ยกเลิกการผูก LINE'}
                    </button>
                    <div style={{ fontSize: 12, color: 'var(--ws-text-muted)', marginTop: 4 }}>ใช้เมื่อพนักงานเปลี่ยนเครื่อง/เปลี่ยนบัญชี LINE หรือผูกผิดคน</div>
                  </div>
                )}

                <div>
                  <button className="ws-btn ws-btn-ghost" onClick={() => onOpenHistory(emp.employee_id)}>
                    ดูประวัติการแก้ไข/เข้าถึงข้อมูลของคนนี้ →
                  </button>
                </div>

                <div>
                  <button
                    className="ws-btn ws-btn-ghost"
                    style={{ color: info.canDelete && !isSelf ? 'var(--ws-danger)' : undefined }}
                    disabled={!info.canDelete || isSelf || !!actioning}
                    onClick={() => runAction('delete', {
                      method: 'DELETE',
                      confirmText: `ยืนยันลบ ${emp.full_name} (${emp.employee_id}) ออกจากระบบถาวร?\nกู้คืนไม่ได้`,
                      closeAfter: true,
                    })}
                  >
                    {actioning === 'delete' ? 'กำลังลบ...' : 'ลบถาวร'}
                  </button>
                  <div style={{ fontSize: 12, color: 'var(--ws-text-muted)', marginTop: 4 }}>
                    {info.canDelete
                      ? 'ใช้กับคนที่เพิ่มผิด/ซ้ำเท่านั้น ยังไม่มีข้อมูลผูกอยู่'
                      : `ลบไม่ได้ เพราะมีข้อมูลผูกอยู่ (${info.related.map((r) => `${r.label} ${r.count}`).join(', ')}) — ถ้าลาออกให้ใช้ปิดใช้งาน`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
