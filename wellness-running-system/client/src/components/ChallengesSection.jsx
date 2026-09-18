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
  joinAliasByChallenge,
  setJoinAliasByChallenge,
  onJoinChallenge,
  onOpenLeaderboard,
  editingAliasChallengeId,
  aliasDraftByChallenge,
  setAliasDraftByChallenge,
  onStartEditAlias,
  onCancelEditAlias,
  onSaveAlias,
  savingAliasChallengeId,
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
            {myChallenges.map((mc) => {
              const canEditAlias = mc.join_mode === 'ANONYMOUS' && ['UPCOMING', 'ONGOING'].includes(mc.status);
              const isEditingAlias = editingAliasChallengeId === mc.challenge_id;
              const isSavingAlias = savingAliasChallengeId === mc.challenge_id;
              return (
                <div key={mc.participant_id} className="ws-card ws-card-row">
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{mc.challenge_name}</div>
                    <div style={{ fontSize: 14, color: 'var(--ws-text-secondary)' }}>
                      {mc.category_name} · <span className="ws-badge ws-badge-info">{CHALLENGE_STATUS_LABEL_TH[mc.status] || mc.status}</span> · ระยะทางสะสมของฉัน{' '}
                      {mc.my_distance} กม.
                      {mc.join_mode === 'ANONYMOUS' && (
                        <> · ไม่ระบุตัวตน{mc.display_alias ? ` (ชื่อที่แสดง: ${mc.display_alias})` : ''}</>
                      )}
                    </div>

                    {isEditingAlias && (
                      <div className="ws-row" style={{ marginTop: 8 }}>
                        <input
                          type="text"
                          className="ws-input"
                          style={{ width: 'auto' }}
                          maxLength={50}
                          placeholder="ตั้งชื่อที่แสดง เช่น 🐱 นักวิ่งลึกลับ"
                          value={aliasDraftByChallenge[mc.challenge_id] ?? mc.display_alias ?? ''}
                          onChange={(e) =>
                            setAliasDraftByChallenge((prev) => ({ ...prev, [mc.challenge_id]: e.target.value }))
                          }
                        />
                        <button
                          className="ws-btn ws-btn-primary ws-btn-sm"
                          disabled={isSavingAlias}
                          onClick={() => onSaveAlias(mc.challenge_id)}
                        >
                          {isSavingAlias ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                        <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => onCancelEditAlias(mc.challenge_id)}>
                          ยกเลิก
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="ws-row">
                    {canEditAlias && !isEditingAlias && (
                      <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => onStartEditAlias(mc.challenge_id)}>
                        แก้ไขชื่อที่แสดง
                      </button>
                    )}
                    <button className="ws-btn ws-btn-secondary ws-btn-sm" onClick={() => onOpenLeaderboard(mc.challenge_id)}>ดู Leaderboard</button>
                  </div>
                </div>
              );
            })}
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
                    {(joinModeByChallenge[c.challenge_id] || 'PUBLIC') === 'ANONYMOUS' && (
                      <input
                        type="text"
                        className="ws-input"
                        style={{ width: 'auto' }}
                        maxLength={50}
                        placeholder="ตั้งชื่อที่แสดง เช่น 🐱 นักวิ่งลึกลับ"
                        value={joinAliasByChallenge[c.challenge_id] || ''}
                        onChange={(e) =>
                          setJoinAliasByChallenge((prev) => ({ ...prev, [c.challenge_id]: e.target.value }))
                        }
                      />
                    )}
                    <button className="ws-btn ws-btn-primary ws-btn-sm ws-btn-shine" onClick={() => onJoinChallenge(c.challenge_id)} disabled={isJoining}>
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