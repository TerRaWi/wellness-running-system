import { useState } from 'react';
import { formatDateTimeShort } from '../../utils/formatDateTime';
import { resolveImageUrl } from '../../utils/resolveImageUrl';
import { API_BASE } from '../../lib/apiClient';
import useApiData from '../../hooks/useApiData';
import { ErrorAlert, ListState, PersonCell, StatusFilterBar, SubText, TableScroll } from './AdminUi';

const STATUS_OPTIONS = [
  ['PENDING', 'รอดำเนินการ (PENDING)'],
  ['APPROVED', 'อนุมัติแล้ว (APPROVED)'],
  ['REJECTED', 'ถูกปฏิเสธ (REJECTED)'],
];

function RejectModal({ api, submissionId, rejectReasons, onClose, onRejected }) {
  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedReason = rejectReasons.find((r) => String(r.reason_id) === String(reasonId));
  const noteRequired = Boolean(selectedReason?.is_other);

  async function handleConfirm() {
    if (!reasonId) {
      setError('กรุณาเลือกเหตุผลที่ปฏิเสธ');
      return;
    }
    if (noteRequired && !note.trim()) {
      setError('กรุณาระบุเหตุผลเพิ่มเติม');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.request(`/api/admin/submissions/${submissionId}/reject`, {
        method: 'POST',
        json: { reasonId, note: noteRequired ? note.trim() : '' },
        errorMessage: 'ปฏิเสธไม่สำเร็จ',
      });
      onRejected(submissionId);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
      setSubmitting(false);
    }
  }

  return (
    <div className="ws-modal-overlay">
      <div className="ws-modal" style={{ maxWidth: 420 }}>
        <h3>
          ปฏิเสธ submission #{submissionId}
        </h3>

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="rejectReasonSelect" className="ws-label">เหตุผล</label>
          <select id="rejectReasonSelect" value={reasonId} onChange={(e) => setReasonId(e.target.value)} className="ws-select">
            <option value="">-- เลือกเหตุผล --</option>
            {rejectReasons.map((r) => (
              <option key={r.reason_id} value={r.reason_id}>
                {r.reason_text}
              </option>
            ))}
          </select>
        </div>

        {noteRequired && (
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="rejectNote" className="ws-label">ระบุเหตุผลเพิ่มเติม</label>
            <textarea id="rejectNote" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="ws-textarea" />
          </div>
        )}

        <ErrorAlert message={error} />

        <div className="ws-modal-actions">
          <button className="ws-btn ws-btn-ghost" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </button>
          <button className="ws-btn ws-btn-danger" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'กำลังบันทึก...' : 'ยืนยันปฏิเสธ'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ตรวจสอบกิจกรรมที่พนักงานส่งมา — โหลดตั้งแต่ล็อกอิน (ไม่ผูกกับการเปิดแท็บ) และเมื่อเปลี่ยนตัวกรอง
// ตัวกรองถูกเก็บไว้ที่ AdminApp เพราะการ์ดบนแดชบอร์ดสั่งเปลี่ยนเป็น PENDING ได้
export default function SubmissionsTab({ api, statusFilter, onStatusFilterChange }) {
  const submissions = useApiData(api, `/api/admin/submissions?status=${statusFilter}`, {
    initialData: [],
    errorMessage: 'โหลดรายการไม่สำเร็จ',
  });
  // preset เหตุผลปฏิเสธ (ใช้ใน modal ปฏิเสธ) — โหลดไว้ล่วงหน้า ถ้าโหลดไม่ได้ก็ปล่อยเป็นรายการว่าง
  const { data: rejectReasons } = useApiData(api, '/api/admin/reject-reasons', { initialData: [] });

  const [actioningId, setActioningId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [rejectModalSubmissionId, setRejectModalSubmissionId] = useState(null);

  // อนุมัติ/ปฏิเสธแล้ว → ตัดออกจากรายการปัจจุบัน เพราะสถานะไม่ตรงตัวกรองเดิมแล้ว
  function removeSubmission(submissionId) {
    submissions.setData((prev) => prev.filter((s) => s.submission_id !== submissionId));
  }

  async function handleApprove(submissionId) {
    setActioningId(submissionId);
    setActionError('');
    try {
      await api.request(`/api/admin/submissions/${submissionId}/approve`, { method: 'POST', errorMessage: 'อนุมัติไม่สำเร็จ' });
      removeSubmission(submissionId);
    } catch (err) {
      setActionError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActioningId(null);
    }
  }

  function handleRejected(submissionId) {
    removeSubmission(submissionId);
    setRejectModalSubmissionId(null);
  }

  return (
    <>
      <StatusFilterBar
        id="statusFilter"
        value={statusFilter}
        onChange={onStatusFilterChange}
        options={STATUS_OPTIONS}
        onRefresh={submissions.reload}
      />

      <ErrorAlert message={actionError} />
      <ListState
        error={submissions.error}
        loading={submissions.loading}
        isEmpty={submissions.data.length === 0}
        emptyText="ไม่มีรายการในสถานะนี้"
      >
        <TableScroll>
          <thead>
            <tr>
              <th>#</th>
              <th>พนักงาน</th>
              <th>แผนก</th>
              <th>กิจกรรม</th>
              <th>คะแนน</th>
              <th>ระยะทาง</th>
              <th>เวลา</th>
              <th>รูปหลักฐาน</th>
              <th>หมายเหตุ</th>
              <th>ส่งเมื่อ</th>
              {statusFilter === 'REJECTED' && <th>เหตุผลที่ปฏิเสธ</th>}
              {statusFilter === 'PENDING' && <th>จัดการ</th>}
            </tr>
          </thead>
          <tbody>
            {submissions.data.map((s) => (
              <tr key={s.submission_id}>
                <td>{s.submission_id}</td>
                <td>
                  <PersonCell name={s.full_name} employeeId={s.employee_id} />
                </td>
                <td>{s.department || '-'}</td>
                <td>{s.activity_name}</td>
                <td>{s.score}</td>
                <td>{s.distance != null ? `${s.distance} กม.` : '-'}</td>
                <td>{s.duration != null ? `${s.duration} นาที` : '-'}</td>
                <td>
                  {s.proof_image ? (
                    <a href={resolveImageUrl(API_BASE, s.proof_image)} target="_blank" rel="noreferrer">
                      <img
                        src={resolveImageUrl(API_BASE, s.proof_image)}
                        alt="proof"
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                      />
                    </a>
                  ) : (
                    'ไม่มีรูป'
                  )}
                </td>
                <td>{s.note || '-'}</td>
                <td>{formatDateTimeShort(s.submitted_at)}</td>
                {statusFilter === 'REJECTED' && (
                  <td>
                    {s.reject_reason_text || '-'}
                    {s.reject_reason_note && <SubText>{s.reject_reason_note}</SubText>}
                  </td>
                )}
                {statusFilter === 'PENDING' && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="ws-btn ws-btn-primary ws-btn-sm"
                      onClick={() => handleApprove(s.submission_id)}
                      disabled={actioningId === s.submission_id}
                      style={{ marginRight: 6 }}
                    >
                      {actioningId === s.submission_id ? '...' : 'อนุมัติ'}
                    </button>
                    <button
                      className="ws-btn ws-btn-danger ws-btn-sm"
                      onClick={() => setRejectModalSubmissionId(s.submission_id)}
                      disabled={actioningId === s.submission_id}
                    >
                      ปฏิเสธ
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </TableScroll>
      </ListState>

      {rejectModalSubmissionId !== null && (
        <RejectModal
          api={api}
          submissionId={rejectModalSubmissionId}
          rejectReasons={rejectReasons}
          onClose={() => setRejectModalSubmissionId(null)}
          onRejected={handleRejected}
        />
      )}
    </>
  );
}
