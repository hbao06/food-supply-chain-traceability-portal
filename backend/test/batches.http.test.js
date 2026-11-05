'use strict';

const assert = require('node:assert/strict');
const { test, before, after, beforeEach } = require('node:test');
const express = require('express');
const { createAuthenticate } = require('../src/middleware/authenticate');
const { createLoadCurrentUser } = require('../src/middleware/currentUser');
const { requirePermission } = require('../src/middleware/rbac');
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
  [16, 'FARMER', null, 'ACTIVE'],
].map(([user_id, role, organization_id, status]) => ({ user_id, role, organization_id, status }));
const input = { productName: 'Cà phê', origin: 'Đắk Lắk', quantity: 500 };
let rows, qrs, duplicateCode, observedError, queue, server, baseUrl;
const visible = (auth, row) => auth.role === 'ADMIN' ||
  (auth.role === 'FARMER' && Number(row.organization_id) === auth.organizationId);
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
  async insertCreatedEvent() { return { event_id: '1' }; },
  async findVisibleBatch(_db, auth, id) {
    const row = rows.find((batch) => Number(batch.batch_id) === id && visible(auth, batch));
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
    const snapshot = structuredClone({ rows, qrs });
    try { return await callback({}); }
    catch (error) { rows = snapshot.rows; qrs = snapshot.qrs; throw error; }
  });
  queue = pending.catch(() => {});
  return pending;
};
const service = createBatchService({ db: {}, repo, withTransaction, insertAudit: async () => {},
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
beforeEach(() => { rows = []; qrs = []; duplicateCode = null; observedError = null; queue = Promise.resolve(); });

test('W5-TV4: A Farmer ACTIVE tạo lô đúng DTO → 201', async () => {
  const result = await request();
  assert.equal(result.status, 201);
  assert.match(result.body.batchCode, new RegExp(`^BATCH-${new Date().getFullYear()}-\\d{4}$`));
  assert.deepEqual(result.body, { ...input, batchId: 1, batchCode: result.body.batchCode,
    creationDate: rows[0].creation_date, currentStatus: 'CREATED', createdBy: 10, organizationId: 1 });
});
for (const [label, token, code] of [['thiếu', null, 'UNAUTHORIZED'], ['giả', 'invalid', 'INVALID_TOKEN'],
  ['hết hạn', expired.sign({ userId: 10, role: 'FARMER', organizationId: 1 }), 'TOKEN_EXPIRED']]) {
  test(`W5-TV4: A token ${label} → 401`, async () => {
    expectError(await request('POST', '', input, token), 401, code);
    assert.equal(rows.length, 0);
  });
}
for (const field of ['productName', 'origin', 'quantity']) {
  test(`W5-TV4: B thiếu ${field} → 400`, async () => {
    const body = { ...input }; delete body[field];
    expectError(await request('POST', '', body), 400, 'VALIDATION_ERROR', field);
  });
}
for (const [field, values] of [['productName', ['', '   ']], ['origin', ['', '   ']], ['quantity', [0, -1, 'abc', 1.234]]]) {
  for (const value of values) test(`W5-TV4: B ${field}=${JSON.stringify(value)} → 400`, async () => {
    expectError(await request('POST', '', { ...input, [field]: value }), 400, 'VALIDATION_ERROR', field);
    assert.equal(rows.length, 0);
  });
}
test('W5-TV4: C hai lô liên tiếp có mã tăng 0001/0002 → 201', async () => {
  const first = await request(); const second = await request();
  assert.equal(first.status, 201); assert.equal(second.status, 201);
  assert.equal(first.body.batchCode, `BATCH-${new Date().getFullYear()}-0001`);
  assert.equal(second.body.batchCode, `BATCH-${new Date().getFullYear()}-0002`);
});
test('W5-TV4: C tạo đồng thời qua transaction giả tuần tự có mã duy nhất → 201', async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () => request()));
  results.forEach((result) => assert.equal(result.status, 201));
  assert.equal(new Set(results.map((result) => result.body.batchCode)).size, 10);
});
test('W5-TV4: C UNIQUE batch_code truyền lỗi 23505 tới handler → 409', async () => {
  duplicateCode = (await request()).body.batchCode;
  const result = await request();
  expectError(result, 409, 'CONFLICT');
  assert.equal(observedError.code, '23505');
  assert.deepEqual(result.body, { code: 'CONFLICT', message: 'Dữ liệu bị trùng' });
  assert.equal(rows.length, 1);
});
test('W5-TV4: D Farmer chỉ liệt kê đơn vị mình, chủ lô và Admin xem chi tiết → 200/404', async () => {
  await request(); await request('POST', '', input, tokenFor(11));
  const list = await request('GET');
  assert.equal(list.status, 200); assert.equal(list.body.total, 1);
  assert.deepEqual(list.body.items.map((row) => row.organizationId), [1]);
  assert.equal((await request('GET', '/1')).status, 200);
  expectError(await request('GET', '/2'), 404, 'NOT_FOUND');
  assert.equal((await request('GET', '/2', undefined, tokenFor(12))).status, 200);
});
test('W5-TV4: D lọc CREATED và tìm tên/mã → 200', async () => {
  await request(); await request('POST', '', { ...input, productName: 'Hồ tiêu' });
  rows[1].current_status = 'TRANSPORTED';
  for (const query of ['?status=CREATED', `?q=${encodeURIComponent('Cà phê')}`, `?q=${rows[0].batch_code}`]) {
    const result = await request('GET', query);
    assert.equal(result.status, 200); assert.deepEqual(result.body.items.map((row) => row.batchId), [1]);
  }
});
test('W5-TV4: D trạng thái SAI → 400', async () => {
  expectError(await request('GET', '?status=SAI'), 400, 'VALIDATION_ERROR', 'status');
});
test('W5-TV4: E chủ lô PATCH giữ nguyên trường không gửi → 200', async () => {
  const original = (await request()).body;
  const result = await request('PATCH', '/1', { productName: 'Tên mới', quantity: 12.5 });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ...original, productName: 'Tên mới', quantity: 12.5 });
});
for (const id of [12, 13, 14, 15, 16]) {
  test(`W5-TV4: E user ${id} không được tạo → 403`, async () => {
    expectError(await request('POST', '', input, tokenFor(id)), 403,
      id === 15 ? 'ACCOUNT_PENDING' : id === 16 ? 'NO_ORGANIZATION' : 'FORBIDDEN');
    assert.equal(rows.length, 0);
  });
}
for (const [id, status, code] of [[11, 404, 'NOT_FOUND'], [12, 403, 'FORBIDDEN'], [13, 403, 'FORBIDDEN'], [14, 403, 'FORBIDDEN'], [null, 401, 'UNAUTHORIZED']]) {
  test(`W5-TV4: E user ${id} không được PATCH lô → ${status}`, async () => {
    await request();
    expectError(await request('PATCH', '/1', { quantity: 10 }, id ? tokenFor(id) : null), status, code);
    assert.equal(Number(rows[0].quantity), input.quantity);
  });
}
test('W5-TV4: E PATCH lô TRANSPORTED → 409', async () => {
  await request(); rows[0].current_status = 'TRANSPORTED';
  expectError(await request('PATCH', '/1', { quantity: 1 }), 409, 'BATCH_NOT_EDITABLE');
  assert.equal(Number(rows[0].quantity), input.quantity);
});
for (const [body, field] of [[{ batchCode: 'fake' }, 'batchCode'], [{ currentStatus: 'SHIPPED' }, 'currentStatus'],
  [{ createdBy: 11 }, 'createdBy'], [{ organizationId: 2 }, 'organizationId'], [{}, 'body'], [{ quantity: 0 }, 'quantity'], [{ quantity: -1 }, 'quantity']]) {
  test(`W5-TV4: E PATCH ${JSON.stringify(body)} → 400`, async () => {
    await request(); const original = structuredClone(rows);
    expectError(await request('PATCH', '/1', body), 400, 'VALIDATION_ERROR', field);
    assert.deepEqual(rows, original);
  });
}
test('W5-TV4: E QR chủ lô và Farmer khác đơn vị → 200/404', async () => {
  const batch = (await request()).body;
  const result = await request('GET', '/1/qr');
  assert.equal(result.status, 200); assert.equal(result.body.batchId, batch.batchId);
  assert.ok(result.body.qrData.startsWith(`https://trace.example.com/trace/${batch.batchCode}.`));
  expectError(await request('GET', '/1/qr', undefined, tokenFor(11)), 404, 'NOT_FOUND');
});
