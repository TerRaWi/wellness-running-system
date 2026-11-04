import { useState } from 'react';
import useApiData from '../../hooks/useApiData';

// แท็บ "ชาเลนจ์": เข้าร่วม (แสดงชื่อ/ไม่ระบุตัวตน), แก้ชื่อที่แสดง, ดู leaderboard
export default function useChallenges(api) {
  const challenges = useApiData(api, '/api/challenges', { initialData: [] });
  const myChallenges = useApiData(api, '/api/my-challenges', { initialData: [] });

  const [challengeMessage, setChallengeMessage] = useState('');
  const [challengeMessageType, setChallengeMessageType] = useState('info'); // 'success' | 'error'
  const [joiningChallengeId, setJoiningChallengeId] = useState(null);
  const [joinModeByChallenge, setJoinModeByChallenge] = useState({}); // { [challengeId]: 'PUBLIC' | 'ANONYMOUS' }
  const [joinAliasByChallenge, setJoinAliasByChallenge] = useState({}); // { [challengeId]: string } ชื่อที่ตั้งตอนเข้าร่วมแบบ ANONYMOUS
  const [editingAliasChallengeId, setEditingAliasChallengeId] = useState(null);
  const [aliasDraftByChallenge, setAliasDraftByChallenge] = useState({}); // { [challengeId]: string } ชื่อที่กำลังแก้ไข
  const [savingAliasChallengeId, setSavingAliasChallengeId] = useState(null);

  const [leaderboardChallengeId, setLeaderboardChallengeId] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState('');

  function reloadAll() {
    return Promise.all([challenges.reload(), myChallenges.reload()]);
  }

  function showMessage(type, message) {
    setChallengeMessageType(type);
    setChallengeMessage(message);
  }

  async function handleJoinChallenge(challengeId) {
    const joinMode = joinModeByChallenge[challengeId] || 'PUBLIC';
    setJoiningChallengeId(challengeId);
    setChallengeMessage('');
    try {
      const data = await api.request(`/api/challenges/${challengeId}/join`, {
        method: 'POST',
        json: {
          joinMode,
          displayAlias: joinMode === 'ANONYMOUS' ? joinAliasByChallenge[challengeId] || '' : undefined,
        },
        errorMessage: 'เข้าร่วม challenge ไม่สำเร็จ',
      });
      showMessage('success', data.message || 'เข้าร่วม challenge สำเร็จ');
      setJoinAliasByChallenge((prev) => ({ ...prev, [challengeId]: '' }));
      await reloadAll();
    } catch (err) {
      showMessage('error', err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setJoiningChallengeId(null);
    }
  }

  function startEditAlias(challengeId) {
    const mc = myChallenges.data.find((m) => m.challenge_id === challengeId);
    setAliasDraftByChallenge((prev) => ({ ...prev, [challengeId]: mc?.display_alias || '' }));
    setEditingAliasChallengeId(challengeId);
  }

  function cancelEditAlias(challengeId) {
    setEditingAliasChallengeId(null);
    setAliasDraftByChallenge((prev) => ({ ...prev, [challengeId]: '' }));
  }

  async function handleSaveAlias(challengeId) {
    setSavingAliasChallengeId(challengeId);
    setChallengeMessage('');
    try {
      const data = await api.request(`/api/challenges/${challengeId}/alias`, {
        method: 'PATCH',
        json: { displayAlias: aliasDraftByChallenge[challengeId] || '' },
        errorMessage: 'แก้ไขชื่อที่แสดงไม่สำเร็จ',
      });
      showMessage('success', data.message || 'แก้ไขชื่อที่แสดงสำเร็จ');
      setEditingAliasChallengeId(null);
      await reloadAll();
    } catch (err) {
      showMessage('error', err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSavingAliasChallengeId(null);
    }
  }

  async function openLeaderboard(challengeId) {
    setLeaderboardChallengeId(challengeId);
    setLeaderboardLoading(true);
    setLeaderboardError('');
    setLeaderboard([]);
    try {
      const data = await api.request(`/api/challenges/${challengeId}/leaderboard`, { errorMessage: 'โหลด leaderboard ไม่สำเร็จ' });
      setLeaderboard(data);
    } catch (err) {
      setLeaderboardError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLeaderboardLoading(false);
    }
  }

  function closeLeaderboard() {
    setLeaderboardChallengeId(null);
    setLeaderboard([]);
    setLeaderboardError('');
  }

  return {
    // props ของ ChallengesSection
    sectionProps: {
      myChallenges: myChallenges.data,
      challenges: challenges.data,
      challengeMessage,
      challengeMessageType,
      joiningChallengeId,
      joinModeByChallenge,
      setJoinModeByChallenge,
      joinAliasByChallenge,
      setJoinAliasByChallenge,
      onJoinChallenge: handleJoinChallenge,
      onOpenLeaderboard: openLeaderboard,
      editingAliasChallengeId,
      aliasDraftByChallenge,
      setAliasDraftByChallenge,
      onStartEditAlias: startEditAlias,
      onCancelEditAlias: cancelEditAlias,
      onSaveAlias: handleSaveAlias,
      savingAliasChallengeId,
    },
    // props ของ LeaderboardModal
    leaderboardProps: {
      challengeId: leaderboardChallengeId,
      leaderboard,
      loading: leaderboardLoading,
      error: leaderboardError,
      onClose: closeLeaderboard,
    },
  };
}
