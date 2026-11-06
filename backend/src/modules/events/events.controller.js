'use strict';

const { parseBatchId } = require('../batches/batches.validators');
const { validateCreateEvent } = require('./events.validators');

function createEventController(service) {
  return {
    async create(req, res) {
      const batchId = parseBatchId(req.params.batchId);
      res.status(201).json(await service.record(req.auth, batchId, validateCreateEvent(req.body)));
    },
    async list(req, res) {
      res.json(await service.list(req.auth, parseBatchId(req.params.batchId)));
    },
    async timeline(req, res) {
      res.json(await service.timeline(req.auth, parseBatchId(req.params.batchId)));
    },
  };
}

module.exports = { createEventController };
