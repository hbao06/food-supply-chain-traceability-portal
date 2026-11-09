'use strict';

const { normalizeAuditEntry } = require('./audit.sanitize');

// Câu SQL cho audit log (W6-TV3). audit_logs chỉ INSERT: không có hàm sửa / xóa.
// chain_seq, prev_hash, row_hash do trigger audit_chain_append của CSDL tự cấp (migration 005).

// Ghi một mục audit. Gọi BÊN TRONG transaction của thay đổi (truyền tx), để thay đổi và audit cùng thành công
// hoặc cùng bị hủy (US-S05 AC02). Nội dung được lọc bỏ khóa nhạy cảm trước khi ghi.
async function insertAudit(db, entry) {
  const e = normalizeAuditEntry(entry);
  const r = await db.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING audit_id`,
    [e.actorId, e.action, e.entityType, e.entityId, e.oldValue, e.newValue]
  );
  return r.rows[0] ? Number(r.rows[0].audit_id) : null;
}

// Tìm kiếm có lọc, mới nhất trước. filters đã qua audit.validators (giá trị đúng kiểu).
function buildWhere({ entityType, entityId, actorId, action, from, to }) {
  const conds = [];
  const params = [];
  const add = (sql, value) => { params.push(value); conds.push(sql.replace('?', `$${params.length}`)); };
  if (entityType) add('a.entity_type = ?', entityType);
  if (entityId != null) add('a.entity_id = ?', entityId);
  if (actorId != null) add('a.actor_id = ?', actorId);
  if (action) add('a.action = ?', action);
  if (from) add('a.created_at >= ?', from);
  if (to) add('a.created_at <= ?', to);
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
}

async function searchAudit(db, filters) {
  const { page, limit } = filters;
  const { where, params } = buildWhere(filters);
  const total = await db.query(`SELECT count(*)::bigint AS total FROM audit_logs a ${where}`, params);
  const rows = await db.query(
    `SELECT a.audit_id, a.actor_id, u.name AS actor_name, a.action, a.entity_type, a.entity_id,
            a.old_value, a.new_value, a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON u.user_id = a.actor_id
       ${where}
      ORDER BY a.created_at DESC, a.audit_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );
  return { rows: rows.rows, total: Number(total.rows[0].total) };
}

// Kiểm tra chuỗi băm (hàm của migration 005).
async function verifyAuditChain(db) {
  const r = await db.query('SELECT checked, first_broken_audit_id, reason FROM verify_audit_chain()');
  return r.rows[0];
}

async function verifyBatchEvents(db, batchId) {
  const r = await db.query('SELECT checked, first_broken_event_id, reason FROM verify_batch_events($1)', [batchId]);
  return r.rows[0];
}

module.exports = { insertAudit, searchAudit, verifyAuditChain, verifyBatchEvents, buildWhere };
