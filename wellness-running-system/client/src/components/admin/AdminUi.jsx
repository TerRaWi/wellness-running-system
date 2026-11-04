// ชิ้นส่วนหน้าตาที่ใช้ซ้ำในหลายแท็บของหน้าแอดมิน (เดิมเขียนซ้ำแยกกันในแต่ละแท็บของ AdminApp.jsx)
import { resolveImageUrl } from '../../utils/resolveImageUrl';
import { API_BASE } from '../../lib/apiClient';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

export function ErrorAlert({ message, style }) {
  if (!message) return null;
  return <div className="ws-alert ws-alert-danger" style={style}>{message}</div>;
}

// error → กำลังโหลด → ว่าง → เนื้อหา (ลำดับเดียวกับที่ทุกแท็บใช้)
export function ListState({ error, loading, isEmpty, emptyText, children }) {
  return (
    <>
      <ErrorAlert message={error} />
      {loading && <p className="ws-empty">กำลังโหลด...</p>}
      {!loading && isEmpty && <p className="ws-empty">{emptyText}</p>}
      {!loading && !isEmpty && children}
    </>
  );
}

// หัวรายการ: ชื่อ + ปุ่มรีเฟรช
export function ListHeader({ title, onRefresh }) {
  return (
    <div className="ws-row-between" style={{ marginBottom: 16 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={onRefresh}>รีเฟรช</button>
    </div>
  );
}

export function TableScroll({ children }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="ws-table">{children}</table>
    </div>
  );
}

// บรรทัดย่อยสีจาง ใต้ชื่อในตาราง (รหัสพนักงาน / คำอธิบาย)
export function SubText({ children }) {
  return (
    <>
      <br />
      <small style={{ color: 'var(--ws-text-muted)' }}>{children}</small>
    </>
  );
}

export function PersonCell({ name, employeeId }) {
  return (
    <>
      {name}
      <SubText>{employeeId}</SubText>
    </>
  );
}

export function ActiveStatusBadge({ status }) {
  return <span className={`ws-badge ${status === 'ACTIVE' ? 'ws-badge-success' : 'ws-badge-neutral'}`}>{status}</span>;
}

export function ActiveStatusSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="ws-select">
      <option value="ACTIVE">ACTIVE</option>
      <option value="INACTIVE">INACTIVE</option>
    </select>
  );
}

// ปุ่มของแถวปกติ: แก้ไข + เปิด/ปิดใช้งาน
export function RowActions({ status, busy, onEdit, onToggle }) {
  return (
    <td style={{ whiteSpace: 'nowrap' }}>
      <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={onEdit} disabled={busy}>
        แก้ไข
      </button>{' '}
      <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={onToggle} disabled={busy}>
        {busy ? '...' : status === 'ACTIVE' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
      </button>
    </td>
  );
}

// ปุ่มของแถวที่กำลังแก้ไข: error + บันทึก + ยกเลิก
export function EditRowActions({ error, busy, onSave, onCancel }) {
  return (
    <td style={{ whiteSpace: 'nowrap' }}>
      <ErrorAlert message={error} style={{ margin: '0 0 6px' }} />
      <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={onSave} disabled={busy}>
        {busy ? '...' : 'บันทึก'}
      </button>{' '}
      <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={onCancel} disabled={busy}>
        ยกเลิก
      </button>
    </td>
  );
}

// ช่องเลือกไฟล์รูปในฟอร์มสร้าง
export function ImageFileInput({ id, onChange }) {
  return <input id={id} type="file" accept={IMAGE_ACCEPT} onChange={(e) => onChange(e.target.files?.[0] || null)} />;
}

// รูปในตาราง (หรือ emoji แทนถ้าไม่มีรูป) — round = วงกลม (เหรียญตรา), ไม่ round = มุมมน (ของรางวัล)
export function TableImage({ src, fallback, round }) {
  if (!src) return <span style={{ fontSize: 24 }}>{fallback}</span>;
  return (
    <img
      src={resolveImageUrl(API_BASE, src)}
      alt=""
      style={{ width: 40, height: 40, borderRadius: round ? '50%' : 4, objectFit: 'cover' }}
    />
  );
}

// ช่องแก้รูปในแถวที่กำลังแก้ไข: รูปปัจจุบัน + เลือกไฟล์ใหม่ + ติ๊กลบรูป
// เลือกไฟล์ใหม่ = ยกเลิกการติ๊กลบ, ติ๊กลบ = ทิ้งไฟล์ที่เลือกไว้
export function ImageEditField({ currentImage, removeImage, onFileChange, onRemoveChange, round }) {
  return (
    <>
      {currentImage && !removeImage && (
        <img
          src={resolveImageUrl(API_BASE, currentImage)}
          alt=""
          style={{
            width: 40,
            height: 40,
            borderRadius: round ? '50%' : 4,
            objectFit: 'cover',
            display: 'block',
            marginBottom: 6,
          }}
        />
      )}
      <input
        type="file"
        accept={IMAGE_ACCEPT}
        onChange={(e) => {
          onFileChange(e.target.files?.[0] || null);
          onRemoveChange(false);
        }}
        style={{ fontSize: 12, width: 110 }}
      />
      {currentImage && (
        <label style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
          <input
            type="checkbox"
            checked={removeImage}
            onChange={(e) => {
              onRemoveChange(e.target.checked);
              if (e.target.checked) onFileChange(null);
            }}
          />{' '}
          ลบรูป
        </label>
      )}
    </>
  );
}

// แถบตัวกรองสถานะ + ปุ่มรีเฟรช (หน้าตรวจสอบกิจกรรม / คำขอแลกของรางวัล)
export function StatusFilterBar({ id, value, onChange, options, onRefresh }) {
  return (
    <div className="ws-row" style={{ marginBottom: 16 }}>
      <label htmlFor={id} className="ws-label" style={{ margin: 0 }}>สถานะ: </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="ws-select" style={{ width: 'auto' }}>
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>{label}</option>
        ))}
      </select>
      <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={onRefresh}>
        รีเฟรช
      </button>
    </div>
  );
}

// การ์ดฟอร์มสร้างรายการใหม่ (หัวข้อ + ฟอร์ม)
export function CreateCard({ title, maxWidth = 480, onSubmit, children, footer }) {
  return (
    <div className="ws-card" style={{ marginBottom: 16, maxWidth }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <form onSubmit={onSubmit}>{children}</form>
      {footer}
    </div>
  );
}

// ช่องกรอกแบบ label + <br /> + input ที่ฟอร์มสร้างในหน้าตั้งค่าใช้ (style ใช้แทนค่าเริ่มต้น เช่น { flex: 1 } ในแถวคู่)
export function FormField({ id, label, children, style = { marginBottom: 12 } }) {
  return (
    <div style={style}>
      <label htmlFor={id}>{label}</label>
      <br />
      {children}
    </div>
  );
}

// แถวที่วางช่องกรอก 2 ช่องคู่กัน (ช่องในแถวใช้ <FormField style={HALF} />)
export function FieldRow({ children }) {
  return <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>{children}</div>;
}

export function SubmitButton({ busy, busyText = 'กำลังสร้าง...', children }) {
  return (
    <button type="submit" className="ws-btn ws-btn-primary" disabled={busy}>
      {busy ? busyText : children}
    </button>
  );
}
