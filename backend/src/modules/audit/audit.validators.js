'use strict';

const { ValidationError } = require('../../common/errors');
const { ACTIONS, ENTITY_TYPES } = require('./audit.sanitize');

const MAX_PAGE_LIMIT = 100;
// Ngày giờ ISO 8601 có ngày đầy đủ: 2026-11-09 hoặc 2026-11-09T08:00:00Z / +07:00.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function parseId(raw, field, errors) {
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,14}$/.test(raw)) {
    errors.push({ field, message: `${field} phải là số nguyên dương` });
    return undefined;
  }
  return Number(raw);
}

function parseDate(raw, field, errors) {
  if (typeof raw !== 'string' || !ISO_DATE.test(raw) || Number.isNaN(Date.parse(raw))) {
    errors.push({ field, message: `${field} phải là ngày giờ ISO 8601, ví dụ 2026-11-09T08:00:00+07:00` });
    return undefined;
  }
  return new Date(raw);
}

// Tham số GET /audit-logs theo openapi-spec.yaml.
function validateAuditQuery(query = {}) {
  const errors = [];
  const out = { page: 1, limit: 20 };

  if (query.entityType !== undefined) {
    if (!ENTITY_TYPES.includes(query.entityType)) errors.push({ field: 'entityType', message: `entityType phải là một trong: ${ENTITY_TYPES.join(', ')}` });
    else out.entityType = query.entityType;
  }
  if (query.action !== undefined) {
    if (!ACTIONS.includes(query.action)) errors.push({ field: 'action', message: `action phải là một trong: ${ACTIONS.join(', ')}` });
    else out.action = query.action;
  }
  if (query.entityId !== undefined) out.entityId = parseId(query.entityId, 'entityId', errors);
  if (query.actorId !== undefined) out.actorId = parseId(query.actorId, 'actorId', errors);
  if (query.from !== undefined) out.from = parseDate(query.from, 'from', errors);
  if (query.to !== undefined) out.to = parseDate(query.to, 'to', errors);
  if (out.from && out.to && out.from > out.to) errors.push({ field: 'from', message: 'from phải trước hoặc bằng to' });

  if (query.page !== undefined) {
    if (typeof query.page !== 'string' || !/^[1-9][0-9]{0,8}$/.test(query.page)) errors.push({ field: 'page', message: 'page phải là số nguyên từ 1' });
    else out.page = Number(query.page);
  }
  if (query.limit !== undefined) {
    if (typeof query.limit !== 'string' || !/^[1-9][0-9]{0,3}$/.test(query.limit) || Number(query.limit) > MAX_PAGE_LIMIT) {
      errors.push({ field: 'limit', message: `limit phải là số nguyên từ 1 đến ${MAX_PAGE_LIMIT}` });
    } else out.limit = Number(query.limit);
  }
  if (errors.length) throw new ValidationError(errors);
  return out;
}

function validateVerifyQuery(query = {}) {
  const errors = [];
  const out = {};
  if (query.batchId !== undefined) out.batchId = parseId(query.batchId, 'batchId', errors);
  if (errors.length) throw new ValidationError(errors);
  return out;
}

module.exports = { validateAuditQuery, validateVerifyQuery, MAX_PAGE_LIMIT };
