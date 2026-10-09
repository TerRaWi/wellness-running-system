import { useEffect, useState } from 'react';
import ThaiDatePicker from './ThaiDatePicker';

// แท็บ "รายงาน" สำหรับผู้บริหาร — ข้อมูลคำนวณทั้งหมดอยู่ฝั่ง server (server/reports.js)
// หน้านี้แสดงเฉพาะตัวเลขรวม ส่วนรายชื่อรายคน (เฉพาะกิจกรรม/คะแนน) ออกได้ทางไฟล์ Excel เท่านั้น

const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// ไตรมาสตามปีงบประมาณราชการ (ต.ค.–ก.ย.) — เดือนเริ่ม/จบเป็น index 1-12 ของปี ค.ศ.
const FISCAL_QUARTERS = [
  { value: 1, label: 'ไตรมาส 1 (ต.ค.–ธ.ค.)', startMonth: 10, endMonth: 12, prevYear: true },
  { value: 2, label: 'ไตรมาส 2 (ม.ค.–มี.ค.)', startMonth: 1, endMonth: 3 },
  { value: 3, label: 'ไตรมาส 3 (เม.ย.–มิ.ย.)', startMonth: 4, endMonth: 6 },
  { value: 4, label: 'ไตรมาส 4 (ก.ค.–ก.ย.)', startMonth: 7, endMonth: 9 },
];

const MONTHLY_METRICS = [
  { key: 'participants', label: 'ผู้ร่วมกิจกรรม', unit: 'คน' },
  { key: 'submissions', label: 'จำนวนกิจกรรม', unit: 'ครั้ง' },
  { key: 'distanceKm', label: 'ระยะทาง', unit: 'กม.' },
  { key: 'durationHours', label: 'เวลาออกกำลังกาย', unit: 'ชม.' },
];

