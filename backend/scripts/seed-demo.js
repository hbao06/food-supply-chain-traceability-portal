'use strict';

// Nạp dữ liệu mẫu (W5-TV3). Chạy SAU npm run db:migrate. CHỈ dùng cho CSDL phát triển / demo.
//   cd backend && npm run db:seed:demo
// Cần trong .env: QR_HMAC_SECRET (giống backend, để QR của lô mẫu quét được), TRACE_BASE_URL (tùy chọn).
// Mật khẩu chung của tài khoản mẫu: SEED_USER_PASSWORD (mặc định Demo12345).
// Chạy lại an toàn: đã có dữ liệu mẫu thì chỉ thêm các lô mẫu còn thiếu (W8), không tạo trùng.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../src/db/pool');
const { seedDemo, createSeedQr } = require('../src/db/seedDemo');
const { passwordProblem } = require('../src/common/passwordPolicy');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Không nạp dữ liệu mẫu khi NODE_ENV=production');
  }
  const password = process.env.SEED_USER_PASSWORD || 'Demo12345';
  const problem = passwordProblem(password);
  if (problem) throw new Error(`SEED_USER_PASSWORD: ${problem}`);

  const qr = createSeedQr({ secret: process.env.QR_HMAC_SECRET, baseUrl: process.env.TRACE_BASE_URL });
  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_COST) || 10);
  const result = await withTransaction((tx) => seedDemo(tx, { passwordHash, qr }));

  if (!result.created) {
    if (!result.added || !result.added.length) {
      console.log('Dữ liệu mẫu đã có đủ, không tạo thêm.');
      return;
    }
    // CSDL đã seed bản cũ (W5): chỉ thêm các lô mẫu mới (W8).
    console.log(`Dữ liệu mẫu đã có; đã thêm ${result.added.length} lô mẫu còn thiếu:`);
    for (const b of result.added) console.log(`  ${b.code}  ${b.farm.padEnd(6)} ${b.status}`);
    console.log('Lưu ý: dữ liệu mẫu cũ (mô tả sự kiện, audit) không được sửa vì lịch sử chỉ ghi thêm.');
    console.log('Muốn CSDL demo sạch hoàn toàn: tạo lại CSDL theo database/Readme.md, mục "Chuẩn bị CSDL sạch để demo".');
    return;
  }
  console.log(`Đã tạo ${result.organizations} đơn vị, ${result.users.length} tài khoản, ${result.products} sản phẩm, ${result.batches.length} lô.`);
  console.log(`\nTài khoản (mật khẩu chung: ${process.env.SEED_USER_PASSWORD ? 'SEED_USER_PASSWORD trong .env' : 'Demo12345'}):`);
  for (const u of result.users) console.log(`  ${u.key.padEnd(14)} ${u.email.padEnd(26)} ${u.role.padEnd(12)} ${u.status}`);
  console.log('\nLô:');
  for (const b of result.batches) console.log(`  ${b.code}  ${b.farm.padEnd(6)} ${b.status}`);
}

main()
  .catch((err) => {
    console.error(`LỖI: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
