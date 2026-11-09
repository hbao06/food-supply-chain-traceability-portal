'use strict';

// Test HTTP/API cho module Events và Timeline (W6-TV4) — kèm mã TC trong docs/test/test-plan.md:
//   TC-EVT-01 toàn vẹn thứ tự chuỗi, TC-EVT-02 thời điểm/trường giả mạo, TC-EVT-03 sự kiện trùng,
//   TC-EVT-04 sai vai trò; TC-BATCH-15/16/17 cho timeline.
// Chạy bằng node --test với CSDL giả trong bộ nhớ (mẫu theo batches.http.test.js, không cần PostgreSQL).
// Repo giả mô phỏng đúng 2 hành vi của CSDL thật mà service phụ thuộc:
//   - trigger check_event_rules tự đồng bộ batches.current_status sau khi INSERT sự kiện;
//   - findEvent/listEvents trả kèm actor_name và organization_name (JOIN users/organizations).
// Chưa kiểm chứng được ở đây: trigger append-only chặn UPDATE/DELETE và khóa dòng FOR UPDATE trên
// PostgreSQL thật — việc đó thuộc smoke-events.js với CSDL thật (kế hoạch kiểm thử tuần 8).

const assert = require('node:assert/strict');
const { test, before, after, beforeEach } = require('node:test');
const express = require('express');
const { createAuthenticate } = require('../src/middleware/authenticate');
const { createLoadCurrentUser } = require('../src/middleware/currentUser');
const { requirePermission, statusesAwaiting, canRecordEvent, nextEventType } = require('../src/middleware/rbac');
const { errorHandler, notFound } = require('../src/common/errorHandler');
const { createTokenService } = require('../src/modules/auth/auth.tokens');
const { createEventService } = require('../src/modules/events/events.service');
const { createEventController } = require('../src/modules/events/events.controller');

const secret = process.env.JWT_SECRET || 'test-only-secret-at-least-32-characters-long';
const tokens = createTokenService({ secret });
const orgNames = { 1: 'HTX Cà phê Cầu Đất', 2: 'HTX Lúa gạo ST25', 3: 'Nhà máy chế biến Nông sản', 4: 'Công ty Phân phối Miền Nam' };
const users = [
  [10, 'FARMER', 1, 'ACTIVE', 'Nguyễn Văn An'], [11, 'FARMER', 2, 'ACTIVE', 'Trần Thị Bích'],
  [12, 'ADMIN', null, 'ACTIVE', 'Quản trị viên'], [13, 'PROCESSOR', 3, 'ACTIVE', 'Lê Văn Chế'],
  [14, 'DISTRIBUTOR', 4, 'ACTIVE', 'Phạm Thị Phân'], [18, 'PROCESSOR', 3, 'PENDING', 'Đỗ Văn Chờ'],
].map(([user_id, role, organization_id, status, name]) => ({ user_id, role, organization_id, status, name }));
const CHAIN = ['CREATED', 'TRANSPORTED', 'RECEIVED', 'PROCESSED', 'PACKAGED', 'SHIPPED'];
const ACTOR_BY_TYPE = { CREATED: 10, TRANSPORTED: 14, RECEIVED: 14, PROCESSED: 13, PACKAGED: 13, SHIPPED: 14 };
let batches, events, audits, queue, server, baseUrl;

const visible = (auth, row, includeAwaiting = false) => auth.role === 'ADMIN' ||
  (auth.role === 'FARMER' && Number(row.organization_id) === auth.organizationId) ||
  ((auth.role === 'PROCESSOR' || auth.role === 'DISTRIBUTOR') && (
    events.some((event) => Number(event.batch_id) === Number(row.batch_id) &&
      Number(users.find((user) => user.user_id === event.actor_id)?.organization_id) === auth.organizationId) ||
    (includeAwaiting && statusesAwaiting(auth.role).includes(row.current_status))
  ));

function pushEvent(batchId, actorId, eventType, minutesAgo = 0) {
  const actor = users.find((user) => user.user_id === actorId);
  const row = { event_id: String(events.length + 1), batch_id: String(batchId), actor_id: actorId,
    event_type: eventType, timestamp: new Date(Date.now() - minutesAgo * 60000).toISOString(),
    location: 'Địa điểm mẫu', description: null,
    actor_name: actor.name, organization_name: actor.organization_id ? orgNames[actor.organization_id] : null };
  events.push(row);
  return row;
}
// Tạo lô thuộc đơn vị 1 ở trạng thái cho trước, kèm đủ sự kiện của các bước đã qua (mới -> cũ theo thời gian).
function seedBatch(status = 'CREATED') {
  const id = batches.length + 1;
  const row = { batch_id: String(id), batch_code: `BATCH-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`,
    product_name: 'Cà phê', origin: 'Đắk Lắk', quantity: '500.00',
    creation_date: new Date(Date.now() - CHAIN.indexOf(status) * 60000).toISOString(),
    current_status: status, created_by: '10', organization_id: '1' };
  batches.push(row);
  const steps = CHAIN.slice(0, CHAIN.indexOf(status) + 1);
  steps.forEach((type, index) => pushEvent(id, ACTOR_BY_TYPE[type], type, (steps.length - index) * 10));
  return row;
}

