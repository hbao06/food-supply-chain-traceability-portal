'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sanitizeAuditValue, normalizeAuditEntry, ACTIONS, ENTITY_TYPES } = require('../src/modules/audit/audit.sanitize');
const repo = require('../src/modules/audit/audit.repository');
const { validateAuditQuery, validateVerifyQuery } = require('../src/modules/audit/audit.validators');
const { createAuditService, toAuditDto } = require('../src/modules/audit/audit.service');
const authRepo = require('../src/modules/auth/auth.repository');

const fieldsOf = (fn) => { try { fn(); } catch (e) { assert.equal(e.status, 400); return e.details.map((d) => d.field); } assert.fail('phải ném lỗi 400'); };

// ---------- Lọc nội dung (US-S05 AC03) ----------
test('bỏ khóa nhạy cảm ở mọi cấp, giữ phần còn lại', () => {
  const v = sanitizeAuditValue({
    email: 'a@x.com', password: 'p1', passwordHash: '$2b$...', token: 't', accessToken: 'x', qrToken: 'q',
    signatureHmac: 's', Authorization: 'Bearer x',
    profile: { name: 'A', jwt: 'j', nested: { secret: 'k', ok: 1 } },
    list: [{ password: 'p', keep: true }],
  });
  assert.deepEqual(v, { email: 'a@x.com', profile: { name: 'A', nested: { ok: 1 } }, list: [{ keep: true }] });
});

test('kết quả lọc luôn qua được CHECK chk_audit_no_secrets của CSDL', () => {
  // Cùng biểu thức với migration 001.
  const dbCheck = /"(password|password_hash|passwordHash|token|jwt|qr_token|qrToken|signature_hmac)"/i;
  const v = sanitizeAuditValue({ password: 1, password_hash: 2, passwordHash: 3, token: 4, jwt: 5, qr_token: 6, qrToken: 7, signature_hmac: 8, a: { token: 9 } });
  assert.ok(!dbCheck.test(JSON.stringify(v)));
});

test('chuẩn hóa kiểu: Date -> ISO, bỏ undefined/hàm, số không hữu hạn -> null, giá trị đơn bọc trong object', () => {
  const d = new Date('2026-11-09T01:02:03Z');
  assert.deepEqual(sanitizeAuditValue({ at: d, u: undefined, f() {}, n: NaN, big: 10n, ok: 'x' }),
    { at: '2026-11-09T01:02:03.000Z', n: null, big: '10', ok: 'x' });
  assert.equal(sanitizeAuditValue(null), null);
  assert.equal(sanitizeAuditValue(undefined), null);
  assert.deepEqual(sanitizeAuditValue('CREATED'), { value: 'CREATED' });
});

test('giới hạn độ sâu và kích thước (audit không phình to)', () => {
  let deep = { v: 1 };
  for (let i = 0; i < 10; i++) deep = { d: deep };
  assert.ok(JSON.stringify(sanitizeAuditValue(deep)).includes('[…]'));
  const big = sanitizeAuditValue({ text: 'x'.repeat(20000), other: 1 });
  assert.deepEqual(big, { _truncated: true, keys: ['text', 'other'] });
});

test('normalizeAuditEntry: action / entityType / id sai là lỗi lập trình (Error thường -> 500)', () => {
  const ok = normalizeAuditEntry({ actorId: '5', action: 'CREATE', entityType: 'BATCH', entityId: 7, newValue: { password: 'x', a: 1 } });
  assert.deepEqual(ok, { actorId: 5, action: 'CREATE', entityType: 'BATCH', entityId: 7, oldValue: null, newValue: { a: 1 } });
  assert.throws(() => normalizeAuditEntry({ action: 'DELETE', entityType: 'BATCH' }), /action/);
  assert.throws(() => normalizeAuditEntry({ action: 'CREATE', entityType: 'PRODUCT' }), /entityType/);
  assert.throws(() => normalizeAuditEntry({ action: 'CREATE', entityType: 'BATCH', actorId: -1 }), /actorId/);
  for (const e of [() => normalizeAuditEntry({ action: 'X', entityType: 'BATCH' })]) {
    try { e(); } catch (err) { assert.equal(err.status, undefined); }
  }
});

