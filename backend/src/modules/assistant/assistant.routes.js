'use strict';

const express = require('express');
const { pool } = require('../../db/pool');
const { createRateLimiter, rateLimitEnabled, passThrough } = require('../../middleware/rateLimit');
const { createQrTokenService } = require('../../common/qrToken');
const { ValidationError } = require('../../common/errors');
const traceRepo = require('../trace/trace.repository');
const { createTraceService } = require('../trace/trace.service');
const { createAssistantService } = require('./assistant.service');

const qr = createQrTokenService({ secret: process.env.QR_HMAC_SECRET, baseUrl: process.env.TRACE_BASE_URL });
const service = createAssistantService({ traceService: createTraceService({ db: pool, repo: traceRepo, qr }) });

const limiter = rateLimitEnabled()
  ? createRateLimiter({ windowMs: 60 * 1000, max: Number(process.env.RATE_LIMIT_ASSISTANT_MAX) || 20, message: 'Bạn hỏi quá nhanh, vui lòng thử lại sau ít phút' })
  : passThrough;

// Gắn vào app: app.use('/api/assistant', assistantRouter); (công khai, giới hạn tần suất, chỉ dùng dữ liệu công khai)
const assistantRouter = express.Router();
assistantRouter.post('/chat', limiter, async (req, res) => {
  const message = req.body && req.body.message;
  if (typeof message !== 'string' || message.trim() === '') {
    throw new ValidationError([{ field: 'message', message: 'Vui lòng nhập câu hỏi' }]);
  }
  res.json(await service.chat(message));
});

module.exports = { assistantRouter };
