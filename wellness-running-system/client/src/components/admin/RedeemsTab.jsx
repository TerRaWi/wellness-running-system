import { useState } from 'react';
import { formatDateTimeShort } from '../../utils/formatDateTime';
import useApiData from '../../hooks/useApiData';
import { ErrorAlert, ListState, PersonCell, StatusFilterBar, TableScroll } from './AdminUi';

const STATUS_OPTIONS = [
  ['PENDING', 'รอดำเนินการ (PENDING)'],
  ['APPROVED', 'อนุมัติแล้ว (APPROVED)'],
  ['REJECTED', 'ถูกปฏิเสธ (REJECTED)'],
  ['CANCELLED', 'ยกเลิกแล้ว (CANCELLED)'],
];

// คำขอแลกของรางวัล — โหลดใหม่ทุกครั้งที่เปิดแท็บและเมื่อเปลี่ยนตัวกรอง
// ตัวกรองเก็บไว้ที่ AdminApp เพราะการ์ดบนแดชบอร์ดสั่งเปลี่ยนเป็น PENDING ได้
export default function RedeemsTab({ api, refreshKey, statusFilter, onStatusFilterChange }) {
  const redeems = useApiData(api, `/api/admin/redeems?status=${statusFilter}`, {
    enabled: refreshKey !== null,
    refreshKey,
    initialData: [],
    errorMessage: 'โหลดรายการไม่สำเร็จ',
  });
  const [actioningId, setActioningId] = useState(null);
  const [actionError, setActionError] = useState('');

  async function runAction(redeemId, action, errorMessage) {
    setActioningId(redeemId);
    setActionError('');
    try {
      await api.request(`/api/admin/redeems/${redeemId}/${action}`, { method: 'POST', errorMessage });
      redeems.setData((prev) => prev.filter((r) => r.redeem_id !== redeemId));
    } catch (err) {
      setActionError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActioningId(null);
    }
  }

  function handleReject(redeemId) {
    if (!window.confirm('ยืนยันปฏิเสธรายการนี้? ระบบจะคืน stock และคืนคะแนนให้พนักงานอัตโนมัติ')) return;
    runAction(redeemId, 'reject', 'ปฏิเสธไม่สำเร็จ');
  }

  return (
    <>
      <StatusFilterBar
        id="redeemStatusFilter"
        value={statusFilter}
        onChange={onStatusFilterChange}
        options={STATUS_OPTIONS}
        onRefresh={redeems.reload}
      />

      <ErrorAlert message={actionError} />
      <ListState error={redeems.error} loading={redeems.loading} isEmpty={redeems.data.length === 0} emptyText="ไม่มีรายการในสถานะนี้">
        <TableScroll>
          <thead>
            <tr>
              <th>#</th>
              <th>พนักงาน</th>
              <th>แผนก</th>
              <th>ของรางวัล</th>
              <th>คะแนนที่ใช้</th>
              <th>วันที่แลก</th>
              {statusFilter === 'PENDING' && <th>จัดการ</th>}
            </tr>
          </thead>
          <tbody>
            {redeems.data.map((rd) => (
              <tr key={rd.redeem_id}>
                <td>{rd.redeem_id}</td>
                <td>
                  <PersonCell name={rd.full_name} employeeId={rd.employee_id} />
                </td>
                <td>{rd.department || '-'}</td>
                <td>{rd.reward_name}</td>
                <td>{rd.used_score}</td>
                <td>{formatDateTimeShort(rd.redeem_date)}</td>
                {statusFilter === 'PENDING' && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="ws-btn ws-btn-primary ws-btn-sm"
                      onClick={() => runAction(rd.redeem_id, 'approve', 'อนุมัติไม่สำเร็จ')}
                      disabled={actioningId === rd.redeem_id}
                      style={{ marginRight: 6 }}
                    >
                      {actioningId === rd.redeem_id ? '...' : 'อนุมัติ (มอบของแล้ว)'}
                    </button>
                    <button
                      className="ws-btn ws-btn-danger ws-btn-sm"
                      onClick={() => handleReject(rd.redeem_id)}
                      disabled={actioningId === rd.redeem_id}
                    >
                      {actioningId === rd.redeem_id ? '...' : 'ปฏิเสธ'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </TableScroll>
      </ListState>
    </>
  );
}