const batchRepo = {
  async findVisibleBatch(_db, auth, id, { includeAwaiting = false } = {}) {
    const row = batches.find((batch) => Number(batch.batch_id) === id && visible(auth, batch, includeAwaiting));
    return row ? { ...row } : null;
  },
};
const eventRepo = {
  async insertEvent(_db, { batchId, actorId, eventType, location, description }) {
    const row = pushEvent(batchId, actorId, eventType);
    row.location = location; row.description = description ?? null;
    row.timestamp = new Date().toISOString();
    // Trigger check_event_rules của CSDL thật đồng bộ trạng thái lô trong cùng transaction.
    const batch = batches.find((item) => Number(item.batch_id) === batchId);
    if (batch) batch.current_status = eventType;
    return Number(row.event_id);
  },
  async findEvent(_db, eventId) {
    const row = events.find((event) => Number(event.event_id) === eventId);
    return row ? { ...row } : null;
  },
  async listEvents(_db, batchId) {
    return events.filter((event) => Number(event.batch_id) === batchId)
      .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : Number(a.event_id) - Number(b.event_id)))
      .map((row) => ({ ...row }));
  },
};
const withTransaction = (callback) => {
  const pending = queue.then(async () => {
    const snapshot = structuredClone({ batches, events, audits });
    try { return await callback({}); }
    catch (error) { batches = snapshot.batches; events = snapshot.events; audits = snapshot.audits; throw error; }
  });
  queue = pending.catch(() => {});
  return pending;
};
const service = createEventService({ db: {}, withTransaction, batchRepo, repo: eventRepo,
  insertAudit: async (_db, audit) => { audits.push(audit); }, rbac: { canRecordEvent, nextEventType } });
const controller = createEventController(service);
const app = express();
app.use(express.json());
const auth = [createAuthenticate(tokens), createLoadCurrentUser({ db: {
  async query(_sql, [id]) { return { rows: users.filter((user) => user.user_id === id) }; },
} })];
app.post('/api/batches/:batchId/events', auth, requirePermission('event:create'), controller.create);
app.get('/api/batches/:batchId/events', auth, requirePermission('event:read'), controller.list);
app.get('/api/batches/:batchId/timeline', auth, requirePermission('timeline:read'), controller.timeline);
app.use(notFound);
app.use(errorHandler);

