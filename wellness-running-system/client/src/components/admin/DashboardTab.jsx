import { formatDateTimeShort } from '../../utils/formatDateTime';
import useApiData from '../../hooks/useApiData';
import { ErrorAlert } from './AdminUi';

function StatCard({ label, value, onClick }) {
  return (
    <div
      className={onClick ? 'ws-stat-card ws-card-hover' : 'ws-stat-card'}
      style={onClick ? { cursor: 'pointer' } : undefined}
      onClick={onClick}
    >
      <div className="ws-stat-label">{label}</div>
      <div className="ws-stat-value">{value}</div>
    </div>
  );
}

// แดชบอร์ดสรุปภาพรวม — โหลดใหม่ทุกครั้งที่เปิดแท็บ
export default function DashboardTab({ api, refreshKey, onOpenPendingSubmissions, onOpenPendingRedeems, onOpenChallenge }) {
  const { data, loading, error } = useApiData(api, '/api/admin/dashboard', {
    enabled: refreshKey !== null,
    refreshKey,
    errorMessage: 'โหลดข้อมูลแดชบอร์ดไม่สำเร็จ',
  });

  return (
    <div>
      {loading && <p className="ws-empty">กำลังโหลด...</p>}
      <ErrorAlert message={error} />

      {data && (
        <>
          <div className="ws-grid-stats" style={{ marginBottom: 24 }}>
            <StatCard label="พนักงาน active" value={data.activeEmployeeCount} />
            <StatCard label="กิจกรรม รอดำเนินการ" value={data.pendingSubmissionCount} onClick={onOpenPendingSubmissions} />
            <StatCard label="แลกของรางวัล รอดำเนินการ" value={data.pendingRedeemCount} onClick={onOpenPendingRedeems} />
            <StatCard label="เหรียญตรา ทั้งหมด" value={data.totalBadgeCount} />
            <StatCard label="ชาเลนจ์ กำลังดำเนินอยู่" value={data.ongoingChallengeCount} />
          </div>

          <h3>ชาเลนจ์ ที่กำลังดำเนินอยู่ตอนนี้</h3>
          {data.ongoingChallenges.length === 0 ? (
            <p style={{ color: 'var(--ws-text-secondary)' }}>ไม่มี ชาเลนจ์ ที่กำลังดำเนินอยู่ตอนนี้</p>
          ) : (
            <table className="ws-table">
              <thead>
                <tr>
                  <th>ชื่อ ชาเลนจ์</th>
                  <th>หมวดหมู่</th>
                  <th>ช่วงเวลา</th>
                  <th>ผู้เข้าร่วม</th>
                </tr>
              </thead>
              <tbody>
                {data.ongoingChallenges.map((c) => (
                  <tr key={c.challenge_id} style={{ cursor: 'pointer' }} onClick={() => onOpenChallenge(c)}>
                    <td>{c.challenge_name}</td>
                    <td>{c.category_name}</td>
                    <td>
                      {formatDateTimeShort(c.start_date)} - {formatDateTimeShort(c.end_date)}
                    </td>
                    <td>{c.participant_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
