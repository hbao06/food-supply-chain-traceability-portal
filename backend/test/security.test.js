'use strict';

// Kiểm thử rà soát bảo mật W7-TV3 (docs/security/security-checklist.md).
// Không cần CSDL hay Express: đọc mã nguồn / OpenAPI và gọi trực tiếp các hàm thuần.
//   SEC-01 mọi route nội bộ có requireAuth + requirePermission
//   SEC-02 DTO trả ra ngoài chỉ có trường được phép (không hash, chữ ký, email của người khác...)
//   SEC-03 OpenAPI không khai báo trường nhạy cảm trong phản hồi
//   SEC-04 che email trong audit đăng nhập sai
//   SEC-05 CORS chỉ cho nguồn được cấu hình
//   SEC-06 câu SQL cấp mã lô dùng đúng biểu thức của chỉ mục idx_batches_code_year_seq

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// ---------------------------------------------------------------------------
// SEC-01 – route
// ---------------------------------------------------------------------------
// Route công khai được phép (không cần đăng nhập). Thêm route công khai mới (ví dụ /trace) thì phải ghi vào đây
// và vào mục 2 của security-checklist.md – để việc mở một đường dẫn ra ngoài luôn là quyết định có chủ đích.
const PUBLIC_ROUTES = new Set([
  'authRouter POST /register',
  'authRouter POST /login',
  'traceRouter GET /code/:batchCode',
  'traceRouter GET /:qrToken',
]);

function routeFiles() {
  const dir = path.join(SRC, 'modules');
  return fs.readdirSync(dir).flatMap((m) => fs.readdirSync(path.join(dir, m))
    .filter((f) => f.endsWith('.routes.js')).map((f) => path.join(dir, m, f)));
}

