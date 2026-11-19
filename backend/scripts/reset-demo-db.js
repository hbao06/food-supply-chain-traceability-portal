'use strict';

// Tạo lại tệp CSDL demo cố định (backend/data/demo-db.json) sạch hoàn toàn với mã lô FR-2026-xxxx,
// 5 đơn vị, 8 tài khoản (mật khẩu Demo12345), 7 lô đủ 6 giai đoạn, mã QR chữ ký HMAC và chuỗi băm SHA-256.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { createDemoDb } = require('../src/db/demoDb');

const db = createDemoDb();
const state = db.reset();

console.log(`Đã khởi tạo CSDL demo cố định tại: ${db.getFilePath()}`);
console.log(`- ${state.organizations.length} đơn vị`);
console.log(`- ${state.users.length} tài khoản (mật khẩu chung: ${process.env.SEED_USER_PASSWORD || 'Demo12345'})`);
console.log(`- ${state.batches.length} lô hàng chuẩn FR-:`);
for (const b of state.batches) {
  console.log(`    ${b.batch_code}  [${b.current_status.padEnd(11)}]  ${b.product_name}`);
}
console.log(`- ${state.supply_chain_events.length} sự kiện chuỗi cung ứng & ${state.audit_logs.length} bản ghi audit (chuỗi băm SHA-256)`);
