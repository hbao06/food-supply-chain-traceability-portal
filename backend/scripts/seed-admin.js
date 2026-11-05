'use strict';

// Tạo tài khoản Admin đầu tiên (W4-TV3). Chạy SAU npm run db:migrate.
//   Đặt trong .env:  ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD (≥ 8 ký tự, có chữ và số; KHÔNG commit)
//   cd backend && npm run db:seed:admin
// Email đã tồn tại thì bỏ qua, không đổi mật khẩu.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../src/db/pool');
const { seedAdmin } = require('../src/db/seedAdmin');

async function main() {
  const cost = Number(process.env.BCRYPT_COST) || 10;
  const result = await withTransaction((tx) =>
    seedAdmin(
      tx,
      { name: process.env.ADMIN_NAME || 'Quản trị viên', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
      { hash: (pw) => bcrypt.hash(pw, cost) }
    )
  );
  if (result.created) console.log(`Đã tạo Admin user_id=${result.userId}.`);
  else console.log(`Email đã tồn tại (user_id=${result.userId}, vai trò ${result.role}), không tạo mới.`);
}

main()
  .catch((err) => {
    console.error(`LỖI: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
