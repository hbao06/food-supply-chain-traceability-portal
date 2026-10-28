'use strict';

// Các câu SQL cho Auth/Profile. Tên bảng/cột đúng database/schema.sql (snake_case).
// Mỗi hàm nhận `db` là pool hoặc client của transaction.
const COLUMNS = 'user_id, organization_id, name, email, password_hash, role, status';

async function findByEmail(db, email) {
  // lower(email) khớp chỉ mục uq_users_email_lower.
  const r = await db.query(`SELECT ${COLUMNS} FROM users WHERE lower(email) = lower($1)`, [email]);
  return r.rows[0] || null;
}

async function findById(db, userId, { forUpdate = false } = {}) {
  const r = await db.query(
    `SELECT ${COLUMNS} FROM users WHERE user_id = $1${forUpdate ? ' FOR UPDATE' : ''}`,
    [userId]
  );
  return r.rows[0] || null;
}

// Tài khoản mới luôn PENDING, chưa có đơn vị (Admin duyệt và gán sau).
async function insertUser(db, { name, email, passwordHash, role }) {
  const r = await db.query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1, $2, $3, $4, 'PENDING')
     RETURNING ${COLUMNS}`,
    [name, email, passwordHash, role]
  );
  return r.rows[0];
}

async function updateName(db, userId, name) {
  const r = await db.query(
    `UPDATE users SET name = $2 WHERE user_id = $1 RETURNING ${COLUMNS}`,
    [userId, name]
  );
  return r.rows[0] || null;
}

// audit_logs chỉ INSERT. Không đưa mật khẩu/token vào old_value/new_value (CHECK chk_audit_no_secrets).
async function insertAudit(db, { actorId = null, action, entityType, entityId = null, oldValue = null, newValue = null }) {
  await db.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorId, action, entityType, entityId, oldValue, newValue]
  );
}

module.exports = { findByEmail, findById, insertUser, updateName, insertAudit };
