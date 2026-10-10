// ---- audit log (PDPA checklist ข้อ 1-2) ----
// บันทึกว่า "ใคร ทำอะไร กับข้อมูลของใคร เมื่อไหร่ จากที่ไหน" ลงตาราง audit_log (append-only)
// - AUTH:        ล็อกอิน/ล็อกเอาต์/ผูก LINE ทั้งสำเร็จ ล้มเหลว และโดน rate limit
// - DATA_CHANGE: ทุก endpoint ที่แอดมินแก้ข้อมูล + พนักงานส่งแบบสอบถามสุขภาพ (หลักฐานการให้ความยินยอม)
// - DATA_ACCESS: เปิดดูข้อมูลสุขภาพ (รายชื่อรวม/รายคน), ดูรายงาน, ดู audit log เอง
// - EXPORT:      ดาวน์โหลดไฟล์รายงาน / audit log
//
// ห้ามบันทึก: รหัสผ่าน, เลขบัตรประชาชน, token, ค่าสุขภาพ (น้ำหนัก ความดัน ฯลฯ) — เก็บแค่ว่า "มีการเข้าถึง"
// การเขียน log เป็นแบบ best-effort: ถ้าเขียนไม่สำเร็จจะ console.error แต่ไม่ทำให้คำขอของผู้ใช้ล้มตาม

const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');

// เก็บอย่างน้อย 90 วันตาม พ.ร.บ.คอมพิวเตอร์ ม.26 — ค่าเริ่มต้น 1 ปี ตั้งเองได้ทาง env แต่ต่ำกว่า 90 ไม่ได้
const MIN_RETENTION_DAYS = 90;
const RETENTION_DAYS = Math.max(
  MIN_RETENTION_DAYS,
  Number(process.env.AUDIT_LOG_RETENTION_DAYS) || 365
);

const SENSITIVE_KEY = /pass|national|token|secret|cookie/i;
const MAX_STRING = 200;
const MAX_DETAIL_CHARS = 4000;

