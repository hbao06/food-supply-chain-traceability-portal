'use strict';

// Đọc và kiểm tra cấu hình bảo mật một lần khi khởi động. Thiếu thì dừng ngay, không dùng giá trị mặc định.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET phải được đặt trong .env và dài tối thiểu 32 ký tự');
}

module.exports = {
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  bcryptCost: Number(process.env.BCRYPT_COST) || 10,
};
