import { resolveImageUrl } from '../utils/resolveImageUrl';

export default function NewBadgePopup({ badges, apiBase, onClose }) {
  if (badges.length === 0) return null;

  return (
    <div className="ws-modal-overlay" style={{ zIndex: 1100 }}>
      <div className="ws-modal" style={{ maxWidth: 360, textAlign: 'center' }}>
        <p className="ws-eyebrow">เข้าเส้นชัย</p>
        <h3>ได้เหรียญตราใหม่</h3>
        <div className="ws-stack" style={{ gap: 'var(--ws-sp-6)', marginBottom: 'var(--ws-sp-6)' }}>
          {badges.map((b) => (
            <div key={b.badgeId} className="ws-medal">
              <div className="ws-icon-circle" style={{ width: 96, height: 96 }}>
                {b.icon ? (
                  <img src={resolveImageUrl(apiBase, b.icon)} alt={b.badgeName} />
                ) : (
                  <span className="ws-medal-fallback" style={{ fontSize: 30 }}>{b.conditionValue}</span>
                )}
              </div>
              <div style={{ fontWeight: 600 }}>{b.badgeName}</div>
              {b.description && <div style={{ fontSize: 13, color: 'var(--ws-text-secondary)' }}>{b.description}</div>}
            </div>
          ))}
        </div>
        <button className="ws-btn ws-btn-primary ws-btn-shine" style={{ width: '100%' }} onClick={onClose}>รับทราบ</button>
      </div>
    </div>
  );
}
