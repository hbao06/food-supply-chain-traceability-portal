'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const seed = require('../src/db/seedDemo');
const { ROLES, EVENT_SEQUENCE, EVENT_TYPE_ROLE } = require('../src/middleware/rbac');

const HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.Xh8gN1H0r1b8O4l6m3bS4qv0r1yW';
const SECRET = 'test-only-qr-secret-0123456789abcdefghij';

// CSDL giả: ghi lại câu lệnh, trả id tăng dần cho INSERT ... RETURNING.
function fakeDb({ marker = false, takenCodes = [], takenEmails = [] } = {}) {
  const calls = [];
  let id = 0;
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/FROM organizations WHERE name/.test(sql)) return { rows: marker ? [{ organization_id: '1' }] : [] };
      if (/FROM batches WHERE batch_code = ANY/.test(sql)) return { rows: takenCodes.map((c) => ({ batch_code: c })) };
      if (/FROM users WHERE lower\(email\)/.test(sql)) return { rows: takenEmails.map((e) => ({ email: e })) };
      const m = /RETURNING (\w+)/.exec(sql);
      if (m) return { rows: [{ [m[1]]: String(++id) }] };
      return { rows: [] };
    },
  };
}
const qr = seed.createSeedQr({ secret: SECRET });
const inserts = (db, table) => db.calls.filter((c) => new RegExp(`INSERT INTO ${table}\\b`).test(c.sql));

test('dữ liệu mẫu khớp test plan: đủ mã tài khoản và mã lô TV4 dùng', () => {
  const keys = seed.USERS.map((u) => u.key);
  for (const k of ['farmer_a', 'farmer_b', 'processor_a', 'distributor_a', 'admin_1', 'user_pending', 'user_locked']) assert.ok(keys.includes(k), k);
  const codes = seed.BATCHES.map((b) => b.code);
  for (const c of ['BATCH-2026-0001', 'BATCH-2026-0002', 'BATCH-2026-0101']) assert.ok(codes.includes(c), c);
  assert.equal(seed.BATCHES.find((b) => b.code === 'BATCH-2026-0001').steps.length, 0, '0001 phải còn CREATED');
  assert.ok(seed.BATCHES.find((b) => b.code === 'BATCH-2026-0002').steps.length > 0, '0002 phải đã rời CREATED');
});

test('dữ liệu mẫu tự nhất quán: vai trò ↔ loại đơn vị, sản phẩm thuộc nông trại, mã lô đúng định dạng', () => {
  const orgType = Object.fromEntries(seed.ORGS.map((o) => [o.key, o.type]));
  const need = { FARMER: 'FARM', PROCESSOR: 'PROCESSOR', DISTRIBUTOR: 'DISTRIBUTOR' };
  for (const u of seed.USERS) {
    assert.ok(Object.values(ROLES).includes(u.role), u.key);
    if (u.role === 'ADMIN') assert.equal(u.org, null);
    else if (u.org) assert.equal(orgType[u.org], need[u.role], u.key);
    else assert.notEqual(u.status, 'ACTIVE', `${u.key} ACTIVE phải có đơn vị`);
  }
  for (const p of seed.PRODUCTS) assert.equal(orgType[p.org], 'FARM', p.key);
  for (const b of seed.BATCHES) {
    assert.match(b.code, /^BATCH-[0-9]{4}-[0-9]{4,}$/);
    const farmer = seed.USERS.find((u) => u.key === b.farmer);
    const product = seed.PRODUCTS.find((p) => p.key === b.product);
    assert.equal(farmer.role, 'FARMER'); assert.equal(farmer.status, 'ACTIVE');
    assert.equal(product.org, farmer.org, `${b.code}: sản phẩm phải thuộc nông trại của Farmer`);
    assert.ok(b.quantity > 0);
  }
  assert.equal(new Set(seed.USERS.map((u) => u.email)).size, seed.USERS.length, 'email trùng');
  assert.equal(new Set(seed.BATCHES.map((b) => b.code)).size, seed.BATCHES.length, 'mã lô trùng');
});

test('chuỗi sự kiện của từng lô đúng thứ tự và đúng vai trò (giống trigger check_event_rules)', () => {
  for (const b of seed.BATCHES) {
    b.steps.forEach(([type, actor], i) => {
      assert.equal(type, EVENT_SEQUENCE[i + 1], `${b.code} bước ${i + 1}`);
      const user = seed.USERS.find((u) => u.key === actor);
      assert.equal(user.role, EVENT_TYPE_ROLE[type], `${b.code} ${type}`);
      assert.equal(user.status, 'ACTIVE', `${b.code} ${type}: người ghi phải ACTIVE`);
    });
  }
});

