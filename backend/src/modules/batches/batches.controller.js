'use strict';

const { validateCreateBatch, validateUpdateBatch, validateListQuery, parseBatchId } = require('./batches.validators');

// Controller mỏng: kiểm tra đầu vào -> gọi service -> trả JSON. Express 5 tự chuyển lỗi async sang errorHandler.
function createBatchController(service) {
  return {
    async create(req, res) {
      res.status(201).json(await service.create(req.auth, validateCreateBatch(req.body)));
    },
    async list(req, res) {
      res.json(await service.list(req.auth, validateListQuery(req.query)));
    },
    async get(req, res) {
      res.json(await service.get(req.auth, parseBatchId(req.params.batchId)));
    },
    async update(req, res) {
      const batchId = parseBatchId(req.params.batchId);
      res.json(await service.update(req.auth, batchId, validateUpdateBatch(req.body)));
    },
    async getQr(req, res) {
      res.json(await service.getQr(req.auth, parseBatchId(req.params.batchId)));
    },
  };
}

module.exports = { createBatchController };
