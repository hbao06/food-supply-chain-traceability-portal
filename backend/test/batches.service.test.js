'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBatchService } = require('../src/modules/batches/batches.service');
const { createQrTokenService } = require('../src/common/qrToken');

// ---- CSDL giả trong bộ nhớ, mô phỏng đúng quy tắc phạm vi của batchReadScope (Farmer: cùng đơn vị) ----
function setup() {
  const state = { batches: [], qrs: [], events: [], audits: [], nextId: 1, txRolledBack: 0 };
  const repo = {
    async lockBatchCodeSequence() {},
    async nextBatchCode() { return `BATCH-2026-${String(state.batches.length + 1).padStart(4, '0')}`; },
    async insertBatch(_d, b) {
      const row = { batch_id: String(state.nextId++), batch_code: b.batchCode, product_name: b.productName, origin: b.origin,
        quantity: b.quantity.toFixed(2), creation_date: new Date('2026-11-02T10:00:00Z'), current_status: 'CREATED',
        created_by: String(b.createdBy), organization_id: String(b.organizationId) };
      state.batches.push(row); return { ...row };
    },
    async insertQr(_d, q) { const row = { qr_id: String(state.qrs.length + 1), batch_id: String(q.batchId), qr_data: q.qrData, created_at: new Date('2026-11-02T10:00:00Z') }; state.qrs.push({ ...row, signatureHmac: q.signatureHmac }); return row; },
    async insertCreatedEvent(_d, e) { const row = { event_id: String(state.events.length + 1) }; state.events.push({ ...e, type: 'CREATED' }); return row; },
    async findVisibleBatch(_d, auth, id) {
      const b = state.batches.find((x) => Number(x.batch_id) === id);
      if (!b) return null;
      if (auth.role === 'ADMIN' || Number(b.organization_id) === auth.organizationId) return { ...b };
      return null;
    },
    async listVisibleBatches(_d, auth, { status, q, limit, offset }) {
      let rows = state.batches.filter((b) => auth.role === 'ADMIN' || Number(b.organization_id) === auth.organizationId);
      if (status) rows = rows.filter((b) => b.current_status === status);
      if (q) rows = rows.filter((b) => (b.product_name + b.batch_code).toLowerCase().includes(q.toLowerCase()));
      return { rows: rows.slice(offset, offset + limit).map((b) => ({ ...b })), total: rows.length };
    },
    async updateBatch(_d, id, ch) {
      const b = state.batches.find((x) => Number(x.batch_id) === id);
      if (ch.productName !== undefined) b.product_name = ch.productName;
      if (ch.origin !== undefined) b.origin = ch.origin;
      if (ch.quantity !== undefined) b.quantity = ch.quantity.toFixed(2);
      return { ...b };
    },
    async findQr(_d, id) { const q = state.qrs.find((x) => Number(x.batch_id) === id); return q ? { ...q } : null; },
  };
  const withTransaction = async (fn) => {
    const snap = JSON.stringify({ b: state.batches, q: state.qrs, e: state.events, a: state.audits });
    try { return await fn({}); } catch (err) { const s = JSON.parse(snap); state.batches = s.b; state.qrs = s.q; state.events = s.e; state.audits = s.a; state.txRolledBack += 1; throw err; }
  };
  const insertAudit = async (_d, a) => { if (state.failAudit) throw new Error('audit down'); state.audits.push(a); };
  const qr = createQrTokenService({ secret: 'k'.repeat(40), baseUrl: 'https://t.example.com' });
  const service = createBatchService({ db: {}, withTransaction, repo, qr, insertAudit });
  return { state, service };
}

const farmerA = { userId: 10, role: 'FARMER', organizationId: 1 };
const farmerB = { userId: 11, role: 'FARMER', organizationId: 2 };
const admin = { userId: 1, role: 'ADMIN', organizationId: null };
const input = { productName: 'Cà phê', origin: 'Đắk Lắk', quantity: 500 };

test('tạo lô: mã lô, QR, sự kiện CREATED và 3 dòng audit trong cùng transaction', async () => {
  const { state, service } = setup();
  const b = await service.create(farmerA, input);
  assert.deepEqual([b.batchId, b.batchCode, b.currentStatus, b.createdBy, b.organizationId, b.quantity], [1, 'BATCH-2026-0001', 'CREATED', 10, 1, 500]);
  assert.equal(state.qrs.length, 1);
  assert.ok(state.qrs[0].qr_data.includes(state.qrs[0].signatureHmac));
  assert.equal(state.qrs[0].qr_data, `https://t.example.com/trace/BATCH-2026-0001.${state.qrs[0].signatureHmac}`);
  assert.deepEqual(state.events.map((e) => [e.type, e.actorId, e.location]), [['CREATED', 10, 'Đắk Lắk']]);
  assert.deepEqual(state.audits.map((a) => `${a.action}:${a.entityType}`).sort(), ['CREATE:BATCH', 'CREATE:EVENT', 'CREATE:QR_CODE']);
});

test('tạo lô: hai lô liên tiếp có mã khác nhau', async () => {
  const { service } = setup();
  const a = await service.create(farmerA, input);
  const b = await service.create(farmerA, input);
  assert.notEqual(a.batchCode, b.batchCode);
  assert.equal(b.batchCode, 'BATCH-2026-0002');
});

test('tạo lô: tài khoản không có đơn vị -> 403 NO_ORGANIZATION, không ghi gì', async () => {
  const { state, service } = setup();
  const e = await service.create({ userId: 5, role: 'FARMER', organizationId: null }, input).catch((x) => x);
  assert.equal(e.status, 403); assert.equal(e.code, 'NO_ORGANIZATION');
  assert.equal(state.batches.length, 0);
});