test('ACTIONS / ENTITY_TYPES khớp CHECK trong CSDL (001) và enum trong openapi-spec.yaml', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../database/migrations/001_init_schema.sql'), 'utf8');
  const list = (name) => [...new RegExp(`${name} CHECK \\(\\w+ IN \\(([^)]*)\\)`, 's').exec(sql)[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...ACTIONS].sort(), list('chk_audit_action').sort());
  assert.deepEqual([...ENTITY_TYPES].sort(), list('chk_audit_entity_type').sort());
  const api = fs.readFileSync(path.resolve(__dirname, '../../docs/openapi-spec.yaml'), 'utf8');
  const enumOf = (name) => new RegExp(`${name}:\\s*\\n\\s*type: string\\s*\\n\\s*enum: \\[([^\\]]*)\\]`).exec(api)[1].split(',').map((s) => s.trim());
  assert.deepEqual([...ACTIONS].sort(), enumOf('AuditAction').sort());
  assert.deepEqual([...ENTITY_TYPES].sort(), enumOf('AuditEntityType').sort());
});

// ---------- Ghi audit ----------
function fakeDb(rowsByQuery = {}) {
  const calls = [];
  return { calls, async query(sql, params) { calls.push({ sql, params }); for (const [k, v] of Object.entries(rowsByQuery)) if (sql.includes(k)) return { rows: v }; return { rows: [] }; } };
}

test('insertAudit: SQL có tham số, nội dung đã lọc, không gửi cột chuỗi băm (CSDL tự cấp)', async () => {
  const db = fakeDb({ 'INSERT INTO audit_logs': [{ audit_id: '42' }] });
  const id = await repo.insertAudit(db, { actorId: 3, action: 'LOGIN_FAILED', entityType: 'USER', newValue: { email: 'a@x.com', password: 'sai' } });
  assert.equal(id, 42);
  assert.match(db.calls[0].sql, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6\)/);
  assert.doesNotMatch(db.calls[0].sql, /chain_seq|row_hash|prev_hash/);
  assert.deepEqual(db.calls[0].params, [3, 'LOGIN_FAILED', 'USER', null, null, { email: 'a@x.com' }]);
});

test('auth.repository.insertAudit (batches, events đang dùng) chính là service audit mới', () => {
  assert.equal(authRepo.insertAudit, repo.insertAudit);
});

test('insertAudit sai action -> ném lỗi trước khi gửi SQL', async () => {
  const db = fakeDb();
  await assert.rejects(repo.insertAudit(db, { action: 'DROP', entityType: 'USER' }), /action/);
  assert.equal(db.calls.length, 0);
});

// ---------- Tìm kiếm ----------
test('buildWhere: chỉ thêm điều kiện được gửi, đánh số tham số liên tục', () => {
  assert.deepEqual(repo.buildWhere({}), { where: '', params: [] });
  const from = new Date('2026-11-01T00:00:00Z');
  const w = repo.buildWhere({ entityType: 'BATCH', entityId: 5, action: 'UPDATE', from });
  assert.equal(w.where, 'WHERE a.entity_type = $1 AND a.entity_id = $2 AND a.action = $3 AND a.created_at >= $4');
  assert.deepEqual(w.params, ['BATCH', 5, 'UPDATE', from]);
});

test('searchAudit: phân trang bằng tham số, mới nhất trước', async () => {
  const db = fakeDb({ 'count(*)': [{ total: '57' }], 'LEFT JOIN users': [{ audit_id: '9' }] });
  const r = await repo.searchAudit(db, { actorId: 2, page: 3, limit: 20 });
  assert.equal(r.total, 57);
  const q = db.calls[1];
  assert.match(q.sql, /ORDER BY a\.created_at DESC, a\.audit_id DESC/);
  assert.match(q.sql, /LIMIT \$2 OFFSET \$3/);
  assert.deepEqual(q.params, [2, 20, 40]);
});

