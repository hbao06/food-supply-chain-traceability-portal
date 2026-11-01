'use strict';

const { TooManyRequestsError } = require('../common/errors');

// Giới hạn tần suất đơn giản theo cửa sổ thời gian cố định, lưu trong bộ nhớ (W4-TV3).
// Dùng cho đăng nhập / đăng ký (chống dò mật khẩu, dò email – SRS P6) và về sau cho /trace (FR-QR-08).
// Vượt giới hạn -> 429 TOO_MANY_REQUESTS kèm header Retry-After (giây).
//
// Giới hạn: bộ nhớ của MỘT tiến trình Node. Đủ cho đồ án (một container backend);
// nếu chạy nhiều bản backend thì cần kho dùng chung (Redis).
// Nếu backend đứng sau reverse proxy, cần app.set('trust proxy', 1) để req.ip là IP thật của người dùng.
function createRateLimiter({
  windowMs,
  max,
  keyGenerator = (req) => req.ip || (req.socket && req.socket.remoteAddress) || 'unknown',
  message,
  now = Date.now,
  maxKeys = 10000,
}) {
  if (!(windowMs > 0) || !(max > 0)) throw new Error('rateLimit: windowMs và max phải > 0');
  const hits = new Map(); // key -> { count, resetAt }

  function sweep(t) {
    for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key);
  }

  function rateLimit(req, res, next) {
    const t = now();
    if (hits.size >= maxKeys) sweep(t); // tránh Map phình mãi khi có nhiều IP
    const key = keyGenerator(req);
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - t) / 1000))));
      return next(new TooManyRequestsError(undefined, message));
    }
    return next();
  }

  rateLimit.reset = () => hits.clear(); // dùng trong test
  return rateLimit;
}

module.exports = { createRateLimiter };
