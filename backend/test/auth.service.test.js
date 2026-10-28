'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthService } = require('../src/modules/auth/auth.service');

// ---- Đối tượng giả: CSDL trong bộ nhớ, bcrypt giả, JWT giả ----
function setup(seedUsers = []) {
  const state = { users: seedUsers.map((u) => ({ ...u })), audits: [], nextId: 100, txCount: 0, txRolledBack: 0 };
  const repo = {
    async findByEmail(_db, email) { const u = state.users.find((x) => x.email.toLowerCase() === email.toLowerCase()); return u ? { ...u } : null; },
    async findById(_db, id) { const u = state.users.find((x) => Number(x.user_id) === id); return u ? { ...u } : null; },
    async insertUser(_db, { name, email, passwordHash, role }) {
      if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) { const e = new Error('dup'); e.code = '23505'; throw e; }
      const row = { user_id: String(state.nextId++), organization_id: null, name, email, password_hash: passwordHash, role, status: 'PENDING' };
      state.users.push(row); return row;
    },
    async updateName(_db, id, name) { const u = state.users.find((x) => Number(x.user_id) === id); u.name = name; return { ...u }; },
    async insertAudit(_db, a) { if (state.failAudit) throw new Error('audit down'); state.audits.push(a); },
  };
  const hasher = {
    calls: [],
    async hash(p) { return 'HASH(' + p + ')'; },
    async compare(p, h) { this.calls.push(h); return h === 'HASH(' + p + ')'; },
  };
  const tokens = { sign: (p) => 'token-' + JSON.stringify(p) };
  const withTransaction = async (fn) => {
    state.txCount += 1;
    const snapshot = { users: state.users.map((u) => ({ ...u })), audits: [...state.audits] };
    try { return await fn({}); } catch (e) { state.users = snapshot.users; state.audits = snapshot.audits; state.txRolledBack += 1; throw e; }
  };
  const logger = { error() {} };
  const service = createAuthService({ db: {}, withTransaction, repo, hasher, tokens, logger });
  return { state, service, hasher };
}

const active = { user_id: '1', organization_id: '5', name: 'Farmer A', email: 'farmer@example.com', password_hash: 'HASH(secret123)', role: 'FARMER', status: 'ACTIVE' };

// ---------- register ----------
test('đăng ký: tạo PENDING, mật khẩu được băm, không trả password_hash, có audit REGISTER', async () => {
  const { state, service } = setup();
  const user = await service.register({ name: 'Nguyen Van A', email: 'a@example.com', password: 'secret123', role: 'FARMER' });
  assert.deepEqual(user, { userId: 100, name: 'Nguyen Van A', email: 'a@example.com', role: 'FARMER', organizationId: null, status: 'PENDING' });
  assert.ok(!('password_hash' in user) && !('passwordHash' in user));
  assert.notEqual(state.users[0].password_hash, 'secret123');
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].action, 'REGISTER');
  assert.ok(!JSON.stringify(state.audits[0]).includes('secret123'), 'audit không được chứa mật khẩu');
  assert.ok(!JSON.stringify(state.audits[0]).includes('HASH('), 'audit không được chứa hash');
});

test('đăng ký: email trùng (khác hoa thường) -> 409 EMAIL_EXISTS, không tạo thêm user', async () => {
  const { state, service } = setup([active]);
  await assert.rejects(
    service.register({ name: 'X', email: 'FARMER@example.com', password: 'secret123', role: 'FARMER' }),
    (e) => e.status === 409 && e.code === 'EMAIL_EXISTS');
  assert.equal(state.users.length, 1);
});

test('đăng ký: audit lỗi thì hoàn tác cả việc tạo user (cùng transaction)', async () => {
  const { state, service } = setup();
  state.failAudit = true;
  await assert.rejects(service.register({ name: 'X', email: 'x@example.com', password: 'secret123', role: 'FARMER' }), /audit down/);
  assert.equal(state.users.length, 0);
  assert.equal(state.txRolledBack, 1);
});

// ---------- login ----------
test('đăng nhập đúng: trả token và user (không có mật khẩu)', async () => {
  const { service } = setup([active]);
  const r = await service.login({ email: 'Farmer@Example.com', password: 'secret123' });
  assert.equal(r.token, 'token-' + JSON.stringify({ userId: 1, role: 'FARMER', organizationId: 5 }));
  assert.deepEqual(r.user, { userId: 1, name: 'Farmer A', email: 'farmer@example.com', role: 'FARMER', organizationId: 5, status: 'ACTIVE' });
});