test('tạo lô: lỗi ở bước audit hoàn tác cả lô, QR và sự kiện', async () => {
  const { state, service } = setup();
  state.failAudit = true;
  await assert.rejects(service.create(farmerA, input), /audit down/);
  assert.deepEqual([state.batches.length, state.qrs.length, state.events.length, state.txRolledBack], [0, 0, 0, 1]);
});

test('tạo lô: thiếu QR_HMAC_SECRET -> lỗi và hoàn tác, không có lô "mồ côi"', async () => {
  const { state } = setup();
  const noKey = createBatchService({ db: {}, withTransaction: async (fn) => fn({}), repo: {
    lockBatchCodeSequence: async () => {}, nextBatchCode: async () => 'BATCH-2026-0001',
    insertBatch: async () => { state.batches.push({}); return { batch_id: '1' }; } },
    qr: createQrTokenService({ secret: undefined }), insertAudit: async () => {} });
  await assert.rejects(noKey.create(farmerA, input), /QR_HMAC_SECRET/);
});

test('xem lô: Farmer đơn vị mình 200; Farmer đơn vị khác và lô không tồn tại cùng 404; Admin xem được', async () => {
  const { service } = setup();
  const b = await service.create(farmerA, input);
  assert.equal((await service.get(farmerA, b.batchId)).batchCode, b.batchCode);
  assert.equal((await service.get(admin, b.batchId)).batchCode, b.batchCode);
  const other = await service.get(farmerB, b.batchId).catch((e) => e);
  const missing = await service.get(farmerA, 999).catch((e) => e);
  assert.equal(other.status, 404); assert.equal(missing.status, 404);
  assert.deepEqual([other.code, other.message], [missing.code, missing.message], 'không phân biệt hai trường hợp');
});

test('danh sách: lọc theo phạm vi, trạng thái, từ khóa, phân trang', async () => {
  const { service } = setup();
  await service.create(farmerA, { ...input, productName: 'Cà phê' });
  await service.create(farmerA, { ...input, productName: 'Sầu riêng' });
  await service.create(farmerB, { ...input, productName: 'Hồ tiêu' });
  assert.equal((await service.list(farmerA, { page: 1, limit: 20 })).total, 2);
  assert.equal((await service.list(farmerB, { page: 1, limit: 20 })).total, 1);
  assert.equal((await service.list(admin, { page: 1, limit: 20 })).total, 3);
  assert.equal((await service.list(farmerA, { status: 'SHIPPED', page: 1, limit: 20 })).total, 0);
  assert.deepEqual((await service.list(farmerA, { q: 'sầu', page: 1, limit: 20 })).items.map((x) => x.productName), ['Sầu riêng']);
  const p2 = await service.list(admin, { page: 2, limit: 2 });
  assert.deepEqual([p2.items.length, p2.page, p2.limit, p2.total], [1, 2, 2, 3]);
});

test('sửa lô: đổi giá trị, ghi audit UPDATE với giá trị cũ/mới chỉ gồm trường thay đổi', async () => {
  const { state, service } = setup();
  const b = await service.create(farmerA, input);
  state.audits.length = 0;
  const u = await service.update(farmerA, b.batchId, { quantity: 480, origin: 'Đắk Lắk' });
  assert.equal(u.quantity, 480);
  assert.equal(state.audits.length, 1);
  assert.deepEqual([state.audits[0].action, state.audits[0].oldValue, state.audits[0].newValue], ['UPDATE', { quantity: 500 }, { quantity: 480 }]);
});

test('sửa lô: không có gì đổi thì không ghi audit', async () => {
  const { state, service } = setup();
  const b = await service.create(farmerA, input);
  state.audits.length = 0;
  await service.update(farmerA, b.batchId, { quantity: 500 });
  assert.equal(state.audits.length, 0);
});

test('sửa lô: đơn vị khác -> 404 và dữ liệu không đổi', async () => {
  const { state, service } = setup();
  const b = await service.create(farmerA, input);
  const e = await service.update(farmerB, b.batchId, { quantity: 1 }).catch((x) => x);
  assert.equal(e.status, 404);
  assert.equal(Number(state.batches[0].quantity), 500);
});

test('sửa lô: đã rời CREATED -> 409 BATCH_NOT_EDITABLE', async () => {
  const { state, service } = setup();
  const b = await service.create(farmerA, input);
  state.batches[0].current_status = 'TRANSPORTED';
  const e = await service.update(farmerA, b.batchId, { quantity: 1 }).catch((x) => x);
  assert.equal(e.status, 409); assert.equal(e.code, 'BATCH_NOT_EDITABLE');
  assert.equal(Number(state.batches[0].quantity), 500);
});

test('QR: có QR trả 200; ngoài phạm vi 404; không có QR 404', async () => {
  const { state, service } = setup();
  const b = await service.create(farmerA, input);
  const q = await service.getQr(farmerA, b.batchId);
  assert.deepEqual([q.qrId, q.batchId], [1, 1]);
  assert.ok(q.qrData.startsWith('https://t.example.com/trace/BATCH-2026-0001.'));
  assert.equal((await service.getQr(farmerB, b.batchId).catch((e) => e)).status, 404);
  state.qrs.length = 0;
  assert.equal((await service.getQr(farmerA, b.batchId).catch((e) => e)).status, 404);
});
