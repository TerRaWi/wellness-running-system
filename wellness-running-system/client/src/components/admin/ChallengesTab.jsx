import { useState } from 'react';
import { formatDateTimeShort } from '../../utils/formatDateTime';
import useApiData from '../../hooks/useApiData';
import ThaiDatePicker from '../ThaiDatePicker';
import { ErrorAlert, ListHeader, ListState, PersonCell, SubText, TableScroll } from './AdminUi';

const CHALLENGE_STATUS_LABEL_TH = {
  UPCOMING: 'ยังไม่เริ่ม',
  ONGOING: 'กำลังแข่งขัน',
  ENDED: 'จบแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
};

// แปลงเวลาปัจจุบันของเครื่องเป็นรูปแบบ YYYY-MM-DDTHH:mm — ใช้เป็นค่า min กันแอดมินเลือกวัน-เวลาที่ผ่านมาแล้ว
function getNowForDatetimeInput() {
  const now = new Date();
  now.setSeconds(0, 0);
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

// รายการชั่วโมง (00-23) และนาที (00-59) แบบ 24 ชม. ใช้กับ dropdown เลือกเวลา
// ทำแบบนี้แทนพึ่ง input type=datetime-local เพราะ popup ปฏิทินของ browser จะโชว์ AM/PM ตาม
// ค่า locale ของเครื่อง OS ผู้ใช้แต่ละคน ซึ่งเราบังคับผ่าน lang attribute ไม่ได้ 100%
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// แยกค่า "YYYY-MM-DDTHH:mm" ออกเป็นวัน/ชั่วโมง/นาที สำหรับ bind กับ input+select แยกกัน
function splitDatetimeLocal(value) {
  if (!value) return { date: '', hour: '', minute: '' };
  const [date, time] = value.split('T');
  const [hour, minute] = (time || '').split(':');
  return { date: date || '', hour: hour || '', minute: minute || '' };
}

// รวมวัน/ชั่วโมง/นาทีกลับเป็น "YYYY-MM-DDTHH:mm" (format เดียวกับที่ backend และ validation ใช้อยู่)
function joinDatetimeLocal(date, hour, minute) {
  if (!date) return '';
  return `${date}T${hour || '00'}:${minute || '00'}`;
}

// ช่องเลือกวัน (ปฏิทินไทย) + ชั่วโมง + นาที — word = "เริ่ม" | "จบ"
function DateTimeField({ id, label, word, value, minDate, onChange }) {
  const parts = splitDatetimeLocal(value);
  const hour = parts.hour || '00';
  const minute = parts.minute || '00';
  return (
    <div>
      <label htmlFor={id} className="ws-label">{label}</label>
      <div className="ws-row" style={{ gap: 6 }}>
        <div style={{ flex: 1 }}>
          <ThaiDatePicker id={id} value={parts.date} min={minDate} onChange={(v) => onChange(joinDatetimeLocal(v, hour, minute))} />
        </div>
        <select
          aria-label={`ชั่วโมง${word}`}
          value={hour}
          onChange={(e) => onChange(joinDatetimeLocal(parts.date, e.target.value, minute))}
          className="ws-select"
          style={{ width: 'auto' }}
        >
          {HOUR_OPTIONS.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span>:</span>
        <select
          aria-label={`นาที${word}`}
          value={minute}
          onChange={(e) => onChange(joinDatetimeLocal(parts.date, hour, e.target.value))}
          className="ws-select"
          style={{ width: 'auto' }}
        >
          {MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      {value && (
        <div style={{ fontSize: 12, color: 'var(--ws-text-muted)', marginTop: 4 }}>
          {word}: {formatDateTimeShort(value)}
        </div>
      )}
    </div>
  );
}

const emptyForm = { categoryId: '', name: '', description: '', startDate: '', endDate: '' };

function CreateChallengeForm({ api, categories, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const setField = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.categoryId || !form.name.trim() || !form.startDate || !form.endDate) {
      setError('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (start.getTime() < Date.now()) {
      setError('วันเริ่มต้องไม่ใช่วัน-เวลาที่ผ่านมาแล้ว');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setError('วันจบต้องอยู่หลังวันเริ่ม');
      return;
    }

    setSubmitting(true);
    try {
      await api.request('/api/admin/challenges', {
        method: 'POST',
        json: {
          categoryId: form.categoryId,
          challengeName: form.name.trim(),
          description: form.description.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
        },
        errorMessage: 'สร้าง challenge ไม่สำเร็จ',
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
    <div className="ws-card" style={{ marginBottom: 16, maxWidth: 720 }}>
      <h3 style={{ marginTop: 0 }}>สร้าง ชาเลนจ์ ใหม่</h3>
      <form onSubmit={handleSubmit}>
        <div className="ws-form-grid">
          <div>
            <label htmlFor="newChallengeCategory" className="ws-label">หมวดกิจกรรมที่ใช้วัด (รวมระยะทางทุกกิจกรรมในหมวดนี้)</label>
            <select id="newChallengeCategory" value={form.categoryId} onChange={(e) => setField('categoryId')(e.target.value)} className="ws-select">
              <option value="">-- เลือกหมวดกิจกรรม --</option>
              {categories.map((cat) => (
                <option key={cat.category_id} value={cat.category_id}>
                  {cat.category_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="newChallengeName" className="ws-label">ชื่อ ชาเลนจ์</label>
            <input
              id="newChallengeName"
              type="text"
              value={form.name}
              onChange={(e) => setField('name')(e.target.value)}
              placeholder="เช่น July Run Challenge"
              className="ws-input"
            />
          </div>

          <div className="ws-field-full">
            <label htmlFor="newChallengeDescription" className="ws-label">รายละเอียด (ถ้ามี)</label>
            <textarea
              id="newChallengeDescription"
              value={form.description}
              onChange={(e) => setField('description')(e.target.value)}
              rows={2}
              className="ws-textarea"
            />
          </div>

          <DateTimeField
            id="newChallengeStart"
            label="วันและเวลาเริ่ม"
            word="เริ่ม"
            value={form.startDate}
            minDate={getNowForDatetimeInput().slice(0, 10)}
            onChange={setField('startDate')}
          />
          <DateTimeField
            id="newChallengeEnd"
            label="วันและเวลาจบ"
            word="จบ"
            value={form.endDate}
            minDate={(form.startDate || getNowForDatetimeInput()).slice(0, 10)}
            onChange={setField('endDate')}
          />
        </div>

        <ErrorAlert message={error} />

        <button type="submit" className="ws-btn ws-btn-primary" disabled={submitting}>
          {submitting ? 'กำลังสร้าง...' : 'สร้าง ชาเลนจ์'}
        </button>
      </form>
    </div>
  );
}

// รายชื่อผู้เข้าร่วม / อันดับของชาเลนจ์ (เปิดจากตารางในแท็บนี้ หรือจากแถวบนแดชบอร์ด)
function ParticipantsModal({ api, challenge, onClose }) {
  const { data, loading, error } = useApiData(api, `/api/admin/challenges/${challenge.challengeId}/participants`, {
    errorMessage: 'โหลดรายชื่อผู้เข้าร่วมไม่สำเร็จ',
  });
  const participants = (!loading && data?.participants) || [];

  return (
    <div className="ws-modal-overlay">
      <div className="ws-modal" style={{ maxWidth: 560 }}>
        <h3>ผู้เข้าร่วม: {challenge.challengeName}</h3>

        {loading && <p className="ws-empty">กำลังโหลด...</p>}
        <ErrorAlert message={error} />

        {!loading && !error && participants.length === 0 && <p className="ws-empty">ยังไม่มีผู้เข้าร่วม</p>}

        {!loading && participants.length > 0 && (
          <table className="ws-table">
            <thead>
              <tr>
                <th>#</th>
                <th>ชื่อ-สกุล</th>
                <th>แผนก</th>
                <th>โหมด</th>
                <th>ระยะทางสะสม</th>
                <th>จำนวนครั้ง</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.participantId}>
                  <td>{p.rank}</td>
                  <td>
                    <PersonCell name={p.fullName} employeeId={p.employeeId} />
                  </td>
                  <td>{p.department || '-'}</td>
                  <td>{p.joinMode === 'ANONYMOUS' ? 'ไม่ระบุตัวตน (leaderboard พนักงาน)' : 'แสดงชื่อ'}</td>
                  <td>{p.totalDistance} กม.</td>
                  <td>{p.runCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="ws-modal-actions">
          <button className="ws-btn ws-btn-secondary" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}

// จัดการชาเลนจ์ — participantsChallenge ({ challengeId, challengeName } | null) เก็บไว้ที่ AdminApp
// เพราะแถวชาเลนจ์บนแดชบอร์ดสั่งเปิด modal ผู้เข้าร่วมของแท็บนี้ได้
export default function ChallengesTab({ api, refreshKey, participantsChallenge, onOpenParticipants, onCloseParticipants }) {
  const enabled = refreshKey !== null;
  const challenges = useApiData(api, '/api/admin/challenges', {
    enabled,
    refreshKey,
    initialData: [],
    errorMessage: 'โหลดรายการ challenge ไม่สำเร็จ',
  });
  const { data: categories } = useApiData(api, '/api/admin/activity-categories', { enabled, refreshKey, initialData: [] });

  const [actioningId, setActioningId] = useState(null);
  const [actionError, setActionError] = useState('');

  async function handleCancel(challengeId) {
    if (!window.confirm('ยืนยันยกเลิก challenge นี้?')) return;
    setActioningId(challengeId);
    setActionError('');
    try {
      await api.request(`/api/admin/challenges/${challengeId}/cancel`, { method: 'POST', errorMessage: 'ยกเลิกไม่สำเร็จ' });
      challenges.reload();
    } catch (err) {
      setActionError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActioningId(null);
    }
  }

  return (
    <>
      <CreateChallengeForm api={api} categories={categories} onCreated={challenges.reload} />

      <ListHeader title="รายการ ชาเลนจ์ ทั้งหมด" onRefresh={challenges.reload} />

      <ErrorAlert message={actionError} />
      <ListState error={challenges.error} loading={challenges.loading} isEmpty={challenges.data.length === 0} emptyText="ยังไม่มี challenge">
        <TableScroll>
          <thead>
            <tr>
              <th>#</th>
              <th>ชื่อ ชาเลนจ์</th>
              <th>หมวดกิจกรรม</th>
              <th>ช่วงเวลา</th>
              <th>สถานะ</th>
              <th>ผู้เข้าร่วม</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {challenges.data.map((c) => (
              <tr key={c.challenge_id}>
                <td>{c.challenge_id}</td>
                <td>
                  {c.challenge_name}
                  {c.description && <SubText>{c.description}</SubText>}
                </td>
                <td>{c.category_name}</td>
                <td>
                  {formatDateTimeShort(c.start_date)} - {formatDateTimeShort(c.end_date)}
                </td>
                <td><span className="ws-badge ws-badge-info">{CHALLENGE_STATUS_LABEL_TH[c.status] || c.status}</span></td>
                <td>{c.participant_count}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => onOpenParticipants(c)} style={{ marginRight: 6 }}>
                    ดูผู้เข้าร่วม
                  </button>
                  {['UPCOMING', 'ONGOING'].includes(c.status) ? (
                    <button
                      className="ws-btn ws-btn-danger ws-btn-sm"
                      onClick={() => handleCancel(c.challenge_id)}
                      disabled={actioningId === c.challenge_id}
                    >
                      {actioningId === c.challenge_id ? '...' : 'ยกเลิก'}
                    </button>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableScroll>
      </ListState>

      {participantsChallenge && <ParticipantsModal api={api} challenge={participantsChallenge} onClose={onCloseParticipants} />}
    </>
  );
}
