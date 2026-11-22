'use strict';

// Nạp 5 sản phẩm & lô nông sản thật vào PostgreSQL qua đúng ràng buộc và trigger CSDL.
// Chạy an toàn nhiều lần (idempotent): đơn vị, tài khoản, sản phẩm hoặc mã lô đã có sẽ được dùng lại / bỏ qua.

const { sanitizeAuditValue } = require('../modules/audit/audit.sanitize');

const BATCH_CODE_LOCK = 2026_0501; // cùng khóa advisory với batches.repository.js
const DAY = 24 * 60 * 60 * 1000;

const ORGS = [
  { key: 'farmCoffee', name: 'HTX Cà phê Arabica Cầu Đất', type: 'FARM', address: 'Cầu Đất, Đà Lạt, Lâm Đồng' },
  { key: 'farmRice', name: 'HTX Lúa gạo ST25 Mỹ Xuyên', type: 'FARM', address: 'Mỹ Xuyên, Sóc Trăng' },
  { key: 'farmCashew', name: 'HTX Hạt điều Bù Đăng', type: 'FARM', address: 'Bù Đăng, Bình Phước' },
  { key: 'farmDragon', name: 'HTX Thanh long Chợ Gạo', type: 'FARM', address: 'Chợ Gạo, Tiền Giang' },
  { key: 'farmTea', name: 'HTX Chè Ô Long Mộc Châu', type: 'FARM', address: 'Mộc Châu, Sơn La' },
  { key: 'processor', name: 'Nhà máy Chế biến Nông sản Việt', type: 'PROCESSOR', address: 'KCN Tân Bình, TP.HCM' },
  { key: 'distributor', name: 'Công ty Vận tải Lạnh Nông sản Việt', type: 'DISTRIBUTOR', address: 'Quận 7, TP.HCM' },
];

const USERS = [
  { key: 'farmer_coffee', name: 'Nguyễn Văn An', email: 'nongtrai.caphe@foodtrace.vn', role: 'FARMER', status: 'ACTIVE', org: 'farmCoffee' },
  { key: 'farmer_rice', name: 'Lâm Thị Cúc', email: 'nongtrai.gao@foodtrace.vn', role: 'FARMER', status: 'ACTIVE', org: 'farmRice' },
  { key: 'farmer_cashew', name: 'Điểu Văn Dũng', email: 'nongtrai.hatdieu@foodtrace.vn', role: 'FARMER', status: 'ACTIVE', org: 'farmCashew' },
  { key: 'farmer_dragon', name: 'Võ Minh Tâm', email: 'nongtrai.thanhlong@foodtrace.vn', role: 'FARMER', status: 'ACTIVE', org: 'farmDragon' },
  { key: 'farmer_tea', name: 'Hà Thị Mai', email: 'nongtrai.che@foodtrace.vn', role: 'FARMER', status: 'ACTIVE', org: 'farmTea' },
  { key: 'processor_main', name: 'Lê Văn Chế', email: 'chebien@foodtrace.vn', role: 'PROCESSOR', status: 'ACTIVE', org: 'processor' },
  { key: 'distributor_main', name: 'Phạm Văn Dũng', email: 'phanphoi@foodtrace.vn', role: 'DISTRIBUTOR', status: 'ACTIVE', org: 'distributor' },
];

const PRODUCTS = [
  { key: 'coffee', org: 'farmCoffee', name: 'Cà phê Arabica Cầu Đất', category: 'Cà phê', unit: 'kg', imageUrl: '/products/coffee.jpg', description: 'Cà phê Arabica trồng ở độ cao 1.600 m, sơ chế ướt đạt chuẩn VietGAP' },
  { key: 'rice', org: 'farmRice', name: 'Gạo ST25 Sóc Trăng', category: 'Lúa gạo', unit: 'kg', imageUrl: '/products/rice.jpg', description: 'Gạo ST25 canh tác luân canh tôm - lúa theo quy trình hữu cơ' },
  { key: 'cashew', org: 'farmCashew', name: 'Hạt điều rang muối Bình Phước', category: 'Hạt dinh dưỡng', unit: 'kg', imageUrl: '/products/cashew.jpg', description: 'Hạt điều nguyên hạt cỡ W240 rang củi truyền thống' },
  { key: 'dragon', org: 'farmDragon', name: 'Thanh long ruột đỏ Chợ Gạo', category: 'Trái cây', unit: 'kg', imageUrl: '/products/dragonfruit.jpg', description: 'Thanh long ruột đỏ đạt chuẩn VietGAP, độ ngọt Brix 15' },
  { key: 'tea', org: 'farmTea', name: 'Chè Ô Long Mộc Châu', category: 'Trà', unit: 'kg', imageUrl: '/products/tea.jpg', description: 'Chè Ô Long búp một tôm hai lá thu hái trên cao nguyên Mộc Châu' },
];

