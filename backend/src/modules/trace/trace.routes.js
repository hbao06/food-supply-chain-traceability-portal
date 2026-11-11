'use strict';

const express = require('express');
const { pool } = require('../../db/pool');
const { createRateLimiter } = require('../../middleware/rateLimit');
const { createQrTokenService } = require('../../common/qrToken');
const repo = require('./trace.repository');
const { createTraceService } = require('./trace.service');
const { createTraceController } = require('./trace.controller');

const qr = createQrTokenService({ secret: process.env.QR_HMAC_SECRET, baseUrl: process.env.TRACE_BASE_URL });
const controller = createTraceController(createTraceService({ db: pool, repo, qr }));

// Giới hạn tần suất theo IP cho API công khai (SRS P6, FR-QR-08): mặc định 60 lượt/phút, đổi bằng RATE_LIMIT_TRACE_MAX.
// Tắt khi NODE_ENV=test hoặc RATE_LIMIT_DISABLED=true (cùng quy ước với đăng nhập/đăng ký).
const limiterOff = process.env.NODE_ENV === 'test' || process.env.RATE_LIMIT_DISABLED === 'true';
const traceLimiter = limiterOff
  ? (req, res, next) => next()
  : createRateLimiter({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_TRACE_MAX) || 60,
    message: 'Bạn tra cứu quá nhanh, vui lòng thử lại sau ít phút',
  });

// Gắn vào app: app.use('/api/trace', traceRouter);   (KHÔNG cần đăng nhập)
const traceRouter = express.Router();
traceRouter.get('/code/:batchCode', traceLimiter, controller.byCode);
traceRouter.get('/:qrToken', traceLimiter, controller.byToken);

module.exports = { traceRouter };
