import { formatDateTimeShort } from '../utils/formatDateTime';

const STATUS_LABEL_TH = {
  PENDING: 'รอดำเนินการ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
  CANCELLED: 'ยกเลิกแล้ว',
};

export default function RewardsSection({
  rewards,
  scoreBalance,
  rewardMessage,
  rewardMessageType,
  redeemingRewardId,
  onRedeem,
  apiBase,
  myRedeems,
  cancelingRedeemId,
  onCancelRedeem,
}) {
  return (
    <div>
      <div className="ws-row-between">
        <h3 style={{ margin: 0 }}>แลกของรางวัล</h3>
        <span>
          คะแนนคงเหลือ: <strong style={{ color: 'var(--ws-primary)' }}>{scoreBalance}</strong>
        </span>
      </div>

      {rewardMessage && (
        <div className={`ws-alert ${rewardMessageType === 'error' ? 'ws-alert-danger' : 'ws-alert-success'}`}>{rewardMessage}</div>
      )}

      {rewards.length === 0 && <p className="ws-empty">ยังไม่มีของรางวัลให้แลกตอนนี้</p>}

      <div className="ws-grid-tiles">
        {rewards.map((r) => {
          const canAfford = scoreBalance >= r.required_score;
          const inStock = r.stock > 0;
          const isRedeeming = redeemingRewardId === r.reward_id;
          return (
            <div key={r.reward_id} className="ws-tile">
              <div className="ws-tile-image">
                {r.image ? (
                  <img src={`${apiBase}/${r.image}`} alt={r.reward_name} />
                ) : (
                  <span style={{ fontSize: 48 }}>🎁</span>
                )}
              </div>
              <div className="ws-tile-body">
                <div className="ws-tile-title">{r.reward_name}</div>
                <div style={{ fontSize: 14, color: 'var(--ws-text-secondary)' }}>
                  {r.required_score} คะแนน · เหลือ {r.stock} ชิ้น
                </div>
                {r.description && (
                  <div style={{ fontSize: 13, color: 'var(--ws-text-muted)' }}>{r.description}</div>
                )}
              </div>
              <div className="ws-tile-actions">
                <button
                  className={`ws-btn ws-btn-primary${canAfford && inStock ? ' ws-btn-shine' : ''}`}
                  onClick={() => onRedeem(r.reward_id)}
                  disabled={!canAfford || !inStock || isRedeeming}
                >
                  {isRedeeming ? 'กำลังแลก...' : !inStock ? 'ของหมด' : !canAfford ? 'คะแนนไม่พอ' : 'แลก'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <h4 style={{ marginTop: 20 }}>ประวัติการแลกของ</h4>
      {myRedeems.length === 0 && <p className="ws-empty">ยังไม่มีประวัติการแลกของ</p>}
      {myRedeems.length > 0 && (
        <div className="ws-stack">
          {myRedeems.map((rd) => (
            <div key={rd.redeem_id} className="ws-card ws-card-row">
              <div>
                <div style={{ fontWeight: 'bold' }}>{rd.reward_name}</div>
                <div style={{ fontSize: 14, color: 'var(--ws-text-secondary)' }}>
                  ใช้ {rd.used_score} คะแนน ·{' '}
                  <span className={`ws-badge ${
                    rd.status === 'APPROVED' ? 'ws-badge-success' :
                    rd.status === 'REJECTED' || rd.status === 'CANCELLED' ? 'ws-badge-danger' :
                    'ws-badge-warning'
                  }`}>{STATUS_LABEL_TH[rd.status] || rd.status}</span>
                  {' '}· {formatDateTimeShort(rd.redeem_date)}
                </div>
              </div>
              {rd.status === 'PENDING' && (
                <button
                  className="ws-btn ws-btn-danger ws-btn-sm"
                  onClick={() => onCancelRedeem(rd.redeem_id)}
                  disabled={cancelingRedeemId === rd.redeem_id}
                >
                  {cancelingRedeemId === rd.redeem_id ? 'กำลังยกเลิก...' : 'ยกเลิก'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}