'use strict';

const express = require('express');
const { pool, withTransaction } = require('../../db/pool');
const { authenticate } = require('../auth/auth.routes');
const { createLoadCurrentUser } = require('../../middleware/currentUser');
const { requirePermission } = require('../../middleware/rbac');
const { createQrTokenService } = require('../../common/qrToken');
const { insertAudit } = require('../auth/auth.repository');
const repo = require('./batches.repository');
const { createBatchService } = require('./batches.service');
const { createBatchController } = require('./batches.controller');

if (!process.env.QR_HMAC_SECRET) {
  console.warn('[batches] QR_HMAC_SECRET chưa được đặt: tạo lô sẽ trả lỗi 500 cho đến khi cấu hình (xem .env.example).');
}
const qr = createQrTokenService({ secret: process.env.QR_HMAC_SECRET, baseUrl: process.env.TRACE_BASE_URL });
const service = createBatchService({ db: pool, withTransaction, repo, qr, insertAudit });
const controller = createBatchController(service);

// Thứ tự: xác thực (JWT) -> đọc lại tài khoản từ CSDL -> đúng vai trò (403) -> kiểm tra đầu vào (400) -> phạm vi (404).
const requireAuth = [authenticate, createLoadCurrentUser({ db: pool })];

// Gắn vào app: app.use('/api/batches', batchesRouter);
const batchesRouter = express.Router();
batchesRouter.post('/', requireAuth, requirePermission('batch:create'), controller.create);
batchesRouter.get('/', requireAuth, requirePermission('batch:read'), controller.list);
batchesRouter.get('/:batchId', requireAuth, requirePermission('batch:read'), controller.get);
batchesRouter.patch('/:batchId', requireAuth, requirePermission('batch:update'), controller.update);
batchesRouter.get('/:batchId/qr', requireAuth, requirePermission('qr:read'), controller.getQr);

module.exports = { batchesRouter, requireAuth, repo, insertAudit };