const BATCHES = [
  {
    code: 'FR-2026-0001',
    product: 'coffee',
    farmer: 'farmer_coffee',
    origin: 'Cầu Đất, Đà Lạt, Lâm Đồng',
    quantity: 500,
    days: 12,
    steps: [
      ['TRANSPORTED', 'distributor_main', 'QL20, Đà Lạt → TP.HCM', 'Xe lạnh chuyên dụng duy trì 2–8°C'],
      ['RECEIVED', 'distributor_main', 'Kho Quận 7, TP.HCM', 'Tiếp nhận đủ 500 kg, đạt độ ẩm tiêu chuẩn'],
      ['PROCESSED', 'processor_main', 'Nhà máy KCN Tân Bình, TP.HCM', 'Rang mộc 220°C theo quy trình HACCP'],
      ['PACKAGED', 'processor_main', 'Nhà máy KCN Tân Bình, TP.HCM', 'Đóng túi van một chiều 500 g và dán tem QR'],
      ['SHIPPED', 'distributor_main', 'Hệ thống Siêu thị Quận 1, TP.HCM', 'Xuất kho phân phối tới điểm bán lẻ'],
    ],
  },
  {
    code: 'FR-2026-0002',
    product: 'rice',
    farmer: 'farmer_rice',
    origin: 'Mỹ Xuyên, Sóc Trăng',
    quantity: 2000,
    days: 10,
    steps: [
      ['TRANSPORTED', 'distributor_main', 'QL1A, Sóc Trăng → TP.HCM', 'Xe tải thùng kín đạt chuẩn vệ sinh thực phẩm'],
      ['RECEIVED', 'distributor_main', 'Kho Quận 7, TP.HCM', 'Kiểm tra độ ẩm 14% và cảm quan hạt gạo'],
      ['PROCESSED', 'processor_main', 'Nhà máy KCN Tân Bình, TP.HCM', 'Xát trắng, đánh bóng và tách tạp chất'],
      ['PACKAGED', 'processor_main', 'Nhà máy KCN Tân Bình, TP.HCM', 'Đóng túi hút chân không 5 kg chuẩn xuất khẩu'],
      ['SHIPPED', 'distributor_main', 'Hệ thống Siêu thị Quận 3, TP.HCM', 'Xuất kho giao tới các cửa hàng phân phối'],
    ],
  },
  {
    code: 'FR-2026-0003',
    product: 'cashew',
    farmer: 'farmer_cashew',
    origin: 'Bù Đăng, Bình Phước',
    quantity: 800,
    days: 8,
    steps: [
      ['TRANSPORTED', 'distributor_main', 'QL14, Bình Phước → TP.HCM', 'Vận chuyển đường bộ đóng bao kín'],
      ['RECEIVED', 'distributor_main', 'Kho Quận 7, TP.HCM', 'Kiểm định phân cỡ hạt điều nguyên W240'],
      ['PROCESSED', 'processor_main', 'Nhà máy KCN Tân Bình, TP.HCM', 'Rang củi truyền thống và ướp muối nhẹ'],
      ['PACKAGED', 'processor_main', 'Nhà máy KCN Tân Bình, TP.HCM', 'Đóng hũ thủy tinh 500 g và niêm phong tem QR'],
    ],
  },
  {
    code: 'FR-2026-0004',
    product: 'dragon',
    farmer: 'farmer_dragon',
    origin: 'Chợ Gạo, Tiền Giang',
    quantity: 1500,
    days: 5,
    steps: [
      ['TRANSPORTED', 'distributor_main', 'QL1A, Tiền Giang → TP.HCM', 'Xe lạnh bảo quản 8–10°C suốt tuyến'],
      ['RECEIVED', 'distributor_main', 'Kho Quận 7, TP.HCM', 'Kiểm tra ngoại quan, độ ngọt Brix 15 đạt chuẩn'],
    ],
  },
  {
    code: 'FR-2026-0005',
    product: 'tea',
    farmer: 'farmer_tea',
    origin: 'Mộc Châu, Sơn La',
    quantity: 350,
    days: 2,
    steps: [],
  },
];

