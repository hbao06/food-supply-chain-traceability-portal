'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { seedSample, ORGS, USERS, PRODUCTS, BATCHES } = require('../src/db/seedSample');
const { createQrTokenService } = require('../src/common/qrToken');
const { ROLES, EVENT_SEQUENCE, EVENT_TYPE_ROLE } = require('../src/middleware/rbac');

const HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.Xh8gN1H0r1b8O4l6m3bS4qv0r1yW';
const SECRET = 'test-only-qr-secret-0123456789abcdefghij';
const qr = createQrTokenService({ secret: SECRET, baseUrl: 'http://localhost:5173' });

function fakeDb({ existingBatchCodes = [] } = {}) {
  const calls = [];
  let seq = 100;
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/SELECT batch_code FROM batches WHERE batch_code = ANY/.test(sql)) {
        return { rows: existingBatchCodes.map((c) => ({ batch_code: c })) };
      }
      if (/^SELECT /i.test(sql.trim())) {
        return { rows: [] };
      }
      const m = /RETURNING (\w+)/.exec(sql);
      if (m) return { rows: [{ [m[1]]: String(++seq) }] };
      return { rows: [] };
    },
  };
}

const inserts = (db, table) => db.calls.filter((c) => new RegExp(`INSERT INTO ${table}\\b`).test(c.sql));

test('seedSample có đúng 5 sản phẩm và 5 lô chuẩn FR-2026-0001..0005', () => {
  assert.equal(PRODUCTS.length, 5);
  assert.equal(BATCHES.length, 5);
  assert.deepEqual(BATCHES.map((b) => b.code), [
    'FR-2026-0001',
    'FR-2026-0002',
    'FR-2026-0003',
    'FR-2026-0004',
    'FR-2026-0005',
  ]);
});

test('seedSample nhất quán vai trò ↔ đơn vị và thứ tự sự kiện chuẩn', () => {
  const orgType = Object.fromEntries(ORGS.map((o) => [o.key, o.type]));
  const need = { FARMER: 'FARM', PROCESSOR: 'PROCESSOR', DISTRIBUTOR: 'DISTRIBUTOR' };
  for (const u of USERS) {
    assert.ok(Object.values(ROLES).includes(u.role));
    assert.equal(u.status, 'ACTIVE');
    assert.equal(orgType[u.org], need[u.role]);
    assert.match(u.email, /@foodtrace\.vn$/);
  }
  for (const b of BATCHES) {
    assert.match(b.code, /^FR-2026-\d{4}$/);
    const farmer = USERS.find((u) => u.key === b.farmer);
    const product = PRODUCTS.find((p) => p.key === b.product);
    assert.equal(farmer.role, 'FARMER');
    assert.equal(product.org, farmer.org);
    b.steps.forEach(([type, actor], i) => {
      assert.equal(type, EVENT_SEQUENCE[i + 1]);
      const user = USERS.find((u) => u.key === actor);
      assert.equal(user.role, EVENT_TYPE_ROLE[type]);
    });
  }
});

test('seedSample tạo đủ bản ghi, QR HMAC và audit không lộ email/mật khẩu', async () => {
  const db = fakeDb();
  const r = await seedSample(db, { passwordHash: HASH, qr, now: new Date('2026-11-20T08:00:00Z') });
  assert.equal(r.orgsCreated, ORGS.length);
  assert.equal(r.usersCreated, USERS.length);
  assert.equal(r.productsCreated, PRODUCTS.length);
  assert.equal(r.createdBatches.length, 5);
  assert.equal(inserts(db, 'batches').length, 5);
  assert.equal(inserts(db, 'qr_codes').length, 5);
  const auditsText = JSON.stringify(inserts(db, 'audit_logs').map((a) => a.params));
  assert.doesNotMatch(auditsText, /@foodtrace\.vn/i);
  assert.doesNotMatch(auditsText, /password|\$2b\$|signature/i);
  const batchesText = JSON.stringify(BATCHES);
  assert.doesNotMatch(batchesText, /\b\d{2}[A-Z]-?\d{3}\.?\d{2}\b/, 'không có biển số xe');
  assert.doesNotMatch(batchesText, /\b0\d{9}\b/, 'không có số điện thoại');
});

test('seedSample idempotent: bỏ qua lô đã tồn tại, không tạo trùng', async () => {
  const db = fakeDb({ existingBatchCodes: BATCHES.map((b) => b.code) });
  const r = await seedSample(db, { passwordHash: HASH, qr });
  assert.equal(r.createdBatches.length, 0);
  assert.equal(r.skippedBatches.length, 5);
  assert.equal(inserts(db, 'batches').length, 0);
});
