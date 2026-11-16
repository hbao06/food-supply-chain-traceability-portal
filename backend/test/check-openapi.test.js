'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseOperations, fill } = require('../scripts/check-openapi');

const SAMPLE = `openapi: 3.1.0
paths:
  /health:
    get:
      summary: x
  /batches:
    post:
      summary: x
    get:
      summary: y
  /batches/{batchId}/events:
    get:
      summary: z
    post:
      summary: w
  /trace/{qrToken}:
    get:
      summary: t
components:
  schemas:
    Foo:
      type: object
`;

test('đọc đúng danh sách method và đường dẫn, dừng ở components', () => {
  assert.deepEqual(parseOperations(SAMPLE).map((o) => `${o.method} ${o.path}`),
    ['GET /health', 'POST /batches', 'GET /batches', 'GET /batches/{batchId}/events', 'POST /batches/{batchId}/events', 'GET /trace/{qrToken}']);
});

test('chịu được xuống dòng CRLF của Windows', () => {
  assert.equal(parseOperations(SAMPLE.replace(/\n/g, '\r\n')).length, 6);
});

test('thay tham số đường dẫn bằng giá trị mẫu', () => {
  assert.equal(fill('/batches/{batchId}/events'), '/batches/1/events');
  assert.equal(fill('/trace/{qrToken}'), '/trace/x');
  assert.equal(fill('/trace/code/{batchCode}'), '/trace/code/BATCH-2026-0001');
  assert.equal(fill('/users/{userId}/status'), '/users/1/status');
});

test('OpenAPI thật của dự án (nếu có) đọc ra được endpoint và mọi đường dẫn đều có method', () => {
  const file = path.resolve(__dirname, '../../docs/openapi-spec.yaml');
  if (!fs.existsSync(file)) return; // chạy riêng ngoài repo thì bỏ qua
  const text = fs.readFileSync(file, 'utf8');
  const ops = parseOperations(text);
  assert.ok(ops.length >= 20, `chỉ đọc được ${ops.length} endpoint`);
  const paths = [...text.matchAll(/^ {2}(\/[^\s:]*):\s*$/gm)].map((m) => m[1]);
  for (const p of new Set(paths)) assert.ok(ops.some((o) => o.path === p), `đường dẫn ${p} không đọc được method nào`);
  assert.equal(new Set(ops.map((o) => `${o.method} ${o.path}`)).size, ops.length, 'có endpoint bị trùng');
});