// กฎว่า route ไหนต้องบันทึกอะไร — key คือ "METHOD path" ตามที่ประกาศไว้ใน app.get/post/...
// targetType + targetParam: เป้าหมายเอามาจาก req.params, ถ้าไม่มีให้ดู targetBody (req.body) หรือ targetResponse (JSON ที่ตอบกลับ)
// logBody: แนบ req.body (ผ่าน sanitize แล้ว) ไว้ใน detail — ใช้กับ endpoint แก้ข้อมูลที่ body ไม่มีค่าสุขภาพ
const RULES = {
  // AUTH
  'POST /api/admin/login': { action: 'ADMIN_LOGIN', category: 'AUTH' },
  'POST /api/admin/logout': { action: 'ADMIN_LOGOUT', category: 'AUTH' },
  'POST /api/auth/line-login': { action: 'LINE_LOGIN', category: 'AUTH' },

  // พนักงานส่งแบบสอบถามสุขภาพ — ไม่ log ค่าใน body (เป็นข้อมูลสุขภาพทั้งหมด) บันทึกแค่ประเภท/รอบ
  'POST /api/health-assessment': { action: 'HEALTH_ASSESSMENT_SUBMIT', category: 'DATA_CHANGE', targetType: 'EMPLOYEE', targetSelf: true },

  // แอดมินแก้ข้อมูล
  'POST /api/admin/campaigns': { action: 'CAMPAIGN_CREATE', category: 'DATA_CHANGE', targetType: 'CAMPAIGN', targetResponse: 'campaignId', logBody: true },
  'POST /api/admin/campaigns/:id/open': { action: 'CAMPAIGN_OPEN', category: 'DATA_CHANGE', targetType: 'CAMPAIGN', targetParam: 'id' },
  'POST /api/admin/campaigns/:id/close': { action: 'CAMPAIGN_CLOSE', category: 'DATA_CHANGE', targetType: 'CAMPAIGN', targetParam: 'id' },
  'POST /api/admin/submissions/:id/approve': { action: 'SUBMISSION_APPROVE', category: 'DATA_CHANGE', targetType: 'SUBMISSION', targetParam: 'id', logBody: true },
  'POST /api/admin/submissions/:id/reject': { action: 'SUBMISSION_REJECT', category: 'DATA_CHANGE', targetType: 'SUBMISSION', targetParam: 'id', logBody: true },
  'POST /api/admin/redeems/:id/approve': { action: 'REDEEM_APPROVE', category: 'DATA_CHANGE', targetType: 'REDEEM', targetParam: 'id', logBody: true },
  'POST /api/admin/redeems/:id/reject': { action: 'REDEEM_REJECT', category: 'DATA_CHANGE', targetType: 'REDEEM', targetParam: 'id', logBody: true },
  'POST /api/admin/challenges': { action: 'CHALLENGE_CREATE', category: 'DATA_CHANGE', targetType: 'CHALLENGE', targetResponse: 'challengeId', logBody: true },
  'POST /api/admin/challenges/:id/cancel': { action: 'CHALLENGE_CANCEL', category: 'DATA_CHANGE', targetType: 'CHALLENGE', targetParam: 'id', logBody: true },
  'POST /api/admin/badges': { action: 'BADGE_CREATE', category: 'DATA_CHANGE', targetType: 'BADGE', targetResponse: 'badgeId', logBody: true },
  'PUT /api/admin/badges/:id': { action: 'BADGE_UPDATE', category: 'DATA_CHANGE', targetType: 'BADGE', targetParam: 'id' },
  'POST /api/admin/categories': { action: 'CATEGORY_CREATE', category: 'DATA_CHANGE', targetType: 'CATEGORY', targetResponse: 'categoryId', logBody: true },
  'PUT /api/admin/categories/:id': { action: 'CATEGORY_UPDATE', category: 'DATA_CHANGE', targetType: 'CATEGORY', targetParam: 'id' },
  'POST /api/admin/activity-types': { action: 'ACTIVITY_TYPE_CREATE', category: 'DATA_CHANGE', targetType: 'ACTIVITY_TYPE', targetResponse: 'activityId', logBody: true },
  'PUT /api/admin/activity-types/:id': { action: 'ACTIVITY_TYPE_UPDATE', category: 'DATA_CHANGE', targetType: 'ACTIVITY_TYPE', targetParam: 'id' },
  'POST /api/admin/rewards': { action: 'REWARD_CREATE', category: 'DATA_CHANGE', targetType: 'REWARD', targetResponse: 'rewardId', logBody: true },
  'PUT /api/admin/rewards/:id': { action: 'REWARD_UPDATE', category: 'DATA_CHANGE', targetType: 'REWARD', targetParam: 'id' },
  'POST /api/admin/admins': { action: 'ADMIN_GRANT', category: 'DATA_CHANGE', targetType: 'EMPLOYEE', targetBody: 'employeeId' },
  'POST /api/admin/admins/:employeeId/revoke': { action: 'ADMIN_REVOKE', category: 'DATA_CHANGE', targetType: 'EMPLOYEE', targetParam: 'employeeId' },

  // การเข้าถึงข้อมูลสุขภาพ/รายงาน
  'GET /api/admin/health-assessments': { action: 'HEALTH_LIST_VIEW', category: 'DATA_ACCESS' },
  'GET /api/admin/health-assessments/:employeeId': { action: 'HEALTH_RECORD_VIEW', category: 'DATA_ACCESS', targetType: 'EMPLOYEE', targetParam: 'employeeId' },
  'GET /api/admin/reports/summary': { action: 'REPORT_VIEW', category: 'DATA_ACCESS', logQuery: true },
  'GET /api/admin/reports/export': { action: 'REPORT_EXPORT', category: 'EXPORT', logQuery: true },
  'GET /api/admin/audit-logs': { action: 'AUDIT_LOG_VIEW', category: 'DATA_ACCESS', logQuery: true },
  'GET /api/admin/audit-logs/export': { action: 'AUDIT_LOG_EXPORT', category: 'EXPORT', logQuery: true },
};

