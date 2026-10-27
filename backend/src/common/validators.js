'use strict';

const { ValidationError } = require('./errors');

// Cùng quy tắc với CHECK chk_users_email_format trong schema.sql.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Admin do hệ thống cấp, không tự đăng ký (openapi: RegisterRequest.role).
const REGISTER_ROLES = ['FARMER', 'DISTRIBUTOR', 'PROCESSOR'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function requireObject(body) {
  if (!isPlainObject(body)) {
    throw new ValidationError([{ field: 'body', message: 'Nội dung yêu cầu phải là một JSON object' }]);
  }
}

function checkName(value, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ field: 'name', message: 'Họ tên không được để trống' });
  } else if (value.trim().length > 100) {
    errors.push({ field: 'name', message: 'Họ tên tối đa 100 ký tự' });
  }
}

function checkEmail(value, errors) {
  if (typeof value !== 'string' || !EMAIL_RE.test(value.trim())) {
    errors.push({ field: 'email', message: 'Email không hợp lệ' });
  } else if (value.trim().length > 255) {
    errors.push({ field: 'email', message: 'Email tối đa 255 ký tự' });
  }
}

function validateRegister(body) {
  requireObject(body);
  const errors = [];
  checkName(body.name, errors);
  checkEmail(body.email, errors);

  const pw = body.password;
  if (typeof pw !== 'string' || pw.length < 8) {
    errors.push({ field: 'password', message: 'Mật khẩu phải có ít nhất 8 ký tự' });
  } else if (Buffer.byteLength(pw, 'utf8') > 72) { // bcrypt chỉ xét 72 byte đầu
    errors.push({ field: 'password', message: 'Mật khẩu tối đa 72 byte' });
  }

  if (!REGISTER_ROLES.includes(body.role)) {
    errors.push({ field: 'role', message: `Vai trò phải là một trong: ${REGISTER_ROLES.join(', ')}` });
  }

  if (errors.length) throw new ValidationError(errors);
  return { name: body.name.trim(), email: body.email.trim().toLowerCase(), password: pw, role: body.role };
}

function validateLogin(body) {
  requireObject(body);
  const errors = [];
  if (typeof body.email !== 'string' || body.email.trim() === '') {
    errors.push({ field: 'email', message: 'Vui lòng nhập email' });
  }
  if (typeof body.password !== 'string' || body.password === '') {
    errors.push({ field: 'password', message: 'Vui lòng nhập mật khẩu' });
  }
  if (errors.length) throw new ValidationError(errors);
  return { email: body.email.trim().toLowerCase(), password: body.password };
}

// Người dùng chỉ được sửa họ tên. Email, vai trò, đơn vị, trạng thái do Admin quản lý.
const EDITABLE_PROFILE_FIELDS = ['name'];

function validateProfileUpdate(body) {
  requireObject(body);
  const errors = [];
  for (const key of Object.keys(body)) {
    if (!EDITABLE_PROFILE_FIELDS.includes(key)) {
      errors.push({ field: key, message: 'Không được phép sửa trường này' });
    }
  }
  checkName(body.name, errors);
  if (errors.length) throw new ValidationError(errors);
  return { name: body.name.trim() };
}

module.exports = { validateRegister, validateLogin, validateProfileUpdate, REGISTER_ROLES };
