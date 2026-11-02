'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { seedAdmin } = require('../src/db/seedAdmin');

function fakeDb(existing = []) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/^SELECT/.test(sql.trim())) return { rows: existing.filter((u) => u.email === params[0].toLowerCase()) };
      if (/INSERT INTO users/.test(sql)) return { rows: [{ user_id: '10' }] };
      return { rows: [] };
    },
  };
}
const hash = async (pw) => `HASH(${pw})`;
const input = { name: ' Admin ', email: ' Admin@Example.com ', password: 'adminpass1' };

test('tạo Admin ACTIVE không thuộc đơn vị, mật khẩu đã băm, có audit không chứa mật khẩu', async () => {
  const db = fakeDb();
  const r = await seedAdmin(db, input, { hash });
  assert.deepEqual(r, { created: true, userId: 10, role: 'ADMIN' });
  const ins = db.calls.find((c) => /INSERT INTO users/.test(c.sql));
  assert.match(ins.sql, /'ADMIN', 'ACTIVE', NULL/);
  assert.deepEqual(ins.params, ['Admin', 'admin@example.com', 'HASH(adminpass1)']);
  const audit = db.calls.find((c) => /INSERT INTO audit_logs/.test(c.sql));
  assert.ok(!JSON.stringify(audit.params).includes('adminpass1'));
});

test('email đã tồn tại -> bỏ qua, không đổi gì', async () => {
  const db = fakeDb([{ user_id: '5', email: 'admin@example.com', role: 'ADMIN' }]);
  assert.deepEqual(await seedAdmin(db, input, { hash }), { created: false, userId: 5, role: 'ADMIN' });
  assert.equal(db.calls.length, 1);
});

test('thiếu email hoặc mật khẩu yếu -> báo lỗi rõ ràng', async () => {
  await assert.rejects(seedAdmin(fakeDb(), { ...input, email: undefined }, { hash }), /ADMIN_EMAIL/);
  await assert.rejects(seedAdmin(fakeDb(), { ...input, password: 'yeu' }, { hash }), /ADMIN_PASSWORD/);
  await assert.rejects(seedAdmin(fakeDb(), { ...input, password: 'chikhongcoso' }, { hash }), /chữ và số/);
});
