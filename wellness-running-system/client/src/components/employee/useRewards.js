import { useState } from 'react';
import useApiData from '../../hooks/useApiData';

// แท็บ "ของรางวัล" + คะแนนคงเหลือบนเบอร์วิ่ง
export default function useRewards(api) {
  const score = useApiData(api, '/api/my-score');
  const rewards = useApiData(api, '/api/rewards', { initialData: [] });
  const myRedeems = useApiData(api, '/api/my-redeems', { initialData: [] });

  const [redeemingRewardId, setRedeemingRewardId] = useState(null);
  const [cancelingRedeemId, setCancelingRedeemId] = useState(null);
  const [rewardMessage, setRewardMessage] = useState('');
  const [rewardMessageType, setRewardMessageType] = useState('info'); // 'success' | 'error'

  function reloadAll() {
    return Promise.all([score.reload(), rewards.reload(), myRedeems.reload()]);
  }

  // แลก/ยกเลิก: แสดงผลลัพธ์ แล้วโหลดคะแนน + รายการใหม่
  async function runAction(setBusyId, id, request, successMessage) {
    setBusyId(id);
    setRewardMessage('');
    try {
      const data = await request();
      setRewardMessageType('success');
      setRewardMessage(successMessage(data));
      await reloadAll();
    } catch (err) {
      setRewardMessageType('error');
      setRewardMessage(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setBusyId(null);
    }
  }

  function handleRedeem(rewardId) {
    return runAction(
      setRedeemingRewardId,
      rewardId,
      () => api.request('/api/redeem', { method: 'POST', json: { rewardId }, errorMessage: 'แลกของรางวัลไม่สำเร็จ' }),
      (data) => data.message || 'แลกของรางวัลสำเร็จ'
    );
  }

  function handleCancelRedeem(redeemId) {
    return runAction(
      setCancelingRedeemId,
      redeemId,
      () => api.request(`/api/redeem/${redeemId}/cancel`, { method: 'POST', errorMessage: 'ยกเลิกไม่สำเร็จ' }),
      () => 'ยกเลิกรายการแลกของสำเร็จ คืนคะแนนแล้ว'
    );
  }

  return {
    scoreBalance: score.data?.balance ?? 0,
    // props ของ RewardsSection (ยกเว้น apiBase)
    sectionProps: {
      rewards: rewards.data,
      scoreBalance: score.data?.balance ?? 0,
      rewardMessage,
      rewardMessageType,
      redeemingRewardId,
      onRedeem: handleRedeem,
      myRedeems: myRedeems.data,
      cancelingRedeemId,
      onCancelRedeem: handleCancelRedeem,
    },
  };
}
