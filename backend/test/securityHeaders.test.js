'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { securityHeaders } = require('../src/middleware/securityHeaders');

test('đặt đủ header bảo mật rồi đi tiếp', () => {
  const headers = {};
  let called = false;
  securityHeaders({}, { setHeader: (k, v) => { headers[k] = v; } }, () => { called = true; });
  assert.ok(called);
  assert.deepEqual(headers, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  });
});
