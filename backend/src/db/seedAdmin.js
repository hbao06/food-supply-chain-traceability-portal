'use strict';

const { passwordProblem } = require('../common/passwordPolicy');

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Tạo tài khoản Admin đầu tiên (W4-TV3). Admin không tự đăng ký được (US-S01 AC03, permission-matrix câu 6),
// nên tài khoản đầu tiên phải được tạo bằng seed. Chạy lại nhiều lần vẫn an toàn: email đã có thì bỏ qua.
// `db` là client đang trong transaction; `hash` là hàm băm bcrypt (truyền vào để test không cần bcrypt thật).
function validateAdminInput({ name, email, password }) {
  const errors = [];
  if (typeof name !== 'string' || name.trim() === '') errors.push('ADMIN_NAME không được để trống');
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) errors.push('ADMIN_EMAIL không hợp lệ');
  const pw = passwordProblem(password);
  if (pw) errors.push(`ADMIN_PASSWORD: ${pw}`);
  if (errors.length) throw new Error(errors.join('; '));
  return { name: name.trim(), email: email.trim().toLowerCase(), password };
}

async function seedAdmin(db, input, { hash }) {
  const { name, email, password } = validateAdminInput(input);
  const existing = await db.query('SELECT user_id, role FROM users WHERE lower(email) = lower($1)', [email]);
  if (existing.rows[0]) {
    return { created: false, userId: Number(existing.rows[0].user_id), role: existing.rows[0].role };
  }
  const passwordHash = await hash(password);
  const r = await db.query(
    `INSERT INTO users (name, email, password_hash, role, status, organization_id)
     VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', NULL) RETURNING user_id`,
    [name, email, passwordHash]
  );
  const userId = Number(r.rows[0].user_id);
  // Ghi audit cùng transaction; actor_id NULL vì do hệ thống (seed) tạo. Không ghi mật khẩu / hash.
  await db.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_value)
     VALUES (NULL, 'CREATE', 'USER', $1, $2)`,
    [userId, { name, email, role: 'ADMIN', status: 'ACTIVE', source: 'seed' }]
  );
  return { created: true, userId, role: 'ADMIN' };
}

module.exports = { seedAdmin, validateAdminInput };
