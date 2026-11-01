'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../src/middleware/rateLimit');

function fakeRes() { const headers = {}; return { headers, setHeader: (k, v) => { headers[k] = v; } }; }
const hit = (mw, ip) => { const res = fakeRes(); let out = 'NOT_CALLED'; mw({ ip }, res, (e) => { out = e; }); return { out, res }; };

test('trong giới hạn đi tiếp; vượt giới hạn -> 429 kèm Retry-After', () => {
  let t = 0;
  const mw = createRateLimiter({ windowMs: 60_000, max: 3, now: () => t });
  for (let i = 0; i < 3; i++) assert.equal(hit(mw, '1.1.1.1').out, undefined);
  t = 15_000;
  const { out, res } = hit(mw, '1.1.1.1');
  assert.equal(out.status, 429); assert.equal(out.code, 'TOO_MANY_REQUESTS');
  assert.equal(res.headers['Retry-After'], '45');
  assert.equal(res.headers['RateLimit-Remaining'], '0');
});

test('mỗi IP đếm riêng', () => {
  const mw = createRateLimiter({ windowMs: 60_000, max: 1, now: () => 0 });
  assert.equal(hit(mw, 'a').out, undefined);
  assert.equal(hit(mw, 'b').out, undefined);
  assert.equal(hit(mw, 'a').out.status, 429);
});

test('hết cửa sổ thời gian thì đếm lại từ đầu', () => {
  let t = 0;
  const mw = createRateLimiter({ windowMs: 1000, max: 1, now: () => t });
  hit(mw, 'x');
  assert.equal(hit(mw, 'x').out.status, 429);
  t = 1000;
  assert.equal(hit(mw, 'x').out, undefined);
});

test('thông báo tùy chỉnh, cấu hình sai bị từ chối', () => {
  const mw = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0, message: 'Chậm lại' });
  hit(mw, 'y');
  assert.equal(hit(mw, 'y').out.message, 'Chậm lại');
  assert.throws(() => createRateLimiter({ windowMs: 0, max: 1 }));
  assert.throws(() => createRateLimiter({ windowMs: 1000, max: 0 }));
});

test('dọn khóa đã hết hạn khi số IP vượt maxKeys', () => {
  let t = 0;
  const mw = createRateLimiter({ windowMs: 10, max: 1, now: () => t, maxKeys: 2 });
  hit(mw, 'p'); hit(mw, 'q');
  t = 20;
  assert.equal(hit(mw, 'r').out, undefined); // p, q hết hạn bị dọn
  assert.equal(hit(mw, 'p').out, undefined);
});
