'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { errorHandler, notFound } = require('../src/common/errorHandler');
const { ValidationError, UnauthorizedError, ForbiddenError, ConflictError } = require('../src/common/errors');

function run(err) {
  const res = { headersSent: false, statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const origError = console.error; let logged = 0; console.error = () => { logged += 1; };
  try { errorHandler(err, {}, res, () => assert.fail('không được gọi next')); } finally { console.error = origError; }
  return { res, logged };
}

test('AppError: giữ nguyên status, code, message, details', () => {
  const { res } = run(new ValidationError([{ field: 'email', message: 'Email không hợp lệ' }]));
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details: [{ field: 'email', message: 'Email không hợp lệ' }] });
});

test('401 / 403 / 409 đúng mã', () => {
  assert.equal(run(new UnauthorizedError('INVALID_TOKEN', 'x')).res.statusCode, 401);
  assert.equal(run(new ForbiddenError()).res.statusCode, 403);
  assert.equal(run(new ConflictError('EMAIL_EXISTS', 'x')).res.body.code, 'EMAIL_EXISTS');
});

test('JSON hỏng từ body parser -> 400 INVALID_JSON', () => {
  const e = new SyntaxError('Unexpected token'); e.type = 'entity.parse.failed'; e.status = 400;
  const { res } = run(e);
  assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'INVALID_JSON');
});

test('lỗi PostgreSQL 23505 / 23514 / 23503 -> 409 và không lộ nội dung lỗi CSDL', () => {
  for (const code of ['23505', '23514', '23503']) {
    const e = new Error('duplicate key value violates unique constraint "uq_users_email_lower"'); e.code = code;
    const { res } = run(e);
    assert.equal(res.statusCode, 409);
    assert.ok(!JSON.stringify(res.body).includes('uq_users_email_lower'));
  }
});

test('lỗi không lường trước -> 500 chung chung, có log, không lộ message gốc', () => {
  const { res, logged } = run(new Error('mật khẩu DB là hunter2'));
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.code, 'INTERNAL_ERROR');
  assert.ok(!JSON.stringify(res.body).includes('hunter2'));
  assert.equal(logged, 1);
});

test('notFound chuyển NotFoundError sang errorHandler', () => {
  let passed; notFound({}, {}, (e) => { passed = e; });
  assert.equal(passed.status, 404);
});
