'use strict';

const { NotFoundError } = require('../../common/errors');

function toAuditDto(row) {
  return {
    auditId: Number(row.audit_id),
    actorId: row.actor_id == null ? null : Number(row.actor_id),
    actorName: row.actor_name ?? null,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id == null ? null : Number(row.entity_id),
    oldValue: row.old_value ?? null,
    newValue: row.new_value ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

const toChainDto = (r, idField) => ({
  checked: Number(r.checked),
  valid: r[idField] == null,
  firstBrokenId: r[idField] == null ? null : Number(r[idField]),
  reason: r.reason ?? null,
});

// Service đọc audit log (US-S06). Ghi audit dùng audit.repository.insertAudit trong transaction của từng module.
function createAuditService({ db, repo }) {
  async function search(filters) {
    const { rows, total } = await repo.searchAudit(db, filters);
    return { items: rows.map(toAuditDto), page: filters.page, limit: filters.limit, total };
  }

  // Kiểm tra toàn vẹn: chuỗi audit chung, và chuỗi sự kiện của một lô nếu có batchId.
  async function verify({ batchId } = {}) {
    const result = { auditLog: toChainDto(await repo.verifyAuditChain(db), 'first_broken_audit_id') };
    if (batchId !== undefined) {
      const ev = toChainDto(await repo.verifyBatchEvents(db, batchId), 'first_broken_event_id');
      if (ev.checked === 0 && ev.valid) throw new NotFoundError('NOT_FOUND', 'Không tìm thấy lô hoặc lô chưa có sự kiện');
      result.batchEvents = { batchId, ...ev };
    }
    result.valid = result.auditLog.valid && (!result.batchEvents || result.batchEvents.valid);
    result.checkedAt = new Date().toISOString();
    return result;
  }

  return { search, verify };
}

module.exports = { createAuditService, toAuditDto };
