'use strict';

// Kiểm thử HTTP đầu-cuối với CSDL thật cho Auth/Profile (W4-TV2):
//   đăng ký -> đăng nhập -> xem hồ sơ -> đổi tên, kèm các ca lỗi (400/401/403/404/409).
//
// Cần: backend đang chạy (npm run dev trong backend/, hoặc docker compose up), CSDL đã tạo từ database/schema.sql,
// và .env ở thư mục gốc repo có DB_PASSWORD (DB_HOST=localhost khi chạy script trên máy).
// Chạy (từ thư mục backend):
//   npm run smoke:auth
//   API_URL=http://localhost:3000 npm run smoke:auth        (đổi địa chỉ API; PowerShell: $env:API_URL="...")
//
// Mỗi lần chạy tạo một tài khoản mới (email smoke.<thời gian>@example.com). Không xóa được vì audit_logs
// chỉ ghi thêm; dùng CSDL phát triển, không chạy trên dữ liệu thật.

const path = require('path');
try {
  // Cùng quy tắc nạp .env với src/app.js; dotenv không ghi đè biến đã có.
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch (_) { /* chưa cài dotenv: dùng biến môi trường có sẵn */ }

const { pool } = require('../src/db/pool');

const API = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
let failed = 0;

function check(name, ok, detail) {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail === undefined ? '' : '  ->  ' + JSON.stringify(detail)}`);
  }
}

async function call(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (_) { /* phản hồi không có JSON */ }
  return { status: res.status, body: json };
}

async function main() {
  const email = `smoke.${Date.now()}@example.com`;
  const password = 'password123';
  console.log(`API: ${API}\nEmail thử: ${email}\n`);

  try {
    const h = await call('GET', '/api/health');
    check('Backend đang chạy (GET /api/health)', h.status === 200, h.status);
  } catch (err) {
    console.log(`  FAIL  Không kết nối được tới ${API}: ${err.message}`);
    console.log('        Hãy chạy backend trước, hoặc đặt API_URL cho đúng.');
    process.exit(1);
  }

  console.log('\n[Đăng ký]');
  const reg = await call('POST', '/api/auth/register', { body: { name: 'Smoke Tester', email, password, role: 'FARMER' } });
  check('Đăng ký hợp lệ -> 201', reg.status === 201, reg);
  check('Tài khoản mới ở trạng thái PENDING, chưa có đơn vị', reg.body?.status === 'PENDING' && reg.body?.organizationId === null, reg.body);
  check('Phản hồi không chứa mật khẩu hay hash', !/password|hash/i.test(JSON.stringify(reg.body)), reg.body);
  const userId = reg.body?.userId;

  const dup = await call('POST', '/api/auth/register', { body: { name: 'X', email: email.toUpperCase(), password, role: 'FARMER' } });
  check('Email trùng (khác hoa thường) -> 409 EMAIL_EXISTS', dup.status === 409 && dup.body?.code === 'EMAIL_EXISTS', dup);

  const bad = await call('POST', '/api/auth/register', { body: { name: '', email: 'abc', password: '123', role: 'ADMIN' } });
  check('Dữ liệu sai -> 400 VALIDATION_ERROR kèm details', bad.status === 400 && bad.body?.code === 'VALIDATION_ERROR' && bad.body?.details?.length === 4, bad);

  const badJson = await call('POST', '/api/auth/register', { raw: '{ không phải json' });
  check('JSON hỏng -> 400 INVALID_JSON', badJson.status === 400 && badJson.body?.code === 'INVALID_JSON', badJson);

  console.log('\n[Đăng nhập]');
  const wrong = await call('POST', '/api/auth/login', { body: { email, password: 'sai-mat-khau' } });
  check('Sai mật khẩu -> 401 INVALID_CREDENTIALS', wrong.status === 401 && wrong.body?.code === 'INVALID_CREDENTIALS', wrong);

  const pending = await call('POST', '/api/auth/login', { body: { email, password } });
  check('Đúng mật khẩu nhưng chưa duyệt -> 403 ACCOUNT_PENDING', pending.status === 403 && pending.body?.code === 'ACCOUNT_PENDING', pending);

  // Chưa có endpoint Admin duyệt tài khoản, nên duyệt tạm bằng SQL (đúng quy tắc schema: có đơn vị rồi mới ACTIVE).
  const org = await pool.query(
    `INSERT INTO organizations (name, type) VALUES ('Smoke Test Farm', 'FARM')
     ON CONFLICT (name, type) DO UPDATE SET name = EXCLUDED.name RETURNING organization_id`);
  await pool.query(`UPDATE users SET organization_id = $1, status = 'ACTIVE' WHERE user_id = $2`, [org.rows[0].organization_id, userId]);
  console.log('  (đã duyệt tài khoản bằng SQL)');

  const login = await call('POST', '/api/auth/login', { body: { email, password } });
  check('Đăng nhập đúng sau khi duyệt -> 200 có token', login.status === 200 && typeof login.body?.token === 'string', login);
  check('user trả về ACTIVE, có organizationId', login.body?.user?.status === 'ACTIVE' && Number.isInteger(login.body?.user?.organizationId), login.body?.user);
  const token = login.body?.token;

  console.log('\n[Hồ sơ]');
  const noToken = await call('GET', '/api/users/me');
  check('Không có token -> 401 UNAUTHORIZED', noToken.status === 401 && noToken.body?.code === 'UNAUTHORIZED', noToken);
  const badToken = await call('GET', '/api/users/me', { token: 'khong.phai.token' });
  check('Token sai -> 401 INVALID_TOKEN', badToken.status === 401 && badToken.body?.code === 'INVALID_TOKEN', badToken);

  const me = await call('GET', '/api/users/me', { token });
  check('GET /users/me -> 200 đúng email', me.status === 200 && me.body?.email === email, me);

  const patch = await call('PATCH', '/api/users/me', { token, body: { name: 'Tên mới' } });
  check('PATCH /users/me đổi tên -> 200', patch.status === 200 && patch.body?.name === 'Tên mới', patch);
  const forbidden = await call('PATCH', '/api/users/me', { token, body: { name: 'A', role: 'ADMIN' } });
  check('Sửa role -> 400 (không được phép sửa)', forbidden.status === 400 && forbidden.body?.code === 'VALIDATION_ERROR', forbidden);
  const me2 = await call('GET', '/api/users/me', { token });
  check('GET lại thấy tên mới, vai trò không đổi', me2.body?.name === 'Tên mới' && me2.body?.role === 'FARMER', me2.body);

  const unknown = await call('GET', '/api/khong-ton-tai');
  check('Đường dẫn lạ -> 404 NOT_FOUND cùng định dạng lỗi', unknown.status === 404 && unknown.body?.code === 'NOT_FOUND', unknown);

  console.log('\n[Kiểm tra trong CSDL]');
  const u = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
  const hash = u.rows[0]?.password_hash || '';
  check('Mật khẩu lưu dạng bcrypt, không phải văn bản thuần', hash.startsWith('$2') && hash !== password, hash.slice(0, 7));
  const a = await pool.query(`SELECT action, count(*)::int AS n FROM audit_logs WHERE entity_type = 'USER' AND entity_id = $1 GROUP BY action`, [userId]);
  const counts = Object.fromEntries(a.rows.map((r) => [r.action, r.n]));
  check('Audit: REGISTER 1, UPDATE 1, LOGIN_FAILED 1', counts.REGISTER === 1 && counts.UPDATE === 1 && counts.LOGIN_FAILED === 1, counts);

  await pool.end();
  console.log(failed === 0 ? '\nTẤT CẢ ĐỀU PASS' : `\n${failed} KIỂM TRA THẤT BẠI`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Lỗi khi chạy:', err);
  try { await pool.end(); } catch (_) { /* bỏ qua */ }
  process.exit(1);
});
