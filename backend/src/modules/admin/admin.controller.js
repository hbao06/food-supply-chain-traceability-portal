'use strict';

const v = require('./admin.validators');

// Controller mỏng: kiểm tra đầu vào -> gọi service -> trả JSON. Express 5 tự chuyển lỗi async sang errorHandler.
function createAdminController(service) {
  return {
    async listUsers(req, res) { res.json(await service.listUsers(v.validateUserListQuery(req.query))); },
    async changeRole(req, res) {
      const id = v.parseId(req.params.userId, 'userId');
      res.json(await service.changeRole(req.auth, id, v.validateChangeRole(req.body)));
    },
    async assignOrganization(req, res) {
      const id = v.parseId(req.params.userId, 'userId');
      res.json(await service.assignOrganization(req.auth, id, v.validateAssignOrganization(req.body)));
    },
    async changeStatus(req, res) {
      const id = v.parseId(req.params.userId, 'userId');
      res.json(await service.changeStatus(req.auth, id, v.validateChangeStatus(req.body)));
    },
    async listOrganizations(req, res) { res.json(await service.listOrganizations(v.validateOrgListQuery(req.query))); },
    async createOrganization(req, res) { res.status(201).json(await service.createOrganization(req.auth, v.validateCreateOrganization(req.body))); },
    async updateOrganization(req, res) {
      const id = v.parseId(req.params.organizationId, 'organizationId');
      res.json(await service.updateOrganization(req.auth, id, v.validateUpdateOrganization(req.body)));
    },
    async listAuditLogs(req, res) { res.json(await service.listAuditLogs(v.validateAuditQuery(req.query))); },
  };
}

module.exports = { createAdminController };
