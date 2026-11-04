import { useCallback, useEffect, useState } from 'react';

// โหลดข้อมูลจาก API แบบ GET ให้ component — แทนแพทเทิร์นเดิม useEffect(() => { loadX() }, [...])
// ที่ไปเรียก setState ตรงๆ ใน effect (lint: react-hooks/set-state-in-effect)
//
// - path เป็น null หรือ enabled=false → ยังไม่โหลด
// - โหลดใหม่เองเมื่อ path หรือ refreshKey เปลี่ยน (เช่น เปลี่ยนตัวกรอง / กลับเข้าแท็บนี้อีกครั้ง)
// - reload() โหลดใหม่ตอนกดปุ่ม/หลังบันทึก
// - ระหว่างโหลดยังเก็บข้อมูลชุดก่อนไว้ (data) และซ่อน error เก่า เหมือนพฤติกรรมเดิม
// - setData/setError ใช้แก้ข้อมูลในรายการทันที (เช่น ตัดแถวที่อนุมัติแล้วออก) หรือแสดง error จากปุ่มจัดการ
export default function useApiData(api, path, { enabled = true, refreshKey = 0, initialData = null, errorMessage } = {}) {
  const [initial] = useState(initialData);
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState({ key: null, data: initial, error: '' });

  const requestKey = enabled && path ? `${path}#${refreshKey}#${reloadCount}` : null;

  useEffect(() => {
    if (!requestKey) return undefined;
    let ignore = false;
    api.request(path, { errorMessage }).then(
      (data) => {
        // กันกรณีเซิร์ฟเวอร์ตอบ ok แต่ไม่ใช่ JSON ที่คาดไว้ (เดิมได้ [] ไว้แสดงเป็นรายการว่าง)
        const safeData = Array.isArray(initial) && !Array.isArray(data) ? initial : data;
        if (!ignore) setResult({ key: requestKey, data: safeData, error: '' });
      },
      (err) => {
        if (!ignore) setResult((prev) => ({ key: requestKey, data: prev.data, error: err.message || 'เกิดข้อผิดพลาด' }));
      }
    );
    return () => {
      ignore = true;
    };
  }, [api, path, errorMessage, requestKey, initial]);

  const loading = requestKey !== null && result.key !== requestKey;

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  const setData = useCallback(
    (updater) =>
      setResult((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater })),
    []
  );
  const setError = useCallback((error) => setResult((prev) => ({ ...prev, error })), []);

  return { data: result.data, loading, error: loading ? '' : result.error, reload, setData, setError };
}
