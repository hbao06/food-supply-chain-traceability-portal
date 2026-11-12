'use strict';

// Test HTTP/API cho QR và truy xuất công khai (W7-TV4) — theo docs/test/test-plan.md:
//   TC-QR-01, 02, 03, 09 chạy trên main hiện tại;
//   TC-QR-06, 07, 10 kiểm định dạng ảnh thuộc TV4; TC-QR-04 và 11–17 chờ PR #59 (W7-TV2) merge;
//   TC-QR-05 và TC-QR-08 đã được kiểm thử trong batches.http.test.js.
// Chạy bằng node --test với Express và CSDL giả trong bộ nhớ, không cần PostgreSQL.

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

const jwtSecret = process.env.JWT_SECRET || 'test-only-secret-at-least-32-characters-long';
const tokens = createTokenService({ secret: jwtSecret });
const expired = createTokenService({ secret: jwtSecret, expiresIn: '-1s' });
const qrSecret = 'test-qr-secret-at-least-32-characters-long';
const qr = createQrTokenService({ secret: qrSecret, baseUrl: 'https://trace.example.com' });
const users = [
  { user_id: 10, role: 'FARMER', organization_id: 1, status: 'ACTIVE' },
  { user_id: 11, role: 'FARMER', organization_id: 2, status: 'ACTIVE' },
  { user_id: 12, role: 'ADMIN', organization_id: null, status: 'ACTIVE' },
];
const input = { productName: 'Cà phê', origin: 'Đắk Lắk', quantity: 500 };
let rows, qrs, events, audits, queue, server, baseUrl;

const repo = {
  async lockBatchCodeSequence() {},
  async nextBatchCode() { return `BATCH-${new Date().getFullYear()}-${String(rows.length + 1).padStart(4, '0')}`; },
  async insertBatch(_db, batch) {
    const row = { batch_id: String(rows.length + 1), batch_code: batch.batchCode, product_name: batch.productName,
      origin: batch.origin, quantity: batch.quantity.toFixed(2), creation_date: new Date().toISOString(),
      current_status: 'CREATED', created_by: String(batch.createdBy), organization_id: String(batch.organizationId) };
    rows.push(row);
    return { ...row };
  },
  async insertQr(_db, data) {
    const row = { qr_id: String(qrs.length + 1), batch_id: String(data.batchId), qr_data: data.qrData, created_at: new Date().toISOString() };
    qrs.push(row);
    return { ...row };
  },
  async insertCreatedEvent(_db, data) {
    const row = { event_id: String(events.length + 1), batch_id: String(data.batchId), actor_id: data.actorId, event_type: 'CREATED' };
    events.push(row);
    return { ...row };
  },
  async findVisibleBatch(_db, auth, id) {
    const row = rows.find((batch) => Number(batch.batch_id) === id &&
      (auth.role === 'ADMIN' || Number(batch.organization_id) === auth.organizationId));
    return row ? { ...row } : null;
  },
  async listVisibleBatches() { return { rows: [], total: 0 }; },
  async updateBatch(_db, id, changes) {
    const row = rows.find((batch) => Number(batch.batch_id) === id);
    if (changes.productName !== undefined) row.product_name = changes.productName;
    if (changes.origin !== undefined) row.origin = changes.origin;
    if (changes.quantity !== undefined) row.quantity = changes.quantity.toFixed(2);
    return { ...row };
  },
  async findQr(_db, id) { return qrs.find((item) => Number(item.batch_id) === id); },
};

const withTransaction = (callback) => {
  const pending = queue.then(async () => {
    const snapshot = structuredClone({ rows, qrs, events, audits });
    try { return await callback({}); }
    catch (error) {
      rows = snapshot.rows; qrs = snapshot.qrs; events = snapshot.events; audits = snapshot.audits;
      throw error;
    }
  });
  queue = pending.catch(() => {});
  return pending;
};
const service = createBatchService({ db: {}, withTransaction, repo, qr,
  insertAudit: async (_db, entry) => { audits.push(entry); } });
