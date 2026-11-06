'use strict';

const { ForbiddenError, NotFoundError, ConflictError } = require('../../common/errors');
const { toBatchDto } = require('../batches/batches.service');

function toEventDto(row) {
  return {
    eventId: Number(row.event_id),
    batchId: Number(row.batch_id),
    actorId: Number(row.actor_id),
    eventType: row.event_type,
    timestamp: row.timestamp,
    location: row.location,
    description: row.description ?? null,
    actorName: row.actor_name,
    organizationName: row.organization_name ?? null,
  };
}

const NOT_FOUND = () => new NotFoundError('NOT_FOUND', 'Không tìm thấy lô');

// Phụ thuộc được truyền vào để test không cần CSDL thật. rbac = { canRecordEvent, nextEventType } của middleware/rbac.js.
function createEventService({ db, withTransaction, batchRepo, repo, insertAudit, rbac }) {
  const { canRecordEvent, nextEventType } = rbac;

  // Ghi sự kiện. Thứ tự kiểm tra: đúng vai trò cho loại sự kiện (403) -> lô trong phạm vi (404) -> đúng thứ tự (409).
  async function record(auth, batchId, { eventType, location, description }) {
    if (!canRecordEvent(auth.role, eventType)) {
      throw new ForbiddenError('FORBIDDEN', `Vai trò ${auth.role} không được ghi sự kiện ${eventType}`);
    }
    return withTransaction(async (tx) => {
      // Khóa dòng lô để hai sự kiện đồng thời không cùng vượt qua kiểm tra thứ tự.
      const batch = await batchRepo.findVisibleBatch(tx, auth, batchId, { forUpdate: true, includeAwaiting: true });
      if (!batch) throw NOT_FOUND();

      if (nextEventType(batch.current_status) !== eventType) {
        throw new ConflictError('INVALID_SEQUENCE', `Sự kiện ${eventType} không hợp lệ sau trạng thái ${batch.current_status}`);
      }

      const eventId = await repo.insertEvent(tx, { batchId, actorId: auth.userId, eventType, location, description });
      // Mọi cập nhật có audit: một dòng cho sự kiện, một dòng cho thay đổi trạng thái lô (cùng transaction).
      await insertAudit(tx, { actorId: auth.userId, action: 'CREATE', entityType: 'EVENT', entityId: eventId,
        newValue: { batchId, eventType, location } });
      await insertAudit(tx, { actorId: auth.userId, action: 'UPDATE', entityType: 'BATCH', entityId: batchId,
        oldValue: { currentStatus: batch.current_status }, newValue: { currentStatus: eventType } });
      return toEventDto(await repo.findEvent(tx, eventId));
    });
  }

  async function list(auth, batchId) {
    const batch = await batchRepo.findVisibleBatch(db, auth, batchId, { includeAwaiting: true });
    if (!batch) throw NOT_FOUND();
    return (await repo.listEvents(db, batchId)).map(toEventDto);
  }

  async function timeline(auth, batchId) {
    const batch = await batchRepo.findVisibleBatch(db, auth, batchId, { includeAwaiting: true });
    if (!batch) throw NOT_FOUND();
    return { batch: toBatchDto(batch), events: (await repo.listEvents(db, batchId)).map(toEventDto) };
  }

  return { record, list, timeline };
}

module.exports = { createEventService, toEventDto };
