export default function LeaderboardModal({ challengeId, leaderboard, loading, error, onClose }) {
  if (challengeId === null) return null;

  return (
    <div className="ws-modal-overlay">
      <div className="ws-modal" style={{ maxWidth: 420 }}>
        <h3>Leaderboard</h3>

        {loading && <p className="ws-empty">กำลังโหลด...</p>}
        {error && <div className="ws-alert ws-alert-danger">{error}</div>}

        {!loading && !error && leaderboard.length === 0 && (
          <p className="ws-empty">ยังไม่มีผู้เข้าร่วม</p>
        )}

        {!loading && leaderboard.length > 0 && (
          <div className="ws-stack" style={{ gap: 6 }}>
            {leaderboard.map((row) => (
              <div
                key={row.rank}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--ws-border)',
                  fontWeight: row.isMe ? 'bold' : 'normal',
                  color: row.isMe ? 'var(--ws-primary)' : 'inherit',
                }}
              >
                <span>
                  #{row.rank} {row.displayName} {row.isMe && '(คุณ)'}
                </span>
                <span>
                  {row.totalDistance} กม. · {row.runCount} ครั้ง
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="ws-modal-actions">
          <button className="ws-btn ws-btn-secondary" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}