'use strict';

const { UnauthorizedError, ForbiddenError } = require('../common/errors');

// Hợp đồng dùng chung với middleware của TV3: authenticate gắn req.auth = { userId, role, organizationId };
// authorize(...roles) trả 403 khi sai vai trò. Nếu TV3 đã merge bản của họ, giữ bản của TV3 và
// chỉ cần giữ nguyên hình dạng req.auth này.
function createAuthenticate(tokens) {
  return function authenticate(req, res, next) {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
      return next(new UnauthorizedError('UNAUTHORIZED', 'Cần đăng nhập để thực hiện thao tác này'));
    }
    try {
      req.auth = tokens.verify(token);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

function authorize(...roles) {
  return function (req, res, next) {
    if (!req.auth) return next(new UnauthorizedError());
    if (!roles.includes(req.auth.role)) return next(new ForbiddenError());
    return next();
  };
}

module.exports = { createAuthenticate, authorize };
