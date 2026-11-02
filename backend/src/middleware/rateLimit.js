'use strict';

const { TooManyRequestsError } = require('../common/errors');

// Giới hạn tần suất đơn giản theo cửa sổ thời gian cố định, lưu trong bộ nhớ (W4-TV3).
// Dùng cho đăng nhập / đăng ký (chống dò mật khẩu, dò email – SRS P6) và về sau cho /trace (FR-QR-08).
// Vượt giới hạn -> 429 TOO_MANY_REQUESTS kèm header Retry-After (giây).
//
// Tùy chọn:
//   keyGenerator(req)      khóa đếm, mặc định IP. Đăng nhập dùng IP + email để cả lớp chung một IP không chặn nhau.
//   skipSuccessfulRequests chỉ tính yêu cầu có phản hồi lỗi (>= 400): đăng nhập đúng không bị đếm.
//   maxKeys                số khóa tối đa giữ trong bộ nhớ; vượt thì xóa khóa hết hạn, rồi tới khóa cũ nhất.
//
// Giới hạn: bộ nhớ của MỘT tiến trình Node. Đủ cho đồ án (một container backend);
// nếu chạy nhiều bản backend thì cần kho dùng chung (Redis).
// Nếu backend đứng sau reverse proxy, cần app.set('trust proxy', 1) để req.ip là IP thật của người dùng.
const clientIp = (req) => req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';

function createRateLimiter({
  windowMs,
  max,
  keyGenerator = clientIp,
  skipSuccessfulRequests = false,
  message,
  now = Date.now,
  maxKeys = 10000,
}) {
  if (!(windowMs > 0) || !(max > 0)) throw new Error('rateLimit: windowMs và max phải > 0');
  if (!(maxKeys > 0)) throw new Error('rateLimit: maxKeys phải > 0');
  const hits = new Map(); // key -> { count, resetAt }; Map giữ thứ tự thêm vào

  function makeRoom(t) {
    for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key);
    // Vẫn đầy (nhiều khóa còn hiệu lực): bỏ khóa cũ nhất để bộ nhớ không tăng mãi.
    for (const key of hits.keys()) {
      if (hits.size < maxKeys) break;
      hits.delete(key);
    }
  }

  function rateLimit(req, res, next) {
    const t = now();
    const key = keyGenerator(req);
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      if (!entry && hits.size >= maxKeys) makeRoom(t);
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }

    if (entry.count >= max) {
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - t) / 1000))));
      return next(new TooManyRequestsError(undefined, message));
    }

    entry.count += 1;
    if (skipSuccessfulRequests && typeof res.on === 'function') {
      const counted = entry;
      res.on('finish', () => {
        if (res.statusCode < 400 && counted.count > 0) counted.count -= 1; // thành công thì không tính
      });
    }
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    return next();
  }

  rateLimit.reset = () => hits.clear(); // dùng trong test
  rateLimit.size = () => hits.size;
  return rateLimit;
}

// Bật / tắt theo môi trường: tắt khi NODE_ENV=test hoặc RATE_LIMIT_DISABLED=true (test tự động, smoke test).
function rateLimitEnabled(env = process.env) {
  return env.NODE_ENV !== 'test' && String(env.RATE_LIMIT_DISABLED).toLowerCase() !== 'true';
}

const passThrough = (req, res, next) => next();

module.exports = { createRateLimiter, rateLimitEnabled, passThrough, clientIp };
