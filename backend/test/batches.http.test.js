'use strict';

const assert = require('node:assert/strict');
const { test, before, after, beforeEach } = require('node:test');
const express = require('express');
const { createAuthenticate } = require('../src/middleware/authenticate');
const { createLoadCurrentUser } = require('../src/middleware/currentUser');
const { requirePermission, statusesAwaiting } = require('../src/middleware/rbac');
const { errorHandler, notFound } = require('../src/common/errorHandler');
const { createTokenService } = require('../src/modules/auth/auth.tokens');
const { createQrTokenService } = require('../src/common/qrToken');
const { createBatchService } = require('../src/modules/batches/batches.service');
const { createBatchController } = require('../src/modules/batches/batches.controller');

const secret = process.env.JWT_SECRET || 'test-only-secret-at-least-32-characters-long';
const tokens = createTokenService({ secret });
const expired = createTokenService({ secret, expiresIn: '-1s' });
const users = [
  [10, 'FARMER', 1, 'ACTIVE'], [11, 'FARMER', 2, 'ACTIVE'],
  [12, 'ADMIN', null, 'ACTIVE'], [13, 'PROCESSOR', 3, 'ACTIVE'],
  [14, 'DISTRIBUTOR', 4, 'ACTIVE'], [15, 'FARMER', 1, 'PENDING'],
  [16, 'FARMER', null, 'ACTIVE'], [17, 'FARMER', 1, 'LOCKED'],
].map(([user_id, role, organization_id, status]) => ({ user_id, role, organization_id, status }));
const input = { productName: 'Cà phê', origin: 'Đắk Lắk', quantity: 500 };
let rows, qrs, events, audits, duplicateCode, observedError, queue, server, baseUrl;
const visible = (auth, row, includeAwaiting = false) => auth.role === 'ADMIN' ||
  (auth.role === 'FARMER' && Number(row.organization_id) === auth.organizationId) ||
  ((auth.role === 'PROCESSOR' || auth.role === 'DISTRIBUTOR') && (
    events.some((event) => Number(event.batch_id) === Number(row.batch_id) &&
      Number(users.find((user) => user.user_id === event.actor_id)?.organization_id) === auth.organizationId) ||
    (includeAwaiting && statusesAwaiting(auth.role).includes(row.current_status))
  ));
const repo = {
  async lockBatchCodeSequence() {},
  async nextBatchCode() {
    return duplicateCode || `BATCH-${new Date().getFullYear()}-${String(rows.length + 1).padStart(4, '0')}`;
  },
  async insertBatch(_db, batch) {
    if (rows.some((row) => row.batch_code === batch.batchCode)) {
      const error = new Error('duplicate batch_code');
      error.code = '23505';
      throw error;
    }
    const row = { batch_id: String(rows.length + 1), batch_code: batch.batchCode,
      product_name: batch.productName, origin: batch.origin, quantity: batch.quantity.toFixed(2),
      creation_date: new Date().toISOString(), current_status: 'CREATED',
      created_by: String(batch.createdBy), organization_id: String(batch.organizationId) };
    rows.push(row);
    return { ...row };
  },
  async insertQr(_db, qr) {
    const row = { qr_id: String(qrs.length + 1), batch_id: String(qr.batchId),
      qr_data: qr.qrData, created_at: new Date().toISOString() };
    qrs.push(row);
    return { ...row };
  },
  async insertCreatedEvent(_db, event) {
    const row = { event_id: String(events.length + 1), batch_id: String(event.batchId), actor_id: event.actorId, event_type: 'CREATED' };
    events.push(row); return { ...row };
  },
  async findVisibleBatch(_db, auth, id, { includeAwaiting = false } = {}) {
    const row = rows.find((batch) => Number(batch.batch_id) === id && visible(auth, batch, includeAwaiting));
    return row ? { ...row } : null;
  },
  async listVisibleBatches(_db, auth, { status, q, limit, offset }) {
    const selected = rows.filter((row) => visible(auth, row) && (!status || row.current_status === status) &&
      (!q || `${row.product_name} ${row.batch_code}`.toLowerCase().includes(q.toLowerCase())));
    return { rows: selected.slice(offset, offset + limit).map((row) => ({ ...row })), total: selected.length };
  },
  async updateBatch(_db, id, changes) {
    const row = rows.find((batch) => Number(batch.batch_id) === id);
    if (changes.productName !== undefined) row.product_name = changes.productName;
    if (changes.origin !== undefined) row.origin = changes.origin;
    if (changes.quantity !== undefined) row.quantity = changes.quantity.toFixed(2);
    return { ...row };
  },
  async findQr(_db, id) { return qrs.find((qr) => Number(qr.batch_id) === id); },
};
const withTransaction = (callback) => {
  const pending = queue.then(async () => {
    const snapshot = structuredClone({ rows, qrs, events, audits });
    try { return await callback({}); }
    catch (error) { rows = snapshot.rows; qrs = snapshot.qrs; events = snapshot.events; audits = snapshot.audits; throw error; }
  });
  queue = pending.catch(() => {});
  return pending;
};
const service = createBatchService({ db: {}, repo, withTransaction, insertAudit: async (_db, audit) => { audits.push(audit); },
  qr: createQrTokenService({ secret: 'test-qr-secret'.repeat(4), baseUrl: 'https://trace.example.com' }) });
