'use strict';

const { AppError, NotFoundError } = require('./errors');

// Đặt SAU tất cả route: đường dẫn không tồn tại -> 404 cùng định dạng lỗi.
function notFound(req, res, next) {
  next(new NotFoundError('NOT_FOUND', 'Không tìm thấy đường dẫn'));
}

// Mọi lỗi trả về dạng { code, message, details? } đúng schema Error trong openapi.
// Không bao giờ lộ stack trace hay nội dung lỗi CSDL ra ngoài.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (res.headersSent) return next(err);

  let status = 500;
  let body = { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống, vui lòng thử lại sau' };

  if (err instanceof AppError) {
    status = err.status;
    body = { code: err.code, message: err.message };
    if (err.details) body.details = err.details;
  } else if (err && err.type === 'entity.parse.failed') {
    status = 400;
    body = { code: 'INVALID_JSON', message: 'Nội dung JSON không hợp lệ' };
  } else if (err && err.type === 'entity.too.large') {
    status = 413;
    body = { code: 'PAYLOAD_TOO_LARGE', message: 'Nội dung gửi lên quá lớn' };
  } else if (err && err.code === '23505') { // unique_violation
    status = 409;
    body = { code: 'CONFLICT', message: 'Dữ liệu bị trùng' };
  } else if (err && err.code === '23514') { // check_violation (CHECK / trigger nghiệp vụ của CSDL)
    status = 409;
    body = { code: 'CONFLICT', message: 'Dữ liệu vi phạm quy tắc nghiệp vụ' };
  } else if (err && err.code === '23503') { // foreign_key_violation
    status = 409;
    body = { code: 'CONFLICT', message: 'Dữ liệu liên quan không hợp lệ hoặc đang được sử dụng' };
  } else if (
    err &&
    (
      ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '57P01', '57P02', '57P03', '08001', '08006'].includes(err.code)
      || (Array.isArray(err.errors) && err.errors.some((e) => e && ['ECONNREFUSED', 'ETIMEDOUT'].includes(e.code)))
    )
  ) {
    status = 503;
    body = { code: 'DATABASE_UNAVAILABLE', message: 'Hệ thống chưa kết nối được cơ sở dữ liệu, vui lòng thử lại sau' };
  }

  if (status >= 500) console.error('[error]', err); // lỗi 4xx là lỗi của người gọi, không cần log

  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
