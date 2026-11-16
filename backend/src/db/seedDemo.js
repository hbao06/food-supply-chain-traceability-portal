'use strict';

// Dữ liệu mẫu cho phát triển, demo và kiểm thử (W5-TV3; W8-TV3 bổ sung lô 0004, 0005 cho đủ 6 trạng thái,
// bỏ biển số xe khỏi mô tả sự kiện, không ghi email vào audit; CSDL đã seed bản cũ thì chạy lại để thêm lô còn thiếu).
// Theo bảng "Dữ liệu mẫu" trong docs/test/test-plan.md mục 3 (TV4):
//   farmer_a, farmer_b, processor_a, distributor_a, admin_1, user_pending, user_locked,
//   BATCH-2026-0001 (A, CREATED, có QR), BATCH-2026-0002 (A, đã rời CREATED), BATCH-2026-0101 (B).
//
// Mọi dòng đi qua đúng các ràng buộc và trigger của CSDL (vai trò, thứ tự sự kiện, append-only...),
// nên dữ liệu mẫu cũng là một lần kiểm tra schema. Chạy trong MỘT transaction (scripts/seed-demo.js).
// Chạy lại an toàn: đã có dữ liệu mẫu thì bỏ qua, không tạo trùng.

const crypto = require('crypto');

const MARKER_ORG = 'HTX Cà phê Cầu Đất';
const BATCH_CODE_LOCK = 2026_0501; // cùng khóa với modules/batches (cấp mã lô), tránh tạo lô song song

const ORGS = [
  { key: 'farmA', name: MARKER_ORG, type: 'FARM', address: 'Cầu Đất, Đà Lạt, Lâm Đồng' },
  { key: 'farmB', name: 'Nông trại Sầu riêng Cái Mơn', type: 'FARM', address: 'Chợ Lách, Bến Tre' },
  { key: 'proc', name: 'Công ty Chế biến Nông sản Sài Gòn', type: 'PROCESSOR', address: 'KCN Tân Bình, TP.HCM' },
  { key: 'distA', name: 'Vận tải Lạnh Miền Nam', type: 'DISTRIBUTOR', address: 'Quận 7, TP.HCM' },
  { key: 'distB', name: 'Phân phối Thực phẩm Sạch Hà Nội', type: 'DISTRIBUTOR', address: 'Long Biên, Hà Nội' },
];

// key = mã trong test plan. Email dùng miền demo.local để không trùng tài khoản thật.
const USERS = [
  { key: 'admin_1', name: 'Quản trị Demo', email: 'admin_1@demo.local', role: 'ADMIN', status: 'ACTIVE', org: null },
  { key: 'farmer_a', name: 'Nguyễn Văn An', email: 'farmer_a@demo.local', role: 'FARMER', status: 'ACTIVE', org: 'farmA' },
  { key: 'farmer_b', name: 'Trần Thị Bình', email: 'farmer_b@demo.local', role: 'FARMER', status: 'ACTIVE', org: 'farmB' },
  { key: 'processor_a', name: 'Lê Văn Chế', email: 'processor_a@demo.local', role: 'PROCESSOR', status: 'ACTIVE', org: 'proc' },
  { key: 'distributor_a', name: 'Phạm Văn Dũng', email: 'distributor_a@demo.local', role: 'DISTRIBUTOR', status: 'ACTIVE', org: 'distA' },
  { key: 'distributor_b', name: 'Hoàng Thị Em', email: 'distributor_b@demo.local', role: 'DISTRIBUTOR', status: 'ACTIVE', org: 'distB' },
  { key: 'user_pending', name: 'Đỗ Văn Chờ', email: 'user_pending@demo.local', role: 'FARMER', status: 'PENDING', org: null },
  { key: 'user_locked', name: 'Vũ Văn Khóa', email: 'user_locked@demo.local', role: 'DISTRIBUTOR', status: 'LOCKED', org: 'distA' },
];

const PRODUCTS = [
  { key: 'arabica', org: 'farmA', name: 'Cà phê Arabica Cầu Đất', category: 'Cà phê', unit: 'kg', description: 'Arabica trồng ở độ cao 1.600 m, sơ chế ướt' },
  { key: 'robusta', org: 'farmA', name: 'Cà phê Robusta rang xay', category: 'Cà phê', unit: 'kg', description: 'Robusta rang mộc, xay sẵn' },
  { key: 'durian', org: 'farmB', name: 'Sầu riêng Ri6', category: 'Trái cây', unit: 'kg', description: 'Sầu riêng Ri6 chín cây' },
];

