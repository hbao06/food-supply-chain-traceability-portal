'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRegister, validateLogin, validateProfileUpdate } = require('../src/common/validators');
const { ValidationError } = require('../src/common/errors');

const valid = { name: '  Nguyen Van A ', email: ' Farmer@Example.COM ', password: 'password123', role: 'FARMER' };

function fieldsOf(fn) {
  try { fn(); } catch (e) { assert.ok(e instanceof ValidationError); assert.equal(e.status, 400); return e.details.map((d) => d.field); }
  assert.fail('phải ném ValidationError');
}

test('đăng ký hợp lệ: cắt khoảng trắng, email về chữ thường', () => {
  assert.deepEqual(validateRegister(valid), { name: 'Nguyen Van A', email: 'farmer@example.com', password: 'password123', role: 'FARMER' });
});

test('đăng ký: gom tất cả lỗi cùng lúc', () => {
  assert.deepEqual(fieldsOf(() => validateRegister({ name: '', email: 'abc', password: '123', role: 'X' })).sort(), ['email', 'name', 'password', 'role']);
});

test('đăng ký: không cho chọn ADMIN hoặc CONSUMER', () => {
  assert.deepEqual(fieldsOf(() => validateRegister({ ...valid, role: 'ADMIN' })), ['role']);
  assert.deepEqual(fieldsOf(() => validateRegister({ ...valid, role: 'CONSUMER' })), ['role']);
});

test('đăng ký: mật khẩu quá dài theo byte (bcrypt 72 byte)', () => {
  assert.deepEqual(fieldsOf(() => validateRegister({ ...valid, password: 'a'.repeat(73) })), ['password']);
  assert.doesNotThrow(() => validateRegister({ ...valid, password: 'a'.repeat(72) }));
});

test('đăng ký: body không phải object', () => {
  assert.deepEqual(fieldsOf(() => validateRegister(undefined)), ['body']);
  assert.deepEqual(fieldsOf(() => validateRegister([])), ['body']);
});

test('đăng ký: kiểu dữ liệu sai (số, null) bị từ chối', () => {
  assert.deepEqual(fieldsOf(() => validateRegister({ ...valid, name: 123, email: null })).sort(), ['email', 'name']);
});

test('đăng nhập: thiếu email hoặc mật khẩu', () => {
  assert.deepEqual(fieldsOf(() => validateLogin({})).sort(), ['email', 'password']);
  assert.deepEqual(validateLogin({ email: ' A@B.com ', password: 'x' }), { email: 'a@b.com', password: 'x' });
});

test('cập nhật hồ sơ: chỉ cho sửa name, chặn role/email/status/organizationId', () => {
  assert.deepEqual(validateProfileUpdate({ name: ' Tên mới ' }), { name: 'Tên mới' });
  const bad = fieldsOf(() => validateProfileUpdate({ name: 'A', role: 'ADMIN', email: 'x@y.com', status: 'ACTIVE', organizationId: 1 })).sort();
  assert.deepEqual(bad, ['email', 'organizationId', 'role', 'status']);
  assert.deepEqual(fieldsOf(() => validateProfileUpdate({})), ['name']);
});
