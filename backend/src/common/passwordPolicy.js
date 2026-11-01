'use strict';

// Chính sách mật khẩu đã chốt (SRS mục 11 – P5, US-UI01, US-UI03): tối thiểu 8 ký tự, có cả chữ và số.
// Tối đa 72 byte vì bcrypt chỉ xét 72 byte đầu (mật khẩu dài hơn sẽ bị cắt mà người dùng không biết).
const MIN_LENGTH = 8;
const MAX_BYTES = 72;

// Trả về thông báo lỗi (string) hoặc null nếu hợp lệ.
function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < MIN_LENGTH) return `Mật khẩu phải có ít nhất ${MIN_LENGTH} ký tự`;
  if (Buffer.byteLength(pw, 'utf8') > MAX_BYTES) return `Mật khẩu tối đa ${MAX_BYTES} byte`;
  if (!/\p{L}/u.test(pw) || !/\p{Nd}/u.test(pw)) return 'Mật khẩu phải có cả chữ và số';
  return null;
}

module.exports = { passwordProblem, MIN_LENGTH, MAX_BYTES };
