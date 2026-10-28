'use strict';

// Lỗi nghiệp vụ có mã HTTP và mã lỗi ổn định (code) để frontend hiển thị thông báo.
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// 400 – dữ liệu đầu vào sai. details: [{ field, message }]
class ValidationError extends AppError {
  constructor(details, message = 'Dữ liệu không hợp lệ') {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

// 401 – chưa đăng nhập / token sai / hết hạn / sai email hoặc mật khẩu
class UnauthorizedError extends AppError {
  constructor(code = 'UNAUTHORIZED', message = 'Cần đăng nhập để thực hiện thao tác này') {
    super(401, code, message);
  }
}

// 403 – đã đăng nhập nhưng không đủ quyền / tài khoản chưa duyệt hoặc bị khóa
class ForbiddenError extends AppError {
  constructor(code = 'FORBIDDEN', message = 'Bạn không có quyền thực hiện thao tác này') {
    super(403, code, message);
  }
}

class NotFoundError extends AppError {
  constructor(code = 'NOT_FOUND', message = 'Không tìm thấy dữ liệu') {
    super(404, code, message);
  }
}

// 409 – trùng dữ liệu hoặc vi phạm quy tắc nghiệp vụ
class ConflictError extends AppError {
  constructor(code = 'CONFLICT', message = 'Dữ liệu bị xung đột') {
    super(409, code, message);
  }
}

module.exports = { AppError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError };
