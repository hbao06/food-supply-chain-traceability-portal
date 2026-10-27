'use strict';

const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../../common/errors');

function createTokenService({ secret, expiresIn = '1h' }) {
  return {
    sign({ userId, role, organizationId }) {
      return jwt.sign({ role, organizationId: organizationId ?? null }, secret, {
        algorithm: 'HS256',
        subject: String(userId),
        expiresIn,
      });
    },

    // Trả { userId, role, organizationId } hoặc ném UnauthorizedError (401).
    verify(token) {
      try {
        const p = jwt.verify(token, secret, { algorithms: ['HS256'] });
        return { userId: Number(p.sub), role: p.role, organizationId: p.organizationId ?? null };
      } catch (err) {
        if (err && err.name === 'TokenExpiredError') {
          throw new UnauthorizedError('TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
        }
        throw new UnauthorizedError('INVALID_TOKEN', 'Token không hợp lệ');
      }
    },
  };
}

module.exports = { createTokenService };
