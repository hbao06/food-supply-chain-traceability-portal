'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEventService } = require('../src/modules/events/events.service');
const { canRecordEvent, nextEventType, statusesAwaiting } = require('../src/middleware/rbac');

// ---- CSDL giả: mô phỏng phạm vi (batchReadScope), trigger đồng bộ trạng thái và append-only ----
function setup() {
  const state = { batch: { batch_id: '1', batch_code: 'BATCH-2026-0001', product_name: 'Cà phê', origin: 'Đắk Lắk', quantity: '500.00',
      creation_date: new Date('2026-11-02T08:00:00Z'), current_status: 'CREATED', created_by: '10', organization_id: '1' },
    events: [{ event_id: '1', batch_id: '1', actor_id: '10', event_type: 'CREATED', timestamp: new Date('2026-11-02T08:00:00Z'), location: 'Đắk Lắk', description: null, actor_name: 'Farmer A', organization_name: 'Nông trại A', orgId: 1 }],
    audits: [], clock: 0, calls: 0, txRolledBack: 0 };
  const batchRepo = {
    async findVisibleBatch(_d, auth, id, { includeAwaiting }) {
      state.calls += 1;
      if (Number(state.batch.batch_id) !== id) return null;
      if (auth.role === 'ADMIN') return { ...state.batch };
      if (auth.role === 'FARMER') return Number(state.batch.organization_id) === auth.organizationId ? { ...state.batch } : null;
      const handled = state.events.some((e) => e.orgId === auth.organizationId);
      const awaiting = includeAwaiting && statusesAwaiting(auth.role).includes(state.batch.current_status);
      return handled || awaiting ? { ...state.batch } : null;
    },
  };
  const repo = {
    async insertEvent(_d, e) {
      const id = state.events.length + 1; state.clock += 1;
      const orgNames = { 2: 'Phân phối D', 3: 'Chế biến P' };
      state.events.push({ event_id: String(id), batch_id: String(e.batchId), actor_id: String(e.actorId), event_type: e.eventType,
        timestamp: new Date(Date.UTC(2026, 10, 2, 8, state.clock)), location: e.location, description: e.description,
        actor_name: `User ${e.actorId}`, organization_name: orgNames[e.orgId] ?? null, orgId: e.orgId });
      state.batch.current_status = e.eventType; // trigger CSDL đồng bộ trạng thái
      return id;
    },
    async findEvent(_d, id) { const e = state.events.find((x) => Number(x.event_id) === id); return e ? { ...e } : null; },
    async listEvents() { return state.events.map((e) => ({ ...e })); },
  };
  const withTransaction = async (fn) => {
    const snap = JSON.stringify({ b: state.batch, e: state.events, a: state.audits });
    try { return await fn({}); } catch (err) { const s = JSON.parse(snap); state.batch = s.b; state.events = s.e; state.audits = s.a; state.txRolledBack += 1; throw err; }
  };
  const insertAudit = async (_d, a) => { if (state.failAudit) throw new Error('audit down'); state.audits.push(a); };
  // actor -> orgId để fake repo gắn đơn vị cho sự kiện
  const service = createEventService({ db: {}, withTransaction, batchRepo,
    repo: { ...repo, insertEvent: (d, e) => repo.insertEvent(d, { ...e, orgId: state.actorOrg[e.actorId] }) },
    insertAudit, rbac: { canRecordEvent, nextEventType } });
  state.actorOrg = { 20: 2, 21: 3, 22: 2, 23: 4 };
  return { state, service };
}

const distributor = { userId: 20, role: 'DISTRIBUTOR', organizationId: 2 };
const processor = { userId: 21, role: 'PROCESSOR', organizationId: 3 };
const farmer = { userId: 10, role: 'FARMER', organizationId: 1 };
const admin = { userId: 1, role: 'ADMIN', organizationId: null };
const ev = (eventType) => ({ eventType, location: 'Điểm ' + eventType, description: null });

test('toàn bộ chuỗi hợp lệ: Distributor -> Distributor -> Processor -> Processor -> Distributor', async () => {
  const { state, service } = setup();
  const steps = [[distributor, 'TRANSPORTED'], [distributor, 'RECEIVED'], [processor, 'PROCESSED'], [processor, 'PACKAGED'], [distributor, 'SHIPPED']];
  for (const [auth, type] of steps) {
    const e = await service.record(auth, 1, ev(type));
    assert.equal(e.eventType, type);
    assert.equal(e.batchId, 1);
    assert.equal(e.actorId, auth.userId);
  }
  assert.equal(state.batch.current_status, 'SHIPPED');
  assert.equal(state.events.length, 6);
});

test('mỗi sự kiện ghi 2 audit: CREATE EVENT và UPDATE BATCH (trạng thái cũ -> mới)', async () => {
  const { state, service } = setup();
  await service.record(distributor, 1, ev('TRANSPORTED'));
  assert.deepEqual(state.audits.map((a) => `${a.action}:${a.entityType}`), ['CREATE:EVENT', 'UPDATE:BATCH']);
  assert.deepEqual([state.audits[1].oldValue, state.audits[1].newValue], [{ currentStatus: 'CREATED' }, { currentStatus: 'TRANSPORTED' }]);
  assert.ok(state.audits.every((a) => a.actorId === 20));
});

