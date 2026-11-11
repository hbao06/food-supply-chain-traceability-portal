'use strict';

const express = require('express');
const router = express.Router();
const traceController = require('./trace.controller');
const traceValidators = require('./trace.validators');
const { rateLimitEnabled, passThrough } = require('../../middleware/rateLimit');

const traceRateLimit = rateLimitEnabled()
  ? express.rateLimit({
      windowMs: 60 * 1000,
      max: Number(process.env.RATE_LIMIT_TRACE_MAX) || 60,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Bạn đã vượt quá giới hạn truy cập, vui lòng thử lại sau',
      },
    })
  : passThrough;

router.get(
  '/code/:batchCode',
  traceRateLimit,
  traceValidators.validateBatchCodeParam,
  traceController.traceByBatchCode
);

router.get(
  '/:qrToken',
  traceRateLimit,
  traceValidators.validateQrTokenParam,
  traceController.traceByQrToken
);

module.exports = { traceRouter: router };