// days: số ngày trước hôm nay của lúc tạo lô; mỗi bước sau cách nhau 1 ngày.
const BATCHES = [
  { code: 'BATCH-2026-0001', product: 'arabica', farmer: 'farmer_a', origin: 'Cầu Đất, Đà Lạt', quantity: 500, days: 2,
    steps: [] },
  { code: 'BATCH-2026-0002', product: 'robusta', farmer: 'farmer_a', origin: 'Cầu Đất, Đà Lạt', quantity: 300, days: 12,
    steps: [
      ['TRANSPORTED', 'distributor_a', 'QL20, Đà Lạt → TP.HCM', 'Xe lạnh 2–8°C'],
      ['RECEIVED', 'distributor_a', 'Kho Quận 7, TP.HCM', 'Nhận đủ 300 kg'],
      ['PROCESSED', 'processor_a', 'Xưởng Tân Bình', 'Rang mộc 220°C'],
      ['PACKAGED', 'processor_a', 'Xưởng Tân Bình', 'Đóng túi 500 g'],
      ['SHIPPED', 'distributor_a', 'Siêu thị Quận 1, TP.HCM', 'Giao siêu thị'],
    ] },
  { code: 'BATCH-2026-0003', product: 'arabica', farmer: 'farmer_a', origin: 'Cầu Đất, Đà Lạt', quantity: 200, days: 6,
    steps: [
      ['TRANSPORTED', 'distributor_a', 'QL20, Đà Lạt → TP.HCM', null],
      ['RECEIVED', 'distributor_a', 'Kho Quận 7, TP.HCM', 'Chờ chuyển xưởng chế biến'],
    ] },
  // W8: hai lô thêm để demo đủ 6 trạng thái và để Distributor B (Hà Nội) có dữ liệu.
  { code: 'BATCH-2026-0004', product: 'arabica', farmer: 'farmer_a', origin: 'Cầu Đất, Đà Lạt', quantity: 120, days: 3,
    steps: [
      ['TRANSPORTED', 'distributor_b', 'QL20 → QL1A, Đà Lạt → Hà Nội', 'Xe lạnh 2–8°C'],
    ] },
  { code: 'BATCH-2026-0005', product: 'robusta', farmer: 'farmer_a', origin: 'Cầu Đất, Đà Lạt', quantity: 250, days: 8,
    steps: [
      ['TRANSPORTED', 'distributor_a', 'QL20, Đà Lạt → TP.HCM', null],
      ['RECEIVED', 'distributor_a', 'Kho Quận 7, TP.HCM', null],
      ['PROCESSED', 'processor_a', 'Xưởng Tân Bình', 'Rang vừa 210°C'],
    ] },
  { code: 'BATCH-2026-0101', product: 'durian', farmer: 'farmer_b', origin: 'Chợ Lách, Bến Tre', quantity: 1000, days: 9,
    steps: [
      ['TRANSPORTED', 'distributor_a', 'QL57, Bến Tre → TP.HCM', 'Xe lạnh 2–5°C'],
      ['RECEIVED', 'distributor_a', 'Kho Quận 7, TP.HCM', null],
      ['PROCESSED', 'processor_a', 'Xưởng Tân Bình', 'Tách múi, cấp đông'],
      ['PACKAGED', 'processor_a', 'Xưởng Tân Bình', 'Hộp 400 g'],
    ] },
  { code: 'BATCH-2026-0102', product: 'durian', farmer: 'farmer_b', origin: 'Chợ Lách, Bến Tre', quantity: 150, days: 1,
    steps: [] },
];

// QR theo SRS P1 (giống backend/src/common/qrToken.js của W5-TV2):
//   signature = base64url(HMAC-SHA256(QR_HMAC_SECRET, batch_code)); qrData = <TRACE_BASE_URL>/trace/<batch_code>.<signature>
function createSeedQr({ secret, baseUrl = 'http://localhost:5173' }) {
  if (!secret || secret.length < 32) throw new Error('QR_HMAC_SECRET chưa được cấu hình (cần tối thiểu 32 ký tự)');
  const signature = (code) => crypto.createHmac('sha256', secret).update(code, 'utf8').digest('base64url');
  const url = (code) => `${baseUrl.replace(/\/+$/, '')}/trace/${code}.${signature(code)}`;
  return { signature, url };
}

