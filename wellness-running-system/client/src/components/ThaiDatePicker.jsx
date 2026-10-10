import { useEffect, useRef, useState } from 'react';

// ช่องเลือกวันที่แบบไทย (แสดง วว/ดด/ปปปป พ.ศ. + ปฏิทินภาษาไทย)
// ทำเองแทน <input type="date"> เพราะปฏิทินของ browser ใช้ภาษา/ปี ค.ศ. ตาม locale ของเครื่อง บังคับเป็นไทยไม่ได้
// value / onChange / min / max ใช้รูปแบบ 'YYYY-MM-DD' (ค.ศ.) เหมือน input type=date เดิม — เปลี่ยนแค่การแสดงผล

const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toIso(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function todayIso() {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
}

function isoToDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${pad2(d)}/${pad2(m)}/${y + 543}`;
}

// รับ "8/10/2569", "08-10-2569", "8.10.69" → 'YYYY-MM-DD' หรือ null ถ้าไม่ใช่วันที่จริง
// ปี 2 หลักถือเป็น พ.ศ. 25xx, ปีมากกว่า 2400 ถือเป็น พ.ศ., นอกนั้นถือเป็น ค.ศ.
function parseDisplay(text) {
  const match = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!match) return null;
  const d = Number(match[1]);
  const m = Number(match[2]);
  let y = Number(match[3]);
  if (match[3].length === 2) y += 2500;
  if (y > 2400) y -= 543;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toIso(y, m - 1, d);
}

function inRange(iso, min, max) {
  return (!min || iso >= min) && (!max || iso <= max);
}

export default function ThaiDatePicker({ id, value, onChange, min, max, placeholder = 'วว/ดด/ปปปป' }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null); // ข้อความที่กำลังพิมพ์ (null = แสดงตาม value)
  const initial = value || (min && min > todayIso() ? min : todayIso());
  const [view, setView] = useState(() => ({ year: Number(initial.slice(0, 4)), month: Number(initial.slice(5, 7)) - 1 }));
  const rootRef = useRef(null);

  // ปิด popup เมื่อคลิกนอกกล่องหรือกด Esc
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (ev) => {
      if (rootRef.current && !rootRef.current.contains(ev.target)) setOpen(false);
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function openPicker() {
    const base = value || initial;
    setView({ year: Number(base.slice(0, 4)), month: Number(base.slice(5, 7)) - 1 });
    setOpen(true);
  }

  function pick(iso) {
    if (!inRange(iso, min, max)) return;
    onChange(iso);
    setDraft(null);
    setOpen(false);
  }

  function commitDraft() {
    if (draft === null) return;
    // ลบข้อความจนว่าง = ล้างค่า (ใช้กับช่องที่ไม่บังคับ เช่น วันปิดรับรอบติดตามผล)
    if (draft.trim() === '') {
      if (value) onChange('');
      setDraft(null);
      return;
    }
    const iso = parseDisplay(draft);
    if (iso && inRange(iso, min, max)) onChange(iso);
    setDraft(null); // พิมพ์ผิด/นอกช่วง → กลับไปแสดงค่าเดิม
  }

  function shiftMonth(delta) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  // ตาราง 6 สัปดาห์ เริ่มวันอาทิตย์ (รวมวันท้ายเดือนก่อน/ต้นเดือนถัดไปให้ครบแถว)
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(view.year, view.month, 1 - firstWeekday + i);
    return { iso: toIso(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === view.month };
  });
  const today = todayIso();
  const thisYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = thisYear + 1; y >= 2020; y -= 1) yearOptions.push(y);
  if (!yearOptions.includes(view.year)) yearOptions.push(view.year);

  return (
    <div className="ws-datepicker" ref={rootRef}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="ws-input ws-date-input"
        placeholder={placeholder}
        value={draft ?? isoToDisplay(value)}
        onChange={(ev) => setDraft(ev.target.value)}
        onFocus={openPicker}
        onClick={() => !open && openPicker()}
        onBlur={commitDraft}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            commitDraft();
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        className="ws-datepicker-toggle"
        aria-label="เปิดปฏิทิน"
        tabIndex={-1}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <div className="ws-datepicker-popup" role="dialog" aria-label="เลือกวันที่">
          <div className="ws-datepicker-header">
            <button type="button" className="ws-datepicker-nav" onClick={() => shiftMonth(-1)} aria-label="เดือนก่อนหน้า">‹</button>
            <select
              className="ws-datepicker-select"
              value={view.month}
              onChange={(ev) => setView((v) => ({ ...v, month: Number(ev.target.value) }))}
              aria-label="เดือน"
            >
              {TH_MONTHS_FULL.map((name, i) => <option key={name} value={i}>{name}</option>)}
            </select>
            <select
              className="ws-datepicker-select"
              value={view.year}
              onChange={(ev) => setView((v) => ({ ...v, year: Number(ev.target.value) }))}
              aria-label="ปี พ.ศ."
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y + 543}</option>)}
            </select>
            <button type="button" className="ws-datepicker-nav" onClick={() => shiftMonth(1)} aria-label="เดือนถัดไป">›</button>
          </div>
          <div className="ws-datepicker-grid">
            {TH_WEEKDAYS.map((w, i) => (
              <div key={w} className={`ws-datepicker-weekday${i === 0 ? ' is-sunday' : ''}`}>{w}</div>
            ))}
            {cells.map((c) => {
              const disabled = !inRange(c.iso, min, max);
              const classes = ['ws-datepicker-day'];
              if (!c.inMonth) classes.push('is-outside');
              if (c.iso === today) classes.push('is-today');
              if (c.iso === value) classes.push('is-selected');
              return (
                <button
                  key={c.iso}
                  type="button"
                  className={classes.join(' ')}
                  disabled={disabled}
                  onMouseDown={(ev) => ev.preventDefault()} // กันช่อง input blur ก่อนเลือก
                  onClick={() => pick(c.iso)}
                  aria-label={`${c.day} ${TH_MONTHS_FULL[Number(c.iso.slice(5, 7)) - 1]} ${Number(c.iso.slice(0, 4)) + 543}`}
                  aria-pressed={c.iso === value}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
          <div className="ws-datepicker-footer">
            <button
              type="button"
              className="ws-btn ws-btn-ghost ws-btn-sm"
              disabled={!inRange(today, min, max)}
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => pick(today)}
            >
              วันนี้
            </button>
            <button type="button" className="ws-btn ws-btn-ghost ws-btn-sm" onClick={() => setOpen(false)}>ปิด</button>
          </div>
        </div>
      )}
    </div>
  );
}
