'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/modules/batches/batches.validators');
const { ValidationError } = require('../src/common/errors');

function fieldsOf(fn) {
  try { fn(); } catch (e) { assert.ok(e instanceof ValidationError); assert.equal(e.status, 400); return e.details.map((d) => d.field).sort(); }
  assert.fail('phải ném ValidationError');
}

test('tạo lô hợp lệ: cắt khoảng trắng, làm tròn 2 chữ số', () => {
  assert.deepEqual(v.validateCreateBatch({ productName: ' Cà phê ', origin: ' Đắk Lắk ', quantity: 500.5 }),
    { productName: 'Cà phê', origin: 'Đắk Lắk', quantity: 500.5 });
});

test('tạo lô: gom mọi lỗi cùng lúc', () => {
  assert.deepEqual(fieldsOf(() => v.validateCreateBatch({ productName: '', origin: '  ', quantity: 'abc' })), ['origin', 'productName', 'quantity']);
});

test('tạo lô: số lượng <= 0, quá lớn, quá nhiều chữ số thập phân, NaN, chuỗi số đều bị từ chối', () => {
  const base = { productName: 'A', origin: 'B' };
  for (const quantity of [0, -5, 1e12, 1.234, NaN, Infinity, '10', null, undefined]) {
    assert.deepEqual(fieldsOf(() => v.validateCreateBatch({ ...base, quantity })), ['quantity'], `quantity=${String(quantity)}`);
  }
  assert.doesNotThrow(() => v.validateCreateBatch({ ...base, quantity: 0.01 }));
  assert.doesNotThrow(() => v.validateCreateBatch({ ...base, quantity: 9999999999.99 }));
});

test('tạo lô: độ dài tối đa và kiểu dữ liệu sai', () => {
  assert.deepEqual(fieldsOf(() => v.validateCreateBatch({ productName: 'a'.repeat(151), origin: 'b'.repeat(256), quantity: 1 })), ['origin', 'productName']);
  assert.deepEqual(fieldsOf(() => v.validateCreateBatch({ productName: 123, origin: null, quantity: 1 })), ['origin', 'productName']);
  assert.deepEqual(fieldsOf(() => v.validateCreateBatch(undefined)), ['body']);
  assert.deepEqual(fieldsOf(() => v.validateCreateBatch([])), ['body']);
});

test('sửa lô: chỉ nhận productName/origin/quantity, cần ít nhất một trường', () => {
  assert.deepEqual(v.validateUpdateBatch({ quantity: 480 }), { quantity: 480 });
  assert.deepEqual(v.validateUpdateBatch({ productName: ' X ', origin: ' Y ' }), { productName: 'X', origin: 'Y' });
  assert.deepEqual(fieldsOf(() => v.validateUpdateBatch({})), ['body']);
});

test('sửa lô: chặn batchCode, currentStatus, createdBy, organizationId, batchId', () => {
  const bad = fieldsOf(() => v.validateUpdateBatch({ quantity: 1, batchCode: 'BATCH-2026-0001', currentStatus: 'SHIPPED', createdBy: 1, organizationId: 2, batchId: 9 }));
  assert.deepEqual(bad, ['batchCode', 'batchId', 'createdBy', 'currentStatus', 'organizationId']);
});

test('sửa lô: giá trị sai bị từ chối', () => {
  assert.deepEqual(fieldsOf(() => v.validateUpdateBatch({ quantity: -1, origin: '' })), ['origin', 'quantity']);
});

test('danh sách: mặc định page=1, limit=20; đọc status, q', () => {
  assert.deepEqual(v.validateListQuery({}), { status: undefined, q: undefined, page: 1, limit: 20 });
  assert.deepEqual(v.validateListQuery({ status: 'CREATED', q: ' cà phê ', page: '3', limit: '50' }), { status: 'CREATED', q: 'cà phê', page: 3, limit: 50 });
  assert.equal(v.validateListQuery({ q: '   ' }).q, undefined);
});

test('danh sách: status/page/limit/q sai -> 400', () => {
  assert.deepEqual(fieldsOf(() => v.validateListQuery({ status: 'ABC' })), ['status']);
  assert.deepEqual(fieldsOf(() => v.validateListQuery({ page: '0' })), ['page']);
  assert.deepEqual(fieldsOf(() => v.validateListQuery({ page: '-1' })), ['page']);
  assert.deepEqual(fieldsOf(() => v.validateListQuery({ limit: '101' })), ['limit']);
  assert.deepEqual(fieldsOf(() => v.validateListQuery({ limit: 'abc' })), ['limit']);
  assert.deepEqual(fieldsOf(() => v.validateListQuery({ q: 'x'.repeat(101) })), ['q']);
  assert.deepEqual(fieldsOf(() => v.validateListQuery({ status: ['CREATED', 'SHIPPED'], q: ['a', 'b'] })), ['q', 'status']);
});

test('batchId trên đường dẫn: số nguyên dương, còn lại 400', () => {
  assert.equal(v.parseBatchId('42'), 42);
  for (const bad of ['0', '-1', 'abc', '1.5', '', '01', '1e3', undefined, '9'.repeat(20)]) {
    assert.throws(() => v.parseBatchId(bad), ValidationError, String(bad));
  }
});