test('sai vai trò cho loại sự kiện -> 403, chưa đụng CSDL', async () => {
  const { state, service } = setup();
  for (const [auth, type] of [[processor, 'TRANSPORTED'], [distributor, 'PROCESSED'], [farmer, 'TRANSPORTED'], [admin, 'SHIPPED'], [distributor, 'CREATED']]) {
    const e = await service.record(auth, 1, ev(type)).catch((x) => x);
    assert.equal(e.status, 403, `${auth.role} ${type}`);
  }
  assert.equal(state.calls, 0, '403 phải xảy ra trước khi truy vấn lô');
  assert.equal(state.events.length, 1);
});

test('nhảy cóc, trùng và ghi tiếp sau SHIPPED -> 409 INVALID_SEQUENCE, không ghi gì', async () => {
  const { state, service } = setup();
  const skip = await service.record(distributor, 1, ev('SHIPPED')).catch((x) => x);
  assert.deepEqual([skip.status, skip.code], [409, 'INVALID_SEQUENCE']);
  await service.record(distributor, 1, ev('TRANSPORTED'));
  const dup = await service.record(distributor, 1, ev('TRANSPORTED')).catch((x) => x);
  assert.equal(dup.code, 'INVALID_SEQUENCE');
  await service.record(distributor, 1, ev('RECEIVED'));
  await service.record(processor, 1, ev('PROCESSED'));
  await service.record(processor, 1, ev('PACKAGED'));
  await service.record(distributor, 1, ev('SHIPPED'));
  const after = await service.record(distributor, 1, ev('SHIPPED')).catch((x) => x);
  assert.equal(after.code, 'INVALID_SEQUENCE');
  assert.equal(state.events.length, 6);
  assert.equal(state.batch.current_status, 'SHIPPED');
});

test('ngoài phạm vi hoặc lô không tồn tại -> 404 giống nhau', async () => {
  const { service } = setup();
  const otherProcessor = { userId: 23, role: 'PROCESSOR', organizationId: 4 };
  const outOfScope = await service.record(otherProcessor, 1, ev('PROCESSED')).catch((x) => x);
  const missing = await service.record(distributor, 999, ev('TRANSPORTED')).catch((x) => x);
  assert.equal(outOfScope.status, 404); assert.equal(missing.status, 404);
  assert.equal(outOfScope.message, missing.message);
});

test('Processor chưa tới lượt không thấy lô -> 404, tới lượt thì ghi được', async () => {
  const { service } = setup();
  assert.equal((await service.record(processor, 1, ev('PROCESSED')).catch((x) => x)).status, 404);
  await service.record(distributor, 1, ev('TRANSPORTED'));
  await service.record(distributor, 1, ev('RECEIVED'));
  assert.equal((await service.record(processor, 1, ev('PROCESSED'))).eventType, 'PROCESSED');
});

test('lỗi ở bước audit hoàn tác cả sự kiện lẫn trạng thái lô', async () => {
  const { state, service } = setup();
  state.failAudit = true;
  await assert.rejects(service.record(distributor, 1, ev('TRANSPORTED')), /audit down/);
  assert.deepEqual([state.events.length, state.batch.current_status, state.txRolledBack], [1, 'CREATED', 1]);
});

test('timeline: lô + sự kiện cũ -> mới, có tên đơn vị, địa điểm, thời gian, người ghi', async () => {
  const { service } = setup();
  await service.record(distributor, 1, ev('TRANSPORTED'));
  await service.record(distributor, 1, ev('RECEIVED'));
  const t = await service.timeline(farmer, 1);
  assert.equal(t.batch.currentStatus, 'RECEIVED');
  assert.deepEqual(t.events.map((e) => e.eventType), ['CREATED', 'TRANSPORTED', 'RECEIVED']);
  const times = t.events.map((e) => new Date(e.timestamp).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => a - b), 'thời gian không giảm');
  assert.deepEqual(Object.keys(t.events[1]).sort(),
    ['actorId', 'actorName', 'batchId', 'description', 'eventId', 'eventType', 'location', 'organizationName', 'timestamp']);
  assert.equal(t.events[1].organizationName, 'Phân phối D');
});

test('timeline/danh sách sự kiện: ngoài phạm vi hoặc không tồn tại -> 404', async () => {
  const { service } = setup();
  const farmerB = { userId: 11, role: 'FARMER', organizationId: 2 };
  assert.equal((await service.timeline(farmerB, 1).catch((e) => e)).status, 404);
  assert.equal((await service.list(farmerB, 1).catch((e) => e)).status, 404);
  assert.equal((await service.timeline(farmer, 77).catch((e) => e)).status, 404);
});

test('danh sách sự kiện: Admin xem được, kết quả cùng dạng với timeline', async () => {
  const { service } = setup();
  await service.record(distributor, 1, ev('TRANSPORTED'));
  const list = await service.list(admin, 1);
  const t = await service.timeline(admin, 1);
  assert.deepEqual(list, t.events);
});
