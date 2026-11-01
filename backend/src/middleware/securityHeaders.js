'use strict';

// Header bảo mật cơ bản cho API JSON (W4-TV3). Không cần thư viện ngoài (helmet).
//  - X-Content-Type-Options: nosniff   trình duyệt không đoán lại kiểu nội dung
//  - X-Frame-Options: DENY             không cho nhúng API vào iframe (clickjacking)
//  - Referrer-Policy: no-referrer      không gửi URL (có thể chứa mã lô / token QR) sang trang khác
//  - Cache-Control: no-store           không lưu phản hồi có dữ liệu cá nhân / token vào cache
// Cùng với app.disable('x-powered-by') để không lộ tên framework.
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

module.exports = { securityHeaders };
