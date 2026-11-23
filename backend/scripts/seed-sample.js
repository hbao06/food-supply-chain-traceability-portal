'use strict';

// Nạp 5 sản phẩm & lô nông sản thật vào PostgreSQL (chạy sau npm run db:migrate).
//   cd backend && npm run db:seed:sample
// Biến môi trường cần có: QR_HMAC_SECRET (>= 32 ký tự), DB_HOST/PORT/NAME/USER/PASSWORD.
// Mật khẩu chung của tài khoản đối tác mẫu: SAMPLE_USER_PASSWORD (mặc định FoodTrace2026).

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../src/db/pool');
const { createQrTokenService } = require('../src/common/qrToken');
const { passwordProblem } = require('../src/common/passwordPolicy');
const { seedSample } = require('../src/db/seedSample');

async function main() {
  const secret = process.env.QR_HMAC_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('QR_HMAC_SECRET chưa được cấu hình (cần tối thiểu 32 ký tự)');
  }
  const password = process.env.SAMPLE_USER_PASSWORD || 'FoodTrace2026';
  const pwProblem = passwordProblem(password);
  if (pwProblem) throw new Error(`SAMPLE_USER_PASSWORD: ${pwProblem}`);

  const qr = createQrTokenService({ secret, baseUrl: process.env.TRACE_BASE_URL });
  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_COST) || 10);
  const result = await withTransaction((tx) => seedSample(tx, { passwordHash, qr }));

  if (!result.createdBatches.length) {
    console.log('5 lô sản phẩm thật đã tồn tại trong CSDL, không tạo thêm.');
    return;
  }

  console.log(
    `Đã nạp dữ liệu thật: +${result.orgsCreated} đơn vị, +${result.usersCreated} tài khoản, +${result.productsCreated} sản phẩm, +${result.createdBatches.length} lô.`
  );
  console.log('\nDanh sách lô:');
  for (const b of result.createdBatches) {
    console.log(`  ${b.code}  [${b.status}]`);
  }
  console.log(`\nTài khoản đối tác (mật khẩu: ${process.env.SAMPLE_USER_PASSWORD ? 'SAMPLE_USER_PASSWORD' : 'FoodTrace2026'}):`);
  for (const u of result.users) {
    console.log(`  ${u.role.padEnd(12)} ${u.email}`);
  }
}

main()
  .catch((err) => {
    console.error(`LỖI: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
