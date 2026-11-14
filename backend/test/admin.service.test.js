'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminService } = require('../src/modules/admin/admin.service');

// ---- CSDL giả: tài khoản, đơn vị, audit. Mô phỏng các ràng buộc quan trọng của schema ----
function setup() {
  const state = { users: [], orgs: [], audits: [], failAudit: false, txRolledBack: 0 };
  const org = (id, name, type) => state.orgs.push({ organization_id: String(id), name, type, address: null, created_at: new Date('2026-11-01T00:00:00Z') });
  org(1, 'Nông trại A', 'FARM'); org(2, 'Chế biến P', 'PROCESSOR'); org(3, 'Phân phối D', 'DISTRIBUTOR'); org(4, 'Nông trại B', 'FARM');
  const user = (id, role, status, orgId) => state.users.push({ user_id: String(id), name: `U${id}`, email: `u${id}@x.com`, role, status, organization_id: orgId == null ? null : String(orgId), created_at: new Date('2026-11-01T00:00:00Z') });
  user(1, 'ADMIN', 'ACTIVE', null); user(2, 'ADMIN', 'ACTIVE', null);
  user(10, 'FARMER', 'PENDING', null); user(11, 'FARMER', 'ACTIVE', 1); user(12, 'FARMER', 'LOCKED', 1);
  const detail = (u) => { const o = state.orgs.find((x) => x.organization_id === u.organization_id); return { ...u, organization_name: o ? o.name : null, organization_type: o ? o.type : null }; };
  const repo = {
    async listUsers(_d, { status, role, limit, offset }) { let r = state.users; if (status) r = r.filter((u) => u.status === status); if (role) r = r.filter((u) => u.role === role); return { rows: r.slice(offset, offset + limit).map(detail), total: r.length }; },
    async findUserDetail(_d, id) { const u = state.users.find((x) => Number(x.user_id) === id); return u ? detail(u) : null; },
    async findUserForUpdate(_d, id) { const u = state.users.find((x) => Number(x.user_id) === id); return u ? detail(u) : null; },
    async updateUserRoleAndOrganization(_d, id, role, orgId) { const u = state.users.find((x) => Number(x.user_id) === id); u.role = role; u.organization_id = orgId == null ? null : String(orgId); },
    async updateUserOrganization(_d, id, orgId) { state.users.find((x) => Number(x.user_id) === id).organization_id = String(orgId); },
    async updateUserStatus(_d, id, status) { state.users.find((x) => Number(x.user_id) === id).status = status; },
    async countOtherActiveAdmins(_d, id) { return state.users.filter((u) => u.role === 'ADMIN' && u.status === 'ACTIVE' && Number(u.user_id) !== id).length; },
    async findOrganization(_d, id) { const o = state.orgs.find((x) => Number(x.organization_id) === id); return o ? { ...o } : null; },
    async listOrganizations(_d, { type, limit, offset }) { let r = state.orgs; if (type) r = r.filter((o) => o.type === type); return { rows: r.slice(offset, offset + limit), total: r.length }; },
    async insertOrganization(_d, { name, type, address }) {
      if (state.orgs.some((o) => o.name === name && o.type === type)) { const e = new Error('dup'); e.code = '23505'; throw e; }
      const row = { organization_id: String(state.orgs.length + 1), name, type, address, created_at: new Date() }; state.orgs.push(row); return { ...row };
    },
    async updateOrganization(_d, id, ch) { const o = state.orgs.find((x) => Number(x.organization_id) === id); Object.assign(o, ch); return { ...o }; },
    async countOrganizationUsage(_d, id) { return { users: state.users.filter((u) => Number(u.organization_id) === id).length, batches: 0 }; },
    async listAuditLogs() { return { rows: state.audits.map((a, i) => ({ audit_id: String(i + 1), actor_id: a.actorId == null ? null : String(a.actorId), actor_name: 'N', action: a.action, entity_type: a.entityType, entity_id: String(a.entityId), old_value: a.oldValue, new_value: a.newValue, created_at: new Date() })), total: state.audits.length }; },
  };
  const withTransaction = async (fn) => {
    const snap = JSON.stringify({ u: state.users, o: state.orgs, a: state.audits });
    try { return await fn({}); } catch (err) { const s = JSON.parse(snap); state.users = s.u; state.orgs = s.o; state.audits = s.a; state.txRolledBack += 1; throw err; }
  };
  const insertAudit = async (_d, a) => { if (state.failAudit) throw new Error('audit down'); state.audits.push(a); };
  return { state, service: createAdminService({ db: {}, withTransaction, repo, insertAudit }) };
}
const admin = { userId: 1, role: 'ADMIN', organizationId: null };
const code = async (p) => (await p.catch((e) => e));

