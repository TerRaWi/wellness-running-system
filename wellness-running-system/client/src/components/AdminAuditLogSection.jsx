import { Fragment, useEffect, useState } from 'react';
import ThaiDatePicker from './ThaiDatePicker';

// แท็บ "ประวัติการใช้งาน" (audit log) — อ่านอย่างเดียว ข้อมูลมาจาก server/audit.js
// การเปิดดู/ดาวน์โหลดหน้านี้ถูกบันทึกลง audit log ด้วยเช่นกัน

const TARGET_LABELS = {
  EMPLOYEE: 'พนักงาน',
  CAMPAIGN: 'รอบติดตามผล',
  SUBMISSION: 'กิจกรรมที่ส่ง',
  REDEEM: 'การแลกรางวัล',
  CHALLENGE: 'ชาเลนจ์',
  BADGE: 'เหรียญตรา',
  CATEGORY: 'หมวดหมู่กิจกรรม',
  ACTIVITY_TYPE: 'ประเภทกิจกรรม',
  REWARD: 'ของรางวัล',
};

const RESULT_BADGE = { SUCCESS: 'ws-badge-success', FAILURE: 'ws-badge-danger', BLOCKED: 'ws-badge-warning' };
const CATEGORY_BADGE = { AUTH: 'ws-badge-info', DATA_CHANGE: 'ws-badge-accent', DATA_ACCESS: 'ws-badge-neutral', EXPORT: 'ws-badge-warning' };

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// วันเวลาแบบไทยถึงหลักวินาที (log ต้องละเอียดกว่าหน้าอื่น)
function thaiDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear() + 543} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function DetailView({ row }) {
  const detail = row.detail || {};
  const { changes, ...rest } = detail;
  const entries = Object.entries(rest);
  return (
    <div style={{ fontSize: 13, display: 'grid', gap: 6 }}>
      {changes && Object.keys(changes).length > 0 && (
        <div>
          <strong>ค่าที่เปลี่ยน</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
            {Object.entries(changes).map(([field, c]) => (
              <li key={field}>
                <code>{field}</code>: {formatValue(c.from)} → {formatValue(c.to)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {changes && Object.keys(changes).length === 0 && <div>บันทึกแล้วแต่ไม่มีค่าใดเปลี่ยน</div>}
      {entries.map(([k, v]) => (
        <div key={k}>
          <code>{k}</code>: {formatValue(v)}
        </div>
      ))}
      <div style={{ color: 'var(--ws-text-secondary)' }}>
        IP: {row.ip || '-'} · HTTP {row.http_status || '-'} · {row.user_agent || 'ไม่ทราบอุปกรณ์'}
      </div>
    </div>
  );
}

// initialEmployeeId: เปิดมาจากหน้าข้อมูลพนักงาน ("ดูประวัติของคนนี้") → กรองคนนั้น ทุกช่วงเวลา
export default function AdminAuditLogSection({ apiBase, fetchOptions, initialEmployeeId = '' }) {
  const [filters, setFilters] = useState({
    from: initialEmployeeId ? '' : isoDaysAgo(6),
    to: isoDaysAgo(0),
    category: '',
    result: '',
    action: '',
    employeeId: initialEmployeeId,
  });
  // ช่องรหัสพนักงานพิมพ์ทีละตัว — ค้นหาเมื่อกดปุ่ม/Enter ไม่ยิง API ทุกตัวอักษร
  const [employeeIdInput, setEmployeeIdInput] = useState(initialEmployeeId);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [labels, setLabels] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  function buildQuery(extra = {}) {
    const params = new URLSearchParams();
    Object.entries({ ...filters, ...extra }).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) params.set(k, v);
    });
    return params.toString();
  }

  const rangeValid = !filters.from || !filters.to || filters.from <= filters.to;

  useEffect(() => {
    if (!rangeValid) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${apiBase}/api/admin/audit-logs?${buildQuery({ page })}`, fetchOptions());
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || 'โหลดประวัติการใช้งานไม่สำเร็จ');
        if (cancelled) return;
        setData(body);
        setLabels(body.labels);
      } catch (err) {
        if (!cancelled) setError(err.message || 'เกิดข้อผิดพลาด');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, reloadKey]);

  function updateFilters(patch) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
    setExpandedId(null);
  }

  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/api/admin/audit-logs/export?${buildQuery()}`, fetchOptions());
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'สร้างไฟล์ Excel ไม่สำเร็จ');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ประวัติการใช้งาน_${filters.from || 'ทั้งหมด'}_ถึง_${filters.to || 'ล่าสุด'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setExporting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const actionLabel = (a) => labels?.actions?.[a] || a;

  return (
    <div style={{ textAlign: 'left' }}>
      <div className="ws-card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="ws-row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label className="ws-label" htmlFor="auditFrom">ตั้งแต่</label>
            <ThaiDatePicker id="auditFrom" value={filters.from} max={filters.to || undefined} onChange={(v) => updateFilters({ from: v })} />
          </div>
          <div>
            <label className="ws-label" htmlFor="auditTo">ถึง</label>
            <ThaiDatePicker id="auditTo" value={filters.to} min={filters.from || undefined} onChange={(v) => updateFilters({ to: v })} />
          </div>
          <div>
            <label className="ws-label" htmlFor="auditCategory">หมวด</label>
            <select id="auditCategory" className="ws-select" value={filters.category} onChange={(ev) => updateFilters({ category: ev.target.value, action: '' })}>
              <option value="">ทุกหมวด</option>
              {Object.entries(labels?.categories || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="ws-label" htmlFor="auditAction">การกระทำ</label>
            <select id="auditAction" className="ws-select" value={filters.action} onChange={(ev) => updateFilters({ action: ev.target.value })}>
              <option value="">ทั้งหมด</option>
              {Object.entries(labels?.actions || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="ws-label" htmlFor="auditResult">ผลลัพธ์</label>
            <select id="auditResult" className="ws-select" value={filters.result} onChange={(ev) => updateFilters({ result: ev.target.value })}>
              <option value="">ทั้งหมด</option>
              {Object.entries(labels?.results || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <form
            onSubmit={(ev) => { ev.preventDefault(); updateFilters({ employeeId: employeeIdInput.trim() }); }}
            style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}
          >
            <div>
              <label className="ws-label" htmlFor="auditEmployeeId">รหัสพนักงาน (ผู้ทำ/ผู้ถูกกระทำ)</label>
              <input
                id="auditEmployeeId"
                className="ws-input"
                value={employeeIdInput}
                onChange={(ev) => setEmployeeIdInput(ev.target.value)}
                placeholder="เช่น EMP0122"
                style={{ width: 160 }}
              />
            </div>
            <button type="submit" className="ws-btn ws-btn-secondary">ค้นหา</button>
          </form>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="ws-btn ws-btn-secondary" onClick={() => setReloadKey((k) => k + 1)} disabled={loading}>รีเฟรช</button>
            <button className="ws-btn ws-btn-primary" onClick={handleExport} disabled={!rangeValid || exporting}>
              {exporting ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลด Excel'}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ws-text-secondary)', marginTop: 10 }}>
          ประวัติแก้ไขหรือลบไม่ได้ ระบบเก็บไว้อย่างน้อย 90 วันตาม พ.ร.บ.คอมพิวเตอร์ · การเปิดดูหน้านี้ก็ถูกบันทึกด้วย
        </div>
        {!rangeValid && <div className="ws-alert ws-alert-danger" style={{ marginTop: 12 }}>วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด</div>}
        {error && <div className="ws-alert ws-alert-danger" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {loading && !data && <p className="ws-empty">กำลังโหลด...</p>}
      {data && data.rows.length === 0 && <p className="ws-empty">ไม่พบประวัติในเงื่อนไขนี้</p>}

      {data && data.rows.length > 0 && (
        <div style={{ opacity: loading ? 0.6 : 1 }}>
          <div className="ws-row-between" style={{ marginBottom: 8, fontSize: 14 }}>
            <span>ทั้งหมด {data.total.toLocaleString('th-TH')} รายการ</span>
            <span>หน้า {data.page} / {totalPages}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ws-table">
              <thead>
                <tr>
                  <th>วันเวลา</th>
                  <th>ผู้กระทำ</th>
                  <th>การกระทำ</th>
                  <th>เป้าหมาย</th>
                  <th>ผลลัพธ์</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const expanded = expandedId === r.log_id;
                  return (
                    <Fragment key={r.log_id}>
                      <tr>
                        <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{thaiDateTime(r.occurred_at)}</td>
                        <td>
                          <div>{r.actor_name || r.actor_id || labels?.actors?.[r.actor_type] || r.actor_type}</div>
                          <div style={{ fontSize: 12, color: 'var(--ws-text-secondary)' }}>
                            {labels?.actors?.[r.actor_type] || r.actor_type}{r.actor_name && r.actor_id ? ` · ${r.actor_id}` : ''}
                          </div>
                        </td>
                        <td>
                          <div>{actionLabel(r.action)}</div>
                          <span className={`ws-badge ${CATEGORY_BADGE[r.category] || 'ws-badge-neutral'}`} style={{ fontSize: 11 }}>
                            {labels?.categories?.[r.category] || r.category}
                          </span>
                        </td>
                        <td>
                          {r.target_id ? (
                            <>
                              <div>{r.target_name || `#${r.target_id}`}</div>
                              <div style={{ fontSize: 12, color: 'var(--ws-text-secondary)' }}>
                                {TARGET_LABELS[r.target_type] || r.target_type}{r.target_name ? ` · ${r.target_id}` : ''}
                              </div>
                            </>
                          ) : '-'}
                        </td>
                        <td>
                          <span className={`ws-badge ${RESULT_BADGE[r.result] || 'ws-badge-neutral'}`}>
                            {labels?.results?.[r.result] || r.result}
                          </span>
                        </td>
                        <td>
                          <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={() => setExpandedId(expanded ? null : r.log_id)}>
                            {expanded ? 'ซ่อน' : 'รายละเอียด'}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={6} style={{ background: 'var(--ws-bg)' }}>
                            <DetailView row={r} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="ws-row" style={{ justifyContent: 'center', marginTop: 12, gap: 8 }}>
            <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading}>ก่อนหน้า</button>
            <span style={{ fontSize: 14 }}>หน้า {data.page} / {totalPages}</span>
            <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages || loading}>ถัดไป</button>
          </div>
        </div>
      )}
    </div>
  );
}
