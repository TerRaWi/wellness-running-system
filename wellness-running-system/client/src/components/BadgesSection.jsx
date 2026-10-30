import { resolveImageUrl } from '../utils/resolveImageUrl';

const BADGE_CONDITION_LABEL_TH = {
  DISTANCE: 'สะสมระยะทาง',
  SUBMISSION_COUNT: 'ส่งกิจกรรมสำเร็จ',
  SCORE: 'สะสมคะแนน',
  STREAK_DAYS: 'วิ่งติดต่อกัน',
};

export default function BadgesSection({ badges, apiBase }) {
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div>
      <div className="ws-section-head">
        <h3>เหรียญตราของฉัน</h3>
        {badges.length > 0 && (
          <div className="ws-section-head-meta">
            <strong>
              {earnedCount}/{badges.length}
            </strong>
            เหรียญที่ได้แล้ว
          </div>
        )}
      </div>
      {badges.length === 0 && <p className="ws-empty">ยังไม่มี เหรียญตรา ให้เก็บตอนนี้</p>}
      {badges.length > 0 && (
        <div className="ws-medal-grid">
          {badges.map((b) => (
            <div
              key={b.badgeId}
              title={b.description || ''}
              className={`ws-medal${b.earned ? '' : ' is-locked'}`}
            >
              <div className="ws-icon-circle">
                {b.icon ? (
                  <img src={resolveImageUrl(apiBase, b.icon)} alt={b.badgeName} />
                ) : (
                  <span className="ws-medal-fallback" style={{ fontSize: 22 }}>{b.conditionValue}</span>
                )}
              </div>
              <div className="ws-medal-name">{b.badgeName}</div>
              <div className="ws-medal-cond">
                {BADGE_CONDITION_LABEL_TH[b.conditionType] || b.conditionType} ≥ {b.conditionValue}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
