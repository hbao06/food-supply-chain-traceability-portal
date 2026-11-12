'use strict';

// Chuẩn hóa nội dung trước khi ghi audit (W6-TV3, US-S05 AC03).
// - Bỏ hẳn các khóa nhạy cảm (mật khẩu, hash, token, chữ ký...) ở MỌI cấp lồng nhau. Không thay bằng "[ẩn]"
//   vì CHECK chk_audit_no_secrets của CSDL từ chối cả tên khóa, và tên khóa cũng không cần lưu.
// - Bỏ giá trị undefined / hàm; Date -> chuỗi ISO; giới hạn độ sâu và kích thước để audit không phình to.
const ACTIONS = Object.freeze(['CREATE', 'UPDATE', 'REGISTER', 'LOGIN_FAILED', 'APPROVE', 'CHANGE_ROLE', 'LOCK', 'UNLOCK', 'ASSIGN_ORGANIZATION']);
const ENTITY_TYPES = Object.freeze(['USER', 'ORGANIZATION', 'BATCH', 'EVENT', 'QR_CODE']);

const SENSITIVE_KEY = /pass(word)?|secret|token|jwt|hash|signature|authorization|cookie|otp/i;
const MAX_DEPTH = 5;
const MAX_JSON_BYTES = 8 * 1024;

function clean(value, depth) {
  if (value === null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const t = typeof value;
  if (t === 'string' || t === 'boolean') return value;
  if (t === 'number') return Number.isFinite(value) ? value : null;
  if (t === 'bigint') return value.toString();
  if (t !== 'object') return undefined; // undefined, function, symbol
  if (depth >= MAX_DEPTH) return '[…]';
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1)).filter((v) => v !== undefined);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(k)) continue;
    const c = clean(v, depth + 1);
    if (c !== undefined) out[k] = c;
  }
  return out;
}

// Trả object/null an toàn để lưu vào cột JSONB.
function sanitizeAuditValue(value) {
  if (value === undefined || value === null) return null;
  const c = clean(value, 0);
  if (c === null || c === undefined) return null;
  const obj = typeof c === 'object' && !Array.isArray(c) ? c : { value: c };
  if (Buffer.byteLength(JSON.stringify(obj), 'utf8') > MAX_JSON_BYTES) {
    return { _truncated: true, keys: Object.keys(obj).slice(0, 50) };
  }
  return obj;
}

// Che email trước khi lưu vào nhật ký không xóa được (W7-TV3, giới hạn dữ liệu cá nhân):
// "nguyenvana@gmail.com" -> "ng***@gmail.com". Giữ tên miền và 2 ký tự đầu để Admin vẫn nhận ra
// một đợt dò mật khẩu nhắm vào cùng tài khoản / cùng tên miền, nhưng không lưu nguyên địa chỉ
// (email gõ sai, hoặc người dùng lỡ gõ mật khẩu vào ô email).
function maskEmail(email) {
  const s = String(email ?? '').trim().toLowerCase();
  const at = s.lastIndexOf('@');
  if (at < 1 || at === s.length - 1) return '***';
  const local = s.slice(0, at);
  const domain = s.slice(at + 1).slice(0, 100);
  return `${local.slice(0, local.length > 2 ? 2 : 1)}***@${domain}`;
}

const isId = (v) => v === null || v === undefined || (Number.isSafeInteger(Number(v)) && Number(v) > 0);

// Kiểm tra một mục audit trước khi ghi. Sai ở đây là lỗi lập trình (500), không phải lỗi người dùng.
function normalizeAuditEntry({ actorId = null, action, entityType, entityId = null, oldValue = null, newValue = null } = {}) {
  if (!ACTIONS.includes(action)) throw new Error(`audit: action không hợp lệ "${action}"`);
  if (!ENTITY_TYPES.includes(entityType)) throw new Error(`audit: entityType không hợp lệ "${entityType}"`);
  if (!isId(actorId)) throw new Error(`audit: actorId không hợp lệ "${actorId}"`);
  if (!isId(entityId)) throw new Error(`audit: entityId không hợp lệ "${entityId}"`);
  return {
    actorId: actorId == null ? null : Number(actorId),
    action,
    entityType,
    entityId: entityId == null ? null : Number(entityId),
    oldValue: sanitizeAuditValue(oldValue),
    newValue: sanitizeAuditValue(newValue),
  };
}

module.exports = { sanitizeAuditValue, normalizeAuditEntry, maskEmail, ACTIONS, ENTITY_TYPES, SENSITIVE_KEY, MAX_JSON_BYTES };
