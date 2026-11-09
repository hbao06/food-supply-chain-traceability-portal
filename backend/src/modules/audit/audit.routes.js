'use strict';

const express = require('express');
const { pool } = require('../../db/pool');
const { requireAuth } = require('../auth/auth.routes');
const { requirePermission } = require('../../middleware/rbac');
const repo = require('./audit.repository');
const { createAuditService } = require('./audit.service');
const { createAuditController } = require('./audit.controller');

const controller = createAuditController(createAuditService({ db: pool, repo }));

// Gắn vào app: app.use('/api/audit-logs', auditRouter). Chỉ ADMIN (quyền audit:read), chỉ đọc.
const auditRouter = express.Router();
auditRouter.get('/', requireAuth, requirePermission('audit:read'), controller.list);
auditRouter.get('/verify', requireAuth, requirePermission('audit:read'), controller.verify);

module.exports = { auditRouter };
