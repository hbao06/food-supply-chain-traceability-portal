'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthenticate, authorize } = require('../src/middleware/authenticate');
const { UnauthorizedError } = require('../src/common/errors');

const tokens = {
  verify(t) {
    if (t === 'good') return { userId: 7, role: 'FARMER', organizationId: 1 };
    if (t === 'expired') throw new UnauthorizedError('TOKEN_EXPIRED', 'hết hạn');
    throw new UnauthorizedError('INVALID_TOKEN', 'sai');
  },
};
const authenticate = createAuthenticate(tokens);
const call = (mw, req) => { let out; mw(req, {}, (e) => { out = e; }); return out; };

test('thiếu header Authorization -> 401 UNAUTHORIZED', () => {
  const e = call(authenticate, { headers: {} });
  assert.equal(e.status, 401); assert.equal(e.code, 'UNAUTHORIZED');
});

test('sai kiểu (không phải Bearer) -> 401', () => {
  assert.equal(call(authenticate, { headers: { authorization: 'Basic abc' } }).status, 401);
  assert.equal(call(authenticate, { headers: { authorization: 'Bearer' } }).status, 401);
});

test('token sai / hết hạn -> 401 với mã riêng', () => {
  assert.equal(call(authenticate, { headers: { authorization: 'Bearer bad' } }).code, 'INVALID_TOKEN');
  assert.equal(call(authenticate, { headers: { authorization: 'Bearer expired' } }).code, 'TOKEN_EXPIRED');
});

test('token đúng -> gắn req.auth, không có lỗi', () => {
  const req = { headers: { authorization: 'bearer good' } };
  assert.equal(call(authenticate, req), undefined);
  assert.deepEqual(req.auth, { userId: 7, role: 'FARMER', organizationId: 1 });
});

test('authorize: đúng vai trò đi tiếp, sai vai trò -> 403, chưa xác thực -> 401', () => {
  assert.equal(call(authorize('FARMER', 'ADMIN'), { auth: { role: 'FARMER' } }), undefined);
  assert.equal(call(authorize('ADMIN'), { auth: { role: 'FARMER' } }).status, 403);
  assert.equal(call(authorize('ADMIN'), {}).status, 401);
});
