'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rbac = require('../src/middleware/rbac');

const call = (mw, req) => { let out = 'NOT_CALLED'; mw(req, {}, (e) => { out = e; }); return out; };

test('ma trận quyền: Admin quản trị, không tạo/sửa lô, không ghi sự kiện', () => {
  for (const p of ['user:read', 'user:change-role', 'user:change-status', 'organization:write', 'audit:read', 'batch:read']) {
    assert.ok(rbac.can('ADMIN', p), p);
  }
  for (const p of ['batch:create', 'batch:update', 'event:create']) assert.ok(!rbac.can('ADMIN', p), p);
});

test('ma trận quyền: chỉ Farmer tạo/sửa lô; chỉ Processor/Distributor gửi sự kiện', () => {
  assert.deepEqual(rbac.PERMISSIONS['batch:create'], ['FARMER']);
  assert.deepEqual(rbac.PERMISSIONS['batch:update'], ['FARMER']);
  assert.deepEqual([...rbac.PERMISSIONS['event:create']].sort(), ['DISTRIBUTOR', 'PROCESSOR']);
  for (const role of ['FARMER', 'PROCESSOR', 'DISTRIBUTOR']) {
    for (const p of ['user:read', 'organization:write', 'audit:read']) assert.ok(!rbac.can(role, p), `${role} ${p}`);
  }
});

test('Consumer / vai trò lạ không có quyền nội bộ nào', () => {
  for (const p of Object.keys(rbac.PERMISSIONS)) {
    assert.ok(!rbac.can('CONSUMER', p), p);
    assert.ok(!rbac.can(undefined, p), p);
  }
});

test('requirePermission: đúng vai trò đi tiếp, sai vai trò 403, chưa xác thực 401', () => {
  const mw = rbac.requirePermission('batch:create');
  assert.equal(call(mw, { auth: { role: 'FARMER' } }), undefined);
  const e = call(mw, { auth: { role: 'DISTRIBUTOR' } });
  assert.equal(e.status, 403); assert.equal(e.code, 'FORBIDDEN');
  assert.equal(call(mw, {}).status, 401);
});

test('requirePermission: gõ sai tên quyền bị phát hiện ngay khi tạo route', () => {
  assert.throws(() => rbac.requirePermission('batch:delete'), /Quyền không tồn tại/);
});

test('sự kiện: vai trò ghi đúng loại, CREATED không gửi qua API, thứ tự kế tiếp đúng', () => {
  assert.ok(rbac.canRecordEvent('DISTRIBUTOR', 'TRANSPORTED'));
  assert.ok(rbac.canRecordEvent('PROCESSOR', 'PACKAGED'));
  assert.ok(!rbac.canRecordEvent('PROCESSOR', 'TRANSPORTED'));
  assert.ok(!rbac.canRecordEvent('FARMER', 'CREATED'));
  assert.ok(!rbac.canRecordEvent('DISTRIBUTOR', 'KHONG_CO'));
  assert.equal(rbac.nextEventType('CREATED'), 'TRANSPORTED');
  assert.equal(rbac.nextEventType('PACKAGED'), 'SHIPPED');
  assert.equal(rbac.nextEventType('SHIPPED'), null);
  assert.equal(rbac.nextEventType('X'), null);
});

test('lô đang chờ từng vai trò tiếp nhận', () => {
  assert.deepEqual(rbac.statusesAwaiting('DISTRIBUTOR'), ['CREATED', 'TRANSPORTED', 'PACKAGED']);
  assert.deepEqual(rbac.statusesAwaiting('PROCESSOR'), ['RECEIVED', 'PROCESSED']);
  assert.deepEqual(rbac.statusesAwaiting('ADMIN'), []);
});

test('batchReadScope: Admin thấy tất cả, Farmer theo đơn vị, tham số đánh số từ startIndex', () => {
  assert.deepEqual(rbac.batchReadScope({ role: 'ADMIN' }), { clause: 'TRUE', params: [] });
  assert.deepEqual(rbac.batchReadScope({ role: 'FARMER', organizationId: 3 }, { alias: 'b', startIndex: 2 }),
    { clause: 'b.organization_id = $2', params: [3] });
});

test('batchReadScope: Processor/Distributor theo sự kiện của đơn vị; includeAwaiting thêm lô đang chờ', () => {
  const s = rbac.batchReadScope({ role: 'DISTRIBUTOR', organizationId: 5 }, { alias: 'bt' });
  assert.match(s.clause, /EXISTS/); assert.match(s.clause, /bt\.batch_id/); assert.deepEqual(s.params, [5]);
  const w = rbac.batchReadScope({ role: 'PROCESSOR', organizationId: 5 }, { startIndex: 3, includeAwaiting: true });
  assert.match(w.clause, /\$3/); assert.match(w.clause, /ANY\(\$4::text\[\]\)/);
  assert.deepEqual(w.params, [5, ['RECEIVED', 'PROCESSED']]);
});

test('batchReadScope: không có đơn vị, vai trò lạ, chưa xác thực -> không thấy gì', () => {
  assert.equal(rbac.batchReadScope({ role: 'FARMER', organizationId: null }).clause, 'FALSE');
  assert.equal(rbac.batchReadScope({ role: 'CONSUMER', organizationId: 1 }).clause, 'FALSE');
  assert.equal(rbac.batchReadScope(undefined).clause, 'FALSE');
});

test('batchReadScope: chặn alias / startIndex có thể gây SQL injection', () => {
  assert.throws(() => rbac.batchReadScope({ role: 'ADMIN' }, { alias: 'b; DROP TABLE users' }), /alias/);
  assert.throws(() => rbac.batchReadScope({ role: 'ADMIN' }, { startIndex: 0 }), /startIndex/);
});
