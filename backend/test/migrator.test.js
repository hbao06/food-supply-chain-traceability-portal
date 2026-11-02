'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadMigrations, migrate, sha256 } = require('../src/db/migrator');

const ROOT = path.resolve(__dirname, '../../database');

test('migrations trong repo: đúng tên, đúng thứ tự, không có BEGIN/COMMIT', () => {
  const ms = loadMigrations(path.join(ROOT, 'migrations'));
  assert.deepEqual(ms.map((m) => m.version).slice(0, 2), ['001', '002']);
  for (const m of ms) assert.match(m.checksum, /^[0-9a-f]{64}$/);
});

test('001 giống hệt schema.sql v1 (bỏ BEGIN/COMMIT) – không để hai bản lệch nhau', () => {
  const strip = (s) => s.replace(/\r\n/g, '\n').split('\n').filter((l) => !/^(BEGIN|COMMIT);$/.test(l.trim())).join('\n');
  const schema = strip(fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8'));
  const m001 = fs.readFileSync(path.join(ROOT, 'migrations/001_init_schema.sql'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(m001.endsWith(schema), '001_init_schema.sql phải chứa nguyên nội dung schema.sql');
});

function tmpDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

test('loadMigrations: từ chối tên sai, trùng số, có BEGIN; checksum giống nhau dù CRLF hay LF', () => {
  assert.throws(() => loadMigrations(tmpDir({ 'abc.sql': 'SELECT 1;' })), /không hợp lệ/);
  assert.throws(() => loadMigrations(tmpDir({ '001_a.sql': 'SELECT 1;', '001_b.sql': 'SELECT 2;' })), /Trùng/);
  assert.throws(() => loadMigrations(tmpDir({ '001_a.sql': 'BEGIN;\nSELECT 1;\nCOMMIT;' })), /BEGIN/);
  const lf = loadMigrations(tmpDir({ '001_a.sql': 'SELECT 1;\nSELECT 2;\n' }))[0];
  const crlf = loadMigrations(tmpDir({ '001_a.sql': 'SELECT 1;\r\nSELECT 2;\r\n' }))[0];
  assert.equal(lf.checksum, crlf.checksum);
});

// CSDL giả ghi lại câu lệnh, giả lập bảng schema_migrations và các bảng v1 đã có.
function fakeDb({ applied = [], v1Tables = [], failOn } = {}) {
  const log = [];
  const rows = applied.map((x) => ({ ...x }));
  return {
    log, rows,
    async query(sql, params = []) {
      log.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
      if (failOn && sql.includes(failOn)) throw new Error('lỗi SQL');
      if (/FROM schema_migrations/.test(sql)) return { rows };
      if (/information_schema\.tables/.test(sql)) return { rows: v1Tables.map((t) => ({ table_name: t })) };
      if (/INSERT INTO schema_migrations/.test(sql)) rows.push({ version: params[0], name: params[1], checksum: params[2] });
      return { rows: [] };
    },
  };
}
const M = (v, sql = `SELECT ${v};`) => ({ version: v, name: `${v}_x.sql`, sql, checksum: sha256(sql) });
const V1 = ['organizations', 'users', 'batches', 'qr_codes', 'supply_chain_events', 'audit_logs'];

test('CSDL trống: chạy lần lượt từng file trong transaction riêng, có khóa advisory', async () => {
  const db = fakeDb();
  const r = await migrate(db, [M('001'), M('002')]);
  assert.deepEqual(r.applied, ['001_x.sql', '002_x.sql']);
  assert.equal(db.log.filter((l) => l === 'BEGIN').length, 2);
  assert.equal(db.log.filter((l) => l === 'COMMIT').length, 2);
  assert.ok(db.log[0].includes('pg_advisory_lock'));
  assert.ok(db.log.at(-1).includes('pg_advisory_unlock'));
});

test('chạy lại khi đã mới nhất: không chạy gì', async () => {
  const db = fakeDb({ applied: [M('001'), M('002')] });
  const r = await migrate(db, [M('001'), M('002')]);
  assert.equal(r.upToDate, true);
  assert.ok(!db.log.includes('BEGIN'));
});

test('CSDL tạo tay từ schema.sql (Tuần 3): ghi nhận 001 là baseline, chỉ chạy 002', async () => {
  const db = fakeDb({ v1Tables: V1 });
  const r = await migrate(db, [M('001'), M('002')]);
  assert.equal(r.baseline, true);
  assert.deepEqual(r.applied, ['002_x.sql']);
  assert.deepEqual(db.rows.map((x) => x.version), ['001', '002']);
});

test('CSDL chỉ có một phần bảng v1 -> dừng, không đoán', async () => {
  await assert.rejects(migrate(fakeDb({ v1Tables: ['users'] }), [M('001')]), /một phần/);
});

test('migration đã chạy bị sửa nội dung -> dừng', async () => {
  const db = fakeDb({ applied: [M('001')] });
  await assert.rejects(migrate(db, [M('001', 'SELECT 999;')]), /bị sửa/);
});

test('file đã chạy bị xóa khỏi thư mục -> dừng', async () => {
  await assert.rejects(migrate(fakeDb({ applied: [M('001'), M('002')] }), [M('001')]), /không còn file/);
});

test('lỗi giữa chừng: ROLLBACK file đó, không chạy file sau, vẫn mở khóa', async () => {
  const db = fakeDb({ failOn: 'LOI_SQL' });
  await assert.rejects(migrate(db, [M('001'), M('002', 'LOI_SQL;'), M('003')]), /002_x\.sql: lỗi SQL/);
  assert.ok(db.log.includes('ROLLBACK'));
  assert.deepEqual(db.rows.map((x) => x.version), ['001']);
  assert.ok(db.log.at(-1).includes('pg_advisory_unlock'));
});
