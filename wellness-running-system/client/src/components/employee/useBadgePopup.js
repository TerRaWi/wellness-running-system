import { useState } from 'react';
import useApiData from '../../hooks/useApiData';

// localStorage เก็บเวลา badge ล่าสุดที่พนักงานคนนี้ "เห็น" popup ไปแล้ว กันเด้งซ้ำทุกครั้งที่เปิดแอป
const lastSeenKey = (employeeId) => `wellness_last_seen_badge_${employeeId}`;

// แท็บ "เหรียญตรา" + popup เหรียญที่ได้ใหม่ตั้งแต่เปิดแอปครั้งก่อน
export default function useBadgePopup(api, employeeId) {
  const { data: badges, loading } = useApiData(api, '/api/my-badges', { initialData: [] });
  const [lastSeenAt, setLastSeenAt] = useState(() => (employeeId ? localStorage.getItem(lastSeenKey(employeeId)) : null));
  const [dismissed, setDismissed] = useState(false);

  // ยังไม่เคยเปิดแอปนี้เลย (ไม่มี lastSeenAt) ให้เห็น badge ที่มีอยู่ทั้งหมดเป็น "ใหม่" ครั้งแรกครั้งเดียว
  const newBadges =
    !employeeId || loading || dismissed
      ? []
      : badges
          .filter((b) => b.earned)
          .filter((b) => !lastSeenAt || new Date(b.receivedAt).getTime() > new Date(lastSeenAt).getTime());

  function closePopup() {
    if (employeeId) {
      const now = new Date().toISOString();
      localStorage.setItem(lastSeenKey(employeeId), now);
      setLastSeenAt(now);
    }
    setDismissed(true);
  }

  return { badges, newBadges, closePopup };
}
