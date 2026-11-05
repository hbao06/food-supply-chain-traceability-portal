'use strict';

const crypto = require('crypto');

// Token QR theo schema.sql / SRS P1:
//   qrToken = <batch_code>.<signature>,  signature = base64url(HMAC-SHA256(QR_HMAC_SECRET, batch_code))
//   qrData  = <TRACE_BASE_URL>/trace/<qrToken>
// Khóa bí mật chỉ nằm trong biến môi trường, không lưu trong CSDL. Tuần 7 dùng verify() cho trang truy xuất công khai.
function createQrTokenService({ secret, baseUrl = 'http://localhost:5173' }) {
  function signature(batchCode) {
    if (!secret || secret.length < 32) {
      throw new Error('QR_HMAC_SECRET chưa được cấu hình (cần tối thiểu 32 ký tự)');
    }
    return crypto.createHmac('sha256', secret).update(batchCode, 'utf8').digest('base64url');
  }

  const token = (batchCode) => `${batchCode}.${signature(batchCode)}`;
  const url = (batchCode) => `${baseUrl.replace(/\/+$/, '')}/trace/${token(batchCode)}`;

  // Trả batchCode nếu chữ ký đúng, ngược lại trả null (không ném lỗi, để route công khai trả 404).
  function verify(candidate) {
    if (typeof candidate !== 'string') return null;
    const i = candidate.lastIndexOf('.');
    if (i <= 0) return null;
    const batchCode = candidate.slice(0, i);
    const given = Buffer.from(candidate.slice(i + 1));
    let expected;
    try { expected = Buffer.from(signature(batchCode)); } catch (_) { return null; }
    return given.length === expected.length && crypto.timingSafeEqual(given, expected) ? batchCode : null;
  }

  return { signature, token, url, verify };
}

module.exports = { createQrTokenService };