const DAY = 24 * 60 * 60 * 1000;

// Tạo một lô mẫu: batches -> qr_codes -> sự kiện (CREATED + các bước) -> audit, đi qua đủ trigger của CSDL.
async function insertBatch(db, b, { orgId, userId, productId, qr, now, audit }) {
  const farmer = USERS.find((u) => u.key === b.farmer);
  const createdAt = new Date(now.getTime() - b.days * DAY);
  // product_name để NULL: trigger trg_batches_a_product tự lấy tên từ products.
  const r = await db.query(
    `INSERT INTO batches (batch_code, product_id, origin, quantity, creation_date, created_by, organization_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING batch_id`,
    [b.code, productId[b.product], b.origin, b.quantity, createdAt.toISOString(), userId[b.farmer], orgId[farmer.org]]
  );
  const batchId = Number(r.rows[0].batch_id);
  await audit(userId[b.farmer], 'BATCH', batchId, { batchCode: b.code, quantity: b.quantity });

  const q = await db.query(
    'INSERT INTO qr_codes (batch_id, qr_data, signature_hmac) VALUES ($1, $2, $3) RETURNING qr_id',
    [batchId, qr.url(b.code), qr.signature(b.code)]
  );
  await audit(userId[b.farmer], 'QR_CODE', Number(q.rows[0].qr_id), { batchId });

  const events = [['CREATED', b.farmer, b.origin, 'Thu hoạch, tạo lô']].concat(b.steps);
  for (let i = 0; i < events.length; i++) {
    const [type, actor, location, description] = events[i];
    const at = new Date(createdAt.getTime() + i * DAY);
    const e = await db.query(
      `INSERT INTO supply_chain_events (batch_id, actor_id, event_type, "timestamp", location, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING event_id`,
      [batchId, userId[actor], type, at.toISOString(), location, description]
    );
    await audit(userId[actor], 'EVENT', Number(e.rows[0].event_id), { batchId, eventType: type });
  }
  return { code: b.code, status: events[events.length - 1][0], farm: farmer.org };
}

// CSDL đã có dữ liệu mẫu của tuần trước (W5): chỉ thêm các lô mẫu còn thiếu (W8: 0004, 0005), dùng lại
// đơn vị / tài khoản / sản phẩm mẫu đã có. Không sửa dữ liệu cũ (lịch sử và audit chỉ ghi thêm).
// Thiếu đơn vị / tài khoản / sản phẩm mẫu (bị đổi tên, xóa...) thì dừng và hướng dẫn tạo lại CSDL.
async function upgradeDemo(db, { qr, now, audit }) {
  const existing = await db.query('SELECT batch_code FROM batches WHERE batch_code = ANY($1::text[])', [BATCHES.map((b) => b.code)]);
  const have = new Set(existing.rows.map((r) => r.batch_code));
  const missing = BATCHES.filter((b) => !have.has(b.code));
  if (!missing.length) return { created: false, added: [] };

  const orgs = await db.query(
    'SELECT organization_id, name, type FROM organizations WHERE name = ANY($1::text[])', [ORGS.map((o) => o.name)]);
  const orgId = {};
  for (const o of ORGS) {
    const row = orgs.rows.find((r) => r.name === o.name && r.type === o.type);
    if (row) orgId[o.key] = Number(row.organization_id);
  }
  const users = await db.query(
    'SELECT user_id, lower(email) AS email, status FROM users WHERE lower(email) = ANY($1::text[])', [USERS.map((u) => u.email)]);
  const userId = {};
  for (const u of USERS) {
    const row = users.rows.find((r) => r.email === u.email);
    if (row && row.status === u.status) userId[u.key] = Number(row.user_id);
  }
  const products = await db.query(
    'SELECT product_id, organization_id, name FROM products WHERE name = ANY($1::text[])', [PRODUCTS.map((p) => p.name)]);
  const productId = {};
  for (const p of PRODUCTS) {
    const row = products.rows.find((r) => r.name === p.name && Number(r.organization_id) === orgId[p.org]);
    if (row) productId[p.key] = Number(row.product_id);
  }

  const lacking = new Set();
  for (const b of missing) {
    const farmer = USERS.find((u) => u.key === b.farmer);
    if (orgId[farmer.org] === undefined) lacking.add(`đơn vị ${ORGS.find((o) => o.key === farmer.org).name}`);
    if (productId[b.product] === undefined) lacking.add(`sản phẩm ${PRODUCTS.find((p) => p.key === b.product).name}`);
    for (const key of [b.farmer, ...b.steps.map((s) => s[1])]) {
      if (userId[key] === undefined) lacking.add(`tài khoản ${USERS.find((u) => u.key === key).email} (${USERS.find((u) => u.key === key).status})`);
    }
  }
  if (lacking.size) {
    throw new Error(`CSDL có dữ liệu mẫu cũ nhưng thiếu hoặc đã đổi: ${[...lacking].join(', ')}. `
      + 'Không thêm được lô mẫu mới; hãy tạo lại CSDL demo (database/Readme.md, mục "Chuẩn bị CSDL sạch để demo").');
  }

  const added = [];
  for (const b of missing) added.push(await insertBatch(db, b, { orgId, userId, productId, qr, now, audit }));
  return { created: false, added };
}

