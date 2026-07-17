export default function NewBadgePopup({ badges, apiBase, onClose }) {
  if (badges.length === 0) return null;

  return (
    <div className="ws-modal-overlay" style={{ zIndex: 1100 }}>
      <div className="ws-modal" style={{ maxWidth: 360, textAlign: 'center' }}>
        <h3>🎉 ได้ Badge ใหม่!</h3>
        <div className="ws-stack" style={{ marginBottom: 16 }}>
          {badges.map((b) => (
            <div key={b.badgeId}>
              <div className="ws-icon-circle" style={{ width: 72, height: 72, margin: '0 auto 6px' }}>
                {b.icon ? (
                  <img src={`${apiBase}/${b.icon}`} alt={b.badgeName} />
                ) : (
                  <span style={{ fontSize: 32 }}>🏅</span>
                )}
              </div>
              <div style={{ fontWeight: 'bold' }}>{b.badgeName}</div>
              {b.description && <div style={{ fontSize: 13, color: 'var(--ws-text-secondary)' }}>{b.description}</div>}
            </div>
          ))}
        </div>
        <button className="ws-btn ws-btn-primary" onClick={onClose}>รับทราบ</button>
      </div>
    </div>
  );
}