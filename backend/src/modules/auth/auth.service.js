'use strict';

const { ConflictError, ForbiddenError, UnauthorizedError } = require('../../common/errors');

// Hàng CSDL -> JSON của API (camelCase, KHÔNG có password_hash). BIGINT của pg là chuỗi nên đổi sang số.
function toUserDto(row) {
  return {
    userId: Number(row.user_id),
    name: row.name,
    email: row.email,
    role: row.role,
    organizationId: row.organization_id == null ? null : Number(row.organization_id),
    status: row.status,
  };
}

// Tài khoản chưa duyệt hoặc bị khóa thì không được dùng hệ thống (403).
function assertActive(row) {
  if (row.status === 'PENDING') {
    throw new ForbiddenError('ACCOUNT_PENDING', 'Tài khoản đang chờ Admin duyệt');
  }
  if (row.status === 'LOCKED') {
    throw new ForbiddenError('ACCOUNT_LOCKED', 'Tài khoản đã bị khóa');
  }
}

// Phụ thuộc được truyền vào (db, repo, hasher, tokens...) để test không cần CSDL thật.
function createAuthService({ db, withTransaction, repo, hasher, tokens, logger = console }) {
  let dummyHash; // so sánh giả khi email không tồn tại: thời gian phản hồi giống nhau, khó dò email
  const getDummyHash = async () => (dummyHash ||= await hasher.hash('khong-phai-mat-khau-that'));

  async function register({ name, email, password, role }) {
    const passwordHash = await hasher.hash(password);
    return withTransaction(async (tx) => {
      let row;
      try {
        row = await repo.insertUser(tx, { name, email, passwordHash, role });
      } catch (err) {
        if (err && err.code === '23505') {
          throw new ConflictError('EMAIL_EXISTS', 'Email này đã được đăng ký');
        }
        throw err;
      }
      // Ghi audit cùng transaction với thay đổi: lỗi thì hoàn tác cả hai.
      await repo.insertAudit(tx, {
        actorId: Number(row.user_id),
        action: 'REGISTER',
        entityType: 'USER',
        entityId: Number(row.user_id),
        newValue: { name: row.name, email: row.email, role: row.role, status: row.status },
      });
      return toUserDto(row);
    });
  }

  async function auditFailedLogin(row, email) {
    try {
      await repo.insertAudit(db, {
        actorId: row ? Number(row.user_id) : null,
        action: 'LOGIN_FAILED',
        entityType: 'USER',
        entityId: row ? Number(row.user_id) : null,
        newValue: { email },
      });
    } catch (err) {
      logger.error('[auth] không ghi được audit LOGIN_FAILED', err); // không làm hỏng phản hồi 401
    }
  }

  async function login({ email, password }) {
    const row = await repo.findByEmail(db, email);
    const ok = await hasher.compare(password, row ? row.password_hash : await getDummyHash());
    if (!row || !ok) {
      await auditFailedLogin(row, email);
      // Cùng một thông báo cho "sai email" và "sai mật khẩu".
      throw new UnauthorizedError('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
    }
    assertActive(row); // chỉ kiểm tra sau khi mật khẩu đúng, để không lộ trạng thái cho người đoán mật khẩu
    const token = tokens.sign({
      userId: Number(row.user_id),
      role: row.role,
      organizationId: row.organization_id == null ? null : Number(row.organization_id),
    });
    return { token, user: toUserDto(row) };
  }

  async function getProfile(userId) {
    const row = await repo.findById(db, userId);
    if (!row) throw new UnauthorizedError('UNAUTHORIZED', 'Tài khoản không còn tồn tại');
    assertActive(row);
    return toUserDto(row);
  }

  async function updateProfile(userId, { name }) {
    return withTransaction(async (tx) => {
      const current = await repo.findById(tx, userId, { forUpdate: true });
      if (!current) throw new UnauthorizedError('UNAUTHORIZED', 'Tài khoản không còn tồn tại');
      assertActive(current);
      if (current.name === name) return toUserDto(current); // không đổi gì thì không ghi audit
      const oldName = current.name; // lấy trước khi ghi, không phụ thuộc repo trả object mới hay cũ
      const updated = await repo.updateName(tx, userId, name);
      await repo.insertAudit(tx, {
        actorId: userId,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        oldValue: { name: oldName },
        newValue: { name: updated.name },
      });
      return toUserDto(updated);
    });
  }

  return { register, login, getProfile, updateProfile };
}

module.exports = { createAuthService, toUserDto };