async function seedDemo(db, { passwordHash, qr, now = new Date() }) {
  if (typeof passwordHash !== 'string' || !/^\$2[aby]\$/.test(passwordHash)) {
    throw new Error('passwordHash phải là bcrypt hash');
  }
  await db.query('SELECT pg_advisory_xact_lock($1)', [BATCH_CODE_LOCK]);

  const audit = (actorId, entityType, entityId, newValue) =>
    db.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_value) VALUES ($1, 'CREATE', $2, $3, $4)`,
      [actorId, entityType, entityId, { ...newValue, source: 'seed' }]
    );

  const marker = await db.query('SELECT organization_id FROM organizations WHERE name = $1 AND type = $2', [MARKER_ORG, 'FARM']);
  if (marker.rows[0]) return upgradeDemo(db, { qr, now, audit });

  const codes = BATCHES.map((b) => b.code);
  const taken = await db.query('SELECT batch_code FROM batches WHERE batch_code = ANY($1::text[])', [codes]);
  if (taken.rows.length) {
    throw new Error(`Mã lô ${taken.rows.map((r) => r.batch_code).join(', ')} đã được dùng. Dữ liệu mẫu cần CSDL chưa có các mã này.`);
  }
  const emails = USERS.map((u) => u.email);
  const takenEmails = await db.query('SELECT email FROM users WHERE lower(email) = ANY($1::text[])', [emails]);
  if (takenEmails.rows.length) {
    throw new Error(`Email ${takenEmails.rows.map((r) => r.email).join(', ')} đã tồn tại.`);
  }

  const orgId = {};
  for (const o of ORGS) {
    const r = await db.query(
      'INSERT INTO organizations (name, type, address) VALUES ($1, $2, $3) RETURNING organization_id',
      [o.name, o.type, o.address]
    );
    orgId[o.key] = Number(r.rows[0].organization_id);
    await audit(null, 'ORGANIZATION', orgId[o.key], { name: o.name, type: o.type });
  }

  const userId = {};
  for (const u of USERS) {
    const r = await db.query(
      `INSERT INTO users (name, email, password_hash, role, status, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id`,
      [u.name, u.email, passwordHash, u.role, u.status, u.org ? orgId[u.org] : null]
    );
    userId[u.key] = Number(r.rows[0].user_id);
    // Không ghi email: audit không xóa được, email đã có trong bảng users (cùng quy tắc với REGISTER, W7).
    await audit(null, 'USER', userId[u.key], { name: u.name, role: u.role, status: u.status });
  }

  const productId = {};
  for (const p of PRODUCTS) {
    const r = await db.query(
      `INSERT INTO products (organization_id, name, category, unit, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING product_id`,
      [orgId[p.org], p.name, p.category, p.unit, p.description]
    );
    productId[p.key] = Number(r.rows[0].product_id);
  }

  const batches = [];
  for (const b of BATCHES) {
    batches.push(await insertBatch(db, b, { orgId, userId, productId, qr, now, audit }));
  }

  return {
    created: true,
    organizations: ORGS.length,
    users: USERS.map((u) => ({ key: u.key, email: u.email, role: u.role, status: u.status })),
    products: PRODUCTS.length,
    batches,
  };
}

module.exports = { seedDemo, createSeedQr, ORGS, USERS, PRODUCTS, BATCHES, MARKER_ORG };