function tokenFor(id) {
  const user = users.find((row) => row.user_id === id);
  return tokens.sign({ userId: id, role: user.role, organizationId: user.organization_id });
}
async function request(method, path, { body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
const post = (batchId, body, token) => request('POST', `/api/batches/${batchId}/events`, { body, token });
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
beforeEach(() => { batches = []; events = []; audits = []; queue = Promise.resolve(); });

test('TC-EVT-01: ghi đủ chuỗi 5 bước đúng thứ tự → 201, DTO do máy chủ đặt người ghi/thời điểm, trạng thái lô đi tới SHIPPED', async () => {
  seedBatch('CREATED');
  const steps = [['TRANSPORTED', 14], ['RECEIVED', 14], ['PROCESSED', 13], ['PACKAGED', 13], ['SHIPPED', 14]];
  let previous = 'CREATED';
  for (const [eventType, actorId] of steps) {
    const beforeCount = audits.length;
    const result = await post(1, { eventType, location: `Kho ${eventType}`, description: '  ' }, tokenFor(actorId));
    assert.equal(result.status, 201);
    assert.equal(result.body.eventType, eventType);
    assert.equal(result.body.batchId, 1);
    assert.equal(result.body.actorId, actorId);
    assert.equal(result.body.actorName, users.find((user) => user.user_id === actorId).name);
    assert.equal(result.body.organizationName, orgNames[users.find((user) => user.user_id === actorId).organization_id]);
    assert.equal(result.body.location, `Kho ${eventType}`);
    assert.equal(result.body.description, null);
    assert.ok(Math.abs(Date.now() - new Date(result.body.timestamp).getTime()) < 60000);
    // Mỗi sự kiện ghi đúng 2 audit: CREATE EVENT và UPDATE BATCH (trạng thái cũ -> mới).
    assert.equal(audits.length, beforeCount + 2);
    assert.deepEqual(audits.slice(-2).map(({ action, entityType }) => ({ action, entityType })),
      [{ action: 'CREATE', entityType: 'EVENT' }, { action: 'UPDATE', entityType: 'BATCH' }]);
    assert.deepEqual(audits.at(-1).oldValue, { currentStatus: previous });
    assert.deepEqual(audits.at(-1).newValue, { currentStatus: eventType });
    previous = eventType;
  }
  const timeline = await request('GET', '/api/batches/1/timeline', { token: tokenFor(10) });
  assert.equal(timeline.status, 200);
  assert.equal(timeline.body.batch.currentStatus, 'SHIPPED');
  assert.deepEqual(timeline.body.events.map((event) => event.eventType), CHAIN);
});

test('TC-EVT-01: nhảy cóc một bước → 409 INVALID_SEQUENCE và không đổi dữ liệu', async () => {
  seedBatch('CREATED');
  const result = await post(1, { eventType: 'RECEIVED', location: 'Kho nhận' }, tokenFor(14));
  expectError(result, 409, 'INVALID_SEQUENCE');
  assert.equal(events.length, 1);
  assert.equal(batches[0].current_status, 'CREATED');
  assert.equal(audits.length, 0);
});

test('TC-EVT-01: ghi thêm sự kiện sau SHIPPED → 409 INVALID_SEQUENCE', async () => {
  seedBatch('SHIPPED');
  const result = await post(1, { eventType: 'SHIPPED', location: 'Kho xuất' }, tokenFor(14));
  expectError(result, 409, 'INVALID_SEQUENCE');
  assert.equal(events.length, CHAIN.length);
});

test('TC-EVT-03: ghi trùng cùng một loại sự kiện hai lần → lần hai 409 INVALID_SEQUENCE', async () => {
  seedBatch('CREATED');
  const first = await post(1, { eventType: 'TRANSPORTED', location: 'Bến xe' }, tokenFor(14));
  assert.equal(first.status, 201);
  const second = await post(1, { eventType: 'TRANSPORTED', location: 'Bến xe' }, tokenFor(14));
  expectError(second, 409, 'INVALID_SEQUENCE');
  assert.equal(events.filter((event) => event.event_type === 'TRANSPORTED').length, 1);
  assert.equal(batches[0].current_status, 'TRANSPORTED');
});

for (const [field, forged] of [['timestamp', '2020-01-01T00:00:00.000Z'], ['actorId', 13], ['batchId', 999]]) {
  test(`TC-EVT-02: gửi kèm ${field} (giả mạo người ghi/thời điểm/lô) → 400`, async () => {
    seedBatch('CREATED');
    const result = await post(1, { eventType: 'TRANSPORTED', location: 'Bến xe', [field]: forged }, tokenFor(14));
    expectError(result, 400, 'VALIDATION_ERROR', field);
    assert.equal(events.length, 1);
    assert.equal(audits.length, 0);
  });
}

for (const [label, body, field] of [
  ['eventType CREATED gửi qua API', { eventType: 'CREATED', location: 'Nông trại' }, 'eventType'],
  ['eventType không tồn tại', { eventType: 'FLOWN', location: 'Sân bay' }, 'eventType'],
  ['thiếu location', { eventType: 'TRANSPORTED' }, 'location'],
  ['location chỉ có khoảng trắng', { eventType: 'TRANSPORTED', location: '   ' }, 'location'],
  ['location dài 256 ký tự', { eventType: 'TRANSPORTED', location: 'a'.repeat(256) }, 'location'],
  ['description dài 1001 ký tự', { eventType: 'TRANSPORTED', location: 'Bến xe', description: 'a'.repeat(1001) }, 'description'],
  ['trường lạ ngoài hợp đồng', { eventType: 'TRANSPORTED', location: 'Bến xe', note: 'x' }, 'note'],
]) {
  test(`TC-EVT-02: ${label} → 400`, async () => {
    seedBatch('CREATED');
    expectError(await post(1, body, tokenFor(14)), 400, 'VALIDATION_ERROR', field);
    assert.equal(events.length, 1);
  });
}

for (const [label, eventType, actorId] of [
  ['Processor ghi TRANSPORTED', 'TRANSPORTED', 13],
  ['Distributor ghi PROCESSED', 'PROCESSED', 14],
  ['Distributor ghi PACKAGED', 'PACKAGED', 14],
  ['Processor ghi SHIPPED', 'SHIPPED', 13],
  ['Farmer ghi TRANSPORTED', 'TRANSPORTED', 10],
  ['Admin ghi TRANSPORTED', 'TRANSPORTED', 12],
]) {
  test(`TC-EVT-04: ${label} → 403 FORBIDDEN`, async () => {
    seedBatch('CREATED');
    expectError(await post(1, { eventType, location: 'Kho' }, tokenFor(actorId)), 403, 'FORBIDDEN');
    assert.equal(events.length, 1);
  });
}

test('TC-EVT-04: kiểm vai trò trước khi kiểm lô — sai vai trò với lô không tồn tại vẫn 403, đúng vai trò mới 404', async () => {
  expectError(await post(999, { eventType: 'TRANSPORTED', location: 'Kho' }, tokenFor(13)), 403, 'FORBIDDEN');
  expectError(await post(999, { eventType: 'TRANSPORTED', location: 'Kho' }, tokenFor(14)), 404, 'NOT_FOUND');
});

test('TC-EVT-04: đúng vai trò nhưng lô ngoài phạm vi → 404 NOT_FOUND', async () => {
  seedBatch('CREATED');
  // Processor chưa có sự kiện nào trên lô này và lô đang chờ Distributor, không chờ Processor.
  expectError(await post(1, { eventType: 'PROCESSED', location: 'Xưởng' }, tokenFor(13)), 404, 'NOT_FOUND');
  assert.equal(events.length, 1);
});

test('ghi sự kiện: chưa đăng nhập → 401; tài khoản PENDING → 403 ACCOUNT_PENDING', async () => {
  seedBatch('RECEIVED');
  expectError(await post(1, { eventType: 'PROCESSED', location: 'Xưởng' }, undefined), 401, 'UNAUTHORIZED');
  expectError(await post(1, { eventType: 'PROCESSED', location: 'Xưởng' }, tokenFor(18)), 403, 'ACCOUNT_PENDING');
  assert.equal(events.length, 3);
});

test('TC-BATCH-16: timeline của lô vừa tạo có đúng 1 sự kiện CREATED → 200', async () => {
  seedBatch('CREATED');
  const result = await request('GET', '/api/batches/1/timeline', { token: tokenFor(10) });
  assert.equal(result.status, 200);
  assert.equal(result.body.batch.currentStatus, 'CREATED');
  assert.equal(result.body.batch.batchCode, batches[0].batch_code);
  assert.equal(result.body.events.length, 1);
  assert.equal(result.body.events[0].eventType, 'CREATED');
  assert.equal(result.body.events[0].actorName, 'Nguyễn Văn An');
});

test('TC-BATCH-15: timeline trong phạm vi trả sự kiện cũ → mới, đủ người ghi/đơn vị/địa điểm/thời gian → 200', async () => {
  seedBatch('PACKAGED');
  const timeline = await request('GET', '/api/batches/1/timeline', { token: tokenFor(13) });
  assert.equal(timeline.status, 200);
  assert.deepEqual(timeline.body.events.map((event) => event.eventType), CHAIN.slice(0, 5));
  for (const event of timeline.body.events) {
    assert.ok(event.actorName.length > 0);
    assert.ok(event.organizationName.length > 0);
    assert.ok(event.location.length > 0);
    assert.ok(!Number.isNaN(new Date(event.timestamp).getTime()));
  }
  const stamps = timeline.body.events.map((event) => new Date(event.timestamp).getTime());
  assert.deepEqual(stamps, [...stamps].sort((a, b) => a - b));
  // GET danh sách sự kiện cho cùng kết quả và thứ tự.
  const list = await request('GET', '/api/batches/1/events', { token: tokenFor(14) });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((event) => event.eventType), CHAIN.slice(0, 5));
});

test('TC-BATCH-15: lô đang chờ vai trò mình thì vai trò đó xem được timeline → 200', async () => {
  seedBatch('CREATED');
  assert.equal((await request('GET', '/api/batches/1/timeline', { token: tokenFor(14) })).status, 200);
  seedBatch('RECEIVED');
  assert.equal((await request('GET', '/api/batches/2/timeline', { token: tokenFor(13) })).status, 200);
});

test('TC-BATCH-17: timeline ngoài phạm vi → 404; chưa đăng nhập → 401', async () => {
  seedBatch('CREATED');
  expectError(await request('GET', '/api/batches/1/timeline', { token: tokenFor(11) }), 404, 'NOT_FOUND');
  expectError(await request('GET', '/api/batches/1/events', { token: tokenFor(11) }), 404, 'NOT_FOUND');
  expectError(await request('GET', '/api/batches/1/timeline', { token: tokenFor(13) }), 404, 'NOT_FOUND');
  expectError(await request('GET', '/api/batches/1/timeline', {}), 401, 'UNAUTHORIZED');
});

test('timeline: batchId không phải số → 400 VALIDATION_ERROR', async () => {
  expectError(await request('GET', '/api/batches/not-a-batch-id/timeline', { token: tokenFor(12) }), 400, 'VALIDATION_ERROR', 'batchId');
});
