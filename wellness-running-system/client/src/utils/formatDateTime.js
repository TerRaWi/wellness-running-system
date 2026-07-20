// จุดเดียวที่ควบคุมการแสดงผลวัน-เวลาแบบไทยของทั้งระบบ (24 ชั่วโมงเสมอ ไม่ว่า browser/OS จะตั้งค่าเป็นแบบไหน)
// ใช้ทั้งฝั่งพนักงาน (ChallengesSection, RewardsSection, SubmissionHistorySection)
// และฝั่งแอดมิน (AdminApp) เพื่อให้ format ตรงกันทุกที่
export function formatDateTimeShort(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const datePart = d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${datePart} ${timePart} น.`;
}