const controller = createBatchController(service);
const app = express();
app.use(express.json());
const auth = [createAuthenticate(tokens), createLoadCurrentUser({ db: {
  async query(_sql, [id]) { return { rows: users.filter((user) => user.user_id === id) }; },
} })];
app.post('/api/batches', auth, requirePermission('batch:create'), controller.create);
app.patch('/api/batches/:batchId', auth, requirePermission('batch:update'), controller.update);
app.get('/api/batches/:batchId/qr', auth, requirePermission('qr:read'), controller.getQr);
app.use(notFound);
app.use(errorHandler);

function tokenFor(id, tokenService = tokens) {
  const user = users.find((row) => row.user_id === id);
  return tokenService.sign({ userId: id, role: user.role, organizationId: user.organization_id });
}
async function request(method, path, { body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
async function rawRequest(method, path, { body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()),
    async json() { return JSON.parse(this.bytes.toString('utf8')); } };
}
async function createBatch() {
  const result = await request('POST', '/api/batches', { body: input, token: tokenFor(10) });
  assert.equal(result.status, 201);
  return { batch: result.body, token: qrs.at(-1).qr_data.split('/trace/')[1] };
}
function assertPublicTrace(body) {
  assert.equal(typeof body.productName, 'string');
  assert.equal(typeof body.batchCode, 'string');
  assert.equal(typeof body.origin, 'string');
  assert.equal(typeof body.organizationName, 'string');
  assert.ok(Array.isArray(body.events));
  const times = body.events.map((event) => Date.parse(event.timestamp));
  assert.ok(times.every(Number.isFinite));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  for (const event of body.events) {
    assert.equal(typeof event.eventType, 'string');
    assert.equal(typeof event.organizationName, 'string');
    assert.equal(typeof event.location, 'string');
  }
}
function expectError(result, status, code) {
  assert.equal(result.status, status);
  assert.equal(result.body.code, code);
  assert.ok(result.body.message.length > 0);
  assert.equal('stack' in result.body, false);
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
beforeEach(() => { rows = []; qrs = []; events = []; audits = []; queue = Promise.resolve(); });

test('TC-QR-01: Farmer tạo lô hợp lệ → 201, đúng một QR có token HMAC hợp lệ và URL truy xuất', async () => {
  const result = await request('POST', '/api/batches', { body: input, token: tokenFor(10) });
  assert.equal(result.status, 201);
  assert.equal(rows.length, 1);
  assert.equal(qrs.length, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].event_type, 'CREATED');
  assert.equal(audits.length, 3);
  const token = qrs[0].qr_data.split('/trace/')[1];
  assert.match(token, /^BATCH-[0-9]{4}-[0-9]{4,}\.[A-Za-z0-9_-]+$/);
  assert.equal(qr.verify(token), rows[0].batch_code);
  assert.ok(qrs[0].qr_data.endsWith(`/trace/${token}`));
});

test('TC-QR-02: Farmer cập nhật lô còn CREATED → qr_token không đổi', async () => {
  await request('POST', '/api/batches', { body: input, token: tokenFor(10) });
  const before = await request('GET', '/api/batches/1/qr', { token: tokenFor(10) });
  const result = await request('PATCH', '/api/batches/1', { body: { origin: 'Lâm Đồng' }, token: tokenFor(10) });
  assert.equal(result.status, 200);
  const after = await request('GET', '/api/batches/1/qr', { token: tokenFor(10) });
  assert.equal(qrs.length, 1, 'repo giả chỉ ghi đúng một QR khi tạo lô, không ghi thêm khi cập nhật');
  assert.equal(after.body.qrData, before.body.qrData);
});

test('E2E-QR: tạo lô → lấy QR qua API → token xác minh về đúng mã lô', async () => {
  const created = await request('POST', '/api/batches', { body: input, token: tokenFor(10) });
  assert.equal(created.status, 201);
  const qrResult = await request('GET', `/api/batches/${created.body.batchId}/qr`, { token: tokenFor(10) });
  assert.equal(qrResult.status, 200);
  const token = qrResult.body.qrData.split('/trace/')[1];
  assert.match(token, /^BATCH-[0-9]{4}-[0-9]{4,}\.[A-Za-z0-9_-]+$/);
  assert.ok(qrResult.body.qrData.endsWith(`/${created.body.batchCode}.${token.split('.')[1]}`));
  assert.equal(qr.verify(token), created.body.batchCode);
});

test('TC-QR-03: thiếu QR_HMAC_SECRET → 500 và transaction rollback batch, QR, CREATED, audit', async () => {
  const badQr = createQrTokenService({ secret: 'short', baseUrl: 'https://trace.example.com' });
  const badService = createBatchService({ db: {}, withTransaction, repo, qr: badQr,
    insertAudit: async (_db, entry) => { audits.push(entry); } });
  const badController = createBatchController(badService);
  const isolated = express();
  isolated.use(express.json());
  isolated.post('/api/batches', auth, requirePermission('batch:create'), badController.create);
  isolated.use(notFound);
  isolated.use(errorHandler);
  const local = isolated.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { local.once('listening', resolve); local.once('error', reject); });
  try {
    const response = await fetch(`http://127.0.0.1:${local.address().port}/api/batches`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(10)}` }, body: JSON.stringify(input) });
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.code, 'INTERNAL_ERROR');
    assert.deepEqual({ rows, qrs, events, audits }, { rows: [], qrs: [], events: [], audits: [] });
  } finally {
    await new Promise((resolve, reject) => {
      local.close((error) => error ? reject(error) : resolve());
      local.closeAllConnections();
    });
  }
});

test('TC-QR-09: GET QR không có token hoặc token hết hạn → 401', async () => {
  expectError(await request('GET', '/api/batches/1/qr'), 401, 'UNAUTHORIZED');
  expectError(await request('GET', '/api/batches/1/qr', { token: tokenFor(10, expired) }), 401, 'TOKEN_EXPIRED');
});

// Chờ PR #59 (W7-TV2) merge: hiện chưa có endpoint /trace/{qrToken}.
test('TC-QR-04: sửa một ký tự token rồi truy xuất → 404', { skip: 'chờ PR #59 (W7-TV2) merge: chưa có endpoint /trace' }, async () => {
  const { token } = await createBatch();
  const altered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
  const result = await rawRequest('GET', `/trace/${encodeURIComponent(altered)}`);
  assert.equal(result.status, 404);
  assert.equal((await result.json()).message, 'Không tìm thấy thông tin truy xuất hợp lệ');
});
test('TC-QR-06: format=png trả PNG tối thiểu 512×512 với tên file theo mã lô', async () => {
  const { batch } = await createBatch();
  const response = await rawRequest('GET', `/api/batches/${batch.batchId}/qr?format=png`, { token: tokenFor(10) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition') || '', new RegExp(`QR-${batch.batchCode}\\.png`));
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(response.bytes.subarray(0, 8), pngSignature);
  assert.equal(response.bytes.toString('ascii', 12, 16), 'IHDR');
  assert.ok(response.bytes.readUInt32BE(16) >= 512);
  assert.ok(response.bytes.readUInt32BE(20) >= 512);
});
test('TC-QR-07: format=svg trả SVG hợp lệ có phần tử vẽ', async () => {
  const { batch } = await createBatch();
  const response = await rawRequest('GET', `/api/batches/${batch.batchId}/qr?format=svg`, { token: tokenFor(10) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition') || '', new RegExp(`QR-${batch.batchCode}\\.svg`));
  const svg = response.bytes.toString('utf8').trim();
  assert.match(svg, /^(?:<\?xml[^>]*>\s*)?<svg\b/i);
  assert.match(svg, /<(?:path|rect|g|use|polygon)\b/i);
});
test('TC-QR-10: format=gif trả 400 và liệt kê png, svg', async () => {
  const { batch } = await createBatch();
  const result = await request('GET', `/api/batches/${batch.batchId}/qr?format=gif`, { token: tokenFor(10) });
  assert.equal(result.status, 400);
  assert.match(result.body.message, /png/i);
  assert.match(result.body.message, /svg/i);
});
// Chờ PR #59 (W7-TV2) merge: endpoint truy xuất công khai chưa có.
test('TC-QR-11: trace token công khai trả thông tin lô và timeline dưới 3 giây', { skip: 'chờ PR #59 (W7-TV2) merge: chưa có endpoint /trace' }, async () => {
  const { token } = await createBatch();
  const started = performance.now();
  const result = await request('GET', `/trace/${encodeURIComponent(token)}`);
  const elapsed = performance.now() - started;
  assert.equal(result.status, 200);
  assertPublicTrace(result.body);
  assert.ok(elapsed < 3000, `harness phản hồi ${elapsed.toFixed(1)}ms`);
  // Đây là phép đo trong môi trường giả; NFR-01 chính thức được đo ở tuần 8 trên bản triển khai thật.
});
// NFR-01 chính thức đo trên bản triển khai thật ở tuần 8; harness giả chỉ đo thời gian cục bộ.
test('TC-QR-12: trace theo mã lô công khai trả cùng cấu trúc và giới hạn trường', { skip: 'chờ PR #59 (W7-TV2) merge: chưa có endpoint /trace' }, async () => {
  const { batch } = await createBatch();
  const result = await request('GET', `/trace/code/${encodeURIComponent(batch.batchCode)}`);
  assert.equal(result.status, 200);
  assertPublicTrace(result.body);
  assert.equal(result.body.batchCode, batch.batchCode);
});
test('TC-QR-13: trace lô chỉ có CREATED trả timeline đúng một sự kiện', { skip: 'chờ PR #59 (W7-TV2) merge: chưa có endpoint /trace' }, async () => {
  const { token } = await createBatch();
  const result = await request('GET', `/trace/${encodeURIComponent(token)}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.events.length, 1);
  assert.equal(result.body.events[0].eventType, 'CREATED');
});
// Các trường cấm được liệt kê theo hợp đồng: email, user_id, actor_id, created_by, createdBy, audit, audit_logs, auditLogs.
// Chờ PR #59 (W7-TV2) merge: chưa có DTO công khai để kiểm tra các trường cấm đệ quy.
test('TC-QR-14: DTO công khai không lộ email, mã người dùng/người ghi hoặc audit', { skip: 'chờ PR #59 (W7-TV2) merge: chưa có endpoint /trace' }, async () => {
  const { token } = await createBatch();
  const result = await request('GET', `/trace/${encodeURIComponent(token)}`);
  assert.equal(result.status, 200);
  const forbiddenFields = ['email', 'user_id', 'userId', 'actor_id', 'actorId', 'created_by', 'createdBy',
    'audit', 'audit_log', 'audit_logs', 'auditLog', 'auditLogs'];
  function assertNoForbiddenFields(value, path = '$') {
    if (Array.isArray(value)) return value.forEach((item, index) => assertNoForbiddenFields(item, `${path}[${index}]`));
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        assert.ok(!forbiddenFields.includes(key), `trường cấm ${path}.${key} xuất hiện`);
        assertNoForbiddenFields(child, `${path}.${key}`);
      }
    }
  }
  assertNoForbiddenFields(result.body);
});
test('TC-QR-15: token không tồn tại hoặc sai chữ ký trả 404 với thông báo chung', { skip: 'chờ PR #59 (W7-TV2) merge: chưa có endpoint /trace' }, async () => {
  const { token } = await createBatch();
  const badSignature = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
  for (const candidate of ['BATCH-2026-9999.invalid-signature', badSignature]) {
    const result = await request('GET', `/trace/${encodeURIComponent(candidate)}`);
    assert.equal(result.status, 404);
    assert.equal(result.body.message, 'Không tìm thấy thông tin truy xuất hợp lệ');
    assert.doesNotMatch(result.body.message, /signature|chữ ký|token|không hợp lệ/i);
  }
});
test('TC-QR-16: mã lô không tồn tại trả 404 với thông báo chung', { skip: 'chờ PR #59 (W7-TV2) merge: chưa có endpoint /trace' }, async () => {
  const result = await request('GET', '/trace/code/BATCH-2026-9999');
  assert.equal(result.status, 404);
  assert.equal(result.body.message, 'Không tìm thấy thông tin truy xuất hợp lệ');
});
test('TC-QR-17: yêu cầu thứ 61 từ một IP trong một phút trả 429', { skip: 'chờ PR #59 (W7-TV2) merge: chưa có endpoint /trace và limiter' }, async () => {
  const { token } = await createBatch();
  const results = await Promise.all(Array.from({ length: 61 }, () => rawRequest('GET', `/trace/${encodeURIComponent(token)}`)));
  assert.equal(results[60].status, 429);
});
