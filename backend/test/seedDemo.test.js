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
// existing: CSDL đã seed bản cũ – { orgs: [{organization_id, name, type}], users: [{user_id, email, status}],
//           products: [{product_id, organization_id, name}] } trả cho các truy vấn tra cứu của chế độ nâng cấp.
function fakeDb({ marker = false, takenCodes = [], takenEmails = [], existing = null } = {}) {
  const calls = [];
  let id = 1000;
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (existing && /SELECT organization_id, name, type FROM organizations/.test(sql)) return { rows: existing.orgs };
      if (existing && /SELECT user_id, lower\(email\) AS email, status FROM users/.test(sql)) return { rows: existing.users };
      if (existing && /SELECT product_id, organization_id, name FROM products/.test(sql)) return { rows: existing.products };
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

test('chạy lại: đã có đủ dữ liệu mẫu thì bỏ qua; mã lô hoặc email đã bị dùng thì dừng rõ ràng', async () => {
  const again = fakeDb({ marker: true, takenCodes: seed.BATCHES.map((b) => b.code) });
  assert.deepEqual(await seed.seedDemo(again, { passwordHash: HASH, qr }), { created: false, added: [] });
  assert.equal(inserts(again, 'organizations').length, 0);
  assert.equal(inserts(again, 'batches').length, 0);
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

test('W8: dữ liệu demo có đủ 6 trạng thái lô và mỗi Distributor đều có lô để xem', () => {
  const status = (b) => (b.steps.length ? b.steps.at(-1)[0] : 'CREATED');
  assert.deepEqual([...new Set(seed.BATCHES.map(status))].sort(), [...EVENT_SEQUENCE].sort());
  for (const key of ['distributor_a', 'distributor_b', 'processor_a']) {
    assert.ok(seed.BATCHES.some((b) => b.steps.some(([, actor]) => actor === key)), `${key} chưa có lô nào`);
  }
});

test('W8: dữ liệu demo không có dữ liệu cá nhân thừa (biển số xe, số điện thoại) và audit không chứa email', async () => {
  const text = JSON.stringify(seed.BATCHES);
  assert.doesNotMatch(text, /\b\d{2}[A-Z]-?\d{3}\.?\d{2}\b/, 'biển số xe');
  assert.doesNotMatch(text, /\b0\d{9}\b/, 'số điện thoại');
  for (const u of seed.USERS) assert.match(u.email, /@demo\.local$/);
  const db = fakeDb();
  await seed.seedDemo(db, { passwordHash: HASH, qr });
  const audits = JSON.stringify(inserts(db, 'audit_logs').map((a) => a.params));
  assert.doesNotMatch(audits, /@demo\.local/);
});

// CSDL đã seed bằng bản W5 (chưa có lô 0004, 0005) – dữ liệu như seed W5 tạo ra.
const W5_CODES = ['BATCH-2026-0001', 'BATCH-2026-0002', 'BATCH-2026-0003', 'BATCH-2026-0101', 'BATCH-2026-0102'];
function w5Existing() {
  const orgs = seed.ORGS.map((o, i) => ({ organization_id: String(i + 1), name: o.name, type: o.type }));
  const orgIdOf = (key) => orgs[seed.ORGS.findIndex((o) => o.key === key)].organization_id;
  return {
    orgs,
    orgIdOf,
    users: seed.USERS.map((u, i) => ({ user_id: String(i + 1), email: u.email, status: u.status })),
    products: seed.PRODUCTS.map((p, i) => ({ product_id: String(i + 1), organization_id: orgIdOf(p.org), name: p.name })),
  };
}

test('W8 nâng cấp: CSDL đã seed bản W5 thì chạy lại chỉ thêm lô 0004, 0005, dùng lại tài khoản / sản phẩm cũ', async () => {
  const ex = w5Existing();
  const db = fakeDb({ marker: true, takenCodes: W5_CODES, existing: ex });
  const r = await seed.seedDemo(db, { passwordHash: HASH, qr });
  assert.equal(r.created, false);
  assert.deepEqual(r.added.map((b) => `${b.code}:${b.status}`), ['BATCH-2026-0004:TRANSPORTED', 'BATCH-2026-0005:PROCESSED']);
  // không tạo thêm đơn vị / tài khoản / sản phẩm
  for (const t of ['organizations', 'users', 'products']) assert.equal(inserts(db, t).length, 0, t);
  const b = inserts(db, 'batches');
  assert.deepEqual(b.map((c) => c.params[0]), ['BATCH-2026-0004', 'BATCH-2026-0005']);
  const userIdOf = (key) => Number(ex.users[seed.USERS.findIndex((u) => u.key === key)].user_id);
  assert.equal(b[0].params[1], 1, 'sản phẩm arabica cũ (id 1)');
  assert.equal(b[0].params[5], userIdOf('farmer_a'));
  assert.equal(b[0].params[6], Number(ex.orgIdOf('farmA')));
  const ev = inserts(db, 'supply_chain_events');
  assert.equal(ev.length, 2 + 4); // 0004: CREATED + 1 bước; 0005: CREATED + 3 bước
  assert.equal(ev[1].params[1], userIdOf('distributor_b'), 'TRANSPORTED của 0004 do distributor_b đã có');
  assert.equal(inserts(db, 'qr_codes').length, 2);
});

test('W8 nâng cấp: thiếu tài khoản mẫu (hoặc bị khóa) thì dừng và hướng dẫn tạo lại CSDL, không ghi gì', async () => {
  const ex = w5Existing();
  ex.users = ex.users.filter((u) => u.email !== 'distributor_b@demo.local');
  const db = fakeDb({ marker: true, takenCodes: W5_CODES, existing: ex });
  await assert.rejects(seed.seedDemo(db, { passwordHash: HASH, qr }), /distributor_b@demo\.local.*tạo lại CSDL/s);
  assert.equal(inserts(db, 'batches').length, 0);

  const locked = w5Existing();
  locked.users.find((u) => u.email === 'farmer_a@demo.local').status = 'LOCKED';
  await assert.rejects(seed.seedDemo(fakeDb({ marker: true, takenCodes: W5_CODES, existing: locked }), { passwordHash: HASH, qr }),
    /farmer_a@demo\.local \(ACTIVE\)/);
});