test('tạo đủ dòng, mỗi lô có QR + sự kiện CREATED, mọi dòng tạo ra đều có audit không chứa bí mật', async () => {
  const db = fakeDb();
  const r = await seed.seedDemo(db, { passwordHash: HASH, qr, now: new Date('2026-11-04T00:00:00Z') });
  assert.equal(r.created, true);
  assert.equal(inserts(db, 'organizations').length, seed.ORGS.length);
  assert.equal(inserts(db, 'users').length, seed.USERS.length);
  assert.equal(inserts(db, 'products').length, seed.PRODUCTS.length);
  assert.equal(inserts(db, 'batches').length, seed.BATCHES.length);
  assert.equal(inserts(db, 'qr_codes').length, seed.BATCHES.length);
  const events = seed.BATCHES.reduce((n, b) => n + 1 + b.steps.length, 0);
  assert.equal(inserts(db, 'supply_chain_events').length, events);
  const audits = inserts(db, 'audit_logs');
  assert.equal(audits.length, seed.ORGS.length + seed.USERS.length + seed.BATCHES.length * 2 + events);
  assert.ok(!JSON.stringify(audits.map((a) => a.params)).match(/password|\$2b\$|signature/i));
  assert.ok(db.calls[0].sql.includes('pg_advisory_xact_lock'), 'phải khóa trước khi đọc/ghi');
  assert.deepEqual(r.batches.map((b) => b.status), seed.BATCHES.map((b) => (b.steps.length ? b.steps.at(-1)[0] : 'CREATED')));
});

test('mật khẩu chỉ lưu dạng hash; tạo lô dùng product_id, không gửi product_name', async () => {
  const db = fakeDb();
  await seed.seedDemo(db, { passwordHash: HASH, qr });
  for (const c of inserts(db, 'users')) assert.equal(c.params[2], HASH);
  for (const c of inserts(db, 'batches')) assert.doesNotMatch(c.sql, /product_name/);
  await assert.rejects(seed.seedDemo(fakeDb(), { passwordHash: 'Demo12345', qr }), /bcrypt/);
});

test('thời điểm sự kiện tăng dần trong mỗi lô và không ở tương lai', async () => {
  const now = new Date('2026-11-04T00:00:00Z');
  const db = fakeDb();
  await seed.seedDemo(db, { passwordHash: HASH, qr, now });
  let last = {};
  for (const c of inserts(db, 'supply_chain_events')) {
    const [batchId, , , at] = c.params;
    const t = Date.parse(at);
    assert.ok(t <= now.getTime(), 'sự kiện ở tương lai');
    if (last[batchId] !== undefined) assert.ok(t > last[batchId]);
    last[batchId] = t;
  }
});

test('chạy lại: đã có dữ liệu mẫu thì bỏ qua; mã lô hoặc email đã bị dùng thì dừng rõ ràng', async () => {
  const again = fakeDb({ marker: true });
  assert.deepEqual(await seed.seedDemo(again, { passwordHash: HASH, qr }), { created: false });
  assert.equal(inserts(again, 'organizations').length, 0);
  await assert.rejects(seed.seedDemo(fakeDb({ takenCodes: ['BATCH-2026-0001'] }), { passwordHash: HASH, qr }), /BATCH-2026-0001/);
  await assert.rejects(seed.seedDemo(fakeDb({ takenEmails: ['farmer_a@demo.local'] }), { passwordHash: HASH, qr }), /farmer_a@demo.local/);
});

test('QR mẫu theo SRS P1; thiếu QR_HMAC_SECRET thì báo lỗi', () => {
  const sig = crypto.createHmac('sha256', SECRET).update('BATCH-2026-0001').digest('base64url');
  const q = seed.createSeedQr({ secret: SECRET, baseUrl: 'http://localhost:5173/' });
  assert.equal(q.signature('BATCH-2026-0001'), sig);
  assert.equal(q.url('BATCH-2026-0001'), `http://localhost:5173/trace/BATCH-2026-0001.${sig}`);
  assert.throws(() => seed.createSeedQr({ secret: undefined }), /QR_HMAC_SECRET/);
  assert.throws(() => seed.createSeedQr({ secret: 'ngan' }), /QR_HMAC_SECRET/);
});

// Khi module QR của TV2 (W5) đã có trong repo: QR của dữ liệu mẫu phải giống hệt và verify() được.
const QR_MODULE = path.resolve(__dirname, '../src/common/qrToken.js');
test('QR mẫu trùng khớp common/qrToken.js của module Batches', { skip: !fs.existsSync(QR_MODULE) && 'chưa có common/qrToken.js' }, () => {
  const { createQrTokenService } = require(QR_MODULE);
  const tri = createQrTokenService({ secret: SECRET, baseUrl: 'http://localhost:5173' });
  const mine = seed.createSeedQr({ secret: SECRET, baseUrl: 'http://localhost:5173' });
  for (const b of seed.BATCHES) {
    assert.equal(mine.url(b.code), tri.url(b.code));
    assert.equal(tri.verify(mine.url(b.code).split('/trace/')[1]), b.code);
  }
});
