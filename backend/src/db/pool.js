'use strict';

const { Pool } = require('pg');

// Dùng DATABASE_URL nếu có, nếu không pg tự đọc PGHOST/PGUSER/PGPASSWORD/PGDATABASE.
// Nếu repo đã có pool chung thì thay file này bằng import của repo, chỉ cần export { pool, withTransaction }.
const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : undefined);

// Chạy fn(client) trong một transaction; lỗi thì ROLLBACK.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* bỏ qua lỗi rollback */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
