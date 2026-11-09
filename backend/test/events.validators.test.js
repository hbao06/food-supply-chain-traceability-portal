'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCreateEvent } = require('../src/modules/events/events.validators');
const { ValidationError } = require('../src/common/errors');

function fieldsOf(fn) {
  try { fn(); } catch (e) { assert.ok(e instanceof ValidationError); assert.equal(e.status, 400); return e.details.map((d) => d.field).sort(); }
  assert.fail('phải ném ValidationError');
}

test('sự kiện hợp lệ: cắt khoảng trắng, mô tả rỗng -> null', () => {
  assert.deepEqual(validateCreateEvent({ eventType: 'TRANSPORTED', location: ' QL14 ', description: ' Xe tải ' }),
    { eventType: 'TRANSPORTED', location: 'QL14', description: 'Xe tải' });
  assert.deepEqual(validateCreateEvent({ eventType: 'SHIPPED', location: 'Kho' }), { eventType: 'SHIPPED', location: 'Kho', description: null });
  assert.equal(validateCreateEvent({ eventType: 'SHIPPED', location: 'Kho', description: '   ' }).description, null);
  assert.equal(validateCreateEvent({ eventType: 'SHIPPED', location: 'Kho', description: null }).description, null);
});

test('chỉ nhận 5 loại sự kiện; CREATED và giá trị lạ bị từ chối', () => {
  for (const t of ['TRANSPORTED', 'RECEIVED', 'PROCESSED', 'PACKAGED', 'SHIPPED']) assert.doesNotThrow(() => validateCreateEvent({ eventType: t, location: 'X' }));
  for (const t of ['CREATED', 'ABC', '', undefined, null, 5]) assert.deepEqual(fieldsOf(() => validateCreateEvent({ eventType: t, location: 'X' })), ['eventType'], String(t));
});

test('địa điểm: bắt buộc, không rỗng, tối đa 255 ký tự', () => {
  assert.deepEqual(fieldsOf(() => validateCreateEvent({ eventType: 'SHIPPED' })), ['location']);
  assert.deepEqual(fieldsOf(() => validateCreateEvent({ eventType: 'SHIPPED', location: '   ' })), ['location']);
  assert.deepEqual(fieldsOf(() => validateCreateEvent({ eventType: 'SHIPPED', location: 'x'.repeat(256) })), ['location']);
});

test('mô tả: chuỗi, tối đa 1000 ký tự', () => {
  assert.deepEqual(fieldsOf(() => validateCreateEvent({ eventType: 'SHIPPED', location: 'X', description: 123 })), ['description']);
  assert.deepEqual(fieldsOf(() => validateCreateEvent({ eventType: 'SHIPPED', location: 'X', description: 'a'.repeat(1001) })), ['description']);
});

test('chặn trường không được gửi: timestamp, actorId, batchId, createdAt', () => {
  const bad = fieldsOf(() => validateCreateEvent({ eventType: 'SHIPPED', location: 'X', timestamp: '2020-01-01T00:00:00Z', actorId: 1, batchId: 2, createdAt: 'x' }));
  assert.deepEqual(bad, ['actorId', 'batchId', 'createdAt', 'timestamp']);
});

test('body không phải object', () => {
  assert.deepEqual(fieldsOf(() => validateCreateEvent(undefined)), ['body']);
  assert.deepEqual(fieldsOf(() => validateCreateEvent([])), ['body']);
  assert.deepEqual(fieldsOf(() => validateCreateEvent('x')), ['body']);
});