test('đăng nhập sai mật khẩu và sai email: cùng 401 INVALID_CREDENTIALS, cùng thông báo', async () => {
  const { service } = setup([active]);
  const wrongPw = await service.login({ email: 'farmer@example.com', password: 'sai' }).catch((e) => e);
  const wrongEmail = await service.login({ email: 'khong@co.com', password: 'sai' }).catch((e) => e);
  for (const e of [wrongPw, wrongEmail]) { assert.equal(e.status, 401); assert.equal(e.code, 'INVALID_CREDENTIALS'); }
  assert.equal(wrongPw.message, wrongEmail.message);
});

test('đăng nhập sai: ghi audit LOGIN_FAILED, actor null nếu email không tồn tại, không chứa mật khẩu', async () => {
  const { state, service } = setup([active]);
  await service.login({ email: 'farmer@example.com', password: 'sai-pass-1' }).catch(() => {});
  await service.login({ email: 'khong@co.com', password: 'sai-pass-2' }).catch(() => {});
  assert.equal(state.audits.length, 2);
  assert.equal(state.audits[0].actorId, 1);
  assert.equal(state.audits[1].actorId, null);
  assert.ok(state.audits.every((a) => a.action === 'LOGIN_FAILED'));
  assert.ok(!JSON.stringify(state.audits).includes('sai-pass'));
});

test('email không tồn tại vẫn so sánh mật khẩu với hash giả (chống dò email qua thời gian)', async () => {
  const { service, hasher } = setup([active]);
  await service.login({ email: 'khong@co.com', password: 'x' }).catch(() => {});
  assert.equal(hasher.calls.length, 1);
});

test('ghi audit LOGIN_FAILED lỗi vẫn trả 401, không thành 500', async () => {
  const { state, service } = setup([active]);
  state.failAudit = true;
  const e = await service.login({ email: 'farmer@example.com', password: 'sai' }).catch((x) => x);
  assert.equal(e.status, 401);
});

test('đăng nhập đúng mật khẩu nhưng PENDING / LOCKED -> 403 với mã riêng', async () => {
  const { service } = setup([
    { ...active, user_id: '2', email: 'p@example.com', status: 'PENDING' },
    { ...active, user_id: '3', email: 'l@example.com', status: 'LOCKED' },
  ]);
  const p = await service.login({ email: 'p@example.com', password: 'secret123' }).catch((e) => e);
  const l = await service.login({ email: 'l@example.com', password: 'secret123' }).catch((e) => e);
  assert.equal(p.status, 403); assert.equal(p.code, 'ACCOUNT_PENDING');
  assert.equal(l.status, 403); assert.equal(l.code, 'ACCOUNT_LOCKED');
});

test('tài khoản LOCKED + sai mật khẩu -> 401 (không lộ trạng thái khóa)', async () => {
  const { service } = setup([{ ...active, status: 'LOCKED' }]);
  const e = await service.login({ email: 'farmer@example.com', password: 'sai' }).catch((x) => x);
  assert.equal(e.status, 401);
});

// ---------- profile ----------
test('lấy hồ sơ: ACTIVE ok; không tồn tại -> 401; bị khóa sau khi có token -> 403', async () => {
  const { service } = setup([active, { ...active, user_id: '9', email: 'k@example.com', status: 'LOCKED' }]);
  assert.equal((await service.getProfile(1)).email, 'farmer@example.com');
  assert.equal((await service.getProfile(404).catch((e) => e)).status, 401);
  assert.equal((await service.getProfile(9).catch((e) => e)).code, 'ACCOUNT_LOCKED');
});

test('cập nhật hồ sơ: đổi tên, ghi audit UPDATE với giá trị cũ/mới', async () => {
  const { state, service } = setup([active]);
  const u = await service.updateProfile(1, { name: 'Tên mới' });
  assert.equal(u.name, 'Tên mới');
  assert.equal(state.audits.length, 1);
  assert.deepEqual([state.audits[0].action, state.audits[0].oldValue, state.audits[0].newValue], ['UPDATE', { name: 'Farmer A' }, { name: 'Tên mới' }]);
});

test('cập nhật hồ sơ: tên không đổi thì không ghi audit', async () => {
  const { state, service } = setup([active]);
  await service.updateProfile(1, { name: 'Farmer A' });
  assert.equal(state.audits.length, 0);
});

test('cập nhật hồ sơ: tài khoản bị khóa -> 403', async () => {
  const { service } = setup([{ ...active, status: 'LOCKED' }]);
  assert.equal((await service.updateProfile(1, { name: 'X' }).catch((e) => e)).status, 403);
});
