'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createQrTokenService } = require('../src/common/qrToken');

const SECRET = 'a'.repeat(48);
const qr = createQrTokenService({ secret: SECRET, baseUrl: 'https://trace.example.com/' });

test('token = mã lô + "." + chữ ký; url nối /trace/<token>, bỏ dấu / thừa', () => {
  const t = qr.token('BATCH-2026-0001');
  assert.ok(t.startsWith('BATCH-2026-0001.'));
  assert.equal(qr.url('BATCH-2026-0001'), `https://trace.example.com/trace/${t}`);
  assert.ok(qr.url('BATCH-2026-0001').includes(qr.signature('BATCH-2026-0001')), 'qr_data phải chứa signature_hmac (CHECK trong schema)');
});

test('chữ ký ổn định và khác nhau giữa các lô', () => {
  assert.equal(qr.signature('BATCH-2026-0001'), qr.signature('BATCH-2026-0001'));
  assert.notEqual(qr.signature('BATCH-2026-0001'), qr.signature('BATCH-2026-0002'));
});

test('verify: token đúng trả mã lô; sửa mã lô hoặc chữ ký thì trả null', () => {
  const t = qr.token('BATCH-2026-0007');
  assert.equal(qr.verify(t), 'BATCH-2026-0007');
  assert.equal(qr.verify(t.replace('0007', '0008')), null);
  assert.equal(qr.verify(t.slice(0, -2) + 'xx'), null);
  assert.equal(qr.verify('BATCH-2026-0007'), null);
  assert.equal(qr.verify('.abc'), null);
  assert.equal(qr.verify(undefined), null);
  assert.equal(qr.verify(12345), null);
});

test('khác khóa bí mật thì không xác minh được', () => {
  const other = createQrTokenService({ secret: 'b'.repeat(48) });
  assert.equal(other.verify(qr.token('BATCH-2026-0001')), null);
});

test('thiếu hoặc ngắn khóa bí mật: sign ném lỗi rõ ràng, verify trả null', () => {
  for (const secret of [undefined, '', 'ngan']) {
    const bad = createQrTokenService({ secret });
    assert.throws(() => bad.token('BATCH-2026-0001'), /QR_HMAC_SECRET/);
    assert.equal(bad.verify('BATCH-2026-0001.abc'), null);
  }
});
