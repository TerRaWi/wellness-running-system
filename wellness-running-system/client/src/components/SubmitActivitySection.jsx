export default function SubmitActivitySection({
  activities,
  selectedActivityId,
  setSelectedActivityId,
  distance,
  setDistance,
  duration,
  setDuration,
  note,
  setNote,
  setProofFile,
  photoRequired,
  submitState,
  submitMessage,
  onSubmit,
}) {
  return (
    <div>
      <h3>ส่งกิจกรรมวิ่ง/เดิน</h3>
      <form onSubmit={onSubmit} className="ws-stack" style={{ textAlign: 'left' }}>
        <div>
          <label htmlFor="activitySelect" className="ws-label">ประเภทกิจกรรม</label>
          <select
            id="activitySelect"
            value={selectedActivityId}
            onChange={(e) => setSelectedActivityId(e.target.value)}
            className="ws-select"
          >
            <option value="">-- เลือกกิจกรรม --</option>
            {Object.entries(
              activities.reduce((groups, a) => {
                const key = a.category_name;
                if (!groups[key]) groups[key] = [];
                groups[key].push(a);
                return groups;
              }, {})
            ).map(([categoryName, items]) => (
              <optgroup key={categoryName} label={categoryName}>
                {items.map((a) => (
                  <option key={a.activity_id} value={a.activity_id}>
                    {a.activity_name} ({a.score} คะแนน)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="distanceInput" className="ws-label">ระยะทาง (กม.)</label>
          <input
            id="distanceInput"
            type="number"
            step="0.1"
            min="0"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className="ws-input"
          />
        </div>

        <div>
          <label htmlFor="durationInput" className="ws-label">ระยะเวลา (นาที)</label>
          <input
            id="durationInput"
            type="number"
            step="1"
            min="0"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="ws-input"
          />
        </div>

        <div>
          <label htmlFor="noteInput" className="ws-label">หมายเหตุ (ถ้ามี)</label>
          <textarea
            id="noteInput"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="ws-textarea"
          />
        </div>

        <div>
          <label htmlFor="proofInput" className="ws-label">
            รูปหลักฐาน {photoRequired ? '(บังคับ)' : '(ไม่บังคับ)'}
          </label>
          <input
            id="proofInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
          />
        </div>

        <button type="submit" className="ws-btn ws-btn-primary" disabled={submitState === 'submitting'}>
          {submitState === 'submitting' ? 'กำลังส่ง...' : 'ส่งข้อมูล'}
        </button>
      </form>

      {submitMessage && (
        <div className={`ws-alert ${submitState === 'error' ? 'ws-alert-danger' : 'ws-alert-success'}`}>{submitMessage}</div>
      )}
    </div>
  );
}