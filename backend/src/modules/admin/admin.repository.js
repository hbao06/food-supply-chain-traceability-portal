'use strict';

// Câu SQL cho quản trị: tài khoản, đơn vị, nhật ký. Tên bảng/cột đúng database/schema.sql. Mỗi hàm nhận `db` là pool hoặc client.
const USER_SELECT = `SELECT u.user_id, u.name, u.email, u.role, u.status, u.organization_id, u.created_at,
       o.name AS organization_name, o.type AS organization_type
  FROM users u LEFT JOIN organizations o ON o.organization_id = u.organization_id`;
const ORG_COLUMNS = 'organization_id, name, type, address, created_at';

// Dựng WHERE từ danh sách điều kiện; mỗi điều kiện thêm một tham số.
function whereBuilder() {
  const params = []; const parts = [];
  return {
    add(sqlWithPlaceholder, value) { params.push(value); parts.push(sqlWithPlaceholder.replace('?', `$${params.length}`)); },
    sql() { return parts.length ? `WHERE ${parts.join(' AND ')}` : ''; },
    params,
  };
}

// ---------- tài khoản ----------
async function listUsers(db, { status, role, limit, offset }) {
  const w = whereBuilder();
  if (status) w.add('u.status = ?', status);
  if (role) w.add('u.role = ?', role);
  const total = await db.query(`SELECT count(*)::int AS total FROM users u ${w.sql()}`, w.params);
  const rows = await db.query(
    `${USER_SELECT} ${w.sql()} ORDER BY u.created_at DESC, u.user_id DESC LIMIT $${w.params.length + 1} OFFSET $${w.params.length + 2}`,
    [...w.params, limit, offset]
  );
  return { rows: rows.rows, total: total.rows[0].total };
}

async function findUserDetail(db, userId) {
  const r = await db.query(`${USER_SELECT} WHERE u.user_id = $1`, [userId]);
  return r.rows[0] || null;
}

// Khóa dòng tài khoản trong transaction để hai quản trị viên không sửa chồng nhau.
async function findUserForUpdate(db, userId) {
  const r = await db.query(`${USER_SELECT} WHERE u.user_id = $1 FOR UPDATE OF u`, [userId]);
  return r.rows[0] || null;
}

async function updateUserRoleAndOrganization(db, userId, role, organizationId) {
  await db.query('UPDATE users SET role = $2, organization_id = $3 WHERE user_id = $1', [userId, role, organizationId]);
}
async function updateUserOrganization(db, userId, organizationId) {
  await db.query('UPDATE users SET organization_id = $2 WHERE user_id = $1', [userId, organizationId]);
}
async function updateUserStatus(db, userId, status) {
  await db.query('UPDATE users SET status = $2 WHERE user_id = $1', [userId, status]);
}

async function countOtherActiveAdmins(db, userId) {
  const r = await db.query(`SELECT count(*)::int AS n FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE' AND user_id <> $1`, [userId]);
  return r.rows[0].n;
}

// ---------- đơn vị ----------
async function findOrganization(db, organizationId, { forUpdate = false } = {}) {
  const r = await db.query(`SELECT ${ORG_COLUMNS} FROM organizations WHERE organization_id = $1${forUpdate ? ' FOR UPDATE' : ''}`, [organizationId]);
  return r.rows[0] || null;
}

async function listOrganizations(db, { type, limit, offset }) {
  const w = whereBuilder();
  if (type) w.add('type = ?', type);
  const total = await db.query(`SELECT count(*)::int AS total FROM organizations ${w.sql()}`, w.params);
  const rows = await db.query(
    `SELECT ${ORG_COLUMNS} FROM organizations ${w.sql()} ORDER BY name ASC, organization_id ASC LIMIT $${w.params.length + 1} OFFSET $${w.params.length + 2}`,
    [...w.params, limit, offset]
  );
  return { rows: rows.rows, total: total.rows[0].total };
}

async function insertOrganization(db, { name, type, address }) {
  const r = await db.query(`INSERT INTO organizations (name, type, address) VALUES ($1, $2, $3) RETURNING ${ORG_COLUMNS}`, [name, type, address]);
  return r.rows[0];
}

async function updateOrganization(db, organizationId, changes) {
  const sets = []; const params = [organizationId];
  for (const [field, value] of Object.entries(changes)) { params.push(value); sets.push(`${field} = $${params.length}`); } // field chỉ là name/type/address (đã kiểm tra)
  const r = await db.query(`UPDATE organizations SET ${sets.join(', ')} WHERE organization_id = $1 RETURNING ${ORG_COLUMNS}`, params);
  return r.rows[0];
}

async function countOrganizationUsage(db, organizationId) {
  const r = await db.query(
    `SELECT (SELECT count(*) FROM users WHERE organization_id = $1)::int AS users,
            (SELECT count(*) FROM batches WHERE organization_id = $1)::int AS batches`,
    [organizationId]
  );
  return r.rows[0];
}

// ---------- nhật ký ----------
async function listAuditLogs(db, { entityType, entityId, actorId, action, from, to, limit, offset }) {
  const w = whereBuilder();
  if (entityType) w.add('a.entity_type = ?', entityType);
  if (entityId) w.add('a.entity_id = ?', entityId);
  if (actorId) w.add('a.actor_id = ?', actorId);
  if (action) w.add('a.action = ?', action);
  if (from) w.add('a.created_at >= ?', from);
  if (to) w.add('a.created_at <= ?', to);
  const total = await db.query(`SELECT count(*)::int AS total FROM audit_logs a ${w.sql()}`, w.params);
  const rows = await db.query(
    `SELECT a.audit_id, a.actor_id, u.name AS actor_name, a.action, a.entity_type, a.entity_id, a.old_value, a.new_value, a.created_at
     FROM audit_logs a LEFT JOIN users u ON u.user_id = a.actor_id ${w.sql()}
     ORDER BY a.created_at DESC, a.audit_id DESC LIMIT $${w.params.length + 1} OFFSET $${w.params.length + 2}`,
    [...w.params, limit, offset]
  );
  return { rows: rows.rows, total: total.rows[0].total };
}

module.exports = {
  listUsers, findUserDetail, findUserForUpdate, updateUserRoleAndOrganization, updateUserOrganization, updateUserStatus,
  countOtherActiveAdmins, findOrganization, listOrganizations, insertOrganization, updateOrganization, countOrganizationUsage, listAuditLogs,
};
