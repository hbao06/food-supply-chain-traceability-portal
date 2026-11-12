'use strict';

const { validateCreateBatch, validateUpdateBatch, validateListQuery, parseBatchId } = require('./batches.validators');
const { ValidationError } = require('../../common/errors');

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
      const format = String(req.query.format || 'json').toLowerCase();
      if (!['json', 'png', 'svg'].includes(format)) {
        throw new ValidationError([{ field: 'format', message: 'Định dạng được hỗ trợ: png, svg' }], 'Định dạng được hỗ trợ: png, svg');
      }
      const result = await service.getQr(req.auth, parseBatchId(req.params.batchId), format);
      if (format === 'png' || format === 'svg') {
        res.type(format === 'png' ? 'image/png' : 'image/svg+xml');
        res.set('Content-Disposition', `attachment; filename="QR-${result.batchCode}.${format}"`);
        return res.send(result.image);
      }
      res.json(result);
    },
  };
}

module.exports = { createBatchController };
