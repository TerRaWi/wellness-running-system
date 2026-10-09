// ---- รายงานผู้บริหาร (แท็บ "รายงาน" ฝั่งแอดมิน + export Excel) ----
// แยกไฟล์ออกมาจาก server.js เพราะเป็น logic คำนวณล้วนๆ ไม่ผูกกับ flow อื่น
// หลักการ PDPA ที่ใช้ทั้งไฟล์:
//   - ข้อมูลสุขภาพ (ข้อมูลอ่อนไหว ม.26) ออกได้เฉพาะตัวเลขรวม ไม่มีรายคนเด็ดขาด
//   - กลุ่มที่มีผู้ตอบน้อยกว่า MIN_GROUP_SIZE คน จะไม่แสดงตัวเลขสุขภาพ กันการระบุตัวบุคคลย้อนกลับ
//   - รายชื่อรายคนใน Excel มีเฉพาะข้อมูลกิจกรรม/คะแนน (ไม่ใช่ข้อมูลอ่อนไหว)
// ทุกตัวเลขนับเฉพาะพนักงานที่ยังปฏิบัติงานอยู่ (employment_status = 'ACTIVE') ให้ตัวหาร/ตัวตั้งตรงกันทุกตาราง
const XLSX = require('xlsx');

const MIN_GROUP_SIZE = 5;
const MET_ADEQUATE = 600; // WHO: ≥ 600 MET-นาที/สัปดาห์ = กิจกรรมทางกายเพียงพอ
const NOT_SPECIFIED = 'ไม่ระบุ';

// เกณฑ์ BMI สำหรับคนเอเชีย (WHO Asia-Pacific) — ใช้กันทั่วไปในหน่วยงานสาธารณสุขไทย
const BMI_CATEGORIES = [
  { key: 'UNDER', label: 'น้ำหนักน้อย (< 18.5)', max: 18.5 },
  { key: 'NORMAL', label: 'ปกติ (18.5–22.9)', max: 23 },
  { key: 'OVER', label: 'ท้วม (23–24.9)', max: 25 },
  { key: 'OBESE1', label: 'อ้วนระดับ 1 (25–29.9)', max: 30 },
  { key: 'OBESE2', label: 'อ้วนระดับ 2 (≥ 30)', max: Infinity },
];
// ระบบไม่มีฟิลด์เพศ จึงใช้อัตราส่วนรอบเอวต่อส่วนสูงแทนเกณฑ์รอบเอวแยกชาย/หญิง
const WAIST_CATEGORIES = [
  { key: 'NORMAL', label: 'ปกติ (เอว < ½ ส่วนสูง)' },
  { key: 'RISK', label: 'เสี่ยง (เอว ≥ ½ ส่วนสูง)' },
];
const BP_CATEGORIES = [
  { key: 'NORMAL', label: 'ปกติ (< 120/80)' },
  { key: 'ELEVATED', label: 'เสี่ยง (120–139 / 80–89)' },
  { key: 'HIGH', label: 'สูง (≥ 140/90)' },
];
const MET_CATEGORIES = [
  { key: 'LOW', label: `ไม่เพียงพอ (< ${MET_ADEQUATE} MET-นาที/สัปดาห์)` },
  { key: 'ADEQUATE', label: `เพียงพอ (≥ ${MET_ADEQUATE} MET-นาที/สัปดาห์)` },
];
const SMOKING_CATEGORIES = [
  { key: 'NONE', label: 'ไม่สูบ' },
  { key: 'FORMER', label: 'เลิกแล้ว' },
  { key: 'SMOKER', label: 'สูบ' },
];
const ALCOHOL_CATEGORIES = [
  { key: 'NONE', label: 'ไม่ดื่ม' },
  { key: 'OCCASIONAL', label: 'ดื่มครั้งคราว' },
  { key: 'REGULAR', label: 'ดื่มเป็นประจำ' },
];
const STAGE_CATEGORIES = [
  { key: 'NOT_CONSIDERING', label: 'ยังไม่คิดจะเปลี่ยน' },
  { key: 'CONSIDERING_6M', label: 'กำลังคิดอยู่ (ภายใน 6 เดือน)' },
  { key: 'PLANNING_1M', label: 'วางแผนจะเริ่ม (ภายใน 1 เดือน)' },
  { key: 'ACTIVE_UNDER_6M', label: 'เริ่มทำแล้ว (ไม่ถึง 6 เดือน)' },
  { key: 'ACTIVE_OVER_6M', label: 'ทำต่อเนื่อง (เกิน 6 เดือน)' },
];
const CHRONIC_DISEASE_PRESETS = ['เบาหวาน', 'ความดันโลหิตสูง', 'ไขมันในเลือดสูง', 'โรคหัวใจ', 'ข้อ/กระดูก', 'อื่นๆ'];
const SHIFT_TYPE_LABEL_TH = { DAY: 'เวรทำการ', SHIFT: 'เวรผลัด' };

