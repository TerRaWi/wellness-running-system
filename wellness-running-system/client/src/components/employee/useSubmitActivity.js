import { useState } from 'react';
import useApiData from '../../hooks/useApiData';

// แท็บ "ส่งกิจกรรม": รายการประเภทกิจกรรม + ฟอร์มส่ง + ประวัติการส่งของฉัน
export default function useSubmitActivity(api) {
  const { data: activities } = useApiData(api, '/api/activities', { initialData: [] });
  const submissions = useApiData(api, '/api/my-submissions', { initialData: [] });

  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submitState, setSubmitState] = useState('idle'); // idle | submitting | success | error
  const [submitMessage, setSubmitMessage] = useState('');

  const selectedActivity = activities.find((a) => String(a.activity_id) === String(selectedActivityId));
  const photoRequired = Boolean(selectedActivity?.require_image);

  function fail(message) {
    setSubmitState('error');
    setSubmitMessage(message);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedActivityId) return fail('กรุณาเลือกประเภทกิจกรรม');
    if (photoRequired && !proofFile) return fail('กิจกรรมนี้ต้องแนบรูปหลักฐาน');

    setSubmitState('submitting');
    setSubmitMessage('');
    try {
      const formData = new FormData();
      formData.append('activityId', selectedActivityId);
      formData.append('distance', distance);
      formData.append('duration', duration);
      formData.append('note', note);
      if (proofFile) formData.append('proofImage', proofFile);

      const data = await api.request('/api/submissions', { method: 'POST', body: formData, errorMessage: 'ส่งข้อมูลไม่สำเร็จ' });

      setSubmitState('success');
      setSubmitMessage(data.message || 'ส่งข้อมูลการวิ่งสำเร็จ กรุณารอการตรวจสอบจากแอดมิน');
      setSelectedActivityId('');
      setDistance('');
      setDuration('');
      setNote('');
      setProofFile(null);
      await submissions.reload();
    } catch (err) {
      fail(err.message || 'เกิดข้อผิดพลาด');
    }
  }

  return {
    mySubmissions: submissions.data,
    // props ของ SubmitActivitySection
    formProps: {
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
      onSubmit: handleSubmit,
    },
  };
}
