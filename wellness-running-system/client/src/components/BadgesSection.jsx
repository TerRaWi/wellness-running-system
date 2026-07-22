const BADGE_CONDITION_LABEL_TH = {
  DISTANCE: 'สะสมระยะทาง',
  SUBMISSION_COUNT: 'ส่งกิจกรรมสำเร็จ',
  SCORE: 'สะสมคะแนน',
  STREAK_DAYS: 'วิ่งติดต่อกัน',
};

export default function BadgesSection({ badges, apiBase }) {
  return (
    <div>
      <h3>เหรียญตราของฉัน</h3>
      {badges.length === 0 && <p className="ws-empty">ยังไม่มี เหรียญตรา ให้เก็บตอนนี้</p>}
      {badges.length > 0 && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {badges.map((b) => (
            <div
              key={b.badgeId}
              title={b.description || ''}
              style={{
                minWidth: 100,
                textAlign: 'center',
                opacity: b.earned ? 1 : 0.35,
                flexShrink: 0,
              }}
            >
              <div className="ws-icon-circle" style={{ width: 64, height: 64, margin: '0 auto 6px' }}>
                {b.icon ? (
                  <img src={`${apiBase}/${b.icon}`} alt={b.badgeName} />
                ) : (
                  <span style={{ fontSize: 24 }}>🏅</span>
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 'bold' }}>{b.badgeName}</div>
              <div style={{ fontSize: 11, color: 'var(--ws-text-muted)' }}>
                {BADGE_CONDITION_LABEL_TH[b.conditionType] || b.conditionType} ≥ {b.conditionValue}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}