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
          <ol className="ws-leader">
            {leaderboard.map((row) => (
              <li key={row.rank} className={`ws-leader-row${row.isMe ? ' is-me' : ''}`}>
                <span className="ws-leader-rank">{row.rank}</span>
                <span className="ws-leader-name">
                  {row.displayName} {row.isMe && '(คุณ)'}
                </span>
                <span className="ws-leader-stat">
                  <strong>{row.totalDistance} กม.</strong>
                  {row.runCount} ครั้ง
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="ws-modal-actions">
          <button className="ws-btn ws-btn-secondary" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}
