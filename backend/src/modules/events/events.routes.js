'use strict';

const express = require('express');
const { pool, withTransaction } = require('../../db/pool');
const { requirePermission, canRecordEvent, nextEventType } = require('../../middleware/rbac');
const { requireAuth, repo: batchRepo, insertAudit } = require('../batches/batches.routes');
const repo = require('./events.repository');
const { createEventService } = require('./events.service');
const { createEventController } = require('./events.controller');

const service = createEventService({
  db: pool, withTransaction, batchRepo, repo, insertAudit, rbac: { canRecordEvent, nextEventType },
});
const controller = createEventController(service);

// Gắn vào app (trước hoặc sau batchesRouter đều được):
//   app.use('/api/batches/:batchId/events', eventsRouter);
//   app.use('/api/batches/:batchId/timeline', timelineRouter);
const eventsRouter = express.Router({ mergeParams: true });
eventsRouter.post('/', requireAuth, requirePermission('event:create'), controller.create);
eventsRouter.get('/', requireAuth, requirePermission('event:read'), controller.list);

const timelineRouter = express.Router({ mergeParams: true });
timelineRouter.get('/', requireAuth, requirePermission('timeline:read'), controller.timeline);

module.exports = { eventsRouter, timelineRouter };