function declaredRoutes() {
  const re = /^\s*(\w+Router)\.(get|post|patch|put|delete)\(\s*(['"])([^'"]*)\3\s*,(.*)$/gm;
  return routeFiles().flatMap((file) => [...read(file).matchAll(re)].map((m) => ({
    file: path.basename(file), key: `${m[1]} ${m[2].toUpperCase()} ${m[4]}`, handlers: m[5],
  })));
}

test('SEC-01: tìm thấy đủ các route đã khai báo (bảo đảm bộ quét không bỏ sót)', () => {
  const keys = declaredRoutes().map((r) => r.key);
  for (const k of ['authRouter POST /login', 'profileRouter GET /me', 'batchesRouter POST /', 'eventsRouter POST /',
    'timelineRouter GET /', 'auditRouter GET /verify']) {
    assert.ok(keys.includes(k), `không thấy route ${k}`);
  }
});

test('SEC-01: mọi route không công khai có requireAuth và requirePermission(...) đúng thứ tự', () => {
  for (const r of declaredRoutes()) {
    if (PUBLIC_ROUTES.has(r.key)) continue;
    const auth = r.handlers.indexOf('requireAuth');
    const perm = r.handlers.indexOf('requirePermission(');
    // /api/users/me chỉ đọc / sửa hồ sơ của CHÍNH người gọi (theo req.auth.userId) nên chỉ cần requireAuth.
    if (r.key.startsWith('profileRouter ')) { assert.ok(auth >= 0, `${r.file}: ${r.key} thiếu requireAuth`); continue; }
    assert.ok(auth >= 0, `${r.file}: ${r.key} thiếu requireAuth`);
    assert.ok(perm > auth, `${r.file}: ${r.key} thiếu requirePermission sau requireAuth`);
  }
});

test('SEC-01: app.js không khai báo route nghiệp vụ trực tiếp ngoài /api/health', () => {
  const direct = [...read(path.join(SRC, 'app.js')).matchAll(/app\.(get|post|patch|put|delete)\(\s*["']([^"']+)/g)].map((m) => m[2]);
  assert.deepEqual(direct, ['/api/health']);
});

test('SEC-01: requireAuth của mọi module đều đọc lại tài khoản từ CSDL (loadCurrentUser)', () => {
  for (const file of routeFiles()) {
    const src = read(file);
    const m = src.match(/const requireAuth = \[([^\]]*)\]/);
    if (m) assert.match(m[1], /createLoadCurrentUser/, `${path.basename(file)}: requireAuth thiếu loadCurrentUser`);
  }
});

// ---------------------------------------------------------------------------
// SEC-02 – DTO
// ---------------------------------------------------------------------------
// Hàng CSDL "đầy đủ" có thêm các cột nhạy cảm: DTO phải bỏ qua chúng.
const LEAKY = {
  password_hash: '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', signature_hmac: 'sig', qr_data: 'https://x/trace/t',
  prev_hash: 'a'.repeat(64), row_hash: 'b'.repeat(64), chain_seq: '9', actor_email: 'x@y.vn', updated_at: new Date(0),
};
const SENSITIVE_OUT = /password|hash|signature|secret|token|chain/i;

function assertOnlyKeys(dto, keys, label) {
  assert.deepEqual(Object.keys(dto).sort(), [...keys].sort(), `${label}: trường trả ra khác danh sách cho phép`);
  assert.ok(!Object.keys(dto).some((k) => SENSITIVE_OUT.test(k)), `${label}: có trường nhạy cảm`);
}

test('SEC-02: DTO người dùng / lô / sự kiện / audit chỉ có trường được phép', () => {
  const { toUserDto } = require('../src/modules/auth/auth.service');
  const { toBatchDto } = require('../src/modules/batches/batches.service');
  const { toEventDto } = require('../src/modules/events/events.service');
  const { toAuditDto } = require('../src/modules/audit/audit.service');

  assertOnlyKeys(toUserDto({ ...LEAKY, user_id: '1', name: 'A', email: 'a@x.vn', role: 'FARMER', organization_id: '1', status: 'ACTIVE' }),
    ['userId', 'name', 'email', 'role', 'organizationId', 'status'], 'User');
  assertOnlyKeys(toBatchDto({ ...LEAKY, batch_id: '1', batch_code: 'BATCH-2026-0001', product_name: 'X', origin: 'Y', quantity: '1',
    creation_date: new Date(0), current_status: 'CREATED', created_by: '2', organization_id: '1' }),
  ['batchId', 'batchCode', 'productName', 'origin', 'quantity', 'creationDate', 'currentStatus', 'createdBy', 'organizationId'], 'Batch');
  const ev = toEventDto({ ...LEAKY, event_id: '1', batch_id: '1', actor_id: '2', event_type: 'CREATED', timestamp: new Date(0),
    location: 'L', description: null, actor_name: 'A', organization_name: 'O' });
  assertOnlyKeys(ev, ['eventId', 'batchId', 'actorId', 'eventType', 'timestamp', 'location', 'description', 'actorName', 'organizationName'], 'Event');
  assert.ok(!JSON.stringify(ev).includes('x@y.vn'), 'Event: lộ email người ghi');
  assertOnlyKeys(toAuditDto({ ...LEAKY, audit_id: '1', actor_id: null, actor_name: null, action: 'UPDATE', entity_type: 'USER',
    entity_id: '1', old_value: null, new_value: null, created_at: new Date(0) }),
  ['auditId', 'actorId', 'actorName', 'action', 'entityType', 'entityId', 'oldValue', 'newValue', 'createdAt'], 'AuditLog');
});

test('SEC-02: câu SQL đọc người dùng cho hồ sơ không đi kèm JOIN lộ dữ liệu người khác; sự kiện không SELECT email', () => {
  const events = read(path.join(SRC, 'modules/events/events.repository.js'));
  assert.ok(!/u\.email|password_hash/.test(events), 'events.repository không được đọc email / hash của người ghi');
  const batches = read(path.join(SRC, 'modules/batches/batches.repository.js'));
  assert.ok(!/signature_hmac\s*(,|FROM)/.test(batches.split('RETURNING qr_id')[1] || ''), 'không trả signature_hmac của QR');
});

// ---------------------------------------------------------------------------
// SEC-03 – OpenAPI
// ---------------------------------------------------------------------------
test('SEC-03: OpenAPI không có thuộc tính nhạy cảm trong schema phản hồi', () => {
  const spec = read(path.join(ROOT, 'docs/openapi-spec.yaml'));
  const schemas = spec.slice(spec.indexOf('\n  schemas:'));
  // Chỉ các yêu cầu đăng ký / đăng nhập được có "password"; không schema nào có hash / chữ ký / secret.
  const props = [...schemas.matchAll(/^ {8}(\w+):\s*$/gm)].map((m) => m[1]);
  const bad = props.filter((p) => /hash|signature|secret|salt/i.test(p));
  assert.deepEqual(bad, []);
  const pw = props.filter((p) => /password/i.test(p));
  assert.ok(pw.length <= 2, `chỉ RegisterRequest / LoginRequest được có password, thấy ${pw.length}`);
});

// ---------------------------------------------------------------------------
// SEC-04 – che email
// ---------------------------------------------------------------------------
test('SEC-04: maskEmail giữ tên miền và tối đa 2 ký tự đầu', () => {
  const { maskEmail } = require('../src/modules/audit/audit.sanitize');
  assert.equal(maskEmail('NguyenVanA@Gmail.com'), 'ng***@gmail.com');
  assert.equal(maskEmail('ab@x.vn'), 'a***@x.vn');
  assert.equal(maskEmail('a@x.vn'), 'a***@x.vn');
  assert.equal(maskEmail('khong-phai-email'), '***');
  assert.equal(maskEmail('@x.vn'), '***');
  assert.equal(maskEmail(undefined), '***');
  assert.ok(!maskEmail('MatKhau123@gmail.com').includes('MatKhau'));
});

// ---------------------------------------------------------------------------
// SEC-05 – CORS
// ---------------------------------------------------------------------------
test('SEC-05: CORS mặc định chỉ cho frontend localhost:5173; CORS_ORIGIN cấu hình được', async () => {
  const { buildCorsOptions, parseOrigins } = require('../src/middleware/corsOptions');
  const check = (opts, origin) => new Promise((resolve) => opts.origin(origin, (err, ok) => resolve(ok)));

  const def = buildCorsOptions({});
  assert.equal(await check(def, 'http://localhost:5173'), true);
  assert.equal(await check(def, 'https://evil.example'), false);
  assert.equal(await check(def, 'http://localhost:5173.evil.example'), false); // không khớp một phần
  assert.equal(await check(def, undefined), true); // cùng nguồn / curl: không có header Origin

  const custom = buildCorsOptions({ CORS_ORIGIN: 'https://trace.example.vn/, http://localhost:5173' });
  assert.equal(await check(custom, 'https://trace.example.vn'), true);
  assert.deepEqual(parseOrigins(' '), ['http://localhost:5173']);
  assert.equal(buildCorsOptions({ CORS_ORIGIN: '*' }).origin, true);
  assert.deepEqual(def.methods, ['GET', 'POST', 'PATCH']);
});

// ---------------------------------------------------------------------------
// SEC-06 – chỉ mục batch_code
// ---------------------------------------------------------------------------
test('SEC-06: nextBatchCode dùng đúng biểu thức của chỉ mục idx_batches_code_year_seq (migration 007)', async () => {
  const migration = read(path.join(ROOT, 'database/migrations/007_query_indexes.sql'));
  const yearExpr = "split_part(batch_code, '-', 2)::int";
  const seqExpr = "split_part(batch_code, '-', 3)::int";
  assert.ok(migration.includes(`((${yearExpr}), (${seqExpr}) DESC)`), 'migration 007 đổi biểu thức chỉ mục');

  const repo = require('../src/modules/batches/batches.repository');
  const calls = [];
  const db = { async query(sql, params) { calls.push(sql); return { rows: [{ year: 2026, max_seq: 9999 }] }; } };
  assert.equal(await repo.nextBatchCode(db), 'BATCH-2026-10000');
  const sql = calls[0].replace(/\s+/g, ' ');
  assert.ok(sql.includes(`WHERE ${yearExpr} = EXTRACT(YEAR FROM now())::int`), 'điều kiện năm phải khớp biểu thức chỉ mục');
  assert.ok(sql.includes(`ORDER BY ${seqExpr} DESC LIMIT 1`), 'sắp xếp phải khớp biểu thức chỉ mục');
  assert.ok(!/LIKE/i.test(sql), 'không dùng LIKE (không dùng được btree với collation en_US)');
});

test('SEC-06: nextBatchCode năm mới bắt đầu từ 0001', async () => {
  const repo = require('../src/modules/batches/batches.repository');
  const db = { async query() { return { rows: [{ year: 2027, max_seq: 0 }] }; } };
  assert.equal(await repo.nextBatchCode(db), 'BATCH-2027-0001');
});

test('SEC-06: tìm kiếm bằng đủ mã lô dùng so khớp đúng (chỉ mục UNIQUE), từ khóa khác dùng ILIKE', async () => {
  const repo = require('../src/modules/batches/batches.repository');
  const run = async (q) => {
    const calls = [];
    const db = { async query(sql, params) { calls.push({ sql: sql.replace(/\s+/g, ' '), params }); return { rows: [{ total: 0 }] }; } };
    await repo.listVisibleBatches(db, { role: 'ADMIN' }, { q, limit: 20, offset: 0 });
    return calls[1];
  };
  const code = await run('batch-2026-0420');
  assert.match(code.sql, /\(b\.batch_code = \$1 OR b\.product_name ILIKE \$2\)/);
  assert.deepEqual(code.params.slice(0, 2), ['BATCH-2026-0420', '%batch-2026-0420%']);
  const word = await run('50%_cà');
  assert.match(word.sql, /\(b\.product_name ILIKE \$1 OR b\.batch_code ILIKE \$1\)/);
  assert.equal(word.params[0], '%50\\%\\_cà%'); // ký tự đại diện của LIKE được thoát
  assert.equal(repo.FULL_BATCH_CODE.test('BATCH-2026-04'), false); // mã chưa đủ -> tìm chứa chuỗi như cũ
});