// ตัดค่าที่ห้ามเก็บ + ย่อ string ยาวๆ ก่อนเก็บลง detail
function sanitize(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[…]';
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k)) continue;
      out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

function resultFromStatus(status) {
  if (status === 429) return 'BLOCKED';
  return status < 400 ? 'SUCCESS' : 'FAILURE';
}

// logout ไม่ผ่าน requireAdmin — ถอดรหัส token เองเพื่อรู้ว่าใครออก (token หมดอายุก็ยังบันทึกได้ว่าเป็นใคร)
function adminIdFromToken(req) {
  const authHeader = req.headers.authorization || '';
  const token = (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) || req.cookies?.admin_session;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true }).employeeId || null;
  } catch {
    return null;
  }
}

function createAudit(pool) {
  // เขียน 1 แถว — ใช้ได้ทั้งจาก middleware และเรียกตรงจากโค้ดที่อื่น (เช่นงาน purge)
  async function writeAudit(entry, req) {
    const detail = entry.detail && Object.keys(entry.detail).length > 0 ? JSON.stringify(entry.detail) : null;
    await pool.query(
      `INSERT INTO audit_log
        (occurred_at, actor_type, actor_id, action, category, target_type, target_id,
         result, http_status, detail, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        new Date(),
        entry.actorType,
        entry.actorId ? String(entry.actorId).slice(0, 20) : null,
        entry.action,
        entry.category,
        entry.targetType || null,
        entry.targetId !== undefined && entry.targetId !== null ? String(entry.targetId).slice(0, 64) : null,
        entry.result,
        entry.httpStatus || null,
        detail && detail.length > MAX_DETAIL_CHARS ? JSON.stringify({ truncated: detail.slice(0, MAX_DETAIL_CHARS) }) : detail,
        req ? req.ip || null : null,
        req ? String(req.headers['user-agent'] || '').slice(0, 255) || null : null,
      ]
    );
  }

  function safeWrite(entry, req) {
    writeAudit(entry, req).catch((err) => {
      console.error('[audit] write failed:', err.code || err.message, entry.action);
    });
  }

  // middleware ระดับแอป: ดักทุกคำขอ แล้วตัดสินใจตอนตอบกลับเสร็จ (ตอนนั้น req.route / ผู้ใช้ / status รู้ครบแล้ว)
  // handler เติมข้อมูลเพิ่มได้ผ่าน res.locals.audit = { actorId, action, detail, ... }
  function auditMiddleware(req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      res.locals.auditResponseBody = body;
      return originalJson(body);
    };

    res.on('finish', () => {
      if (!req.route) return; // ไม่ตรง route ไหนเลย (404)
      const key = `${req.method} ${req.route.path}`;
      let rule = RULES[key];

      // แอดมินที่ถูกถอดสิทธิ์/ลาออกแล้วแต่ยังถือ token เก่าพยายามเข้าหน้าแอดมิน
      if (!rule && res.statusCode === 403 && req.originalUrl.startsWith('/api/admin')) {
        rule = { action: 'ADMIN_ACCESS_DENIED', category: 'AUTH' };
      }
      if (!rule) return;

      const extra = res.locals.audit || {};
      const body = req.body || {};
      const responseBody = res.locals.auditResponseBody || {};

      let actorType = 'ANONYMOUS';
      let actorId = null;
      if (req.adminEmployeeId) {
        actorType = 'ADMIN';
        actorId = req.adminEmployeeId;
      } else if (req.employeeId) {
        actorType = 'EMPLOYEE';
        actorId = req.employeeId;
      } else if (key === 'POST /api/admin/login') {
        // รหัสพนักงานที่ "พยายาม" ล็อกอิน (อาจไม่มีอยู่จริง) — ใช้สืบว่ามีคนไล่เดารหัสของใคร
        actorType = 'ADMIN';
        actorId = String(body.employeeId || '').trim() || null;
      } else if (key === 'POST /api/admin/logout' || rule.action === 'ADMIN_ACCESS_DENIED') {
        // ไม่ผ่าน requireAdmin (logout) หรือถูก requireAdmin ปฏิเสธ -> ดูจาก token ว่าเป็นใคร
        actorId = adminIdFromToken(req);
        if (actorId) actorType = 'ADMIN';
      } else if (responseBody.employeeId && key === 'POST /api/auth/line-login') {
        actorType = 'EMPLOYEE';
        actorId = responseBody.employeeId;
      }
      if (extra.actorType) actorType = extra.actorType;
      if (extra.actorId) actorId = extra.actorId;

      let targetId = null;
      if (rule.targetParam) targetId = req.params[rule.targetParam];
      else if (rule.targetBody) targetId = body[rule.targetBody];
      else if (rule.targetResponse) targetId = responseBody[rule.targetResponse];
      else if (rule.targetSelf) targetId = actorId;
      if (extra.targetId) targetId = extra.targetId;

      const detail = {};
      if (rule.logBody) Object.assign(detail, sanitize(body));
      if (rule.logQuery && Object.keys(req.query || {}).length > 0) detail.query = sanitize(req.query);
      if (req.file) detail.uploadedFile = true;
      if (Array.isArray(responseBody)) detail.rowCount = responseBody.length;
      if (key === 'POST /api/auth/line-login') {
        // LINE user id ไว้สืบว่าบัญชี LINE ไหนไล่เดาเลขบัตร (ไม่ใช่ข้อมูลที่ระบุตัวตนตรงๆ)
        if (req.linePayload?.sub) detail.lineUserId = req.linePayload.sub;
        if (responseBody.needsNationalId) detail.needsNationalId = true;
      }
      if (key === 'POST /api/health-assessment') {
        // เก็บแค่ประเภท/รอบ + เวลาที่ยินยอม ไม่เก็บค่าสุขภาพใน body
        detail.assessmentType = body.assessmentType === 'FOLLOWUP' ? 'FOLLOWUP' : 'BASELINE';
        if (body.campaignId) detail.campaignId = body.campaignId;
        if (res.statusCode < 400) detail.consentAccepted = true;
      }
      if (res.statusCode >= 400 && responseBody.message) detail.message = sanitize(responseBody.message);
      if (extra.detail) Object.assign(detail, sanitize(extra.detail));

      const entry = {
        actorType,
        actorId,
        action: extra.action || (key === 'POST /api/auth/line-login' && body.nationalId ? 'LINE_BIND' : rule.action),
        category: rule.category,
        targetType: targetId ? extra.targetType || rule.targetType || null : null,
        targetId,
        result: resultFromStatus(res.statusCode),
        httpStatus: res.statusCode,
        detail,
      };

      // แก้ข้อมูลสำเร็จ + route จับค่า "ก่อนแก้" ไว้ (captureBefore) -> อ่านค่า "หลังแก้" แล้วเก็บเฉพาะฟิลด์ที่เปลี่ยน
      const before = res.locals.auditBefore;
      if (before && entry.result === 'SUCCESS') {
        pool
          .query(`SELECT * FROM ${before.table} WHERE ${before.idColumn} = ?`, [before.id])
          .then(([rows]) => {
            const after = rows[0] || {};
            const changes = {};
            for (const [field, oldValue] of Object.entries(before.row)) {
              const newValue = after[field];
              if (String(oldValue ?? '') !== String(newValue ?? '')) {
                changes[field] = { from: sanitize(oldValue), to: sanitize(newValue) };
              }
            }
            entry.detail = { ...entry.detail, changes };
          })
          .catch(() => {})
          .finally(() => safeWrite(entry, req));
        return;
      }

      safeWrite(entry, req);
    });

    next();
  }

  // ใส่หน้า handler ของ route แก้ไข (PUT) เพื่อจับค่าแถวก่อนแก้ ใช้คู่กับ auditMiddleware ด้านบน
  // table/idColumn เป็นค่าคงที่ในโค้ดเท่านั้น (ไม่รับจากผู้ใช้) จึงต่อ string ลง SQL ได้
  function captureBefore(table, idColumn, param = 'id') {
    return async (req, res, next) => {
      try {
        const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [req.params[param]]);
        if (rows[0]) res.locals.auditBefore = { table, idColumn, id: req.params[param], row: rows[0] };
      } catch (err) {
        console.error('[audit] capture before failed:', err.code || err.message);
      }
      next();
    };
  }

  // ลบ log ที่เก่าเกินระยะเก็บ — DB มี trigger กันลบแถวที่อายุยังไม่ถึง 90 วันอีกชั้น
  async function purgeExpired() {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    try {
      const [result] = await pool.query(`DELETE FROM audit_log WHERE occurred_at < ?`, [cutoff]);
      if (result.affectedRows > 0) {
        safeWrite({
          actorType: 'SYSTEM',
          action: 'AUDIT_LOG_PURGE',
          category: 'DATA_CHANGE',
          result: 'SUCCESS',
          detail: { deletedRows: result.affectedRows, retentionDays: RETENTION_DAYS, olderThan: cutoff.toISOString() },
        });
      }
    } catch (err) {
      console.error('[audit] purge failed:', err.code || err.message);
    }
  }

  function startRetentionJob() {
    setTimeout(purgeExpired, 60 * 1000).unref();
    setInterval(purgeExpired, 24 * 60 * 60 * 1000).unref();
  }

  return { auditMiddleware, captureBefore, writeAudit, startRetentionJob, RETENTION_DAYS };
}

// ---- หน้าดู audit log (แอดมิน) ----
const ACTION_LABELS = {
  ADMIN_LOGIN: 'แอดมินเข้าสู่ระบบ',
  ADMIN_LOGOUT: 'แอดมินออกจากระบบ',
  ADMIN_ACCESS_DENIED: 'ถูกปฏิเสธการเข้าหน้าแอดมิน',
  LINE_LOGIN: 'พนักงานเข้าสู่ระบบ (LINE)',
  LINE_BIND: 'ผูกบัญชี LINE ด้วยเลขบัตรประชาชน',
  HEALTH_ASSESSMENT_SUBMIT: 'ส่งแบบสอบถามสุขภาพ (ให้ความยินยอม)',
  CAMPAIGN_CREATE: 'สร้างรอบติดตามผล',
  CAMPAIGN_OPEN: 'เปิดรอบติดตามผล',
  CAMPAIGN_CLOSE: 'ปิดรอบติดตามผล',
  SUBMISSION_APPROVE: 'อนุมัติกิจกรรม',
  SUBMISSION_REJECT: 'ปฏิเสธกิจกรรม',
  REDEEM_APPROVE: 'อนุมัติแลกของรางวัล',
  REDEEM_REJECT: 'ปฏิเสธแลกของรางวัล',
  CHALLENGE_CREATE: 'สร้างชาเลนจ์',
  CHALLENGE_CANCEL: 'ยกเลิกชาเลนจ์',
  BADGE_CREATE: 'สร้างเหรียญตรา',
  BADGE_UPDATE: 'แก้ไขเหรียญตรา',
  CATEGORY_CREATE: 'สร้างหมวดหมู่กิจกรรม',
  CATEGORY_UPDATE: 'แก้ไขหมวดหมู่กิจกรรม',
  ACTIVITY_TYPE_CREATE: 'สร้างประเภทกิจกรรม',
  ACTIVITY_TYPE_UPDATE: 'แก้ไขประเภทกิจกรรม',
  REWARD_CREATE: 'สร้างของรางวัล',
  REWARD_UPDATE: 'แก้ไขของรางวัล',
  ADMIN_GRANT: 'ให้สิทธิ์แอดมิน',
  ADMIN_REVOKE: 'ถอดสิทธิ์แอดมิน',
  HEALTH_LIST_VIEW: 'เปิดดูตารางผลข้อมูลสุขภาพ (ทุกคน)',
  HEALTH_RECORD_VIEW: 'เปิดดูข้อมูลสุขภาพรายบุคคล',
  REPORT_VIEW: 'เปิดดูรายงานผู้บริหาร',
  REPORT_EXPORT: 'ดาวน์โหลดรายงาน Excel',
  AUDIT_LOG_VIEW: 'เปิดดูประวัติการใช้งาน',
  AUDIT_LOG_EXPORT: 'ดาวน์โหลดประวัติการใช้งาน',
  AUDIT_LOG_PURGE: 'ลบประวัติที่เกินระยะเก็บ (อัตโนมัติ)',
};
const CATEGORY_LABELS = { AUTH: 'เข้าสู่ระบบ', DATA_CHANGE: 'แก้ไขข้อมูล', DATA_ACCESS: 'เข้าถึงข้อมูล', EXPORT: 'ส่งออกข้อมูล' };
const RESULT_LABELS = { SUCCESS: 'สำเร็จ', FAILURE: 'ไม่สำเร็จ', BLOCKED: 'ถูกบล็อก' };
const ACTOR_LABELS = { ADMIN: 'แอดมิน', EMPLOYEE: 'พนักงาน', ANONYMOUS: 'ไม่ทราบตัวตน', SYSTEM: 'ระบบ' };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXPORT_MAX_ROWS = 20000;

// แปลง query string เป็น WHERE — วันที่เป็นวันไทย (occurred_at เก็บเป็นเวลาไทยอยู่แล้ว) นับรวมวันสุดท้ายทั้งวัน
function buildAuditFilter(query) {
  const where = [];
  const params = [];
  const { from, to, category, result, actorType, action, employeeId } = query;

  if (from) {
    if (!DATE_RE.test(from)) return { error: 'รูปแบบวันที่เริ่มต้นไม่ถูกต้อง' };
    where.push('l.occurred_at >= ?');
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    if (!DATE_RE.test(to)) return { error: 'รูปแบบวันที่สิ้นสุดไม่ถูกต้อง' };
    where.push('l.occurred_at < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(`${to} 00:00:00`);
  }
  if (category) {
    if (!CATEGORY_LABELS[category]) return { error: 'ประเภทไม่ถูกต้อง' };
    where.push('l.category = ?');
    params.push(category);
  }
  if (result) {
    if (!RESULT_LABELS[result]) return { error: 'ผลลัพธ์ไม่ถูกต้อง' };
    where.push('l.result = ?');
    params.push(result);
  }
  if (actorType) {
    if (!ACTOR_LABELS[actorType]) return { error: 'ประเภทผู้กระทำไม่ถูกต้อง' };
    where.push('l.actor_type = ?');
    params.push(actorType);
  }
  if (action) {
    if (!ACTION_LABELS[action]) return { error: 'การกระทำไม่ถูกต้อง' };
    where.push('l.action = ?');
    params.push(action);
  }
  // รหัสพนักงาน: ตรงกับทั้ง "คนที่ทำ" และ "คนที่ถูกกระทำ" — ใช้ตอบคำถามว่าใครเคยดูข้อมูลของคนนี้บ้าง
  if (employeeId) {
    const id = String(employeeId).trim();
    where.push(`(l.actor_id = ? OR (l.target_type = 'EMPLOYEE' AND l.target_id = ?))`);
    params.push(id, id);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const AUDIT_SELECT = `
  SELECT l.log_id, l.occurred_at, l.actor_type, l.actor_id, a.full_name AS actor_name,
         l.action, l.category, l.target_type, l.target_id, t.full_name AS target_name,
         l.result, l.http_status, l.detail, l.ip, l.user_agent
  FROM audit_log l
  LEFT JOIN employee a ON a.employee_id = l.actor_id
  LEFT JOIN employee t ON l.target_type = 'EMPLOYEE' AND t.employee_id = l.target_id`;

function parseDetail(detail) {
  if (!detail) return null;
  if (typeof detail === 'object') return detail;
  try {
    return JSON.parse(detail);
  } catch {
    return { raw: String(detail) };
  }
}

function thaiDateTime(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  // แปลงเป็นเวลาไทยเอง ไม่พึ่ง timezone ของเครื่องที่รัน server (Render เป็น UTC)
  const th = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${pad(th.getUTCDate())}/${pad(th.getUTCMonth() + 1)}/${th.getUTCFullYear() + 543} ${pad(th.getUTCHours())}:${pad(th.getUTCMinutes())}:${pad(th.getUTCSeconds())}`;
}

function registerAuditLogRoutes(app, pool, requireAdmin) {
  app.get('/api/admin/audit-logs', requireAdmin, async (req, res) => {
    const filter = buildAuditFilter(req.query);
    if (filter.error) return res.status(400).json({ message: filter.error });

    const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 50));
    const page = Math.max(1, Number(req.query.page) || 1);

    try {
      const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_log l ${filter.whereSql}`, filter.params);
      const [rows] = await pool.query(
        `${AUDIT_SELECT} ${filter.whereSql} ORDER BY l.occurred_at DESC, l.log_id DESC LIMIT ? OFFSET ?`,
        [...filter.params, pageSize, (page - 1) * pageSize]
      );
      // ห่อด้วย object (ไม่ส่ง array ตรงๆ) — audit middleware จะได้ไม่นับเป็น rowCount ของข้อมูลสุขภาพ
      res.json({
        rows: rows.map((r) => ({ ...r, detail: parseDetail(r.detail) })),
        total: countRow.total,
        page,
        pageSize,
        labels: { actions: ACTION_LABELS, categories: CATEGORY_LABELS, results: RESULT_LABELS, actors: ACTOR_LABELS },
      });
    } catch (err) {
      console.error('list audit logs error:', err);
      res.status(500).json({ message: 'โหลดประวัติการใช้งานไม่สำเร็จ' });
    }
  });

  app.get('/api/admin/audit-logs/export', requireAdmin, async (req, res) => {
    const filter = buildAuditFilter(req.query);
    if (filter.error) return res.status(400).json({ message: filter.error });

    try {
      const [rows] = await pool.query(
        `${AUDIT_SELECT} ${filter.whereSql} ORDER BY l.occurred_at DESC, l.log_id DESC LIMIT ?`,
        [...filter.params, EXPORT_MAX_ROWS + 1]
      );
      if (rows.length > EXPORT_MAX_ROWS) {
        return res.status(400).json({ message: `ข้อมูลเกิน ${EXPORT_MAX_ROWS.toLocaleString()} แถว กรุณาเลือกช่วงวันที่ให้แคบลง` });
      }

      const header = ['เลขที่', 'วันเวลา', 'ประเภทผู้กระทำ', 'รหัสผู้กระทำ', 'ชื่อผู้กระทำ', 'การกระทำ', 'หมวด',
        'เป้าหมาย', 'รหัสเป้าหมาย', 'ชื่อเป้าหมาย', 'ผลลัพธ์', 'HTTP', 'รายละเอียด', 'IP', 'อุปกรณ์/เบราว์เซอร์'];
      const data = rows.map((r) => [
        r.log_id,
        thaiDateTime(r.occurred_at),
        ACTOR_LABELS[r.actor_type] || r.actor_type,
        r.actor_id || '',
        r.actor_name || '',
        ACTION_LABELS[r.action] || r.action,
        CATEGORY_LABELS[r.category] || r.category,
        r.target_type || '',
        r.target_id || '',
        r.target_name || '',
        RESULT_LABELS[r.result] || r.result,
        r.http_status || '',
        r.detail ? JSON.stringify(parseDetail(r.detail)) : '',
        r.ip || '',
        r.user_agent || '',
      ]);
      const sheet = XLSX.utils.aoa_to_sheet([header, ...data]);
      sheet['!cols'] = [8, 20, 12, 12, 24, 32, 14, 14, 14, 24, 10, 6, 60, 16, 40].map((wch) => ({ wch }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'ประวัติการใช้งาน');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.locals.audit = { detail: { rowCount: rows.length } };
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-log.xlsx"');
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) {
      console.error('export audit logs error:', err);
      res.status(500).json({ message: 'สร้างไฟล์ Excel ไม่สำเร็จ' });
    }
  });
}

module.exports = { createAudit, registerAuditLogRoutes, RULES, ACTION_LABELS };