async function insertSampleBatch(db, b, { orgId, userId, productId, qr, now, audit }) {
  const farmer = USERS.find((u) => u.key === b.farmer);
  const product = PRODUCTS.find((p) => p.key === b.product);
  const createdAt = new Date(now.getTime() - b.days * DAY);

  const r = await db.query(
    `INSERT INTO batches (batch_code, product_id, origin, quantity, image_url, creation_date, created_by, organization_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING batch_id`,
    [b.code, productId[b.product], b.origin, b.quantity, product?.imageUrl || null, createdAt.toISOString(), userId[b.farmer], orgId[farmer.org]]
  );
  const batchId = Number(r.rows[0].batch_id);
  await audit(userId[b.farmer], 'BATCH', batchId, { batchCode: b.code, quantity: b.quantity });

  const q = await db.query(
    'INSERT INTO qr_codes (batch_id, qr_data, signature_hmac) VALUES ($1, $2, $3) RETURNING qr_id',
    [batchId, qr.url(b.code), qr.signature(b.code)]
  );
  await audit(userId[b.farmer], 'QR_CODE', Number(q.rows[0].qr_id), { batchId });

  const events = [['CREATED', b.farmer, b.origin, 'Thu hoạch và khởi tạo lô hàng']].concat(b.steps);
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
  return { code: b.code, status: events[events.length - 1][0], product: b.product };
}

async function seedSample(db, { passwordHash, qr, now = new Date() }) {
  if (typeof passwordHash !== 'string' || !/^\$2[aby]\$/.test(passwordHash)) {
    throw new Error('passwordHash phải là bcrypt hash');
  }
  await db.query('SELECT pg_advisory_xact_lock($1)', [BATCH_CODE_LOCK]);

  const audit = (actorId, entityType, entityId, newValue) =>
    db.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_value)
       VALUES ($1, 'CREATE', $2, $3, $4)`,
      [actorId, entityType, entityId, sanitizeAuditValue({ ...newValue, source: 'seed-sample' })]
    );

  const orgId = {};
  let orgsCreated = 0;
  for (const o of ORGS) {
    const found = await db.query(
      'SELECT organization_id FROM organizations WHERE name = $1 AND type = $2 LIMIT 1',
      [o.name, o.type]
    );
    if (found.rows[0]) {
      orgId[o.key] = Number(found.rows[0].organization_id);
      continue;
    }
    const r = await db.query(
      'INSERT INTO organizations (name, type, address) VALUES ($1, $2, $3) RETURNING organization_id',
      [o.name, o.type, o.address]
    );
    orgId[o.key] = Number(r.rows[0].organization_id);
    orgsCreated += 1;
    await audit(null, 'ORGANIZATION', orgId[o.key], { name: o.name, type: o.type });
  }

  const userId = {};
  let usersCreated = 0;
  for (const u of USERS) {
    const found = await db.query(
      'SELECT user_id, role, status, organization_id FROM users WHERE lower(email) = lower($1) LIMIT 1',
      [u.email]
    );
    if (found.rows[0]) {
      const row = found.rows[0];
      if (row.role !== u.role || row.status !== 'ACTIVE' || Number(row.organization_id) !== orgId[u.org]) {
        throw new Error(`Tài khoản ${u.email} đã tồn tại nhưng khác vai trò/đơn vị/trạng thái.`);
      }
      userId[u.key] = Number(row.user_id);
      continue;
    }
    const r = await db.query(
      `INSERT INTO users (name, email, password_hash, role, status, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id`,
      [u.name, u.email, passwordHash, u.role, u.status, orgId[u.org]]
    );
    userId[u.key] = Number(r.rows[0].user_id);
    usersCreated += 1;
    await audit(null, 'USER', userId[u.key], { name: u.name, role: u.role, status: u.status });
  }

  const productId = {};
  let productsCreated = 0;
  for (const p of PRODUCTS) {
    const found = await db.query(
      'SELECT product_id FROM products WHERE organization_id = $1 AND name = $2 LIMIT 1',
      [orgId[p.org], p.name]
    );
    if (found.rows[0]) {
      productId[p.key] = Number(found.rows[0].product_id);
      continue;
    }
    const r = await db.query(
      `INSERT INTO products (organization_id, name, category, unit, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING product_id`,
      [orgId[p.org], p.name, p.category, p.unit, p.description]
    );
    productId[p.key] = Number(r.rows[0].product_id);
    productsCreated += 1;
  }

  const existingBatches = await db.query(
    'SELECT batch_code FROM batches WHERE batch_code = ANY($1::text[])',
    [BATCHES.map((b) => b.code)]
  );
  const existingSet = new Set(existingBatches.rows.map((r) => r.batch_code));

  const createdBatches = [];
  const skippedBatches = [];
  for (const b of BATCHES) {
    if (existingSet.has(b.code)) {
      skippedBatches.push(b.code);
      continue;
    }
    createdBatches.push(await insertSampleBatch(db, b, { orgId, userId, productId, qr, now, audit }));
  }

  return {
    orgsCreated,
    usersCreated,
    productsCreated,
    createdBatches,
    skippedBatches,
    users: USERS.map((u) => ({ email: u.email, role: u.role })),
  };
}

module.exports = { seedSample, ORGS, USERS, PRODUCTS, BATCHES };
