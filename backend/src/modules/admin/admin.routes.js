'use strict';

const express = require('express');
const { pool, withTransaction } = require('../../db/pool');
const { requirePermission } = require('../../middleware/rbac');
const { requireAuth, insertAudit } = require('../batches/batches.routes'); // bộ middleware xác thực dùng chung
const repo = require('./admin.repository');
const { createAdminService } = require('./admin.service');
const { createAdminController } = require('./admin.controller');

const controller = createAdminController(createAdminService({ db: pool, withTransaction, repo, insertAudit }));

// Gắn vào app MỘT lần, SAU profileRouter của /api/users:  app.use('/api', adminRouter);
// Chỉ có route /users, /organizations, /audit-logs; đường dẫn khác đi tiếp. Tất cả chỉ ADMIN (403 với vai trò khác).
const adminRouter = express.Router();
adminRouter.get('/users', requireAuth, requirePermission('user:read'), controller.listUsers);
adminRouter.patch('/users/:userId/role', requireAuth, requirePermission('user:change-role'), controller.changeRole);
adminRouter.patch('/users/:userId/organization', requireAuth, requirePermission('user:change-role'), controller.assignOrganization);
adminRouter.patch('/users/:userId/status', requireAuth, requirePermission('user:change-status'), controller.changeStatus);
adminRouter.get('/organizations', requireAuth, requirePermission('organization:read'), controller.listOrganizations);
adminRouter.post('/organizations', requireAuth, requirePermission('organization:write'), controller.createOrganization);
adminRouter.patch('/organizations/:organizationId', requireAuth, requirePermission('organization:write'), controller.updateOrganization);
adminRouter.get('/audit-logs', requireAuth, requirePermission('audit:read'), controller.listAuditLogs);

module.exports = { adminRouter };
