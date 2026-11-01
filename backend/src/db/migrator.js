'use strict';

// Trình chạy migration SQL (W4-TV3). Không phụ thuộc thư viện ngoài: nhận `db` có hàm query(text, params)
// (pg.Client thật, hoặc đối tượng giả khi test). Lệnh chạy: backend/scripts/migrate.js.
//
// Quy tắc:
//  - File trong database/migrations dạng NNN_ten_thay_doi.sql, chạy theo thứ tự số.
//  - Mỗi file chạy trong MỘT transaction; lỗi thì ROLLBACK, các file sau không chạy.
//  - Bảng schema_migrations lưu version + checksum SHA-256. File đã chạy mà bị sửa -> dừng, báo lỗi.
//  - Khóa advisory để hai người/tiến trình không chạy migration cùng lúc.
//  - CSDL đã tạo tay từ schema.sql ở Tuần 3 (có đủ 6 bảng, chưa có schema_migrations) được ghi nhận
//    001 là đã chạy (baseline), không chạy lại.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FILE_RE = /^(\d{3})_[a-z0-9_]+\.sql$/;
const LOCK_KEY = 2026_0413; // số bất kỳ, cố định cho dự án
const V1_TABLES = ['organizations', 'users', 'batches', 'qr_codes', 'supply_chain_events', 'audit_logs'];

const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
// Chuẩn hóa xuống dòng để checksum giống nhau trên Windows (CRLF) và Linux (LF).
const normalize = (text) => text.replace(/\r\n/g, '\n');

function loadMigrations(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const seen = new Set();
  return files.map((file) => {
    const m = FILE_RE.exec(file);
    if (!m) throw new Error(`Tên file migration không hợp lệ: ${file} (cần dạng 001_ten_thay_doi.sql)`);
    if (seen.has(m[1])) throw new Error(`Trùng số migration ${m[1]}`);
    seen.add(m[1]);
    const sql = normalize(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im.test(sql)) {
      throw new Error(`${file}: không viết BEGIN/COMMIT trong migration (trình chạy tự bọc transaction)`);
    }
    return { version: m[1], name: file, sql, checksum: sha256(sql) };
  });
}

async function ensureTable(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(10)  PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    checksum    CHAR(64)     NOT NULL,
    applied_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
  )`);
}

async function existingV1Tables(db) {
  const r = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [V1_TABLES]
  );
  return r.rows.map((x) => x.table_name);
}

async function record(db, m) {
  await db.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [m.version, m.name, m.checksum]);
}

// Trả { applied: [tên file vừa chạy], baseline: bool, upToDate: bool }
async function migrate(db, migrations, { log = () => {} } = {}) {
  await db.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    await ensureTable(db);
    const rows = (await db.query('SELECT version, name, checksum FROM schema_migrations ORDER BY version')).rows;
    const done = new Map(rows.map((r) => [r.version, r]));
    let baseline = false;

    if (done.size === 0) {
      const found = await existingV1Tables(db);
      if (found.length === V1_TABLES.length) {
        const first = migrations.find((m) => m.version === '001');
        if (!first) throw new Error('Thiếu migration 001 để ghi nhận baseline');
        await record(db, first);
        done.set('001', first);
        baseline = true;
        log(`  baseline  ${first.name} (CSDL đã tạo từ schema.sql, không chạy lại)`);
      } else if (found.length > 0) {
        throw new Error(`CSDL chỉ có một phần bảng v1 (${found.join(', ')}). Hãy tạo CSDL trống rồi chạy lại.`);
      }
    }

    for (const [version, row] of done) {
      const file = migrations.find((m) => m.version === version);
      if (!file) throw new Error(`Migration ${row.name} đã chạy nhưng không còn file trong database/migrations`);
      if (file.checksum !== row.checksum.trim()) {
        throw new Error(`${file.name} đã chạy nhưng nội dung bị sửa sau đó. Không sửa migration cũ, hãy tạo file mới.`);
      }
    }

    const applied = [];
    for (const m of migrations.filter((x) => !done.has(x.version))) {
      await db.query('BEGIN');
      try {
        await db.query(m.sql);
        await record(db, m);
        await db.query('COMMIT');
      } catch (err) {
        await db.query('ROLLBACK').catch(() => {});
        err.message = `${m.name}: ${err.message}`;
        throw err;
      }
      applied.push(m.name);
      log(`  applied   ${m.name}`);
    }
    return { applied, baseline, upToDate: applied.length === 0 };
  } finally {
    await db.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
  }
}

module.exports = { loadMigrations, migrate, sha256, normalize, V1_TABLES };