const controller = createBatchController(service);
const app = express();
app.use(express.json());
const auth = [createAuthenticate(tokens), createLoadCurrentUser({ db: {
  async query(_sql, [id]) { return { rows: users.filter((user) => user.user_id === id) }; },
} })];
app.post('/api/batches', auth, requirePermission('batch:create'), controller.create);
app.get('/api/batches', auth, requirePermission('batch:read'), controller.list);
app.get('/api/batches/:batchId', auth, requirePermission('batch:read'), controller.get);
app.patch('/api/batches/:batchId', auth, requirePermission('batch:update'), controller.update);
app.get('/api/batches/:batchId/qr', auth, requirePermission('qr:read'), controller.getQr);
app.use(notFound);
app.use((error, req, res, next) => { observedError = error; next(error); });
app.use(errorHandler);

function tokenFor(id) {
  const user = users.find((row) => row.user_id === id);
  return tokens.sign({ userId: id, role: user.role, organizationId: user.organization_id });
}
async function request(method = 'POST', path = '', body = input, token = tokenFor(10)) {
  const response = await fetch(`${baseUrl}/api/batches${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
function expectError(result, status, code, field) {
  assert.equal(result.status, status);
  assert.equal(result.body.code, code);
  assert.ok(result.body.message.length > 0);
  assert.equal('stack' in result.body, false);
  if (field) assert.ok(result.body.details.some((detail) => detail.field === field && detail.message.trim().length > 0));
}
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});
beforeEach(() => { rows = []; qrs = []; events = []; audits = []; duplicateCode = null; observedError = null; queue = Promise.resolve(); });

test('TC-BATCH-01: A Farmer ACTIVE tạo lô đúng DTO, QR, CREATED và 3 audit → 201', async () => {
  const result = await request();
  assert.equal(result.status, 201);
  assert.match(result.body.batchCode, new RegExp(`^BATCH-${new Date().getFullYear()}-\\d{4}$`));
  assert.deepEqual(result.body, { ...input, batchId: 1, batchCode: result.body.batchCode,
    creationDate: rows[0].creation_date, currentStatus: 'CREATED', createdBy: 10, organizationId: 1 });
  assert.equal(qrs.length, 1); assert.equal(Number(qrs[0].batch_id), result.body.batchId);
  assert.equal(events.length, 1); assert.equal(events[0].event_type, 'CREATED');
  assert.equal(audits.length, 3);
  assert.deepEqual(audits.map(({ entityType, action, actorId }) => ({ entityType, action, actorId })), [
    { entityType: 'BATCH', action: 'CREATE', actorId: 10 },
    { entityType: 'QR_CODE', action: 'CREATE', actorId: 10 },
    { entityType: 'EVENT', action: 'CREATE', actorId: 10 },
  ]);
});
for (const [label, token, code] of [['thiếu', null, 'UNAUTHORIZED'], ['giả', 'invalid', 'INVALID_TOKEN'],
  ['hết hạn', expired.sign({ userId: 10, role: 'FARMER', organizationId: 1 }), 'TOKEN_EXPIRED']]) {
  test(`TC-BATCH-03: token ${label} → 401`, async () => {
    expectError(await request('POST', '', input, token), 401, code);
    assert.equal(rows.length, 0);
  });
}
for (const field of ['productName', 'origin', 'quantity']) {
  test(`TC-BATCH-02: thiếu ${field} → 400`, async () => {
    const body = { ...input }; delete body[field];
    expectError(await request('POST', '', body), 400, 'VALIDATION_ERROR', field);
  });
}
for (const [field, values] of [['productName', ['', '   ']], ['origin', ['', '   ']], ['quantity', [0, -1, 'abc', 1.234]]]) {
  for (const value of values) test(`TC-BATCH-02: ${field}=${JSON.stringify(value)} → 400`, async () => {
    expectError(await request('POST', '', { ...input, [field]: value }), 400, 'VALIDATION_ERROR', field);
    assert.equal(rows.length, 0);
  });
}
test('TC-BATCH-11: hai lô liên tiếp có mã tăng 0001/0002 → 201', async () => {
  const first = await request(); const second = await request();
  assert.equal(first.status, 201); assert.equal(second.status, 201);
  assert.equal(first.body.batchCode, `BATCH-${new Date().getFullYear()}-0001`);
  assert.equal(second.body.batchCode, `BATCH-${new Date().getFullYear()}-0002`);
});
// Transaction giả tuần tự trong bộ nhớ chỉ chứng minh logic cấp mã không trùng ở tầng service.
// Chưa kiểm chứng advisory lock hoặc UNIQUE trên PostgreSQL thật; việc đó để smoke-batches với CSDL thật ở tuần 8.
test('TC-BATCH-11: tạo đồng thời qua transaction giả tuần tự có mã duy nhất → 201', async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () => request()));
  results.forEach((result) => assert.equal(result.status, 201));
  assert.equal(new Set(results.map((result) => result.body.batchCode)).size, 10);
});
test('TC-BATCH-11: UNIQUE batch_code truyền lỗi 23505 tới handler → 409', async () => {
  duplicateCode = (await request()).body.batchCode;
  const result = await request();
  expectError(result, 409, 'CONFLICT');
  assert.equal(observedError.code, '23505');
  assert.deepEqual(result.body, { code: 'CONFLICT', message: 'Dữ liệu bị trùng' });
  assert.equal(rows.length, 1);
});
test('TC-BATCH-07: Farmer chỉ liệt kê đơn vị mình, chủ lô và Admin xem chi tiết → 200/404', async () => {
  await request(); await request('POST', '', input, tokenFor(11));
  const list = await request('GET');
  assert.equal(list.status, 200); assert.equal(list.body.total, 1);
  assert.deepEqual(list.body.items.map((row) => row.organizationId), [1]);
  assert.equal((await request('GET', '/1')).status, 200);
  expectError(await request('GET', '/2'), 404, 'NOT_FOUND');
  assert.equal((await request('GET', '/2', undefined, tokenFor(12))).status, 200);
});
test('TC-BATCH-07: Processor và Distributor chỉ liệt kê lô đã xử lý, xem thêm lô đang chờ → 200/404', async () => {
  const distributorBatch = (await request()).body;
  const distributorListBefore = await request('GET', '', undefined, tokenFor(14));
  assert.equal(distributorListBefore.status, 200);
  assert.equal(distributorListBefore.body.items.some((row) => row.batchId === distributorBatch.batchId), false);
  assert.equal((await request('GET', `/${distributorBatch.batchId}`, undefined, tokenFor(14))).status, 200);

  assert.equal((await request('GET', `/${distributorBatch.batchId}`, undefined, tokenFor(13))).status, 404);
  const processorBatch = (await request('POST', '', { ...input, productName: 'Lô Processor' }, tokenFor(11))).body;
  rows[1].current_status = 'RECEIVED';
  assert.equal((await request('GET', `/${processorBatch.batchId}`, undefined, tokenFor(13))).status, 200);

  events.push({ event_id: '99', batch_id: String(distributorBatch.batchId), actor_id: 14, event_type: 'TRANSPORTED' });
  const distributorListAfter = await request('GET', '', undefined, tokenFor(14));
  assert.equal(distributorListAfter.body.items.some((row) => row.batchId === distributorBatch.batchId), true);
  const adminList = await request('GET', '', undefined, tokenFor(12));
  assert.equal(adminList.body.total, rows.length);
});
test('TC-BATCH-08: lọc CREATED và tìm tên/mã → 200', async () => {
  await request(); await request('POST', '', { ...input, productName: 'Hồ tiêu' });
  rows[1].current_status = 'TRANSPORTED';
  for (const query of ['?status=CREATED', `?q=${encodeURIComponent('Cà phê')}`, `?q=${rows[0].batch_code}`]) {
    const result = await request('GET', query);
    assert.equal(result.status, 200); assert.deepEqual(result.body.items.map((row) => row.batchId), [1]);
  }
});
test('TC-BATCH-08: trạng thái SAI → 400', async () => {
  expectError(await request('GET', '?status=SAI'), 400, 'VALIDATION_ERROR', 'status');
});
test('TC-BATCH-09: tìm kiếm không khớp trả danh sách rỗng → 200', async () => {
  await request();
  const result = await request('GET', '?q=khong-co-lo-nao');
  assert.equal(result.status, 200); assert.deepEqual(result.body.items, []); assert.equal(result.body.total, 0);
});
test("TC-BATCH-10: chuỗi injection không lộ lô ngoài phạm vi và batchId lạ trả 400", async () => {
  await request(); await request('POST', '', input, tokenFor(11));
  const before = await request('GET', '', undefined, tokenFor(10));
  const result = await request('GET', `?q=${encodeURIComponent("' OR 1=1 --")}`, undefined, tokenFor(10));
  assert.equal(result.status, 200); assert.ok(result.body.total <= before.body.total);
  assert.ok(result.body.items.every((row) => before.body.items.some((allowed) => allowed.batchId === row.batchId)));
  expectError(await request('GET', '/not-a-batch-id'), 400, 'VALIDATION_ERROR', 'batchId');
});
test('TC-BATCH-04: chủ lô PATCH giữ nguyên trường không gửi → 200', async () => {
  const original = (await request()).body;
  const result = await request('PATCH', '/1', { productName: 'Tên mới', quantity: 12.5 });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ...original, productName: 'Tên mới', quantity: 12.5 });
});
for (const id of [12, 13, 14, 15, 16]) {
  test(`TC-BATCH-03: user ${id} không được tạo → 403`, async () => {
    expectError(await request('POST', '', input, tokenFor(id)), 403,
      id === 15 ? 'ACCOUNT_PENDING' : id === 16 ? 'NO_ORGANIZATION' : 'FORBIDDEN');
    assert.equal(rows.length, 0);
  });
}
for (const [id, status, code] of [[11, 404, 'NOT_FOUND'], [12, 403, 'FORBIDDEN'], [13, 403, 'FORBIDDEN'], [14, 403, 'FORBIDDEN'], [null, 401, 'UNAUTHORIZED']]) {
  test(`${id === 11 ? 'TC-BATCH-06' : 'TC-BATCH-03'}: user ${id} không được PATCH lô → ${status}`, async () => {
    await request();
    expectError(await request('PATCH', '/1', { quantity: 10 }, id ? tokenFor(id) : null), status, code);
    assert.equal(Number(rows[0].quantity), input.quantity);
  });
}
test('TC-BATCH-12: Farmer LOCKED tạo lô bị chặn, dữ liệu không đổi → 403 ACCOUNT_LOCKED', async () => {
  expectError(await request('POST', '', input, tokenFor(17)), 403, 'ACCOUNT_LOCKED');
  assert.deepEqual({ rows, qrs, events, audits }, { rows: [], qrs: [], events: [], audits: [] });
});
test('TC-BATCH-05: PATCH lô TRANSPORTED → 409', async () => {
  await request(); rows[0].current_status = 'TRANSPORTED';
  expectError(await request('PATCH', '/1', { quantity: 1 }), 409, 'BATCH_NOT_EDITABLE');
  assert.equal(Number(rows[0].quantity), input.quantity);
});
for (const [body, field] of [[{ batchCode: 'fake' }, 'batchCode'], [{ currentStatus: 'SHIPPED' }, 'currentStatus'],
  [{ createdBy: 11 }, 'createdBy'], [{ organizationId: 2 }, 'organizationId'], [{}, 'body'], [{ quantity: 0 }, 'quantity'], [{ quantity: -1 }, 'quantity']]) {
  test(`TC-BATCH-13: PATCH ${JSON.stringify(body)} → 400`, async () => {
    await request(); const original = structuredClone(rows);
    expectError(await request('PATCH', '/1', body), 400, 'VALIDATION_ERROR', field);
    assert.deepEqual(rows, original);
  });
}
test('TC-QR-05 và TC-QR-08: QR chủ lô và Farmer khác đơn vị → 200/404', async () => {
  const batch = (await request()).body;
  const result = await request('GET', '/1/qr');
  assert.equal(result.status, 200); assert.equal(result.body.batchId, batch.batchId);
  assert.ok(result.body.qrData.startsWith(`https://trace.example.com/trace/${batch.batchCode}.`));
  expectError(await request('GET', '/1/qr', undefined, tokenFor(11)), 404, 'NOT_FOUND');
});
