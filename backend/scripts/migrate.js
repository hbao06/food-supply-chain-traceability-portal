'use strict';

// Chạy migration CSDL (W4-TV3).
//   cd backend && npm run db:migrate            # chạy các migration chưa chạy
//   cd backend && npm run db:migrate -- --status   # chỉ xem trạng thái
// Dùng các biến DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (giống src/db/pool.js).
// Với Docker Compose: chạy trên máy với DB_HOST=localhost (cổng 5432 đã mở ra ngoài).

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Client } = require('pg');
const { loadMigrations, migrate } = require('../src/db/migrator');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

async function main() {
  const migrations = loadMigrations(MIGRATIONS_DIR);
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  try {
    if (process.argv.includes('--status')) {
      const exists = (await client.query("SELECT to_regclass('public.schema_migrations') AS t")).rows[0].t;
      const done = exists
        ? new Set((await client.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version))
        : new Set();
      for (const m of migrations) console.log(`  ${done.has(m.version) ? 'done   ' : 'pending'}  ${m.name}`);
      return;
    }
    console.log(`Migration -> ${client.database}@${client.host}:${client.port}`);
    const result = await migrate(client, migrations, { log: console.log });
    console.log(result.upToDate && !result.baseline ? 'CSDL đã ở phiên bản mới nhất.' : 'Hoàn tất.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`LỖI: ${err.message}`);
  process.exit(1);
});
