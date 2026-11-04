'use strict';

const { ForbiddenError, NotFoundError, ConflictError } = require('../../common/errors');

// Hàng CSDL -> JSON của API (camelCase). BIGINT/NUMERIC của pg là chuỗi nên đổi sang số.
function toBatchDto(row) {
  return {
    batchId: Number(row.batch_id),
    batchCode: row.batch_code,
    productName: row.product_name,
    origin: row.origin,
    quantity: Number(row.quantity),
    creationDate: row.creation_date,
    currentStatus: row.current_status,
    createdBy: Number(row.created_by),
    organizationId: Number(row.organization_id),
  };
}

const NOT_FOUND = () => new NotFoundError('NOT_FOUND', 'Không tìm thấy lô');

// Phụ thuộc được truyền vào (db, repo, qr, audit...) để test không cần CSDL thật.
function createBatchService({ db, withTransaction, repo, qr, insertAudit }) {
  // Tạo lô: lô + QR + sự kiện CREATED + audit trong MỘT transaction (UC01, UC04, R6, R8).
  async function create(auth, input) {
    if (auth.organizationId == null) {
      throw new ForbiddenError('NO_ORGANIZATION', 'Tài khoản chưa thuộc đơn vị nào nên chưa tạo được lô');
    }
    return withTransaction(async (tx) => {
      await repo.lockBatchCodeSequence(tx);
      const batchCode = await repo.nextBatchCode(tx);
      const row = await repo.insertBatch(tx, {
        batchCode, ...input, createdBy: auth.userId, organizationId: auth.organizationId,
      });
      const batchId = Number(row.batch_id);
      const qrRow = await repo.insertQr(tx, { batchId, qrData: qr.url(batchCode), signatureHmac: qr.signature(batchCode) });
      const event = await repo.insertCreatedEvent(tx, { batchId, actorId: auth.userId, location: input.origin });

      const dto = toBatchDto(row);
      await insertAudit(tx, { actorId: auth.userId, action: 'CREATE', entityType: 'BATCH', entityId: batchId,
        newValue: { batchCode, productName: dto.productName, origin: dto.origin, quantity: dto.quantity, organizationId: dto.organizationId } });
      await insertAudit(tx, { actorId: auth.userId, action: 'CREATE', entityType: 'QR_CODE', entityId: Number(qrRow.qr_id),
        newValue: { batchId } });
      await insertAudit(tx, { actorId: auth.userId, action: 'CREATE', entityType: 'EVENT', entityId: Number(event.event_id),
        newValue: { batchId, eventType: 'CREATED' } });
      return dto;
    });
  }

  async function list(auth, { status, q, page, limit }) {
    const { rows, total } = await repo.listVisibleBatches(db, auth, { status, q, limit, offset: (page - 1) * limit });
    return { items: rows.map(toBatchDto), page, limit, total };
  }

  async function get(auth, batchId) {
    const row = await repo.findVisibleBatch(db, auth, batchId, { includeAwaiting: true });
    if (!row) throw NOT_FOUND(); // không tồn tại và ngoài phạm vi cho cùng kết quả
    return toBatchDto(row);
  }

  // Sửa lô: chỉ Farmer của đơn vị sở hữu và chỉ khi còn CREATED (US-B02). Vai trò sai đã bị requirePermission chặn (403).
  async function update(auth, batchId, changes) {
    return withTransaction(async (tx) => {
      const row = await repo.findVisibleBatch(tx, auth, batchId, { forUpdate: true });
      if (!row) throw NOT_FOUND();
      if (row.current_status !== 'CREATED') {
        throw new ConflictError('BATCH_NOT_EDITABLE', `Lô đã chuyển sang trạng thái ${row.current_status}, không thể sửa`);
      }
      const current = { productName: row.product_name, origin: row.origin, quantity: Number(row.quantity) };
      const diff = {};
      for (const [field, value] of Object.entries(changes)) if (current[field] !== value) diff[field] = value;
      if (Object.keys(diff).length === 0) return toBatchDto(row); // không đổi gì thì không ghi audit

      const updated = await repo.updateBatch(tx, batchId, diff);
      const oldValue = {};
      for (const field of Object.keys(diff)) oldValue[field] = current[field];
      await insertAudit(tx, { actorId: auth.userId, action: 'UPDATE', entityType: 'BATCH', entityId: batchId,
        oldValue, newValue: diff });
      return toBatchDto(updated);
    });
  }

  async function getQr(auth, batchId) {
    const row = await repo.findVisibleBatch(db, auth, batchId, { includeAwaiting: true });
    if (!row) throw NOT_FOUND();
    const qrRow = await repo.findQr(db, batchId);
    if (!qrRow) throw NOT_FOUND();
    return { qrId: Number(qrRow.qr_id), batchId: Number(qrRow.batch_id), qrData: qrRow.qr_data, createdAt: qrRow.created_at };
  }

  return { create, list, get, update, getQr };
}

module.exports = { createBatchService, toBatchDto };
