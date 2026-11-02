'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLoadCurrentUser } = require('../src/middleware/currentUser');

// CSDL giả: trả hàng users theo user_id (pg trả BIGINT dạng chuỗi).
function fakeDb(rows, { fail = false } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (fail) throw new Error('db down');
      return { rows: rows.filter((r) => String(r.user_id) === String(params[0])) };
    },
  };
}
const run = async (mw, req) => { let out = 'NOT_CALLED'; await mw(req, {}, (e) => { out = e; }); return out; };
const USERS = [
  { user_id: '1', role: 'FARMER', status: 'ACTIVE', organization_id: '3' },
  { user_id: '2', role: 'DISTRIBUTOR', status: 'LOCKED', organization_id: '4' },
  { user_id: '3', role: 'FARMER', status: 'PENDING', organization_id: null },
  { user_id: '4', role: 'ADMIN', status: 'ACTIVE', organization_id: null },
];

test('ACTIVE: thay req.auth bằng dữ liệu mới nhất từ CSDL (vai trò trong token đã cũ)', async () => {
  const mw = createLoadCurrentUser({ db: fakeDb(USERS) });
  const req = { auth: { userId: 1, role: 'ADMIN', organizationId: 99 } }; // token cũ / bị sửa
  assert.equal(await run(mw, req), undefined);
  assert.deepEqual(req.auth, { userId: 1, role: 'FARMER', organizationId: 3, status: 'ACTIVE' });
});

test('Admin không có đơn vị -> organizationId null', async () => {
  const req = { auth: { userId: 4, role: 'ADMIN', organizationId: null } };
  assert.equal(await run(createLoadCurrentUser({ db: fakeDb(USERS) }), req), undefined);
  assert.equal(req.auth.organizationId, null);
});

test('tài khoản bị khóa sau khi đã có token -> 403 ACCOUNT_LOCKED (US-S04 AC01)', async () => {
  const e = await run(createLoadCurrentUser({ db: fakeDb(USERS) }), { auth: { userId: 2, role: 'DISTRIBUTOR' } });
  assert.equal(e.status, 403); assert.equal(e.code, 'ACCOUNT_LOCKED');
});

test('tài khoản PENDING -> 403 ACCOUNT_PENDING', async () => {
  const e = await run(createLoadCurrentUser({ db: fakeDb(USERS) }), { auth: { userId: 3, role: 'FARMER' } });
  assert.equal(e.status, 403); assert.equal(e.code, 'ACCOUNT_PENDING');
});

test('tài khoản không còn tồn tại -> 401', async () => {
  const e = await run(createLoadCurrentUser({ db: fakeDb(USERS) }), { auth: { userId: 999, role: 'FARMER' } });
  assert.equal(e.status, 401);
});

test('chưa qua authenticate hoặc userId không phải số nguyên -> 401, không truy vấn CSDL', async () => {
  const db = fakeDb(USERS);
  const mw = createLoadCurrentUser({ db });
  assert.equal((await run(mw, {})).status, 401);
  assert.equal((await run(mw, { auth: { userId: NaN } })).status, 401);
  assert.equal(db.calls.length, 0);
});

test('truy vấn có tham số, không ghép chuỗi', async () => {
  const db = fakeDb(USERS);
  await run(createLoadCurrentUser({ db }), { auth: { userId: 1 } });
  assert.match(db.calls[0].sql, /WHERE user_id = \$1/);
  assert.deepEqual(db.calls[0].params, [1]);
});

test('lỗi CSDL -> chuyển lỗi cho errorHandler (500), không cho đi tiếp', async () => {
  const req = { auth: { userId: 1 } };
  const e = await run(createLoadCurrentUser({ db: fakeDb(USERS, { fail: true }) }), req);
  assert.ok(e instanceof Error); assert.equal(e.status, undefined);
});
