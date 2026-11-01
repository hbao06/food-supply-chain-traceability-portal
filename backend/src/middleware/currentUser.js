'use strict';

const { UnauthorizedError, ForbiddenError } = require('../common/errors');

// Đặt NGAY SAU authenticate (W4-TV3, US-S04 AC01, SRS P7).
//
// JWT sống 1 giờ và không thu hồi được phía server. Nếu chỉ tin token thì tài khoản vừa bị khóa,
// hoặc vừa bị Admin đổi vai trò / đơn vị, vẫn dùng quyền cũ đến khi token hết hạn.
// Middleware này đọc lại tài khoản từ CSDL ở MỖI yêu cầu và thay req.auth bằng dữ liệu mới nhất:
//   - không còn tài khoản        -> 401 UNAUTHORIZED
//   - PENDING / LOCKED           -> 403 ACCOUNT_PENDING / ACCOUNT_LOCKED
//   - còn lại                    -> req.auth = { userId, role, organizationId, status } lấy từ CSDL
// Truy vấn theo khóa chính nên rất nhẹ.
function createLoadCurrentUser({ db }) {
  return async function loadCurrentUser(req, res, next) {
    if (!req.auth || !Number.isSafeInteger(req.auth.userId)) {
      return next(new UnauthorizedError());
    }
    let row;
    try {
      const r = await db.query(
        'SELECT user_id, role, status, organization_id FROM users WHERE user_id = $1',
        [req.auth.userId]
      );
      row = r.rows[0];
    } catch (err) {
      return next(err); // lỗi CSDL -> 500 qua errorHandler, không cho đi tiếp
    }
    if (!row) return next(new UnauthorizedError('UNAUTHORIZED', 'Tài khoản không còn tồn tại'));
    if (row.status === 'PENDING') return next(new ForbiddenError('ACCOUNT_PENDING', 'Tài khoản đang chờ Admin duyệt'));
    if (row.status !== 'ACTIVE') return next(new ForbiddenError('ACCOUNT_LOCKED', 'Tài khoản đã bị khóa'));

    req.auth = {
      userId: Number(row.user_id),
      role: row.role,
      organizationId: row.organization_id == null ? null : Number(row.organization_id),
      status: row.status,
    };
    return next();
  };
}

module.exports = { createLoadCurrentUser };
