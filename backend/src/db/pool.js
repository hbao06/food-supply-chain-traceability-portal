'use strict';

const { Pool } = require('pg');
const { createDemoDb } = require('./demoDb');

const isDemoMode = String(process.env.DB_MODE || '').trim().toLowerCase() === 'demo';

// Cấu hình CSDL:
// - DB_MODE=demo: dùng CSDL demo cố định (backend/data/demo-db.json) đầy đủ bảng, QR HMAC, chuỗi băm SHA-256 để demo ngay không cần cài PostgreSQL.
// - Mặc định (postgres / Docker Compose): dùng PostgreSQL với DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
const pool = isDemoMode
  ? createDemoDb()
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

if (isDemoMode && process.env.NODE_ENV !== 'test') {
  console.log(`[db] Đang chạy chế độ CSDL demo cố định: ${pool.getFilePath()}`);
}

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

module.exports = { pool, withTransaction, isDemoMode };
