'use strict';

// Câu SQL cho sự kiện chuỗi cung ứng. supply_chain_events chỉ INSERT (append-only, trigger chặn UPDATE/DELETE).
// INSERT sự kiện hợp lệ thì trigger check_event_rules tự cập nhật batches.current_status trong cùng transaction.

async function insertEvent(db, { batchId, actorId, eventType, location, description }) {
  // "timestamp" lấy mặc định now() của máy chủ CSDL: người gọi không đặt được thời điểm sự kiện.
  const r = await db.query(
    `INSERT INTO supply_chain_events (batch_id, actor_id, event_type, location, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING event_id`,
    [batchId, actorId, eventType, location, description]
  );
  return Number(r.rows[0].event_id);
}

const SELECT_DETAIL = `SELECT e.event_id, e.batch_id, e.actor_id, e.event_type, e."timestamp" AS "timestamp",
       e.location, e.description, u.name AS actor_name, o.name AS organization_name
  FROM supply_chain_events e
  JOIN users u ON u.user_id = e.actor_id
  LEFT JOIN organizations o ON o.organization_id = u.organization_id`;

async function findEvent(db, eventId) {
  const r = await db.query(`${SELECT_DETAIL} WHERE e.event_id = $1`, [eventId]);
  return r.rows[0] || null;
}

// Timeline: cũ -> mới. event_id là khóa phụ để thứ tự ổn định khi hai sự kiện cùng thời điểm.
async function listEvents(db, batchId) {
  const r = await db.query(`${SELECT_DETAIL} WHERE e.batch_id = $1 ORDER BY e."timestamp" ASC, e.event_id ASC`, [batchId]);
  return r.rows;
}

module.exports = { insertEvent, findEvent, listEvents };