test('danh sách tài khoản: phân trang, lọc, có tên đơn vị, không lộ mật khẩu', async () => {
  const { service } = setup();
  const all = await service.listUsers({ page: 1, limit: 20 });
  assert.equal(all.total, 5);
  assert.ok(!JSON.stringify(all).includes('password'));
  const pending = await service.listUsers({ status: 'PENDING', page: 1, limit: 20 });
  assert.deepEqual(pending.items.map((u) => u.userId), [10]);
  assert.equal(all.items.find((u) => u.userId === 11).organizationName, 'Nông trại A');
});

test('duyệt tài khoản: PENDING chưa có đơn vị -> 409 ORGANIZATION_REQUIRED; gán đơn vị rồi duyệt -> APPROVE', async () => {
  const { state, service } = setup();
  const e = await code(service.changeStatus(admin, 10, { status: 'ACTIVE' }));
  assert.deepEqual([e.status, e.code], [409, 'ORGANIZATION_REQUIRED']);
  await service.assignOrganization(admin, 10, { organizationId: 1 });
  const u = await service.changeStatus(admin, 10, { status: 'ACTIVE' });
  assert.deepEqual([u.status, u.organizationId, u.organizationName], ['ACTIVE', 1, 'Nông trại A']);
  assert.deepEqual(state.audits.map((a) => a.action), ['ASSIGN_ORGANIZATION', 'APPROVE']);
  assert.ok(state.audits.every((a) => a.actorId === 1 && a.entityType === 'USER' && a.entityId === 10));
});

test('khóa và mở khóa ghi LOCK / UNLOCK với trạng thái cũ -> mới', async () => {
  const { state, service } = setup();
  await service.changeStatus(admin, 11, { status: 'LOCKED' });
  await service.changeStatus(admin, 11, { status: 'ACTIVE' });
  assert.deepEqual(state.audits.map((a) => [a.action, a.oldValue.status, a.newValue.status]), [['LOCK', 'ACTIVE', 'LOCKED'], ['UNLOCK', 'LOCKED', 'ACTIVE']]);
});

test('đặt lại đúng trạng thái hiện tại: không đổi, không audit', async () => {
  const { state, service } = setup();
  const u = await service.changeStatus(admin, 11, { status: 'ACTIVE' });
  assert.equal(u.status, 'ACTIVE');
  assert.equal(state.audits.length, 0);
});

test('Admin không tự đổi trạng thái của chính mình; còn Admin khác thì khóa được', async () => {
  const { state, service } = setup();
  assert.equal((await code(service.changeStatus(admin, 1, { status: 'LOCKED' }))).code, 'CANNOT_MODIFY_SELF');
  assert.equal((await service.changeStatus(admin, 2, { status: 'LOCKED' })).status, 'LOCKED');
  assert.equal(state.audits.length, 1);
});

test('khóa Admin cuối cùng -> 409 LAST_ADMIN', async () => {
  const { state, service } = setup();
  state.users.find((u) => u.user_id === '2').status = 'LOCKED';
  const actor = { userId: 99, role: 'ADMIN', organizationId: null };
  const e = await code(service.changeStatus(actor, 1, { status: 'LOCKED' }));
  assert.deepEqual([e.status, e.code], [409, 'LAST_ADMIN']);
});

test('gán đơn vị: sai loại -> 409 ORG_TYPE_MISMATCH; Admin -> 409; đơn vị/tài khoản không có -> 404', async () => {
  const { service } = setup();
  assert.equal((await code(service.assignOrganization(admin, 10, { organizationId: 2 }))).code, 'ORG_TYPE_MISMATCH');
  assert.equal((await code(service.assignOrganization(admin, 2, { organizationId: 1 }))).code, 'ADMIN_HAS_NO_ORGANIZATION');
  assert.equal((await code(service.assignOrganization(admin, 10, { organizationId: 99 }))).status, 404);
  assert.equal((await code(service.assignOrganization(admin, 99, { organizationId: 1 }))).status, 404);
});

test('gán lại đúng đơn vị đang có: không đổi, không audit', async () => {
  const { state, service } = setup();
  await service.assignOrganization(admin, 11, { organizationId: 1 });
  assert.equal(state.audits.length, 0);
});