const GROUP_VIEWS = [
  { key: 'byDepartment', label: 'แผนก' },
  { key: 'byJobPosition', label: 'ตำแหน่ง' },
  { key: 'byShift', label: 'ลักษณะเวร' },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// ปีงบประมาณ (พ.ศ.) ของวันนี้: ตั้งแต่ ต.ค. นับเป็นปีงบถัดไป
function currentFiscalYearBE() {
  const now = new Date();
  return now.getFullYear() + 543 + (now.getMonth() >= 9 ? 1 : 0);
}

// ค่าเริ่มต้นของหน้า: เดือนแรกของปีงบใหม่ (ต.ค.) ยังแทบไม่มีข้อมูล และเป็นช่วงสรุปผลปีที่แล้ว
// จึงเปิดมาที่ปีงบที่เพิ่งจบไปแทน
function defaultFiscalYearBE() {
  return currentFiscalYearBE() - (new Date().getMonth() === 9 ? 1 : 0);
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

function currentFiscalQuarter() {
  const m = new Date().getMonth() + 1;
  return FISCAL_QUARTERS.find((q) => (q.prevYear ? m >= 10 : m >= q.startMonth && m <= q.endMonth)).value;
}

// แปลงตัวเลือกช่วงเวลาเป็น { from, to } แบบ YYYY-MM-DD (ค.ศ.) ที่ API ต้องการ
function resolveRange(period) {
  const fyCE = period.fiscalYear - 543; // ปีงบ 2570 = 1 ต.ค. 2026 – 30 ก.ย. 2027
  if (period.type === 'fiscalYear') {
    return { from: `${fyCE - 1}-10-01`, to: `${fyCE}-09-30` };
  }
  if (period.type === 'quarter') {
    const q = FISCAL_QUARTERS.find((x) => x.value === period.quarter);
    const year = q.prevYear ? fyCE - 1 : fyCE;
    return {
      from: `${year}-${pad2(q.startMonth)}-01`,
      to: `${year}-${pad2(q.endMonth)}-${lastDayOfMonth(year, q.endMonth)}`,
    };
  }
  if (period.type === 'month') {
    if (!period.month) return null;
    const [y, m] = period.month.split('-').map(Number);
    return { from: `${period.month}-01`, to: `${period.month}-${lastDayOfMonth(y, m)}` };
  }
  if (!period.from || !period.to || period.from > period.to) return null;
  return { from: period.from, to: period.to };
}

function thaiDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${TH_MONTHS[m - 1]} ${y + 543}`;
}

function thaiMonthShort(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return `${TH_MONTHS[m - 1]} ${String(y + 543).slice(2)}`;
}

function fmt(n, digits = 0) {
  if (n === null || n === undefined) return '-';
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function fmtPct(n) {
  return n === null || n === undefined ? '-' : `${fmt(n, 1)}%`;
}

// แถบ % แนวนอนในตาราง — ตัวเลขยังแสดงเป็นข้อความเสมอ แถบเป็นแค่ตัวช่วยกวาดตา
function PctBar({ value, color = 'var(--ws-primary)' }) {
  const width = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
      <div style={{ flex: 1, height: 8, background: 'var(--ws-bg)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ minWidth: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtPct(value)}</span>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="ws-stat-card">
      <div className="ws-stat-label">{label}</div>
      <div className="ws-stat-value">{value}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--ws-text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// กราฟแท่งรายเดือน (series เดียว) — hover ที่คอลัมน์ไหนก็ได้เพื่อดูตัวเลขของเดือนนั้น
function MonthlyBarChart({ months, metric }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  if (months.length === 0) return <p className="ws-empty">ไม่มีข้อมูลในช่วงเวลานี้</p>;

  const width = 720;
  const height = 220;
  const padL = 44;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const values = months.map((m) => m[metric.key]);
  const rawMax = Math.max(...values, 0);
  // ปัดเพดานแกน y เป็นเลขกลมๆ (1/2/5 x 10^n ต่อช่อง, 4 ช่อง) ให้เส้น grid อ่านง่าย
  let step = 1;
  if (rawMax > 4) {
    const mag = 10 ** Math.floor(Math.log10(rawMax / 4));
    step = [1, 2, 5, 10].find((s) => s * mag * 4 >= rawMax) * mag;
  }
  const yMax = step * 4;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const slot = plotW / months.length;
  const barW = Math.max(6, Math.min(48, slot - 8));
  const y = (v) => padT + plotH - (v / yMax) * plotH;
  const ticks = [0, 1, 2, 3, 4].map((i) => (yMax / 4) * i);
  const hovered = hoverIdx !== null ? months[hoverIdx] : null;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ minHeight: 22, fontSize: 14, color: 'var(--ws-text-secondary)' }}>
        {hovered
          ? <>{thaiMonthShort(hovered.month)}: <strong style={{ color: 'var(--ws-text)' }}>{fmt(hovered[metric.key], 1)} {metric.unit}</strong></>
          : 'ชี้ที่แท่งเพื่อดูตัวเลขของแต่ละเดือน'}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={`${metric.label}รายเดือน: ${months.map((m) => `${thaiMonthShort(m.month)} ${m[metric.key]} ${metric.unit}`).join(', ')}`}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--ws-border)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ws-text-muted)">{fmt(t, 1)}</text>
          </g>
        ))}
        {months.map((m, i) => {
          const v = m[metric.key];
          const x = padL + slot * i + (slot - barW) / 2;
          const top = y(v);
          const h = padT + plotH - top;
          const r = Math.min(4, h);
          return (
            <g key={m.month} onMouseEnter={() => setHoverIdx(i)}>
              {/* พื้นที่ hover ทั้งคอลัมน์ ใหญ่กว่าแท่งจริง */}
              <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill={hoverIdx === i ? 'var(--ws-primary-light)' : 'transparent'} />
              {v > 0 && (
                <path
                  d={`M ${x} ${top + h} V ${top + r} Q ${x} ${top} ${x + r} ${top} H ${x + barW - r} Q ${x + barW} ${top} ${x + barW} ${top + r} V ${top + h} Z`}
                  fill="var(--ws-primary)"
                />
              )}
              {(months.length <= 12 || i % Math.ceil(months.length / 12) === 0) && (
                <text x={padL + slot * i + slot / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--ws-text-muted)">
                  {thaiMonthShort(m.month)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SectionTitle({ children, note }) {
  return (
    <div style={{ margin: '32px 0 12px' }}>
      <h3 style={{ margin: 0 }}>{children}</h3>
      {note && <div style={{ fontSize: 13, color: 'var(--ws-text-secondary)', marginTop: 4 }}>{note}</div>}
    </div>
  );
}

// ตารางการกระจายตัว Baseline เทียบล่าสุด ของตัวชี้วัดสุขภาพหนึ่งตัว
function DistributionCard({ dist }) {
  return (
    <div className="ws-card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{dist.title}</div>
      <table className="ws-table" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th>หมวด</th>
            <th style={{ width: 150 }}>Baseline <span style={{ fontWeight: 400 }}>(n={dist.baselineN})</span></th>
            <th style={{ width: 150 }}>ล่าสุด <span style={{ fontWeight: 400 }}>(n={dist.latestN})</span></th>
          </tr>
        </thead>
        <tbody>
          {dist.rows.map((r) => (
            <tr key={r.key || r.label}>
              <td>{r.label}</td>
              <td><PctBar value={r.baselinePct} color="var(--ws-border-strong)" /></td>
              <td><PctBar value={r.latestPct} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangeCard({ title, data, render, minGroupSize }) {
  return (
    <div className="ws-stat-card">
      <div className="ws-stat-label">{title}</div>
      {data.suppressed
        ? <div style={{ fontSize: 14, color: 'var(--ws-text-secondary)', marginTop: 8 }}>ข้อมูลเปรียบเทียบยังไม่พอ (ต้องมีผู้ตอบทั้ง Baseline และติดตามผลอย่างน้อย {minGroupSize} คน)</div>
        : render(data)}
    </div>
  );
}

export default function AdminReportSection({ apiBase, fetchOptions }) {
  const [period, setPeriod] = useState(() => ({
    type: 'fiscalYear',
    fiscalYear: defaultFiscalYearBE(),
    quarter: currentFiscalQuarter(),
    month: currentMonthValue(),
    from: '',
    to: '',
  }));
  const [department, setDepartment] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [monthlyMetric, setMonthlyMetric] = useState(MONTHLY_METRICS[0].key);
  const [groupView, setGroupView] = useState(GROUP_VIEWS[0].key);

  const range = resolveRange(period);
  const fiscalYearOptions = [];
  for (let fy = currentFiscalYearBE(); fy >= 2568; fy -= 1) fiscalYearOptions.push(fy);
  const calendarYearOptions = [];
  for (let y = new Date().getFullYear(); y >= 2025; y -= 1) calendarYearOptions.push(y);

  function buildQuery() {
    const qs = new URLSearchParams({ from: range.from, to: range.to });
    if (department) qs.set('department', department);
    return qs.toString();
  }

  useEffect(() => {
    if (!range) return undefined;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${apiBase}/api/admin/reports/summary?${buildQuery()}`, fetchOptions());
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'โหลดข้อมูลรายงานไม่สำเร็จ');
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'เกิดข้อผิดพลาด');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to, department]);

  async function handleExport() {
    if (!range) return;
    setExporting(true);
    setExportError('');
    try {
      const res = await fetch(`${apiBase}/api/admin/reports/export?${buildQuery()}`, fetchOptions());
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'สร้างไฟล์ Excel ไม่สำเร็จ');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `รายงานสุขภาพบุคลากร_${range.from}_ถึง_${range.to}${department ? `_${department}` : ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setExporting(false);
    }
  }

  const updatePeriod = (patch) => setPeriod((prev) => ({ ...prev, ...patch }));
  const metric = MONTHLY_METRICS.find((m) => m.key === monthlyMetric);
  const e = report?.engagement;
  const h = report?.health;

  return (
    // ws-app จัดข้อความกึ่งกลางเป็นค่าเริ่มต้น แต่หน้ารายงานเป็นตาราง/ตัวเลขจำนวนมาก อ่านง่ายกว่าเมื่อชิดซ้าย
    <div style={{ textAlign: 'left' }}>
      {/* ---- ตัวกรอง ---- */}
      <div className="ws-card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="ws-row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label className="ws-label" htmlFor="reportPeriodType">ช่วงเวลา</label>
            <select id="reportPeriodType" className="ws-select" value={period.type} onChange={(ev) => {
              // สลับไป "กำหนดเอง" ครั้งแรก: เติมช่วงที่ดูอยู่ให้ก่อน จะได้ไม่ขึ้นหน้าว่างแล้วค่อยปรับวันจากตรงนั้น
              const next = ev.target.value;
              if (next === 'custom' && !period.from && !period.to && range) updatePeriod({ type: next, from: range.from, to: range.to });
              else updatePeriod({ type: next });
            }}>
              <option value="fiscalYear">ปีงบประมาณ</option>
              <option value="quarter">ไตรมาส</option>
              <option value="month">รายเดือน</option>
              <option value="custom">กำหนดเอง</option>
            </select>
          </div>
          {(period.type === 'fiscalYear' || period.type === 'quarter') && (
            <div>
              <label className="ws-label" htmlFor="reportFiscalYear">ปีงบประมาณ</label>
              <select id="reportFiscalYear" className="ws-select" value={period.fiscalYear} onChange={(ev) => updatePeriod({ fiscalYear: Number(ev.target.value) })}>
                {fiscalYearOptions.map((fy) => <option key={fy} value={fy}>{fy}</option>)}
              </select>
            </div>
          )}
          {period.type === 'quarter' && (
            <div>
              <label className="ws-label" htmlFor="reportQuarter">ไตรมาส</label>
              <select id="reportQuarter" className="ws-select" value={period.quarter} onChange={(ev) => updatePeriod({ quarter: Number(ev.target.value) })}>
                {FISCAL_QUARTERS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
              </select>
            </div>
          )}
          {period.type === 'month' && (
            <>
              {/* แยกเป็น dropdown เดือน/ปี พ.ศ. แทน input type=month ที่แสดงภาษาตาม locale ของเครื่อง */}
              <div>
                <label className="ws-label" htmlFor="reportMonth">เดือน</label>
                <select
                  id="reportMonth"
                  className="ws-select"
                  value={Number(period.month.slice(5, 7))}
                  onChange={(ev) => updatePeriod({ month: `${period.month.slice(0, 4)}-${pad2(ev.target.value)}` })}
                >
                  {TH_MONTHS_FULL.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                </select>
              </div>
              <div>
                <label className="ws-label" htmlFor="reportMonthYear">ปี พ.ศ.</label>
                <select
                  id="reportMonthYear"
                  className="ws-select"
                  value={Number(period.month.slice(0, 4))}
                  onChange={(ev) => updatePeriod({ month: `${ev.target.value}-${period.month.slice(5, 7)}` })}
                >
                  {calendarYearOptions.map((y) => <option key={y} value={y}>{y + 543}</option>)}
                </select>
              </div>
            </>
          )}
          {period.type === 'custom' && (
            <>
              <div>
                <label className="ws-label" htmlFor="reportFrom">ตั้งแต่</label>
                <ThaiDatePicker id="reportFrom" value={period.from} max={period.to || undefined} onChange={(v) => updatePeriod({ from: v })} />
              </div>
              <div>
                <label className="ws-label" htmlFor="reportTo">ถึง</label>
                <ThaiDatePicker id="reportTo" value={period.to} min={period.from || undefined} onChange={(v) => updatePeriod({ to: v })} />
              </div>
            </>
          )}
          <div>
            <label className="ws-label" htmlFor="reportDepartment">แผนก</label>
            <select id="reportDepartment" className="ws-select" value={department} onChange={(ev) => setDepartment(ev.target.value)}>
              <option value="">ทุกแผนก</option>
              {(report?.departments || []).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button className="ws-btn ws-btn-primary" onClick={handleExport} disabled={!range || exporting}>
              {exporting ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลด Excel'}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ws-text-secondary)', marginTop: 10 }}>
          {range
            ? <>ข้อมูลช่วง <strong>{thaiDate(range.from)} – {thaiDate(range.to)}</strong> · {department || 'ทุกแผนก'} · นับเฉพาะพนักงานที่ยังปฏิบัติงานอยู่และกิจกรรมที่อนุมัติแล้ว</>
            : 'กรุณาเลือกช่วงวันที่ให้ครบถ้วน'}
        </div>
        {exportError && <div className="ws-alert ws-alert-danger" style={{ marginTop: 12 }}>{exportError}</div>}
      </div>

      {/* โหลดครั้งแรกเท่านั้นที่แสดงข้อความ — ครั้งถัดไปแค่หรี่เนื้อหาเดิม ไม่ให้หน้ากระโดด */}
      {loading && !report && <p className="ws-empty">กำลังโหลด...</p>}
      {error && <div className="ws-alert ws-alert-danger">{error}</div>}

      {report && !error && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity var(--ws-transition)' }}>
          {/* ---- 1. การมีส่วนร่วม + กิจกรรม ---- */}
          <SectionTitle>การมีส่วนร่วมและกิจกรรม</SectionTitle>
          <div className="ws-grid-stats">
            <StatCard label="พนักงานที่ปฏิบัติงานอยู่" value={fmt(e.headcount)} sub="คน" />
            <StatCard label="ผูกบัญชี LINE แล้ว" value={fmtPct(e.linkedPct)} sub={`${fmt(e.linked)} คน`} />
            <StatCard label="ตอบแบบประเมินสุขภาพ Baseline" value={fmtPct(e.baselineDonePct)} sub={`${fmt(e.baselineDone)} คน`} />
            <StatCard label="อัตราการมีส่วนร่วม" value={fmtPct(e.participationPct)} sub={`${fmt(e.participants)} คนส่งกิจกรรมที่อนุมัติ`} />
            <StatCard label="กิจกรรมที่อนุมัติ" value={fmt(e.approvedSubmissions)} sub={`รอตรวจ ${fmt(e.pendingSubmissions)} · ปฏิเสธ ${fmt(e.rejectedSubmissions)}`} />
            <StatCard
              label="ระยะทางรวม"
              value={`${fmt(e.distanceKm, 1)} กม.`}
              sub={`เวลารวม ${fmt(e.durationHours, 1)} ชม. · เฉลี่ย ${fmt(e.avgDistancePerParticipant, 1)} กม./ผู้ร่วม`}
            />
          </div>

          <div className="ws-card" style={{ padding: 16, marginTop: 16 }}>
            <div className="ws-row-between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>แนวโน้มรายเดือน — {metric.label} ({metric.unit})</div>
              <div className="ws-tabs" style={{ margin: 0 }}>
                {MONTHLY_METRICS.map((m) => (
                  <button key={m.key} className={`ws-tab ${monthlyMetric === m.key ? 'active' : ''}`} onClick={() => setMonthlyMetric(m.key)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <MonthlyBarChart months={report.monthly} metric={metric} />
          </div>

          <div className="ws-card" style={{ padding: 16, marginTop: 16 }}>
            <div className="ws-row-between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>การมีส่วนร่วมแยกตามกลุ่ม</div>
              <div className="ws-tabs" style={{ margin: 0 }}>
                {GROUP_VIEWS.map((g) => (
                  <button key={g.key} className={`ws-tab ${groupView === g.key ? 'active' : ''}`} onClick={() => setGroupView(g.key)}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ws-table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>{GROUP_VIEWS.find((g) => g.key === groupView).label}</th>
                    <th>พนักงาน</th>
                    <th>ผูก LINE</th>
                    <th>ผู้ร่วมกิจกรรม</th>
                    <th>อัตราการมีส่วนร่วม</th>
                    <th>กิจกรรม (ครั้ง)</th>
                    <th>ระยะทาง (กม.)</th>
                    <th>เฉลี่ย/คน (กม.)</th>
                  </tr>
                </thead>
                <tbody>
                  {report[groupView].map((g) => (
                    <tr key={g.group}>
                      <td>{g.group}</td>
                      <td>{fmt(g.headcount)}</td>
                      <td>{fmt(g.linked)}</td>
                      <td>{fmt(g.participants)}</td>
                      <td><PctBar value={g.participationPct} /></td>
                      <td>{fmt(g.submissions)}</td>
                      <td>{fmt(g.distanceKm, 1)}</td>
                      <td>{fmt(g.avgDistancePerHead, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ws-card" style={{ padding: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>กิจกรรมแยกตามประเภท</div>
            {report.byActivity.length === 0 ? (
              <p className="ws-empty">ยังไม่มีกิจกรรมที่อนุมัติในช่วงเวลานี้</p>
            ) : (
              <div className="ws-table-wrap">
                <table className="ws-table">
                  <thead>
                    <tr>
                      <th>หมวดหมู่</th>
                      <th>ประเภทกิจกรรม</th>
                      <th>ผู้ร่วม (คน)</th>
                      <th>จำนวน (ครั้ง)</th>
                      <th>ระยะทาง (กม.)</th>
                      <th>เวลา (ชม.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byActivity.map((a) => (
                      <tr key={`${a.category}-${a.activity}`}>
                        <td>{a.category}</td>
                        <td>{a.activity}</td>
                        <td>{fmt(a.participants)}</td>
                        <td>{fmt(a.submissions)}</td>
                        <td>{fmt(a.distanceKm, 1)}</td>
                        <td>{fmt(a.durationHours, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---- 2. ผลลัพธ์สุขภาพ ---- */}
          <SectionTitle note={`ข้อมูลล่าสุด ณ ${thaiDate(report.params.to)} เทียบกับ Baseline · แสดงเฉพาะตัวเลขรวม กลุ่มที่มีผู้ตอบน้อยกว่า ${h.minGroupSize} คนจะไม่แสดงเพื่อคุ้มครองข้อมูลส่วนบุคคล (PDPA)`}>
            ผลลัพธ์สุขภาพ
          </SectionTitle>
          {h.suppressed ? (
            <div className="ws-alert ws-alert-info">
              🔒 ผู้ตอบแบบประเมินในกลุ่มนี้น้อยกว่า {h.minGroupSize} คน จึงไม่แสดงข้อมูลสุขภาพเพื่อป้องกันการระบุตัวบุคคล
            </div>
          ) : (
            <>
              <div className="ws-grid-stats">
                <StatCard label="ผู้ตอบแบบประเมิน Baseline" value={fmt(h.respondents)} sub="คน" />
                <StatCard label="ผู้ตอบแบบติดตามผล" value={fmt(h.change.followupRespondents)} sub="คน (อย่างน้อย 1 รอบ)" />
                <ChangeCard
                  minGroupSize={h.minGroupSize}
                  title="น้ำหนักเปลี่ยนแปลงเฉลี่ย"
                  data={h.change.weight}
                  render={(w) => (
                    <>
                      <div className="ws-stat-value">{w.avgChangeKg > 0 ? '+' : ''}{fmt(w.avgChangeKg, 1)} กก.</div>
                      <div style={{ fontSize: 13, color: 'var(--ws-text-secondary)', marginTop: 4 }}>
                        ลดลง {fmt(w.lost)} จาก {fmt(w.n)} คน · รวม {fmt(w.totalLostKg, 1)} กก.
                      </div>
                    </>
                  )}
                />
                <ChangeCard
                  minGroupSize={h.minGroupSize}
                  title="BMI ขยับเข้าใกล้เกณฑ์ปกติ"
                  data={h.change.bmi}
                  render={(b) => (
                    <>
                      <div className="ws-stat-value">{fmt(b.improved)} คน</div>
                      <div style={{ fontSize: 13, color: 'var(--ws-text-secondary)', marginTop: 4 }}>
                        จาก {fmt(b.n)} คน · คงที่ {fmt(b.same)} · แย่ลง {fmt(b.worse)}
                      </div>
                    </>
                  )}
                />
                <ChangeCard
                  minGroupSize={h.minGroupSize}
                  title="กิจกรรมทางกายถึงเกณฑ์ WHO"
                  data={h.change.met}
                  render={(m) => (
                    <>
                      <div className="ws-stat-value">{fmt(m.baselineAdequate)} → {fmt(m.latestAdequate)} คน</div>
                      <div style={{ fontSize: 13, color: 'var(--ws-text-secondary)', marginTop: 4 }}>
                        เพิ่งถึงเกณฑ์ {fmt(m.becameAdequate)} คน จาก {fmt(m.n)} คน
                      </div>
                    </>
                  )}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 16, marginTop: 16 }}>
                {Object.entries(h.distributions).map(([key, dist]) => <DistributionCard key={key} dist={dist} />)}
                <DistributionCard dist={{ title: 'โรคประจำตัว (ตอบได้มากกว่า 1 โรค)', ...h.chronic }} />
              </div>

              {report.healthByDepartment.length > 0 && (
                <div className="ws-card" style={{ padding: 16, marginTop: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>ตัวชี้วัดสุขภาพรายแผนก (ข้อมูลล่าสุด)</div>
                  <div className="ws-table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                    <table className="ws-table">
                      <thead>
                        <tr>
                          <th>แผนก</th>
                          <th>ผู้ตอบ</th>
                          <th>อ้วน (BMI ≥ 25)</th>
                          <th>รอบเอวเสี่ยง</th>
                          <th>ความดันสูง</th>
                          <th>กิจกรรมทางกายเพียงพอ</th>
                          <th>สูบบุหรี่</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.healthByDepartment.map((g) => (
                          <tr key={g.group}>
                            <td>{g.group}</td>
                            {g.suppressed ? (
                              <>
                                <td>&lt; {h.minGroupSize}</td>
                                <td colSpan={5} style={{ color: 'var(--ws-text-muted)' }}>🔒 ผู้ตอบไม่ถึงเกณฑ์ ไม่แสดงข้อมูล</td>
                              </>
                            ) : (
                              <>
                                <td>{fmt(g.n)}</td>
                                <td>{fmtPct(g.obesePct)}</td>
                                <td>{fmtPct(g.waistRiskPct)}</td>
                                <td>{fmtPct(g.bpHighPct)}</td>
                                <td>{fmtPct(g.metAdequatePct)}</td>
                                <td>{fmtPct(g.smokerPct)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ---- 3. คะแนน + ของรางวัล ---- */}
          <SectionTitle>คะแนนและของรางวัล</SectionTitle>
          <div className="ws-grid-stats">
            <StatCard label="คะแนนที่แจกจากกิจกรรม" value={fmt(report.points.earned)} sub="ในช่วงเวลานี้" />
            <StatCard label="คะแนนที่ใช้แลกของรางวัล" value={fmt(report.points.used)} sub="สุทธิ หลังคืนคะแนนรายการที่ยกเลิก" />
            <StatCard
              label="คะแนนคงเหลือที่ยังไม่ได้แลก"
              value={fmt(report.points.outstanding)}
              sub={`ยอดสะสมของพนักงานทุกคน ณ ${thaiDate(report.params.to)}`}
            />
            <StatCard
              label="ของรางวัลที่แลก"
              value={`${fmt(report.rewards.reduce((a, r) => a + r.approved, 0))} ชิ้น`}
              sub={`รอดำเนินการ ${fmt(report.rewards.reduce((a, r) => a + r.pending, 0))} ชิ้น`}
            />
          </div>
          <div className="ws-card" style={{ padding: 16, marginTop: 16 }}>
            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>ของรางวัล</th>
                    <th>คะแนน/ชิ้น</th>
                    <th>อนุมัติแล้ว</th>
                    <th>รอดำเนินการ</th>
                    <th>คะแนนที่ใช้</th>
                    <th>สต็อกคงเหลือ</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rewards.map((r) => (
                    <tr key={r.rewardName}>
                      <td>
                        {r.rewardName}
                        {!r.active && <span className="ws-badge ws-badge-neutral" style={{ marginLeft: 6 }}>ปิดแลก</span>}
                      </td>
                      <td>{fmt(r.requiredScore)}</td>
                      <td>{fmt(r.approved)}</td>
                      <td>{fmt(r.pending)}</td>
                      <td>{fmt(r.pointsUsed)}</td>
                      <td>
                        {fmt(r.stock)}
                        {r.active && r.stock <= 3 && <span className="ws-badge ws-badge-warning" style={{ marginLeft: 6 }}>ใกล้หมด</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--ws-text-secondary)', marginTop: 24 }}>
            ไฟล์ Excel มีชีตเพิ่มเติม: แนวโน้มรายเดือนแบบตาราง และรายชื่อรายบุคคล (เฉพาะข้อมูลกิจกรรมและคะแนน ไม่มีข้อมูลสุขภาพ)
          </p>
        </div>
      )}
    </div>
  );
}
