'use strict';

// Hàm dùng chung cho các script kiểm thử HTTP đầu-cuối (smoke-batches.js, smoke-events.js).
// Cần: backend đang chạy, CSDL đã tạo từ schema/migration, .env có DB_PASSWORD, JWT_SECRET, QR_HMAC_SECRET.
// Mỗi lần chạy tạo đơn vị và tài khoản mới (hậu tố theo thời gian). audit_logs chỉ ghi thêm nên dữ liệu thử
// không xóa được: chỉ dùng CSDL phát triển.
const path = require('path');
try {
  // Cùng quy tắc nạp .env với src/app.js; dotenv không ghi đè biến đã có.
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
} catch (_) { /* chưa cài dotenv: dùng biến môi trường có sẵn */ }

const bcrypt = require('bcryptjs');
const { pool } = require('../../src/db/pool');

const API = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const stamp = Date.now();
const PASSWORD = 'Password123'; // đạt chính sách mật khẩu: >= 8 ký tự, có chữ và số
let failed = 0;
let warned429 = false;

function check(name, ok, detail) {
  if (ok) console.log(`  PASS  ${name}`);
  else { failed += 1; console.log(`  FAIL  ${name}${detail === undefined ? '' : '  ->  ' + JSON.stringify(detail)}`); }
}

async function call(method, urlPath, { token, body, raw } = {}) {
  const headers = {};
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + urlPath, {
    method, headers,
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (_) { /* phản hồi không có JSON */ }
  if (res.status === 429 && !warned429) {
    warned429 = true;
    console.log(`  !!    Chạm giới hạn tần suất (429), chờ ${res.headers.get('retry-after') || '?'} giây hoặc đặt RATE_LIMIT_DISABLED=true trong .env rồi khởi động lại backend.`);
  }
  return { status: res.status, body: json };
}

async function ensureServer() {
  console.log(`API: ${API}\n`);
  try {
    const r = await call('GET', '/api/health');
    check('Backend đang chạy (GET /api/health)', r.status === 200, r.status);
  } catch (err) {
    console.log(`  FAIL  Không kết nối được tới ${API}: ${err.message}\n        Hãy chạy backend trước (npm run dev), hoặc đặt API_URL cho đúng.`);
    process.exit(1);
  }
}

async function createOrg(label, type) {
  const name = `Smoke ${label} ${stamp}`;
  const r = await pool.query('INSERT INTO organizations (name, type) VALUES ($1, $2) RETURNING organization_id', [name, type]);
  return { orgId: Number(r.rows[0].organization_id), orgName: name };
}

// Tài khoản thường: đăng ký bằng API rồi duyệt bằng SQL (chưa có endpoint Admin). Admin: tạo bằng SQL.
async function createActor({ label, role, org }) {
  const email = `smoke.${label}.${stamp}@example.com`;
  let userId;
  if (role === 'ADMIN') {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const r = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, status) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE') RETURNING user_id`,
      [`Smoke ${label}`, email, hash]);
    userId = Number(r.rows[0].user_id);
  } else {
    const reg = await call('POST', '/api/auth/register', { body: { name: `Smoke ${label}`, email, password: PASSWORD, role } });
    if (reg.status !== 201) throw new Error(`Đăng ký ${label} thất bại: ${JSON.stringify(reg)}`);
    userId = reg.body.userId;
    await pool.query(`UPDATE users SET organization_id = $1, status = 'ACTIVE' WHERE user_id = $2`, [org.orgId, userId]);
  }
  const login = await call('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  if (login.status !== 200) throw new Error(`Đăng nhập ${label} thất bại: ${JSON.stringify(login)}`);
  return { label, role, userId, token: login.body.token, ...(org || {}) };
}

// 2 đơn vị nông trại (để thử phạm vi), 1 đơn vị chế biến, 1 đơn vị phân phối, và Admin.
async function setupActors() {
  console.log('[Chuẩn bị] tạo đơn vị và tài khoản thử...');
  const farmA = await createOrg('Farm A', 'FARM');
  const farmB = await createOrg('Farm B', 'FARM');
  const proc = await createOrg('Processor', 'PROCESSOR');
  const dist = await createOrg('Distributor', 'DISTRIBUTOR');
  return {
    admin: await createActor({ label: 'admin', role: 'ADMIN' }),
    farmerA: await createActor({ label: 'farmerA', role: 'FARMER', org: farmA }),
    farmerB: await createActor({ label: 'farmerB', role: 'FARMER', org: farmB }),
    processor: await createActor({ label: 'processor', role: 'PROCESSOR', org: proc }),
    distributor: await createActor({ label: 'distributor', role: 'DISTRIBUTOR', org: dist }),
  };
}

async function finish() {
  await pool.end();
  console.log(failed === 0 ? '\nTẤT CẢ ĐỀU PASS' : `\n${failed} KIỂM TRA THẤT BẠI`);
  process.exit(failed === 0 ? 0 : 1);
}

async function run(main) {
  try { await main(); await finish(); } catch (err) {
    console.error('Lỗi khi chạy:', err);
    try { await pool.end(); } catch (_) { /* bỏ qua */ }
    process.exit(1);
  }
}

module.exports = { API, stamp, PASSWORD, pool, check, call, ensureServer, setupActors, run };