test('validateAuditQuery: hợp lệ', () => {
  assert.deepEqual(validateAuditQuery({}), { page: 1, limit: 20 });
  const v = validateAuditQuery({ entityType: 'EVENT', entityId: '12', actorId: '3', action: 'CREATE',
    from: '2026-11-01', to: '2026-11-09T23:59:59+07:00', page: '2', limit: '100' });
  assert.equal(v.entityId, 12); assert.equal(v.actorId, 3); assert.equal(v.page, 2); assert.equal(v.limit, 100);
  assert.ok(v.from instanceof Date && v.to instanceof Date);
});

test('validateAuditQuery: sai -> 400 đúng trường (US-S06 AC02)', () => {
  assert.deepEqual(fieldsOf(() => validateAuditQuery({ entityType: 'PRODUCT' })), ['entityType']);
  assert.deepEqual(fieldsOf(() => validateAuditQuery({ action: 'DELETE' })), ['action']);
  assert.deepEqual(fieldsOf(() => validateAuditQuery({ entityId: '0', actorId: 'abc' })), ['entityId', 'actorId']);
  assert.deepEqual(fieldsOf(() => validateAuditQuery({ from: '09/11/2026' })), ['from']);
  assert.deepEqual(fieldsOf(() => validateAuditQuery({ to: '2026-13-45' })), ['to']);
  assert.deepEqual(fieldsOf(() => validateAuditQuery({ from: '2026-11-09', to: '2026-11-01' })), ['from']);
  assert.deepEqual(fieldsOf(() => validateAuditQuery({ limit: '101' })), ['limit']);
  assert.deepEqual(fieldsOf(() => validateAuditQuery({ page: '0' })), ['page']);
  assert.deepEqual(fieldsOf(() => validateAuditQuery({ entityId: ['1', '2'] })), ['entityId']); // ?entityId=1&entityId=2
  assert.deepEqual(fieldsOf(() => validateVerifyQuery({ batchId: '-1' })), ['batchId']);
});

// ---------- Service ----------
test('search: trả DTO camelCase theo schema AuditLog, không có cột băm', async () => {
  const fakeRepo = { searchAudit: async () => ({ total: 1, rows: [{ audit_id: '1', actor_id: null, actor_name: null, action: 'LOGIN_FAILED',
    entity_type: 'USER', entity_id: null, old_value: null, new_value: { email: 'a@x.com' }, created_at: new Date('2026-11-09T00:00:00Z'), row_hash: 'x' }] }) };
  const r = await createAuditService({ db: {}, repo: fakeRepo }).search({ page: 1, limit: 20 });
  assert.deepEqual(r, { page: 1, limit: 20, total: 1, items: [{ auditId: 1, actorId: null, actorName: null, action: 'LOGIN_FAILED',
    entityType: 'USER', entityId: null, oldValue: null, newValue: { email: 'a@x.com' }, createdAt: '2026-11-09T00:00:00.000Z' }] });
  assert.equal('rowHash' in toAuditDto({ row_hash: 'x' }), false);
});

test('verify: báo toàn vẹn / hỏng; lô không có sự kiện -> 404', async () => {
  const mk = (audit, events) => createAuditService({ db: {}, repo: {
    verifyAuditChain: async () => audit, verifyBatchEvents: async () => events } });
  const ok = await mk({ checked: '39', first_broken_audit_id: null, reason: null }).verify();
  assert.deepEqual({ ...ok, checkedAt: undefined }, { auditLog: { checked: 39, valid: true, firstBrokenId: null, reason: null }, valid: true, checkedAt: undefined });
  const bad = await mk({ checked: '39', first_broken_audit_id: null }, { checked: '1', first_broken_event_id: '8', reason: 'Nội dung sự kiện đã bị sửa' }).verify({ batchId: 2 });
  assert.equal(bad.valid, false);
  assert.deepEqual(bad.batchEvents, { batchId: 2, checked: 1, valid: false, firstBrokenId: 8, reason: 'Nội dung sự kiện đã bị sửa' });
  await assert.rejects(mk({ checked: '0' }, { checked: '0', first_broken_event_id: null }).verify({ batchId: 999 }), (e) => e.status === 404);
});
