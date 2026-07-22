import { formatDateTimeShort } from '../utils/formatDateTime';

const CHALLENGE_STATUS_LABEL_TH = {
  UPCOMING: 'ยังไม่เริ่ม',
  ONGOING: 'กำลังแข่งขัน',
  ENDED: 'จบแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
};

export default function ChallengesSection({
  myChallenges,
  challenges,
  challengeMessage,
  challengeMessageType,
  joiningChallengeId,
  joinModeByChallenge,
  setJoinModeByChallenge,
  onJoinChallenge,
  onOpenLeaderboard,
}) {
  return (
    <div>
      <h3>ชาเลนจ์</h3>

      {challengeMessage && (
        <div className={`ws-alert ${challengeMessageType === 'error' ? 'ws-alert-danger' : 'ws-alert-success'}`}>{challengeMessage}</div>
      )}

      {myChallenges.length > 0 && (
        <>
          <h4>ชาเลนจ์ ที่เข้าร่วมอยู่</h4>
          <div className="ws-stack" style={{ marginBottom: 16 }}>
            {myChallenges.map((mc) => (
              <div key={mc.participant_id} className="ws-card ws-card-row">
                <div>
                  <div style={{ fontWeight: 'bold' }}>{mc.challenge_name}</div>
                  <div style={{ fontSize: 14, color: 'var(--ws-text-secondary)' }}>
                    {mc.category_name} · <span className="ws-badge ws-badge-info">{CHALLENGE_STATUS_LABEL_TH[mc.status] || mc.status}</span> · ระยะทางสะสมของฉัน{' '}
                    {mc.my_distance} กม.
                    {mc.join_mode === 'ANONYMOUS' && ' · เข้าร่วมแบบไม่ระบุตัวตน'}
                  </div>
                </div>
                <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => onOpenLeaderboard(mc.challenge_id)}>ดู Leaderboard</button>
              </div>
            ))}
          </div>
        </>
      )}

      <h4>ชาเลนจ์ ที่เปิดอยู่</h4>
      {challenges.length === 0 && <p className="ws-empty">ยังไม่มี ชาเลนจ์ ที่เปิดอยู่ตอนนี้</p>}

      <div className="ws-stack">
        {challenges.map((c) => {
          const isJoining = joiningChallengeId === c.challenge_id;
          return (
            <div key={c.challenge_id} className="ws-card ws-card-row">
              <div>
                <div style={{ fontWeight: 'bold' }}>{c.challenge_name}</div>
                <div style={{ fontSize: 14, color: 'var(--ws-text-secondary)' }}>
                  {c.category_name} · <span className="ws-badge ws-badge-info">{CHALLENGE_STATUS_LABEL_TH[c.status] || c.status}</span> · ผู้เข้าร่วม{' '}
                  {c.participant_count} คน
                </div>
                <div style={{ fontSize: 13, color: 'var(--ws-text-muted)' }}>
                  {formatDateTimeShort(c.start_date)} - {formatDateTimeShort(c.end_date)}
                </div>
                {c.description && <div style={{ fontSize: 13, color: 'var(--ws-text-muted)' }}>{c.description}</div>}
              </div>

              <div className="ws-row">
                {c.joined ? (
                  <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => onOpenLeaderboard(c.challenge_id)}>ดู Leaderboard</button>
                ) : (
                  <>
                    <select
                      value={joinModeByChallenge[c.challenge_id] || 'PUBLIC'}
                      onChange={(e) =>
                        setJoinModeByChallenge((prev) => ({ ...prev, [c.challenge_id]: e.target.value }))
                      }
                      className="ws-select"
                      style={{ width: 'auto' }}
                    >
                      <option value="PUBLIC">แสดงชื่อจริง</option>
                      <option value="ANONYMOUS">ไม่ระบุตัวตน</option>
                    </select>
                    <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => onJoinChallenge(c.challenge_id)} disabled={isJoining}>
                      {isJoining ? 'กำลังเข้าร่วม...' : 'เข้าร่วม'}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}