'use strict';

const { Pool } = require('pg');

// Cấu hình CSDL chỉ dùng DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (giống .env.example và docker-compose.yml).
// Không có DATABASE_URL để tránh hai cách cấu hình song song.
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

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
