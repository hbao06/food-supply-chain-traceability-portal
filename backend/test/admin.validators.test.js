'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/modules/admin/admin.validators');
const { ValidationError } = require('../src/common/errors');

function fieldsOf(fn) {
  try { fn(); } catch (e) { assert.ok(e instanceof ValidationError); assert.equal(e.status, 400); return e.details.map((d) => d.field).sort(); }
  assert.fail('phải ném ValidationError');
}

test('id trên đường dẫn: số nguyên dương, còn lại 400', () => {
  assert.equal(v.parseId('7', 'userId'), 7);
  for (const bad of ['0', '-1', 'abc', '1.5', '', '01', undefined]) assert.deepEqual(fieldsOf(() => v.parseId(bad, 'userId')), ['userId'], String(bad));
});

test('danh sách tài khoản: mặc định, lọc, và giá trị sai', () => {
  assert.deepEqual(v.validateUserListQuery({}), { status: undefined, role: undefined, page: 1, limit: 20 });
  assert.deepEqual(v.validateUserListQuery({ status: 'PENDING', role: 'FARMER', page: '2', limit: '50' }), { status: 'PENDING', role: 'FARMER', page: 2, limit: 50 });
  assert.deepEqual(fieldsOf(() => v.validateUserListQuery({ status: 'X', role: 'Y', page: '0', limit: '101' })), ['limit', 'page', 'role', 'status']);
});

test('đổi vai trò: chỉ FARMER/PROCESSOR/DISTRIBUTOR, organizationId tùy chọn, chặn ADMIN và trường lạ', () => {
  assert.deepEqual(v.validateChangeRole({ role: 'PROCESSOR' }), { role: 'PROCESSOR' });
  assert.deepEqual(v.validateChangeRole({ role: 'PROCESSOR', organizationId: 3 }), { role: 'PROCESSOR', organizationId: 3 });
  assert.deepEqual(fieldsOf(() => v.validateChangeRole({ role: 'ADMIN' })), ['role']);
  assert.deepEqual(fieldsOf(() => v.validateChangeRole({ role: 'FARMER', organizationId: '3' })), ['organizationId']);
  assert.deepEqual(fieldsOf(() => v.validateChangeRole({ role: 'FARMER', status: 'ACTIVE' })), ['status']);
  assert.deepEqual(fieldsOf(() => v.validateChangeRole(undefined)), ['body']);
});

test('gán đơn vị và đổi trạng thái', () => {
  assert.deepEqual(v.validateAssignOrganization({ organizationId: 2 }), { organizationId: 2 });
  assert.deepEqual(fieldsOf(() => v.validateAssignOrganization({ organizationId: 0 })), ['organizationId']);
  assert.deepEqual(v.validateChangeStatus({ status: 'LOCKED' }), { status: 'LOCKED' });
  assert.deepEqual(fieldsOf(() => v.validateChangeStatus({ status: 'PENDING' })), ['status']);
  assert.deepEqual(fieldsOf(() => v.validateChangeStatus({})), ['status']);
});

test('tạo đơn vị: cắt khoảng trắng, địa chỉ rỗng -> null, chặn loại sai và trường lạ', () => {
  assert.deepEqual(v.validateCreateOrganization({ name: ' Nông trại A ', type: 'FARM', address: '  ' }), { name: 'Nông trại A', type: 'FARM', address: null });
  assert.deepEqual(v.validateCreateOrganization({ name: 'X', type: 'PROCESSOR', address: ' Q1 ' }).address, 'Q1');
  assert.deepEqual(fieldsOf(() => v.validateCreateOrganization({ name: '', type: 'SHOP', extra: 1 })), ['extra', 'name', 'type']);
  assert.deepEqual(fieldsOf(() => v.validateCreateOrganization({ name: 'x'.repeat(151), type: 'FARM', address: 'y'.repeat(256) })), ['address', 'name']);
});

test('sửa đơn vị: cần ít nhất một trường, giữ nguyên null của địa chỉ', () => {
  assert.deepEqual(v.validateUpdateOrganization({ name: ' B ' }), { name: 'B' });
  assert.deepEqual(v.validateUpdateOrganization({ address: null }), { address: null });
  assert.deepEqual(fieldsOf(() => v.validateUpdateOrganization({})), ['body']);
  assert.deepEqual(fieldsOf(() => v.validateUpdateOrganization({ type: 'SHOP', organizationId: 1 })), ['organizationId', 'type']);
});

test('nhật ký: lọc, chuyển id sang số, ngày sang ISO, from phải trước to', () => {
  const q = v.validateAuditQuery({ entityType: 'USER', entityId: '5', actorId: '1', action: 'APPROVE', from: '2026-11-01T00:00:00Z', to: '2026-11-30', page: '2', limit: '10' });
  assert.deepEqual([q.entityType, q.entityId, q.actorId, q.action, q.page, q.limit], ['USER', 5, 1, 'APPROVE', 2, 10]);
  assert.equal(q.from, '2026-11-01T00:00:00.000Z');
  assert.deepEqual(fieldsOf(() => v.validateAuditQuery({ entityType: 'X', action: 'Y', entityId: 'a', actorId: '0', from: 'hôm qua', to: '32/13' })), ['action', 'actorId', 'entityId', 'entityType', 'from', 'to']);
  assert.deepEqual(fieldsOf(() => v.validateAuditQuery({ from: '2026-12-01', to: '2026-11-01' })), ['from']);
});
