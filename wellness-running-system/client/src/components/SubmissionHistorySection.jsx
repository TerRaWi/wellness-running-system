import { formatDateTimeShort } from '../utils/formatDateTime';

const SUBMISSION_STATUS_LABEL_TH = {
  PENDING: 'รอตรวจสอบ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
};

export default function SubmissionHistorySection({ mySubmissions, apiBase }) {
  return (
    <div>
      <h4 style={{ marginTop: 20 }}>ประวัติการส่งกิจกรรม</h4>
      {mySubmissions.length === 0 && <p className="ws-empty">ยังไม่มีประวัติการส่งกิจกรรม</p>}

      {mySubmissions.length > 0 && (
        <div className="ws-stack">
          {mySubmissions.map((s) => (
            <div key={s.submission_id} className="ws-card ws-card-row" style={{ alignItems: 'flex-start' }}>
              {s.proof_image && (
                <img
                  src={`${apiBase}/${s.proof_image}`}
                  alt=""
                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>{s.activity_name}</div>
                <div style={{ fontSize: 14, color: 'var(--ws-text-secondary)' }}>
                  {s.category_name}
                  {s.distance != null && ` · ${s.distance} กม.`}
                  {s.duration != null && ` · ${s.duration} นาที`}
                  {' · '}
                  <span
                    className={`ws-badge ${
                      s.status === 'APPROVED'
                        ? 'ws-badge-success'
                        : s.status === 'REJECTED'
                        ? 'ws-badge-danger'
                        : 'ws-badge-warning'
                    }`}
                  >
                    {SUBMISSION_STATUS_LABEL_TH[s.status] || s.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ws-text-muted)' }}>
                  ส่งเมื่อ {formatDateTimeShort(s.submitted_at)}
                </div>
                {s.note && (
                  <div style={{ fontSize: 13, color: 'var(--ws-text-muted)' }}>หมายเหตุ: {s.note}</div>
                )}
                {s.status === 'REJECTED' && (
                  <div className="ws-alert ws-alert-danger" style={{ marginTop: 6, fontSize: 13 }}>
                    เหตุผลที่ถูกปฏิเสธ: {s.reject_reason_text}
                    {s.reject_reason_note && ` — ${s.reject_reason_note}`}
                  </div>
                )}
                {s.status === 'APPROVED' && s.approved_at && (
                  <div style={{ fontSize: 13, color: 'var(--ws-text-muted)' }}>
                    อนุมัติเมื่อ {formatDateTimeShort(s.approved_at)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}