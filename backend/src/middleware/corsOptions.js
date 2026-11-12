'use strict';

// CORS (W7-TV3). Trước đây app.use(cors()) cho MỌI website gọi API bằng trình duyệt của người dùng.
// Token nằm trong header Authorization (không dùng cookie) nên rủi ro thấp, nhưng không có lý do để mở:
// frontend gọi qua proxy của Vite (cùng nguồn), các trang khác không cần đọc phản hồi của API.
//
// CORS_ORIGIN (.env): danh sách nguồn được phép, phân tách bằng dấu phẩy.
//   - không đặt  -> chỉ http://localhost:5173 (frontend khi chạy dev / Docker)
//   - "*"        -> cho tất cả (chỉ dùng khi thật cần, ví dụ demo từ máy khác)
const DEFAULT_ORIGINS = Object.freeze(['http://localhost:5173']);

function parseOrigins(value) {
  if (value === undefined || value.trim() === '') return [...DEFAULT_ORIGINS];
  if (value.trim() === '*') return '*';
  return value.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
}

// Tùy chọn cho gói `cors`. origin là hàm để so khớp chính xác (không dùng regex, không khớp một phần).
function buildCorsOptions(env = process.env) {
  const allowed = parseOrigins(env.CORS_ORIGIN);
  return {
    origin: allowed === '*' ? true : (origin, callback) => callback(null, !origin || allowed.includes(origin)),
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  };
}

module.exports = { buildCorsOptions, parseOrigins, DEFAULT_ORIGINS };
