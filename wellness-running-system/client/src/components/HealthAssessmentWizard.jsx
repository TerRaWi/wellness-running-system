import { useState } from "react";

// ---- ตัวเลือก preset ต่างๆ ตามแบบสอบถาม baseline สุขภาพ ----
const CHRONIC_DISEASE_OPTIONS = [
  "เบาหวาน",
  "ความดันโลหิตสูง",
  "ไขมันในเลือดสูง",
  "โรคหัวใจ",
  "ข้อ/กระดูก",
  "อื่นๆ",
];

const EXERCISE_PATTERN_OPTIONS = [
  "เดิน/วิ่ง",
  "โยคะ",
  "ฟิตเนส/เวทเทรนนิ่ง",
  "ปั่นจักรยาน",
  "ว่ายน้ำ",
  "กีฬาประเภททีม",
  "ไม่ได้ออกกำลังกาย",
  "อื่นๆ",
];

const GOAL_TYPE_OPTIONS = [
  "ลดน้ำหนัก",
  "ส่งเสริมสุขภาพที่ดี",
  "ควบคุมโรคประจำตัว",
  "ลดความเครียด",
  "สร้างวินัยออกกำลังกาย",
  "อื่นๆ",
];

const STAGE_OF_CHANGE_OPTIONS = [
  { value: "NOT_CONSIDERING", label: "ยังไม่คิดจะเริ่ม" },
  { value: "CONSIDERING_6M", label: "กำลังคิดจะเริ่มใน 6 เดือนข้างหน้า" },
  { value: "PLANNING_1M", label: "วางแผนจะเริ่มใน 1 เดือนข้างหน้า" },
  { value: "ACTIVE_UNDER_6M", label: "เริ่มทำแล้วแต่ยังไม่ถึง 6 เดือน" },
  { value: "ACTIVE_OVER_6M", label: "ทำต่อเนื่องมากกว่า 6 เดือน" },
];

const FREQ_4_OPTIONS = [
  { value: "NEVER", label: "ไม่เลย" },
  { value: "1_2_PER_WEEK", label: "1-2 ครั้ง" },
  { value: "3_4_PER_WEEK", label: "3-4 ครั้ง" },
  { value: "5_PLUS_PER_WEEK", label: "5 ครั้งขึ้นไป" },
];

const VEGGIE_FRUIT_OPTIONS = [
  { value: "NONE", label: "ไม่รับประทาน" },
  { value: "1_SERVING", label: "1 ส่วน" },
  { value: "2_SERVINGS", label: "2 ส่วน" },
  { value: "3_PLUS_SERVINGS", label: "3 ส่วนขึ้นไป" },
];

const initialForm = {
  jobPosition: "",
  yearsOfService: "",
  shiftType: "",
  weightKg: "",
  heightCm: "",
  waistCm: "",
  bpSystolic: "",
  bpDiastolic: "",
  chronicDisease: [],
  chronicDiseaseOther: "",
  smokingStatus: "NONE",
  alcoholStatus: "NONE",
  physicalLimitation: false,
  physicalLimitationNote: "",
  vigorousDays: 0,
  vigorousMinutes: "",
  moderateDays: 0,
  moderateMinutes: "",
  walkingDays: 0,
  exercisePattern: [],
  exerciseBarrier: "",
  mealsPerDay: "",
  friedFoodFreq: "",
  sweetFoodFreq: "",
  veggieFruitFreq: "",
  lateNightEating: "",
  pastDieting: "",
  goalType: [],
  stageOfChange: "",
  targetWeightKg: "",
};

