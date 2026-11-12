'use strict';

// Câu SQL cho lô. Tên bảng/cột đúng database/schema.sql. Mỗi hàm nhận `db` là pool hoặc client của transaction.
// Phạm vi đọc dùng batchReadScope của middleware/rbac.js: ngoài phạm vi thì không có dòng nào -> service trả 404.
const { batchReadScope } = require('../../middleware/rbac');

const COLS = 'b.batch_id, b.batch_code, b.product_name, b.origin, b.quantity, b.creation_date, b.current_status, b.created_by, b.organization_id';
const RETURNING = 'batch_id, batch_code, product_name, origin, quantity, creation_date, current_status, created_by, organization_id';
const BATCH_CODE_LOCK = 2026_0501; // khóa advisory riêng cho việc cấp mã lô (khác khóa của migrator)

// Hai người tạo lô cùng lúc không được nhận trùng mã: khóa theo transaction rồi mới đọc số lớn nhất.
async function lockBatchCodeSequence(db) {
  await db.query('SELECT pg_advisory_xact_lock($1)', [BATCH_CODE_LOCK]);
}

// Mã lô: BATCH-<năm>-<số thứ tự 4 chữ số>, thứ tự tăng dần trong từng năm (CHECK chk_batches_batch_code_format).
// Biểu thức split_part(...)::int phải giữ ĐÚNG như chỉ mục idx_batches_code_year_seq (migration 007) để
// PostgreSQL đọc số lớn nhất từ chỉ mục (~0,1 ms) thay vì quét cả bảng (W7-TV3, docs/security/query-optimization.md).
async function nextBatchCode(db) {
  const r = await db.query(
    `SELECT EXTRACT(YEAR FROM now())::int AS year,
            COALESCE((SELECT split_part(batch_code, '-', 3)::int FROM batches
                      WHERE split_part(batch_code, '-', 2)::int = EXTRACT(YEAR FROM now())::int
                      ORDER BY split_part(batch_code, '-', 3)::int DESC
                      LIMIT 1), 0) AS max_seq`
  );
  const { year, max_seq: maxSeq } = r.rows[0];
  return `BATCH-${year}-${String(Number(maxSeq) + 1).padStart(4, '0')}`;
}

async function insertBatch(db, { batchCode, productName, origin, quantity, createdBy, organizationId }) {
  const r = await db.query(
    `INSERT INTO batches (batch_code, product_name, origin, quantity, created_by, organization_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${RETURNING}`,
    [batchCode, productName, origin, quantity, createdBy, organizationId]
  );
  return r.rows[0];
}

async function insertQr(db, { batchId, qrData, signatureHmac }) {
  const r = await db.query(
    `INSERT INTO qr_codes (batch_id, qr_data, signature_hmac) VALUES ($1, $2, $3)
     RETURNING qr_id, batch_id, qr_data, created_at`,
    [batchId, qrData, signatureHmac]
  );
  return r.rows[0];
}

// Sự kiện CREATED do hệ thống ghi khi tạo lô (người ghi là Farmer tạo lô). Trigger check_event_rules kiểm tra lại.
async function insertCreatedEvent(db, { batchId, actorId, location }) {
  const r = await db.query(
    `INSERT INTO supply_chain_events (batch_id, actor_id, event_type, location)
     VALUES ($1, $2, 'CREATED', $3) RETURNING event_id`,
    [batchId, actorId, location]
  );
  return r.rows[0];
}

// Một lô trong phạm vi của người gọi. includeAwaiting: Processor/Distributor thấy cả lô đang chờ bước của vai trò mình.
async function findVisibleBatch(db, auth, batchId, { forUpdate = false, includeAwaiting = false } = {}) {
  const scope = batchReadScope(auth, { alias: 'b', startIndex: 2, includeAwaiting });
  const r = await db.query(
    `SELECT ${COLS} FROM batches b WHERE b.batch_id = $1 AND ${scope.clause}${forUpdate ? ' FOR UPDATE OF b' : ''}`,
    [batchId, ...scope.params]
  );
  return r.rows[0] || null;
}

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');
const FULL_BATCH_CODE = /^BATCH-[0-9]{4}-[0-9]{4,}$/i; // giống CHECK chk_batches_batch_code_format

async function listVisibleBatches(db, auth, { status, q, limit, offset }) {
  const params = [];
  const scope = batchReadScope(auth, { alias: 'b', startIndex: 1 }); // danh sách: không có includeAwaiting
  params.push(...scope.params);
  const where = [scope.clause];
  if (status) { params.push(status); where.push(`b.current_status = $${params.length}`); }
  if (q && FULL_BATCH_CODE.test(q)) {
    // Gõ đủ một mã lô (thường gặp nhất: chép từ nhãn / QR): so khớp đúng mã qua chỉ mục UNIQUE.
    // ILIKE '%BATCH-2026-0420%' thì mọi lô đều có các bộ ba "BAT", "TCH", "-20"... nên chỉ mục trigram
    // không lọc được và PostgreSQL quét cả bảng (~90 ms / 60 000 lô -> ~6 ms, W7-TV3).
    params.push(q.toUpperCase(), `%${escapeLike(q)}%`);
    where.push(`(b.batch_code = $${params.length - 1} OR b.product_name ILIKE $${params.length})`);
  } else if (q) {
    params.push(`%${escapeLike(q)}%`);
    where.push(`(b.product_name ILIKE $${params.length} OR b.batch_code ILIKE $${params.length})`);
  }
  const whereSql = where.join(' AND ');
  const total = await db.query(`SELECT count(*)::int AS total FROM batches b WHERE ${whereSql}`, params);
  const rows = await db.query(
    `SELECT ${COLS} FROM batches b WHERE ${whereSql}
     ORDER BY b.creation_date DESC, b.batch_id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { rows: rows.rows, total: total.rows[0].total };
}

const COLUMN_OF = { productName: 'product_name', origin: 'origin', quantity: 'quantity' };

async function updateBatch(db, batchId, changes) {
  const sets = [];
  const params = [batchId];
  for (const [field, value] of Object.entries(changes)) {
    params.push(value);
    sets.push(`${COLUMN_OF[field]} = $${params.length}`);
  }
  const r = await db.query(`UPDATE batches SET ${sets.join(', ')} WHERE batch_id = $1 RETURNING ${RETURNING}`, params);
  return r.rows[0];
}

async function findQr(db, batchId) {
  const r = await db.query('SELECT qr_id, batch_id, qr_data, created_at FROM qr_codes WHERE batch_id = $1', [batchId]);
  return r.rows[0] || null;
}

module.exports = {
  lockBatchCodeSequence, nextBatchCode, insertBatch, insertQr, insertCreatedEvent,
  findVisibleBatch, listVisibleBatches, updateBatch, findQr, escapeLike, FULL_BATCH_CODE,
};