// ฟิลด์ของแต่ละตัวชี้วัด (camelCase ตรงกับ assessment_campaign.included_fields)
// แถว FOLLOWUP จะถูกนับเป็นค่าของตัวชี้วัดนั้น "เฉพาะถ้ารอบนั้นถามฟิลด์นั้นจริง" เพราะคอลัมน์อย่าง
// vigorous_days/smoking_status มี DEFAULT ทำให้แยกไม่ออกว่า 0/'NONE' คือคำตอบจริงหรือแค่ไม่ได้ถาม
const METRIC_FIELDS = {
  weight: ['weightKg'],
  height: ['heightCm'],
  waist: ['waistCm'],
  bp: ['bpSystolic'],
  smoking: ['smokingStatus'],
  alcohol: ['alcoholStatus'],
  chronic: ['chronicDisease'],
  // MET ต้องถามครบทั้ง 3 ระดับ ไม่งั้นส่วนที่ไม่ถามถูกนับเป็น 0 ในสูตร generated column (ค่าต่ำกว่าจริง)
  met: ['vigorousDays', 'moderateDays', 'walkingDays'],
  stage: ['stageOfChange'],
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ต้องเป็นวันที่ที่มีอยู่จริงด้วย (กัน 2026-13-01 / 2026-02-31 ที่ผ่าน regex แต่ MySQL ตีความแปลกๆ)
function isValidDate(value) {
  if (!DATE_RE.test(value || '')) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function parseReportParams(query) {
  const { from, to } = query;
  if (!isValidDate(from) || !isValidDate(to)) {
    return { error: 'กรุณาระบุช่วงวันที่ให้ถูกต้อง (YYYY-MM-DD)' };
  }
  if (from > to) {
    return { error: 'วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด' };
  }
  const department = typeof query.department === 'string' && query.department.trim() ? query.department.trim() : null;
  return { from, to, department };
}

function pct(part, total) {
  if (!total) return null;
  return Math.round((part / total) * 1000) / 10;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function bmiCategory(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const bmi = weightKg / (heightCm / 100) ** 2;
  return BMI_CATEGORIES.find((c) => bmi < c.max).key;
}

function waistCategory(waistCm, heightCm) {
  if (!waistCm || !heightCm) return null;
  return waistCm / heightCm >= 0.5 ? 'RISK' : 'NORMAL';
}

function bpCategory(bp) {
  if (!bp || !bp.sys || !bp.dia) return null;
  if (bp.sys >= 140 || bp.dia >= 90) return 'HIGH';
  if (bp.sys >= 120 || bp.dia >= 80) return 'ELEVATED';
  return 'NORMAL';
}

function metCategory(met) {
  if (met === null || met === undefined) return null;
  return met >= MET_ADEQUATE ? 'ADEQUATE' : 'LOW';
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ดึงค่าของตัวชี้วัดออกจากแถว health_assessment หนึ่งแถว (undefined = แถวนี้ไม่ได้ถามตัวชี้วัดนี้)
function metricValue(row, metric) {
  switch (metric) {
    case 'weight': return row.weight_kg === null ? undefined : Number(row.weight_kg);
    case 'height': return row.height_cm === null ? undefined : Number(row.height_cm);
    case 'waist': return row.waist_cm === null ? undefined : Number(row.waist_cm);
    case 'bp':
      return row.bp_systolic === null || row.bp_diastolic === null
        ? undefined
        : { sys: row.bp_systolic, dia: row.bp_diastolic };
    case 'smoking': return row.smoking_status || undefined;
    case 'alcohol': return row.alcohol_status || undefined;
    case 'chronic': return parseJsonArray(row.chronic_disease);
    case 'met': return row.met_minutes_per_week === null ? undefined : Number(row.met_minutes_per_week);
    case 'stage': return row.stage_of_change || undefined;
    default: return undefined;
  }
}

function rowAsksMetric(row, metric) {
  if (row.assessment_type === 'BASELINE') return true;
  const included = parseJsonArray(row.included_fields);
  return METRIC_FIELDS[metric].every((f) => included.includes(f));
}

// สรุปสถานะสุขภาพของพนักงานหนึ่งคน: ค่า baseline และค่าล่าสุด (ค่าล่าสุดที่ "ถามจริง" ของแต่ละตัวชี้วัด
// ไม่ใช่แถวล่าสุดเฉยๆ — ตรรกะเดียวกับหน้า "ผลข้อมูลสุขภาพ" ที่ follow-up บางรอบถามไม่ครบทุกฟิลด์)
function summarizeEmployeeHealth(rows) {
  const baselineRow = rows.find((r) => r.assessment_type === 'BASELINE');
  const baseline = {};
  const latest = {};
  const hasFollowup = {};
  for (const metric of Object.keys(METRIC_FIELDS)) {
    if (baselineRow) {
      const v = metricValue(baselineRow, metric);
      if (v !== undefined) baseline[metric] = v;
    }
    for (const row of rows) {
      if (!rowAsksMetric(row, metric)) continue;
      const v = metricValue(row, metric);
      if (v === undefined) continue;
      latest[metric] = v;
      if (row.assessment_type === 'FOLLOWUP') hasFollowup[metric] = true;
    }
  }
  return { hasBaseline: Boolean(baselineRow), baseline, latest, hasFollowup };
}

function categorize(state) {
  return {
    bmi: bmiCategory(state.weight, state.height),
    waist: waistCategory(state.waist, state.height),
    bp: bpCategory(state.bp),
    met: metCategory(state.met),
    smoking: state.smoking || null,
    alcohol: state.alcohol || null,
    stage: state.stage || null,
  };
}

// นับการกระจายตัวของหมวดหมู่ เทียบ baseline กับล่าสุด (ตัวหารคือคนที่มีข้อมูลตัวชี้วัดนั้นในแต่ละช่วง)
function distribution(people, field, categories) {
  const baseVals = people.map((p) => p.baseCat[field]).filter(Boolean);
  const latestVals = people.map((p) => p.latestCat[field]).filter(Boolean);
  return {
    baselineN: baseVals.length,
    latestN: latestVals.length,
    rows: categories.map((c) => {
      const b = baseVals.filter((v) => v === c.key).length;
      const l = latestVals.filter((v) => v === c.key).length;
      return { key: c.key, label: c.label, baseline: b, baselinePct: pct(b, baseVals.length), latest: l, latestPct: pct(l, latestVals.length) };
    }),
  };
}

function buildHealthSection(employeeHealth) {
  const respondents = employeeHealth.filter((h) => h.hasBaseline);
  const n = respondents.length;
  // ไม่ส่งจำนวนจริงออกไปเมื่อซ่อนข้อมูล (บอกแค่ว่าน้อยกว่าเกณฑ์) — "มี 1 คน" ก็ช่วยระบุตัวได้แล้ว
  if (n < MIN_GROUP_SIZE) {
    return { suppressed: true, minGroupSize: MIN_GROUP_SIZE };
  }

  const people = respondents.map((h) => ({
    ...h,
    baseCat: categorize({ ...h.baseline }),
    // ส่วนสูงไม่ค่อยถูกถามซ้ำใน follow-up จึงใช้ค่าล่าสุดที่มี (fallback baseline) คำนวณ BMI/รอบเอว
    latestCat: categorize({ ...h.latest, height: h.latest.height ?? h.baseline.height }),
  }));

  const chronicRows = (stateKey) => {
    const withData = people.filter((p) => p[stateKey].chronic !== undefined);
    const any = withData.filter((p) => p[stateKey].chronic.some((d) => d && d !== 'ไม่มี')).length;
    return {
      n: withData.length,
      any,
      byDisease: CHRONIC_DISEASE_PRESETS.map((d) => ({
        label: d,
        count: withData.filter((p) => p[stateKey].chronic.includes(d)).length,
      })),
    };
  };
  const chronicBase = chronicRows('baseline');
  const chronicLatest = chronicRows('latest');

  // ---- การเปลี่ยนแปลง: นับเฉพาะคนที่มีทั้ง baseline และ follow-up ของตัวชี้วัดนั้น (paired) ----
  const weightPaired = people.filter((p) => p.hasFollowup.weight && p.baseline.weight !== undefined);
  const weightDiffs = weightPaired.map((p) => p.latest.weight - p.baseline.weight);
  const bmiOrder = BMI_CATEGORIES.map((c) => c.key);
  // "ดีขึ้น" ของ BMI = ขยับเข้าใกล้หมวดปกติ (ทั้งฝั่งอ้วนลดลงและฝั่งผอมเพิ่มขึ้น)
  const bmiDistance = (key) => Math.abs(bmiOrder.indexOf(key) - bmiOrder.indexOf('NORMAL'));
  const bmiPaired = weightPaired.filter((p) => p.baseCat.bmi && p.latestCat.bmi);
  const metPaired = people.filter((p) => p.hasFollowup.met && p.baseCat.met && p.latestCat.met);

  const change = {
    followupRespondents: people.filter((p) => Object.keys(p.hasFollowup).length > 0).length,
    weight: {
      n: weightPaired.length,
      avgChangeKg: weightDiffs.length ? round1(weightDiffs.reduce((a, b) => a + b, 0) / weightDiffs.length) : null,
      lost: weightDiffs.filter((d) => d < 0).length,
      totalLostKg: round1(-weightDiffs.filter((d) => d < 0).reduce((a, b) => a + b, 0)),
    },
    bmi: {
      n: bmiPaired.length,
      improved: bmiPaired.filter((p) => bmiDistance(p.latestCat.bmi) < bmiDistance(p.baseCat.bmi)).length,
      same: bmiPaired.filter((p) => bmiDistance(p.latestCat.bmi) === bmiDistance(p.baseCat.bmi)).length,
      worse: bmiPaired.filter((p) => bmiDistance(p.latestCat.bmi) > bmiDistance(p.baseCat.bmi)).length,
    },
    met: {
      n: metPaired.length,
      baselineAdequate: metPaired.filter((p) => p.baseCat.met === 'ADEQUATE').length,
      latestAdequate: metPaired.filter((p) => p.latestCat.met === 'ADEQUATE').length,
      becameAdequate: metPaired.filter((p) => p.baseCat.met === 'LOW' && p.latestCat.met === 'ADEQUATE').length,
    },
  };
  // ตัวเลขการเปลี่ยนแปลงที่มีคนน้อยกว่าเกณฑ์ก็ระบุตัวได้เหมือนกัน (เช่น "1 คนน้ำหนักลด 5 กก.")
  for (const key of ['weight', 'bmi', 'met']) {
    if (change[key].n < MIN_GROUP_SIZE) change[key] = { suppressed: true };
  }

  return {
    suppressed: false,
    respondents: n,
    minGroupSize: MIN_GROUP_SIZE,
    distributions: {
      bmi: { title: 'ดัชนีมวลกาย (BMI)', ...distribution(people, 'bmi', BMI_CATEGORIES) },
      waist: { title: 'รอบเอว', ...distribution(people, 'waist', WAIST_CATEGORIES) },
      bp: { title: 'ความดันโลหิต', ...distribution(people, 'bp', BP_CATEGORIES) },
      met: { title: 'กิจกรรมทางกาย', ...distribution(people, 'met', MET_CATEGORIES) },
      smoking: { title: 'การสูบบุหรี่', ...distribution(people, 'smoking', SMOKING_CATEGORIES) },
      alcohol: { title: 'การดื่มแอลกอฮอล์', ...distribution(people, 'alcohol', ALCOHOL_CATEGORIES) },
      stage: { title: 'ความพร้อมเปลี่ยนพฤติกรรม', ...distribution(people, 'stage', STAGE_CATEGORIES) },
    },
    chronic: {
      baselineN: chronicBase.n,
      latestN: chronicLatest.n,
      rows: [
        { label: 'มีโรคประจำตัวอย่างน้อย 1 โรค', baseline: chronicBase.any, latest: chronicLatest.any },
        ...CHRONIC_DISEASE_PRESETS.map((d, i) => ({
          label: d,
          baseline: chronicBase.byDisease[i].count,
          latest: chronicLatest.byDisease[i].count,
        })),
      ].map((r) => ({
        ...r,
        baselinePct: pct(r.baseline, chronicBase.n),
        latestPct: pct(r.latest, chronicLatest.n),
      })),
    },
    change,
    people, // ใช้ภายในเท่านั้น (สร้างตารางรายแผนก) — ถูกลบออกก่อนส่ง response เสมอ
  };
}

// ตัวชี้วัดสุขภาพหลักรายกลุ่ม (ค่าล่าสุด) — กลุ่มที่ผู้ตอบไม่ถึงเกณฑ์จะถูกซ่อนตัวเลข
function healthByGroup(people, groupKeyFn) {
  const groups = new Map();
  for (const p of people) {
    const key = groupKeyFn(p);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return [...groups.entries()]
    // กลุ่มที่แสดงตัวเลขได้ขึ้นก่อน เรียงตามจำนวนผู้ตอบ
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'th'))
    .map(([group, list]) => {
      if (list.length < MIN_GROUP_SIZE) return { group, suppressed: true };
      const share = (field, keys) => {
        const withData = list.filter((p) => p.latestCat[field]);
        return pct(withData.filter((p) => keys.includes(p.latestCat[field])).length, withData.length);
      };
      return {
        group,
        n: list.length,
        suppressed: false,
        obesePct: share('bmi', ['OBESE1', 'OBESE2']),
        waistRiskPct: share('waist', ['RISK']),
        bpHighPct: share('bp', ['HIGH']),
        metAdequatePct: share('met', ['ADEQUATE']),
        smokerPct: share('smoking', ['SMOKER']),
      };
    });
}

// สรุปการมีส่วนร่วมรายกลุ่ม (แผนก/ตำแหน่ง/เวร) จากข้อมูลรายคน
function participationByGroup(employees, groupKeyFn) {
  const groups = new Map();
  for (const e of employees) {
    const key = groupKeyFn(e);
    if (!groups.has(key)) {
      groups.set(key, { group: key, headcount: 0, linked: 0, baselineDone: 0, participants: 0, submissions: 0, distanceKm: 0, durationMin: 0 });
    }
    const g = groups.get(key);
    g.headcount += 1;
    g.linked += e.linked ? 1 : 0;
    g.baselineDone += e.baselineDone ? 1 : 0;
    g.participants += e.submissions > 0 ? 1 : 0;
    g.submissions += e.submissions;
    g.distanceKm += e.distanceKm;
    g.durationMin += e.durationMin;
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      distanceKm: round1(g.distanceKm),
      participationPct: pct(g.participants, g.headcount),
      avgDistancePerHead: round1(g.distanceKm / g.headcount),
    }))
    // เรียงตามจำนวนผู้ร่วมกิจกรรมก่อน (ไม่ใช่ % — กลุ่ม 1 คนที่ร่วม 100% จะลอยขึ้นบนสุดจนอ่านภาพรวมยาก)
    .sort((a, b) => b.participants - a.participants || b.headcount - a.headcount || a.group.localeCompare(b.group, 'th'));
}

function monthKeysBetween(from, to) {
  const keys = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const [ty, tm] = to.slice(0, 7).split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return keys;
}

async function buildReport(pool, { from, to, department }) {
  // เงื่อนไขพนักงานที่ใช้ร่วมกันทุก query (alias e)
  const empWhere = `e.employment_status = 'ACTIVE'${department ? ' AND e.department = ?' : ''}`;
  const empParams = department ? [department] : [];
  // ช่วงวันที่แบบรวมวันสุดท้ายทั้งวัน
  const rangeSql = (col) => `${col} >= ? AND ${col} < DATE_ADD(?, INTERVAL 1 DAY)`;
  const rangeParams = [from, to];

  const [departmentRows] = await pool.query(
    `SELECT DISTINCT department FROM employee
     WHERE employment_status = 'ACTIVE' AND department IS NOT NULL AND department <> ''
     ORDER BY department`
  );

  // ---- ข้อมูลรายคน (ฐานของตารางการมีส่วนร่วม + ชีตรายบุคคลใน Excel) ----
  const [employeeRows] = await pool.query(
    `SELECT
       e.employee_id, e.full_name, e.department, e.job_position, e.shift_type,
       EXISTS(SELECT 1 FROM employee_account ea WHERE ea.employee_id = e.employee_id AND ea.status = 'ACTIVE') AS linked,
       EXISTS(SELECT 1 FROM health_assessment ha WHERE ha.employee_id = e.employee_id AND ha.assessment_type = 'BASELINE') AS baseline_done,
       COALESCE(s.submissions, 0) AS submissions,
       COALESCE(s.distance_km, 0) AS distance_km,
       COALESCE(s.duration_min, 0) AS duration_min,
       COALESCE(p.earned, 0) AS points_earned,
       COALESCE(p.used, 0) AS points_used,
       COALESCE(b.balance, 0) AS points_balance,
       (SELECT COUNT(*) FROM employee_badge eb WHERE eb.employee_id = e.employee_id) AS badge_count
     FROM employee e
     LEFT JOIN (
       SELECT employee_id, COUNT(*) AS submissions, SUM(distance) AS distance_km, SUM(duration) AS duration_min
       FROM running_submission
       WHERE status = 'APPROVED' AND ${rangeSql('submitted_at')}
       GROUP BY employee_id
     ) s ON s.employee_id = e.employee_id
     LEFT JOIN (
       SELECT employee_id,
         SUM(CASE WHEN transaction_type = 'EARN' THEN score ELSE 0 END) AS earned,
         -SUM(CASE WHEN transaction_type = 'REDEEM' OR (transaction_type = 'ADJUST' AND redeem_id IS NOT NULL) THEN score ELSE 0 END) AS used
       FROM score_transaction
       WHERE ${rangeSql('created_at')}
       GROUP BY employee_id
     ) p ON p.employee_id = e.employee_id
     LEFT JOIN (
       -- คะแนนคงเหลือ ณ วันสิ้นสุดช่วงรายงาน (ไม่ใช่ ณ วันนี้) ให้สอดคล้องกับตัวกรองช่วงเวลาเหมือนตัวเลขอื่น
       SELECT employee_id, SUM(score) AS balance FROM score_transaction
       WHERE created_at < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY employee_id
     ) b ON b.employee_id = e.employee_id
     WHERE ${empWhere}
     ORDER BY e.department, e.full_name`,
    [...rangeParams, ...rangeParams, to, ...empParams]
  );
  const employees = employeeRows.map((r) => ({
    employeeId: r.employee_id,
    fullName: r.full_name,
    department: r.department || NOT_SPECIFIED,
    jobPosition: r.job_position || NOT_SPECIFIED,
    shiftType: SHIFT_TYPE_LABEL_TH[r.shift_type] || NOT_SPECIFIED,
    linked: Boolean(r.linked),
    baselineDone: Boolean(r.baseline_done),
    submissions: Number(r.submissions),
    distanceKm: Number(r.distance_km),
    durationMin: Number(r.duration_min),
    pointsEarned: Number(r.points_earned),
    pointsUsed: Number(r.points_used),
    pointsBalance: Number(r.points_balance),
    badgeCount: Number(r.badge_count),
  }));

  const headcount = employees.length;
  const sum = (field) => employees.reduce((a, e) => a + e[field], 0);
  const participants = employees.filter((e) => e.submissions > 0).length;
  const linked = employees.filter((e) => e.linked).length;
  const baselineDone = employees.filter((e) => e.baselineDone).length;

  const [statusRows] = await pool.query(
    `SELECT rs.status, COUNT(*) AS count
     FROM running_submission rs JOIN employee e ON e.employee_id = rs.employee_id
     WHERE ${rangeSql('rs.submitted_at')} AND ${empWhere}
     GROUP BY rs.status`,
    [...rangeParams, ...empParams]
  );
  const statusCount = (s) => Number(statusRows.find((r) => r.status === s)?.count || 0);

  // ---- แนวโน้มรายเดือน ----
  const [monthlyRows] = await pool.query(
    `SELECT DATE_FORMAT(rs.submitted_at, '%Y-%m') AS month,
       COUNT(DISTINCT rs.employee_id) AS participants,
       COUNT(*) AS submissions,
       COALESCE(SUM(rs.distance), 0) AS distance_km,
       COALESCE(SUM(rs.duration), 0) AS duration_min
     FROM running_submission rs JOIN employee e ON e.employee_id = rs.employee_id
     WHERE rs.status = 'APPROVED' AND ${rangeSql('rs.submitted_at')} AND ${empWhere}
     GROUP BY month`,
    [...rangeParams, ...empParams]
  );
  // ตัดเดือนในอนาคตออก (เช่นเลือกทั้งปีงบที่ยังไม่จบ) ไม่งั้นกราฟ/ชีตจะมีแถว 0 ยาวต่อท้ายจนดูเหมือนกิจกรรมหยุด
  const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
  const monthly = monthKeysBetween(from, to < todayKey ? to : todayKey).map((month) => {
    const r = monthlyRows.find((m) => m.month === month);
    return {
      month,
      participants: Number(r?.participants || 0),
      participationPct: pct(Number(r?.participants || 0), headcount),
      submissions: Number(r?.submissions || 0),
      distanceKm: round1(Number(r?.distance_km || 0)),
      durationHours: round1(Number(r?.duration_min || 0) / 60),
    };
  });

  // ---- แยกตามประเภทกิจกรรม ----
  const [categoryRows] = await pool.query(
    `SELECT ac.category_name, at.activity_name,
       COUNT(DISTINCT rs.employee_id) AS participants,
       COUNT(*) AS submissions,
       COALESCE(SUM(rs.distance), 0) AS distance_km,
       COALESCE(SUM(rs.duration), 0) AS duration_min
     FROM running_submission rs
     JOIN employee e ON e.employee_id = rs.employee_id
     JOIN activity_type at ON at.activity_id = rs.activity_id
     JOIN activity_category ac ON ac.category_id = at.category_id
     WHERE rs.status = 'APPROVED' AND ${rangeSql('rs.submitted_at')} AND ${empWhere}
     GROUP BY ac.category_name, at.activity_name
     ORDER BY submissions DESC`,
    [...rangeParams, ...empParams]
  );
  const byActivity = categoryRows.map((r) => ({
    category: r.category_name,
    activity: r.activity_name,
    participants: Number(r.participants),
    submissions: Number(r.submissions),
    distanceKm: round1(Number(r.distance_km)),
    durationHours: round1(Number(r.duration_min) / 60),
  }));

  // ---- สุขภาพ: ทุกแถวจนถึงวันสิ้นสุดช่วง (สถานะ "ณ วันสิ้นสุดรายงาน") ----
  const [healthRows] = await pool.query(
    `SELECT ha.employee_id, e.department, e.job_position, ha.assessment_type, ha.created_at,
       ha.weight_kg, ha.height_cm, ha.waist_cm, ha.bp_systolic, ha.bp_diastolic,
       ha.chronic_disease, ha.smoking_status, ha.alcohol_status, ha.met_minutes_per_week,
       ha.stage_of_change, ac.included_fields
     FROM health_assessment ha
     JOIN employee e ON e.employee_id = ha.employee_id
     LEFT JOIN assessment_campaign ac ON ac.campaign_id = ha.campaign_id
     WHERE ha.created_at < DATE_ADD(?, INTERVAL 1 DAY) AND ${empWhere}
     ORDER BY ha.employee_id, ha.created_at, ha.assessment_id`,
    [to, ...empParams]
  );
  const rowsByEmployee = new Map();
  for (const r of healthRows) {
    if (!rowsByEmployee.has(r.employee_id)) rowsByEmployee.set(r.employee_id, []);
    rowsByEmployee.get(r.employee_id).push(r);
  }
  const employeeHealth = [...rowsByEmployee.values()].map((rows) => ({
    department: rows[0].department || NOT_SPECIFIED,
    jobPosition: rows[0].job_position || NOT_SPECIFIED,
    ...summarizeEmployeeHealth(rows),
  }));
  const health = buildHealthSection(employeeHealth);
  let healthByDepartment = [];
  if (!health.suppressed) {
    healthByDepartment = healthByGroup(health.people, (p) => p.department);
    delete health.people;
  }

  // ---- คะแนนและของรางวัล ----
  const [pointRows] = await pool.query(
    `SELECT st.transaction_type, (st.redeem_id IS NOT NULL) AS is_redeem_related, COALESCE(SUM(st.score), 0) AS total
     FROM score_transaction st JOIN employee e ON e.employee_id = st.employee_id
     WHERE ${rangeSql('st.created_at')} AND ${empWhere}
     GROUP BY st.transaction_type, is_redeem_related`,
    [...rangeParams, ...empParams]
  );
  const pointTotal = (predicate) => pointRows.filter(predicate).reduce((a, r) => a + Number(r.total), 0);
  const points = {
    earned: pointTotal((r) => r.transaction_type === 'EARN'),
    // คะแนนที่ใช้แลกจริง = หักตอนแลก ลบด้วยที่คืนกลับตอนถูกปฏิเสธ/ยกเลิก
    used: -pointTotal((r) => r.transaction_type === 'REDEEM' || (r.transaction_type === 'ADJUST' && Number(r.is_redeem_related) === 1)),
    otherAdjust: pointTotal((r) => r.transaction_type === 'ADJUST' && Number(r.is_redeem_related) !== 1),
    expired: -pointTotal((r) => r.transaction_type === 'EXPIRE'),
    outstanding: sum('pointsBalance'),
  };

  const [rewardRows] = await pool.query(
    `SELECT r.reward_id, r.reward_name, r.required_score, r.stock, r.status,
       COUNT(x.redeem_id) AS requested,
       COALESCE(SUM(x.status = 'APPROVED'), 0) AS approved,
       COALESCE(SUM(x.status = 'PENDING'), 0) AS pending,
       COALESCE(SUM(CASE WHEN x.status IN ('APPROVED', 'PENDING') THEN x.used_score ELSE 0 END), 0) AS points_used
     FROM reward r
     LEFT JOIN (
       SELECT rr.* FROM reward_redeem rr JOIN employee e ON e.employee_id = rr.employee_id
       WHERE ${rangeSql('rr.redeem_date')} AND ${empWhere}
     ) x ON x.reward_id = r.reward_id
     GROUP BY r.reward_id
     ORDER BY approved DESC, requested DESC, r.reward_name`,
    [...rangeParams, ...empParams]
  );
  const rewards = rewardRows.map((r) => ({
    rewardName: r.reward_name,
    requiredScore: r.required_score,
    stock: r.stock,
    active: r.status === 'ACTIVE',
    requested: Number(r.requested),
    approved: Number(r.approved),
    pending: Number(r.pending),
    pointsUsed: Number(r.points_used),
  }));

  return {
    params: { from, to, department },
    generatedAt: new Date().toISOString(),
    departments: departmentRows.map((r) => r.department),
    engagement: {
      headcount,
      linked,
      linkedPct: pct(linked, headcount),
      baselineDone,
      baselineDonePct: pct(baselineDone, headcount),
      participants,
      participationPct: pct(participants, headcount),
      approvedSubmissions: statusCount('APPROVED'),
      pendingSubmissions: statusCount('PENDING'),
      rejectedSubmissions: statusCount('REJECTED'),
      distanceKm: round1(sum('distanceKm')),
      durationHours: round1(sum('durationMin') / 60),
      avgDistancePerParticipant: participants ? round1(sum('distanceKm') / participants) : null,
    },
    monthly,
    byDepartment: participationByGroup(employees, (e) => e.department),
    byJobPosition: participationByGroup(employees, (e) => e.jobPosition),
    byShift: participationByGroup(employees, (e) => e.shiftType),
    byActivity,
    health,
    healthByDepartment,
    points,
    rewards,
    employees, // ใช้ทำชีตรายบุคคลใน Excel เท่านั้น — ถูกตัดออกจาก JSON ของหน้าเว็บ
  };
}

// ---- Excel ----
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function thaiDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${TH_MONTHS[m - 1]} ${y + 543}`;
}

function thaiMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}

function thaiDateTimeNow() {
  const now = new Date();
  return now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short', hour12: false });
}

function pctCell(value) {
  return value === null || value === undefined ? '-' : value / 100;
}

// สร้าง sheet จาก array of arrays พร้อมตั้งความกว้างคอลัมน์และ format ช่องที่เป็น % (ค่า 0-1)
function makeSheet(rows, widths, percentCols = {}) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  for (const [rowIdxStr, cols] of Object.entries(percentCols)) {
    for (const c of cols) {
      const ref = XLSX.utils.encode_cell({ r: Number(rowIdxStr), c });
      if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = '0.0%';
    }
  }
  return ws;
}

// แถวที่เป็นตาราง: คืน { rows, percentCols } โดยจด index แถว/คอลัมน์ที่เป็น % ไว้ให้ makeSheet
function tableBlock(startRow, header, dataRows, pctColumnIndexes) {
  const percentCols = {};
  dataRows.forEach((_, i) => { percentCols[startRow + 1 + i] = pctColumnIndexes; });
  return { rows: [header, ...dataRows], percentCols };
}

function reportHeader(report, adminName, title) {
  const { from, to, department } = report.params;
  return [
    [title],
    ['ช่วงเวลา', `${thaiDate(from)} – ${thaiDate(to)}`],
    ['แผนก', department || 'ทุกแผนก'],
    ['ออกรายงานเมื่อ', thaiDateTimeNow()],
    ['ออกรายงานโดย', adminName],
    [],
  ];
}

function buildWorkbook(report, adminName) {
  const wb = XLSX.utils.book_new();
  const e = report.engagement;

  // 1. สรุปภาพรวม
  {
    const rows = reportHeader(report, adminName, 'รายงานโครงการส่งเสริมสุขภาพบุคลากร — สรุปภาพรวม');
    const percentCols = {};
    const add = (label, value, isPct = false) => {
      if (isPct) percentCols[rows.length] = [1];
      rows.push([label, isPct ? pctCell(value) : value]);
    };
    rows.push(['การมีส่วนร่วม']);
    add('พนักงานที่ปฏิบัติงานอยู่ (คน)', e.headcount);
    add('ผูกบัญชี LINE แล้ว (คน)', e.linked);
    add('ผูกบัญชี LINE แล้ว (%)', e.linkedPct, true);
    add('ตอบแบบประเมินสุขภาพ Baseline แล้ว (คน)', e.baselineDone);
    add('ตอบแบบประเมินสุขภาพ Baseline แล้ว (%)', e.baselineDonePct, true);
    add('ผู้ร่วมกิจกรรม — ส่งกิจกรรมที่อนุมัติอย่างน้อย 1 ครั้ง (คน)', e.participants);
    add('อัตราการมีส่วนร่วม (%)', e.participationPct, true);
    rows.push([]);
    rows.push(['กิจกรรม']);
    add('กิจกรรมที่อนุมัติ (ครั้ง)', e.approvedSubmissions);
    add('กิจกรรมรอตรวจสอบ (ครั้ง)', e.pendingSubmissions);
    add('กิจกรรมที่ถูกปฏิเสธ (ครั้ง)', e.rejectedSubmissions);
    add('ระยะทางรวม (กม.)', e.distanceKm);
    add('เวลาออกกำลังกายรวม (ชั่วโมง)', e.durationHours);
    add('ระยะทางเฉลี่ยต่อผู้ร่วมกิจกรรม (กม.)', e.avgDistancePerParticipant ?? '-');
    rows.push([]);
    rows.push(['คะแนนและของรางวัล']);
    add('คะแนนที่แจกจากกิจกรรม', report.points.earned);
    add('คะแนนที่ใช้แลกของรางวัล (สุทธิ)', report.points.used);
    add(`คะแนนคงเหลือที่ยังไม่ได้แลก ณ ${thaiDate(report.params.to)}`, report.points.outstanding);
    add('ของรางวัลที่แลก — อนุมัติแล้ว (ชิ้น)', report.rewards.reduce((a, r) => a + r.approved, 0));
    add('ของรางวัลที่แลก — รอดำเนินการ (ชิ้น)', report.rewards.reduce((a, r) => a + r.pending, 0));
    rows.push([]);
    rows.push(['หมายเหตุ']);
    rows.push(['• นับเฉพาะพนักงานที่ยังปฏิบัติงานอยู่ และนับเฉพาะกิจกรรมที่แอดมินอนุมัติแล้ว (ยกเว้นแถวรอตรวจสอบ/ถูกปฏิเสธ)']);
    rows.push([`• ข้อมูลสุขภาพแสดงเฉพาะตัวเลขรวม กลุ่มที่มีผู้ตอบน้อยกว่า ${MIN_GROUP_SIZE} คนจะไม่แสดง เพื่อคุ้มครองข้อมูลส่วนบุคคลตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562`]);
    rows.push(['• เอกสารนี้มีข้อมูลส่วนบุคคล ใช้เพื่อการบริหารโครงการภายในโรงพยาบาลเท่านั้น ห้ามเผยแพร่']);
    XLSX.utils.book_append_sheet(wb, makeSheet(rows, [58, 22], percentCols), 'สรุปภาพรวม');
  }

  // 2. รายเดือน
  {
    const head = reportHeader(report, adminName, 'แนวโน้มรายเดือน');
    const block = tableBlock(
      head.length,
      ['เดือน', 'ผู้ร่วมกิจกรรม (คน)', 'อัตราการมีส่วนร่วม', 'กิจกรรมที่อนุมัติ (ครั้ง)', 'ระยะทาง (กม.)', 'เวลา (ชม.)'],
      report.monthly.map((m) => [thaiMonth(m.month), m.participants, pctCell(m.participationPct), m.submissions, m.distanceKm, m.durationHours]),
      [2]
    );
    XLSX.utils.book_append_sheet(wb, makeSheet([...head, ...block.rows], [16, 20, 20, 22, 16, 12], block.percentCols), 'รายเดือน');
  }

  // 3. แยกตามกลุ่ม (แผนก / ตำแหน่ง / เวร)
  {
    const rows = reportHeader(report, adminName, 'การมีส่วนร่วมแยกตามกลุ่ม');
    let percentCols = {};
    const header = (label) => [label, 'พนักงาน (คน)', 'ผูก LINE (คน)', 'ตอบ Baseline (คน)', 'ผู้ร่วมกิจกรรม (คน)', 'อัตราการมีส่วนร่วม', 'กิจกรรม (ครั้ง)', 'ระยะทาง (กม.)', 'ระยะทางเฉลี่ย/คน (กม.)'];
    const toRow = (g) => [g.group, g.headcount, g.linked, g.baselineDone, g.participants, pctCell(g.participationPct), g.submissions, g.distanceKm, g.avgDistancePerHead];
    for (const [label, list] of [['แผนก', report.byDepartment], ['ตำแหน่ง', report.byJobPosition], ['ลักษณะเวร', report.byShift]]) {
      const block = tableBlock(rows.length, header(label), list.map(toRow), [5]);
      rows.push(...block.rows, []);
      percentCols = { ...percentCols, ...block.percentCols };
    }
    XLSX.utils.book_append_sheet(wb, makeSheet(rows, [30, 14, 14, 16, 18, 18, 14, 14, 20], percentCols), 'แยกตามกลุ่ม');
  }

  // 4. ประเภทกิจกรรม
  {
    const head = reportHeader(report, adminName, 'กิจกรรมแยกตามประเภท');
    const block = tableBlock(
      head.length,
      ['หมวดหมู่', 'ประเภทกิจกรรม', 'ผู้ร่วม (คน)', 'จำนวน (ครั้ง)', 'ระยะทาง (กม.)', 'เวลา (ชม.)'],
      report.byActivity.map((a) => [a.category, a.activity, a.participants, a.submissions, a.distanceKm, a.durationHours]),
      []
    );
    XLSX.utils.book_append_sheet(wb, makeSheet([...head, ...block.rows], [20, 30, 14, 14, 16, 12]), 'ประเภทกิจกรรม');
  }

  // 5. สุขภาพ (ตัวเลขรวม)
  {
    const rows = reportHeader(report, adminName, 'ผลลัพธ์สุขภาพ (ตัวเลขรวม) — Baseline เทียบกับข้อมูลล่าสุด ณ วันสิ้นสุดรายงาน');
    let percentCols = {};
    const h = report.health;
    if (h.suppressed) {
      rows.push([`ผู้ตอบแบบประเมินน้อยกว่า ${h.minGroupSize} คน จึงไม่แสดงข้อมูลสุขภาพเพื่อคุ้มครองข้อมูลส่วนบุคคล`]);
    } else {
      rows.push(['ผู้ตอบแบบประเมิน Baseline (คน)', h.respondents]);
      rows.push(['ผู้ตอบแบบติดตามผลอย่างน้อย 1 รอบ (คน)', h.change.followupRespondents]);
      rows.push([]);
      for (const d of Object.values(h.distributions)) {
        rows.push([d.title]);
        const block = tableBlock(
          rows.length,
          ['หมวด', 'Baseline (คน)', 'Baseline (%)', 'ล่าสุด (คน)', 'ล่าสุด (%)'],
          [
            ...d.rows.map((r) => [r.label, r.baseline, pctCell(r.baselinePct), r.latest, pctCell(r.latestPct)]),
            ['รวมผู้มีข้อมูล', d.baselineN, '', d.latestN, ''],
          ],
          [2, 4]
        );
        rows.push(...block.rows, []);
        percentCols = { ...percentCols, ...block.percentCols };
      }
      rows.push(['โรคประจำตัว (ตอบได้มากกว่า 1 โรค)']);
      const chronicBlock = tableBlock(
        rows.length,
        ['โรค', 'Baseline (คน)', 'Baseline (%)', 'ล่าสุด (คน)', 'ล่าสุด (%)'],
        [
          ...h.chronic.rows.map((r) => [r.label, r.baseline, pctCell(r.baselinePct), r.latest, pctCell(r.latestPct)]),
          ['รวมผู้มีข้อมูล', h.chronic.baselineN, '', h.chronic.latestN, ''],
        ],
        [2, 4]
      );
      rows.push(...chronicBlock.rows, []);
      percentCols = { ...percentCols, ...chronicBlock.percentCols };

      rows.push(['การเปลี่ยนแปลง (นับเฉพาะคนที่มีทั้ง Baseline และแบบติดตามผลของตัวชี้วัดนั้น)']);
      const c = h.change;
      const suppressedNote = () => `ข้อมูลเปรียบเทียบยังไม่พอ (น้อยกว่า ${MIN_GROUP_SIZE} คน)`;
      if (c.weight.suppressed) rows.push(['น้ำหนัก', suppressedNote()]);
      else {
        rows.push(['น้ำหนัก — จำนวนคนที่มีข้อมูลเปรียบเทียบ', c.weight.n]);
        rows.push(['น้ำหนักเปลี่ยนแปลงเฉลี่ย (กก.; ติดลบ = ลดลง)', c.weight.avgChangeKg]);
        rows.push(['จำนวนคนที่น้ำหนักลดลง', c.weight.lost]);
        rows.push(['น้ำหนักที่ลดได้รวม (กก.)', c.weight.totalLostKg]);
      }
      if (c.bmi.suppressed) rows.push(['BMI', suppressedNote()]);
      else {
        rows.push(['BMI — จำนวนคนที่มีข้อมูลเปรียบเทียบ', c.bmi.n]);
        rows.push(['BMI ขยับเข้าใกล้เกณฑ์ปกติ (คน)', c.bmi.improved]);
        rows.push(['BMI อยู่หมวดเดิม (คน)', c.bmi.same]);
        rows.push(['BMI ห่างจากเกณฑ์ปกติมากขึ้น (คน)', c.bmi.worse]);
      }
      if (c.met.suppressed) rows.push(['กิจกรรมทางกาย', suppressedNote()]);
      else {
        rows.push(['กิจกรรมทางกาย — จำนวนคนที่มีข้อมูลเปรียบเทียบ', c.met.n]);
        rows.push(['ถึงเกณฑ์ WHO ตอน Baseline (คน)', c.met.baselineAdequate]);
        rows.push(['ถึงเกณฑ์ WHO ล่าสุด (คน)', c.met.latestAdequate]);
        rows.push(['เปลี่ยนจากไม่ถึงเกณฑ์เป็นถึงเกณฑ์ (คน)', c.met.becameAdequate]);
      }
    }
    XLSX.utils.book_append_sheet(wb, makeSheet(rows, [52, 16, 14, 14, 14], percentCols), 'สุขภาพ');
  }

  // 6. สุขภาพรายแผนก
  {
    const rows = reportHeader(report, adminName, `ตัวชี้วัดสุขภาพรายแผนก (ข้อมูลล่าสุด) — แผนกที่มีผู้ตอบน้อยกว่า ${MIN_GROUP_SIZE} คนจะไม่แสดงตัวเลข`);
    const block = tableBlock(
      rows.length,
      ['แผนก', 'ผู้ตอบ (คน)', 'อ้วน BMI ≥ 25', 'รอบเอวเสี่ยง', 'ความดันสูง ≥ 140/90', 'กิจกรรมทางกายเพียงพอ', 'สูบบุหรี่'],
      report.healthByDepartment.map((g) => g.suppressed
        ? [g.group, `< ${MIN_GROUP_SIZE}`, 'ไม่แสดง', 'ไม่แสดง', 'ไม่แสดง', 'ไม่แสดง', 'ไม่แสดง']
        : [g.group, g.n, pctCell(g.obesePct), pctCell(g.waistRiskPct), pctCell(g.bpHighPct), pctCell(g.metAdequatePct), pctCell(g.smokerPct)]),
      [2, 3, 4, 5, 6]
    );
    if (report.health.suppressed) rows.push(['ข้อมูลไม่พอสำหรับแสดงผล']);
    else rows.push(...block.rows);
    XLSX.utils.book_append_sheet(wb, makeSheet(rows, [30, 12, 16, 14, 20, 22, 12], report.health.suppressed ? {} : block.percentCols), 'สุขภาพรายแผนก');
  }

  // 7. คะแนนและของรางวัล
  {
    const rows = reportHeader(report, adminName, 'คะแนนและของรางวัล');
    const p = report.points;
    rows.push(['คะแนนที่แจกจากกิจกรรม', p.earned]);
    rows.push(['คะแนนที่ใช้แลกของรางวัล (สุทธิ)', p.used]);
    rows.push(['คะแนนที่แอดมินปรับเอง', p.otherAdjust]);
    rows.push(['คะแนนหมดอายุ', p.expired]);
    rows.push([`คะแนนคงเหลือที่ยังไม่ได้แลก ณ ${thaiDate(report.params.to)} (สะสมตั้งแต่เริ่มโครงการ)`, p.outstanding]);
    rows.push([]);
    rows.push(['ของรางวัล — จำนวนที่แลกในช่วงเวลานี้']);
    rows.push(['ของรางวัล', 'คะแนนต่อชิ้น', 'คำขอทั้งหมด', 'อนุมัติแล้ว', 'รอดำเนินการ', 'คะแนนที่ใช้', 'สต็อกคงเหลือ', 'สถานะ']);
    for (const r of report.rewards) {
      rows.push([r.rewardName, r.requiredScore, r.requested, r.approved, r.pending, r.pointsUsed, r.stock, r.active ? 'เปิดแลก' : 'ปิดแลก']);
    }
    XLSX.utils.book_append_sheet(wb, makeSheet(rows, [44, 14, 14, 12, 14, 12, 14, 10]), 'คะแนนและรางวัล');
  }

  // 8. รายบุคคล — เฉพาะกิจกรรม/คะแนน ไม่มีข้อมูลสุขภาพ
  {
    const rows = reportHeader(report, adminName, 'รายบุคคล (เฉพาะข้อมูลกิจกรรมและคะแนน — ไม่มีข้อมูลสุขภาพ)');
    rows.push(['รหัสพนักงาน', 'ชื่อ-สกุล', 'แผนก', 'ตำแหน่ง', 'ลักษณะเวร', 'ผูก LINE', 'ตอบ Baseline', 'กิจกรรมที่อนุมัติ (ครั้ง)', 'ระยะทาง (กม.)', 'เวลา (ชม.)', 'คะแนนที่ได้ในช่วงนี้', 'คะแนนที่ใช้ในช่วงนี้', `คะแนนคงเหลือ ณ ${thaiDate(report.params.to)}`, 'เหรียญตรา']);
    const sorted = [...report.employees].sort((a, b) => b.distanceKm - a.distanceKm || b.submissions - a.submissions);
    for (const emp of sorted) {
      rows.push([
        emp.employeeId, emp.fullName, emp.department, emp.jobPosition, emp.shiftType,
        emp.linked ? 'ใช่' : 'ไม่', emp.baselineDone ? 'ใช่' : 'ไม่',
        emp.submissions, round1(emp.distanceKm), round1(emp.durationMin / 60),
        emp.pointsEarned, emp.pointsUsed, emp.pointsBalance, emp.badgeCount,
      ]);
    }
    const ws = makeSheet(rows, [14, 28, 24, 16, 12, 10, 12, 20, 14, 10, 18, 18, 14, 10]);
    const headerRow = rows.length - sorted.length - 1;
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: rows.length - 1, c: 13 } }) };
    XLSX.utils.book_append_sheet(wb, ws, 'รายบุคคล');
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true });
}

function registerReportRoutes(app, pool, requireAdmin) {
  app.get('/api/admin/reports/summary', requireAdmin, async (req, res) => {
    const params = parseReportParams(req.query);
    if (params.error) return res.status(400).json({ message: params.error });
    try {
      const report = await buildReport(pool, params);
      delete report.employees; // ข้อมูลรายคนออกได้ทางไฟล์ Excel เท่านั้น
      res.json(report);
    } catch (err) {
      console.error('get report summary error:', err);
      res.status(500).json({ message: 'โหลดข้อมูลรายงานไม่สำเร็จ' });
    }
  });

  app.get('/api/admin/reports/export', requireAdmin, async (req, res) => {
    const params = parseReportParams(req.query);
    if (params.error) return res.status(400).json({ message: params.error });
    try {
      const report = await buildReport(pool, params);
      const [adminRows] = await pool.query(`SELECT full_name FROM employee WHERE employee_id = ?`, [req.adminEmployeeId]);
      const adminName = `${adminRows[0]?.full_name || ''} (${req.adminEmployeeId})`;
      const buffer = buildWorkbook(report, adminName);
      // บันทึกร่องรอยการ export ไว้ใน log ของ server ก่อน (รอทำ audit_log table ตาม checklist PDPA)
      console.info('[report-export]', JSON.stringify({ admin: req.adminEmployeeId, ...params, at: new Date().toISOString() }));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="wellness-report_${params.from}_${params.to}.xlsx"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) {
      console.error('export report error:', err);
      res.status(500).json({ message: 'สร้างไฟล์ Excel ไม่สำเร็จ' });
    }
  });
}

module.exports = { registerReportRoutes, buildReport, buildWorkbook };
