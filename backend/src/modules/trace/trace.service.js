'use strict';

const { NotFoundError } = require('../../common/errors');

const BATCH_CODE_RE = /^BATCH-[0-9]{4}-[0-9]{4,}$/; // cùng quy tắc CHECK chk_batches_batch_code_format
const MAX_TOKEN_LENGTH = 200;

// Mọi trường hợp "không có kết quả" dùng CÙNG một lỗi: token sai chữ ký, mã sai định dạng, mã không tồn tại.
// Người ngoài không phân biệt được lô có tồn tại hay không.
const NOT_FOUND = () => new NotFoundError('NOT_FOUND', 'Không tìm thấy thông tin truy xuất');

// DANH SÁCH TRẮNG: chỉ những trường này được trả ra công khai (OpenAPI: PublicTrace). Thêm trường mới phải sửa ở đây.
function toPublicTrace(batch, events) {
  return {
    batchCode: batch.batch_code,
    productName: batch.product_name,
    origin: batch.origin,
    organizationName: batch.organization_name ?? null,
    currentStatus: batch.current_status,
    events: events.map((e) => ({
      eventType: e.event_type,
      location: e.location,
      organizationName: e.organization_name ?? null,
      timestamp: e.timestamp,
    })),
  };
}

function createTraceService({ db, repo, qr }) {
  async function byCode(batchCode) {
    if (typeof batchCode !== 'string' || !BATCH_CODE_RE.test(batchCode)) throw NOT_FOUND();
    const batch = await repo.findPublicBatch(db, batchCode);
    if (!batch) throw NOT_FOUND();
    return toPublicTrace(batch, await repo.listPublicEvents(db, batchCode));
  }

  // Token trong mã QR: <mã lô>.<chữ ký HMAC>. Sai chữ ký thì không truy vấn CSDL.
  async function byToken(token) {
    if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) throw NOT_FOUND();
    const batchCode = qr.verify(token);
    if (!batchCode) throw NOT_FOUND();
    return byCode(batchCode);
  }

  return { byCode, byToken };
}

module.exports = { createTraceService, toPublicTrace, BATCH_CODE_RE };
