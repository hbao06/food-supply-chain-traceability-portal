'use strict';

function createTraceController(service) {
  return {
    async byToken(req, res) {
      res.json(await service.byToken(req.params.qrToken));
    },
    async byCode(req, res) {
      res.json(await service.byCode(req.params.batchCode));
    },
  };
}

module.exports = { createTraceController };