// ปุ่มเลือกได้หลายข้อ (chip) — toggle ค่าเข้า/ออกจาก array ใน form state
function ChipGroup({ options, selected, onToggle }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className="ws-btn ws-btn-sm"
            style={{
              borderColor: active ? "var(--ws-primary)" : undefined,
              background: active ? "var(--ws-primary)" : undefined,
              color: active ? "#fff" : undefined,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function RadioPills({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
      {options.map((opt) => {
        const optValue = typeof opt === "string" ? opt : opt.value;
        const optLabel = typeof opt === "string" ? opt : opt.label;
        const active = value === optValue;
        return (
          <button
            key={optValue}
            type="button"
            onClick={() => onChange(optValue)}
            className="ws-btn ws-btn-sm"
            style={{
              borderColor: active ? "var(--ws-primary)" : undefined,
              background: active ? "var(--ws-primary)" : undefined,
              color: active ? "#fff" : undefined,
            }}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}

export default function HealthAssessmentWizard({ apiBase, onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitState, setSubmitState] = useState("idle"); // idle | submitting | error
  const [errorMsg, setErrorMsg] = useState("");

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArrayField(key, value) {
    setForm((prev) => {
      const current = prev[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  }

  const steps = [
    { key: "consent", title: "ยินยอมการใช้ข้อมูล (PDPA)" },
    { key: "general", title: "ข้อมูลทั่วไป" },
    { key: "anthro", title: "ข้อมูลสุขภาพพื้นฐาน" },
    { key: "history", title: "ประวัติสุขภาพและปัจจัยเสี่ยง" },
    { key: "ipaq", title: "พฤติกรรมการออกกำลังกาย" },
    { key: "diet", title: "พฤติกรรมการรับประทานอาหาร" },
    { key: "goals", title: "เป้าหมายและความพร้อมในการปรับเปลี่ยน" },
  ];

  function validateCurrentStep() {
    const key = steps[stepIndex].key;
    if (key === "consent" && !consentAccepted) {
      return "กรุณายืนยันการยินยอมก่อนไปต่อ";
    }
    if (key === "anthro" && (!form.weightKg || !form.heightCm)) {
      return "กรุณากรอกน้ำหนักและส่วนสูง";
    }
    if (
      key === "diet" &&
      (!form.mealsPerDay ||
        !form.friedFoodFreq ||
        !form.sweetFoodFreq ||
        !form.veggieFruitFreq ||
        !form.lateNightEating ||
        !form.pastDieting)
    ) {
      return "กรุณาตอบให้ครบทุกข้อในหมวดนี้";
    }
    if (
      key === "goals" &&
      (form.goalType.length === 0 || !form.stageOfChange)
    ) {
      return "กรุณาเลือกเป้าหมายอย่างน้อย 1 ข้อ และระบุขั้นความพร้อม";
    }
    return "";
  }

  function goNext() {
    const err = validateCurrentStep();
    if (err) {
      setErrorMsg(err);
      return;
    }
    setErrorMsg("");
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      handleSubmit();
    }
  }

  function goBack() {
    setErrorMsg("");
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  async function handleSubmit() {
    setSubmitState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch(`${apiBase}/api/health-assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "บันทึกข้อมูลไม่สำเร็จ");
      }

      onComplete();
    } catch (err) {
      setSubmitState("error");
      setErrorMsg(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  }

  const currentKey = steps[stepIndex].key;
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div
      className="ws-app"
      style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}
    >
      {/* progress bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {steps.map((s, i) => (
          <div
            key={s.key}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background:
                i <= stepIndex ? "var(--ws-primary)" : "var(--ws-border)",
            }}
          />
        ))}
      </div>

      <p
        style={{
          fontSize: 12,
          color: "var(--ws-text-muted)",
          margin: "0 0 4px",
        }}
      >
        ขั้นตอน {stepIndex + 1} / {steps.length}
      </p>
      <h3 style={{ marginTop: 0 }}>{steps[stepIndex].title}</h3>

      <div className="ws-stack" style={{ textAlign: "left" }}>
        {currentKey === "consent" && (
          <div>
            <p style={{ color: "var(--ws-text-secondary)" }}>
              ระบบขอเก็บข้อมูลสุขภาพพื้นฐานและพฤติกรรมออกกำลังกายของท่าน
              เพื่อใช้เป็นข้อมูล baseline
              เปรียบเทียบผลลัพธ์การเปลี่ยนแปลงด้านสุขภาพหลังใช้งานแอป
              ข้อมูลนี้ถือเป็นข้อมูลสุขภาพส่วนบุคคล
              ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)
              จะถูกเก็บและใช้เพื่อวัตถุประสงค์นี้เท่านั้น
            </p>
            <label
              style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
            >
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                style={{ marginTop: 4 }}
              />
              <span>
                ฉันยินยอมให้เก็บและใช้ข้อมูลสุขภาพของฉันตามที่ระบุไว้ข้างต้น
              </span>
            </label>
          </div>
        )}

        {currentKey === "general" && (
          <>
            <div>
              <label className="ws-label" htmlFor="jobPosition">
                ตำแหน่ง/สายงาน
              </label>
              <select
                id="jobPosition"
                className="ws-select"
                value={form.jobPosition}
                onChange={(e) => setField("jobPosition", e.target.value)}
              >
                <option value="">-- เลือกตำแหน่ง --</option>
                <option value="พยาบาล">พยาบาล</option>
                <option value="ผู้ช่วยพยาบาล">ผู้ช่วยพยาบาล</option>
                <option value="เจ้าหน้าที่">เจ้าหน้าที่</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
            </div>
            <div>
              <label className="ws-label" htmlFor="yearsOfService">
                ระยะเวลาปฏิบัติงานในโรงพยาบาลนี้ (ปี)
              </label>
              <input
                id="yearsOfService"
                type="number"
                step="0.5"
                min="0"
                className="ws-input"
                value={form.yearsOfService}
                onChange={(e) => setField("yearsOfService", e.target.value)}
              />
            </div>
            <div>
              <label className="ws-label">
                ลักษณะเวรที่ปฏิบัติงานเป็นส่วนใหญ่
              </label>
              <RadioPills
                options={[
                  { value: "DAY", label: "เวรทำการ" },
                  { value: "SHIFT", label: "เวรผลัด" },
                ]}
                value={form.shiftType}
                onChange={(v) => setField("shiftType", v)}
              />
            </div>
          </>
        )}

        {currentKey === "anthro" && (
          <>
            <div>
              <label className="ws-label" htmlFor="weightKg">
                น้ำหนักตัวปัจจุบัน (กก.) *
              </label>
              <input
                id="weightKg"
                type="number"
                step="0.1"
                min="0"
                className="ws-input"
                value={form.weightKg}
                onChange={(e) => setField("weightKg", e.target.value)}
              />
            </div>
            <div>
              <label className="ws-label" htmlFor="heightCm">
                ส่วนสูง (ซม.) *
              </label>
              <input
                id="heightCm"
                type="number"
                step="0.1"
                min="0"
                className="ws-input"
                value={form.heightCm}
                onChange={(e) => setField("heightCm", e.target.value)}
              />
            </div>
            <div>
              <label className="ws-label" htmlFor="waistCm">
                รอบเอว (ซม.)
              </label>
              <input
                id="waistCm"
                type="number"
                step="0.1"
                min="0"
                className="ws-input"
                value={form.waistCm}
                onChange={(e) => setField("waistCm", e.target.value)}
              />
            </div>
            <div className="ws-row">
              <div style={{ flex: 1 }}>
                <label className="ws-label" htmlFor="bpSystolic">
                  ความดันโลหิต ค่าบน
                </label>
                <input
                  id="bpSystolic"
                  type="number"
                  className="ws-input"
                  value={form.bpSystolic}
                  onChange={(e) => setField("bpSystolic", e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="ws-label" htmlFor="bpDiastolic">
                  ค่าล่าง
                </label>
                <input
                  id="bpDiastolic"
                  type="number"
                  className="ws-input"
                  value={form.bpDiastolic}
                  onChange={(e) => setField("bpDiastolic", e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {currentKey === "history" && (
          <>
            <div>
              <label className="ws-label">
                ท่านมีโรคประจำตัวหรือไม่ (เลือกได้มากกว่า 1 ข้อ)
              </label>
              <ChipGroup
                options={CHRONIC_DISEASE_OPTIONS}
                selected={form.chronicDisease}
                onToggle={(v) => toggleArrayField("chronicDisease", v)}
              />
              {form.chronicDisease.includes("อื่นๆ") && (
                <input
                  type="text"
                  placeholder="ระบุโรคประจำตัวอื่นๆ"
                  className="ws-input"
                  style={{ marginTop: 8 }}
                  value={form.chronicDiseaseOther}
                  onChange={(e) =>
                    setField("chronicDiseaseOther", e.target.value)
                  }
                />
              )}
            </div>
            <div>
              <label className="ws-label">ท่านสูบบุหรี่หรือไม่</label>
              <RadioPills
                options={[
                  { value: "NONE", label: "ไม่สูบ" },
                  { value: "SMOKER", label: "สูบ" },
                  { value: "FORMER", label: "เลิกแล้ว" },
                ]}
                value={form.smokingStatus}
                onChange={(v) => setField("smokingStatus", v)}
              />
            </div>
            <div>
              <label className="ws-label">
                ท่านดื่มเครื่องดื่มแอลกอฮอล์หรือไม่
              </label>
              <RadioPills
                options={[
                  { value: "NONE", label: "ไม่ดื่ม" },
                  { value: "OCCASIONAL", label: "ดื่มเป็นครั้งคราว" },
                  { value: "REGULAR", label: "ดื่มเป็นประจำ" },
                ]}
                value={form.alcoholStatus}
                onChange={(v) => setField("alcoholStatus", v)}
              />
            </div>
            <div>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={form.physicalLimitation}
                  onChange={(e) =>
                    setField("physicalLimitation", e.target.checked)
                  }
                />
                <span>มีข้อจำกัดทางร่างกายที่มีผลต่อการออกกำลังกาย</span>
              </label>
              {form.physicalLimitation && (
                <input
                  type="text"
                  placeholder="ระบุข้อจำกัด"
                  className="ws-input"
                  style={{ marginTop: 8 }}
                  value={form.physicalLimitationNote}
                  onChange={(e) =>
                    setField("physicalLimitationNote", e.target.value)
                  }
                />
              )}
            </div>
          </>
        )}

        {currentKey === "ipaq" && (
          <>
            <div>
              <label className="ws-label">
                ออกกำลังกายระดับหนัก (เช่น วิ่ง, แอโรบิกหนัก) กี่วัน/สัปดาห์:{" "}
                {form.vigorousDays}
              </label>
              <input
                type="range"
                min="0"
                max="7"
                step="1"
                value={form.vigorousDays}
                onChange={(e) =>
                  setField("vigorousDays", Number(e.target.value))
                }
                style={{ width: "100%" }}
              />
              {form.vigorousDays > 0 && (
                <input
                  type="number"
                  placeholder="เฉลี่ยครั้งละกี่นาที"
                  className="ws-input"
                  style={{ marginTop: 6 }}
                  value={form.vigorousMinutes}
                  onChange={(e) => setField("vigorousMinutes", e.target.value)}
                />
              )}
            </div>
            <div>
              <label className="ws-label">
                ออกกำลังกายระดับปานกลาง (เช่น เดินเร็ว, ปั่นจักรยานเบาๆ)
                กี่วัน/สัปดาห์: {form.moderateDays}
              </label>
              <input
                type="range"
                min="0"
                max="7"
                step="1"
                value={form.moderateDays}
                onChange={(e) =>
                  setField("moderateDays", Number(e.target.value))
                }
                style={{ width: "100%" }}
              />
              {form.moderateDays > 0 && (
                <input
                  type="number"
                  placeholder="เฉลี่ยครั้งละกี่นาที"
                  className="ws-input"
                  style={{ marginTop: 6 }}
                  value={form.moderateMinutes}
                  onChange={(e) => setField("moderateMinutes", e.target.value)}
                />
              )}
            </div>
            <div>
              <label className="ws-label">
                เดินเพื่อการออกกำลังกาย/สันทนาการ กี่วัน/สัปดาห์:{" "}
                {form.walkingDays}
              </label>
              <input
                type="range"
                min="0"
                max="7"
                step="1"
                value={form.walkingDays}
                onChange={(e) =>
                  setField("walkingDays", Number(e.target.value))
                }
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="ws-label">
                รูปแบบการออกกำลังกายที่ทำเป็นประจำ (เลือกได้มากกว่า 1 ข้อ)
              </label>
              <ChipGroup
                options={EXERCISE_PATTERN_OPTIONS}
                selected={form.exercisePattern}
                onToggle={(v) => toggleArrayField("exercisePattern", v)}
              />
            </div>
            <div>
              <label className="ws-label">
                อุปสรรคสำคัญที่สุดที่ทำให้ออกกำลังกายไม่สม่ำเสมอ
              </label>
              <select
                className="ws-select"
                value={form.exerciseBarrier}
                onChange={(e) => setField("exerciseBarrier", e.target.value)}
              >
                <option value="">-- เลือก --</option>
                <option value="ไม่มีเวลา">ไม่มีเวลา</option>
                <option value="เหนื่อยล้าจากงาน">เหนื่อยล้าจากงาน</option>
                <option value="ไม่มีสถานที่/อุปกรณ์">
                  ไม่มีสถานที่/อุปกรณ์
                </option>
                <option value="ไม่มีแรงจูงใจ">ไม่มีแรงจูงใจ</option>
                <option value="เข้าเวรไม่แน่นอน">เข้าเวรไม่แน่นอน</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
            </div>
          </>
        )}

        {currentKey === "diet" && (
          <>
            <div>
              <label className="ws-label">
                จำนวนมื้ออาหารหลักที่รับประทานต่อวัน *
              </label>
              <RadioPills
                options={[
                  { value: "1", label: "1 มื้อ" },
                  { value: "2", label: "2 มื้อ" },
                  { value: "3", label: "3 มื้อ" },
                  { value: "MORE_THAN_3", label: "มากกว่า 3 มื้อ" },
                ]}
                value={form.mealsPerDay}
                onChange={(v) => setField("mealsPerDay", v)}
              />
            </div>
            <div>
              <label className="ws-label">
                ความถี่ในการรับประทานอาหารทอด/มัน (ต่อสัปดาห์) *
              </label>
              <RadioPills
                options={FREQ_4_OPTIONS}
                value={form.friedFoodFreq}
                onChange={(v) => setField("friedFoodFreq", v)}
              />
            </div>
            <div>
              <label className="ws-label">
                ความถี่ในการรับประทานอาหารหวาน/ขนม/เครื่องดื่มรสหวาน
                (ต่อสัปดาห์) *
              </label>
              <RadioPills
                options={FREQ_4_OPTIONS}
                value={form.sweetFoodFreq}
                onChange={(v) => setField("sweetFoodFreq", v)}
              />
            </div>
            <div>
              <label className="ws-label">
                ความถี่ในการรับประทานผัก/ผลไม้ (ต่อวัน) *
              </label>
              <RadioPills
                options={VEGGIE_FRUIT_OPTIONS}
                value={form.veggieFruitFreq}
                onChange={(v) => setField("veggieFruitFreq", v)}
              />
            </div>
            <div>
              <label className="ws-label">
                พฤติกรรมการรับประทานอาหารมื้อดึก (หลัง 20:00 น.) *
              </label>
              <RadioPills
                options={[
                  { value: "NEVER", label: "ไม่เคย" },
                  { value: "SOMETIMES", label: "บางครั้ง" },
                  { value: "REGULARLY", label: "เป็นประจำ" },
                ]}
                value={form.lateNightEating}
                onChange={(v) => setField("lateNightEating", v)}
              />
            </div>
            <div>
              <label className="ws-label">
                ท่านเคยควบคุม/จำกัดอาหารเพื่อลดน้ำหนักมาก่อนหรือไม่ *
              </label>
              <RadioPills
                options={[
                  { value: "NEVER", label: "ไม่เคย" },
                  { value: "CURRENTLY", label: "เคย (ปัจจุบันยังทำอยู่)" },
                  { value: "PAST_ONLY", label: "เคย (ปัจจุบันเลิกแล้ว)" },
                ]}
                value={form.pastDieting}
                onChange={(v) => setField("pastDieting", v)}
              />
            </div>
          </>
        )}

        {currentKey === "goals" && (
          <>
            <div>
              <label className="ws-label">
                เป้าหมายหลักที่ท่านต้องการจากการใช้แอปนี้ (เลือกได้มากกว่า 1
                ข้อ) *
              </label>
              <ChipGroup
                options={GOAL_TYPE_OPTIONS}
                selected={form.goalType}
                onToggle={(v) => toggleArrayField("goalType", v)}
              />
            </div>
            <div>
              <label className="ws-label">
                ปัจจุบันท่านอยู่ในขั้นใดของการเปลี่ยนพฤติกรรมสุขภาพ *
              </label>
              <RadioPills
                options={STAGE_OF_CHANGE_OPTIONS}
                value={form.stageOfChange}
                onChange={(v) => setField("stageOfChange", v)}
              />
            </div>
            <div>
              <label className="ws-label" htmlFor="targetWeightKg">
                น้ำหนักเป้าหมายที่ต้องการ (ถ้ามี)
              </label>
              <input
                id="targetWeightKg"
                type="number"
                step="0.1"
                min="0"
                className="ws-input"
                value={form.targetWeightKg}
                onChange={(e) => setField("targetWeightKg", e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      {errorMsg && (
        <div className="ws-alert ws-alert-danger" style={{ marginTop: 12 }}>
          {errorMsg}
        </div>
      )}

      <div className="ws-row" style={{ marginTop: 16 }}>
        {stepIndex > 0 && (
          <button
            type="button"
            className="ws-btn ws-btn-secondary"
            onClick={goBack}
          >
            ย้อนกลับ
          </button>
        )}
        <button
          type="button"
          className="ws-btn ws-btn-primary"
          onClick={goNext}
          disabled={submitState === "submitting"}
          style={{ flex: 1 }}
        >
          {submitState === "submitting"
            ? "กำลังบันทึก..."
            : isLastStep
              ? "บันทึกและเข้าใช้แอป"
              : "ถัดไป"}
        </button>
      </div>
    </div>
  );
}
