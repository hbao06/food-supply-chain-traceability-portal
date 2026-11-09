'use strict';

const { validateAuditQuery, validateVerifyQuery } = require('./audit.validators');

function createAuditController(service) {
  return {
    async list(req, res) {
      res.json(await service.search(validateAuditQuery(req.query)));
    },
    async verify(req, res) {
      res.json(await service.verify(validateVerifyQuery(req.query)));
    },
  };
}

module.exports = { createAuditController };
