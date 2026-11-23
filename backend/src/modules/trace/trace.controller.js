'use strict';

function createTraceController(service) {
  return {
    async recent(req, res) {
      res.json(await service.recent({ limit: req.query?.limit }));
    },
    async byToken(req, res) {
      res.json(await service.byToken(req.params.qrToken));
    },
    async byCode(req, res) {
      res.json(await service.byCode(req.params.batchCode));
    },
  };
}

module.exports = { createTraceController };
