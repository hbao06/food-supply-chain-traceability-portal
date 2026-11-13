'use strict';

// Truy xuất công khai CHỈ đọc qua hai view của database/schema.sql (public_batch_trace, public_event_trace):
// view không có id nội bộ, email, người tạo hay audit (FR-QR-06). Không truy vấn trực tiếp bảng batches/users ở đây.
const EVENT_ORDER = "array_position(ARRAY['CREATED','TRANSPORTED','RECEIVED','PROCESSED','PACKAGED','SHIPPED']::text[], event_type::text)";

async function findPublicBatch(db, batchCode) {
  const r = await db.query(
    `SELECT batch_code, product_name, origin, organization_name, current_status
     FROM public_batch_trace WHERE batch_code = $1`,
    [batchCode]
  );
  return r.rows[0] || null;
}

// Cũ -> mới. Chuỗi sự kiện tuyến tính nên vị trí trong chuỗi là khóa phụ ổn định khi hai sự kiện cùng thời điểm.
// Cố ý KHÔNG chọn cột description (văn bản tự do, có thể chứa ghi chú nội bộ).
async function listPublicEvents(db, batchCode) {
  const r = await db.query(
    `SELECT event_type, location, organization_name, "timestamp" AS "timestamp"
     FROM public_event_trace WHERE batch_code = $1
     ORDER BY "timestamp" ASC, ${EVENT_ORDER} ASC`,
    [batchCode]
  );
  return r.rows;
}

module.exports = { findPublicBatch, listPublicEvents };