test('đổi vai trò: lệch loại đơn vị -> 409; kèm organizationId phù hợp -> thành công và ghi CHANGE_ROLE', async () => {
  const { state, service } = setup();
  const e = await code(service.changeRole(admin, 11, { role: 'DISTRIBUTOR' }));
  assert.deepEqual([e.status, e.code], [409, 'ORG_TYPE_MISMATCH']);
  const u = await service.changeRole(admin, 11, { role: 'DISTRIBUTOR', organizationId: 3 });
  assert.deepEqual([u.role, u.organizationId, u.organizationName], ['DISTRIBUTOR', 3, 'Phân phối D']);
  assert.deepEqual([state.audits[0].action, state.audits[0].oldValue, state.audits[0].newValue],
    ['CHANGE_ROLE', { role: 'FARMER', organizationId: 1 }, { role: 'DISTRIBUTOR', organizationId: 3 }]);
});

test('đổi vai trò của tài khoản chưa có đơn vị: được, không cần organizationId', async () => {
  const { service } = setup();
  assert.equal((await service.changeRole(admin, 10, { role: 'PROCESSOR' })).role, 'PROCESSOR');
});

test('không đổi vai trò của tài khoản Admin qua API', async () => {
  const { service } = setup();
  assert.equal((await code(service.changeRole(admin, 2, { role: 'FARMER' }))).code, 'ROLE_CHANGE_NOT_ALLOWED');
});

test('tạo đơn vị: ghi audit CREATE; trùng tên và loại -> 409 ORGANIZATION_EXISTS', async () => {
  const { state, service } = setup();
  const o = await service.createOrganization(admin, { name: 'Kho mới', type: 'DISTRIBUTOR', address: null });
  assert.deepEqual([o.name, o.type, o.address], ['Kho mới', 'DISTRIBUTOR', null]);
  assert.deepEqual([state.audits[0].action, state.audits[0].entityType], ['CREATE', 'ORGANIZATION']);
  const e = await code(service.createOrganization(admin, { name: 'Kho mới', type: 'DISTRIBUTOR', address: null }));
  assert.deepEqual([e.status, e.code], [409, 'ORGANIZATION_EXISTS']);
});

test('sửa đơn vị: đổi tên ghi audit giá trị cũ/mới; đổi loại khi đã có thành viên -> 409 ORGANIZATION_IN_USE', async () => {
  const { state, service } = setup();
  await service.updateOrganization(admin, 1, { name: 'Nông trại A2' });
  assert.deepEqual([state.audits[0].oldValue, state.audits[0].newValue], [{ name: 'Nông trại A' }, { name: 'Nông trại A2' }]);
  const e = await code(service.updateOrganization(admin, 1, { type: 'PROCESSOR' }));
  assert.deepEqual([e.status, e.code], [409, 'ORGANIZATION_IN_USE']);
  assert.equal((await service.updateOrganization(admin, 4, { type: 'PROCESSOR' })).type, 'PROCESSOR'); // đơn vị chưa dùng thì đổi được
  assert.equal((await code(service.updateOrganization(admin, 99, { name: 'x' }))).status, 404);
});

test('sửa đơn vị: không đổi gì thì không ghi audit', async () => {
  const { state, service } = setup();
  await service.updateOrganization(admin, 1, { name: 'Nông trại A', address: null });
  assert.equal(state.audits.length, 0);
});

test('lỗi ở bước audit hoàn tác cả thay đổi', async () => {
  const { state, service } = setup();
  state.failAudit = true;
  await assert.rejects(service.changeStatus(admin, 12, { status: 'ACTIVE' }), /audit down/);
  assert.equal(state.users.find((u) => u.user_id === '12').status, 'LOCKED');
  assert.equal(state.txRolledBack, 1);
});

test('danh sách đơn vị và nhật ký: định dạng phân trang thống nhất', async () => {
  const { service } = setup();
  await service.changeStatus(admin, 11, { status: 'LOCKED' });
  const orgs = await service.listOrganizations({ type: 'FARM', page: 1, limit: 20 });
  assert.deepEqual(Object.keys(orgs).sort(), ['items', 'limit', 'page', 'total']);
  assert.equal(orgs.total, 2);
  const logs = await service.listAuditLogs({ page: 1, limit: 20 });
  assert.deepEqual(Object.keys(logs).sort(), ['items', 'limit', 'page', 'total']);
  assert.deepEqual(Object.keys(logs.items[0]).sort(), ['action', 'actorId', 'actorName', 'auditId', 'createdAt', 'entityId', 'entityType', 'newValue', 'oldValue']);
});
