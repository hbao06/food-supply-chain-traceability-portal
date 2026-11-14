'use strict';

const { ValidationError } = require('../../common/errors');

const ASSIGNABLE_ROLES = ['FARMER', 'PROCESSOR', 'DISTRIBUTOR']; // Admin do hệ thống cấp, không gán qua API
const LIST_ROLES = [...ASSIGNABLE_ROLES, 'ADMIN'];
const STATUSES = ['PENDING', 'ACTIVE', 'LOCKED'];
const SETTABLE_STATUSES = ['ACTIVE', 'LOCKED']; // PENDING chỉ có khi đăng ký
const ORG_TYPES = ['FARM', 'PROCESSOR', 'DISTRIBUTOR'];
const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'REGISTER', 'LOGIN_FAILED', 'APPROVE', 'CHANGE_ROLE', 'LOCK', 'UNLOCK', 'ASSIGN_ORGANIZATION'];
const AUDIT_ENTITY_TYPES = ['USER', 'ORGANIZATION', 'BATCH', 'EVENT', 'QR_CODE'];
const MAX_LIMIT = 100;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const oneOf = (list) => `phải là một trong: ${list.join(', ')}`;

function requireObject(body) {
  if (!isPlainObject(body)) {
    throw new ValidationError([{ field: 'body', message: 'Nội dung yêu cầu phải là một JSON object' }]);
  }
}

function rejectUnknown(body, allowed, errors) {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) errors.push({ field: key, message: 'Không được phép gửi trường này' });
  }
}

function parseId(raw, field) {
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,14}$/.test(raw)) {
    throw new ValidationError([{ field, message: `${field} phải là số nguyên dương` }]);
  }
  return Number(raw);
}

const isPositiveInt = (v) => Number.isSafeInteger(v) && v > 0;

function parsePaging(query, errors) {
  const out = { page: 1, limit: 20 };
  if (query.page !== undefined) {
    if (typeof query.page !== 'string' || !/^[1-9][0-9]{0,8}$/.test(query.page)) errors.push({ field: 'page', message: 'page phải là số nguyên từ 1' });
    else out.page = Number(query.page);
  }
  if (query.limit !== undefined) {
    if (typeof query.limit !== 'string' || !/^[1-9][0-9]{0,3}$/.test(query.limit) || Number(query.limit) > MAX_LIMIT) {
      errors.push({ field: 'limit', message: `limit phải là số nguyên từ 1 đến ${MAX_LIMIT}` });
    } else out.limit = Number(query.limit);
  }
  return out;
}

function enumQuery(query, field, list, errors) {
  if (query[field] === undefined) return undefined;
  if (typeof query[field] !== 'string' || !list.includes(query[field])) {
    errors.push({ field, message: `${field} ${oneOf(list)}` });
    return undefined;
  }
  return query[field];
}

function idQuery(query, field, errors) {
  if (query[field] === undefined) return undefined;
  if (typeof query[field] !== 'string' || !/^[1-9][0-9]{0,14}$/.test(query[field])) {
    errors.push({ field, message: `${field} phải là số nguyên dương` });
    return undefined;
  }
  return Number(query[field]);
}

function dateQuery(query, field, errors) {
  if (query[field] === undefined) return undefined;
  const v = query[field];
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v) || Number.isNaN(Date.parse(v))) {
    errors.push({ field, message: `${field} phải là ngày giờ ISO 8601, ví dụ 2026-11-01T00:00:00Z` });
    return undefined;
  }
  return new Date(v).toISOString();
}

function validateUserListQuery(query = {}) {
  const errors = [];
  const out = { status: enumQuery(query, 'status', STATUSES, errors), role: enumQuery(query, 'role', LIST_ROLES, errors), ...parsePaging(query, errors) };
  if (errors.length) throw new ValidationError(errors);
  return out;
}

// organizationId kèm theo cho phép đổi vai trò và đơn vị cùng lúc (vai trò mới cần đơn vị loại khác).
function validateChangeRole(body) {
  requireObject(body);
  const errors = [];
  rejectUnknown(body, ['role', 'organizationId'], errors);
  if (!ASSIGNABLE_ROLES.includes(body.role)) errors.push({ field: 'role', message: `role ${oneOf(ASSIGNABLE_ROLES)}` });
  if (body.organizationId !== undefined && !isPositiveInt(body.organizationId)) errors.push({ field: 'organizationId', message: 'organizationId phải là số nguyên dương' });
  if (errors.length) throw new ValidationError(errors);
  return body.organizationId === undefined ? { role: body.role } : { role: body.role, organizationId: body.organizationId };
}

function validateAssignOrganization(body) {
  requireObject(body);
  const errors = [];
  rejectUnknown(body, ['organizationId'], errors);
  if (!isPositiveInt(body.organizationId)) errors.push({ field: 'organizationId', message: 'organizationId phải là số nguyên dương' });
  if (errors.length) throw new ValidationError(errors);
  return { organizationId: body.organizationId };
}

function validateChangeStatus(body) {
  requireObject(body);
  const errors = [];
  rejectUnknown(body, ['status'], errors);
  if (!SETTABLE_STATUSES.includes(body.status)) errors.push({ field: 'status', message: `status ${oneOf(SETTABLE_STATUSES)}` });
  if (errors.length) throw new ValidationError(errors);
  return { status: body.status };
}

function validateOrgListQuery(query = {}) {
  const errors = [];
  const out = { type: enumQuery(query, 'type', ORG_TYPES, errors), ...parsePaging(query, errors) };
  if (errors.length) throw new ValidationError(errors);
  return out;
}

function checkName(value, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push({ field: 'name', message: 'Tên đơn vị không được để trống' });
  else if (value.trim().length > 150) errors.push({ field: 'name', message: 'Tên đơn vị tối đa 150 ký tự' });
}

function checkAddress(value, errors) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') { errors.push({ field: 'address', message: 'Địa chỉ phải là chuỗi' }); return null; }
  if (value.trim().length > 255) { errors.push({ field: 'address', message: 'Địa chỉ tối đa 255 ký tự' }); return null; }
  return value.trim() === '' ? null : value.trim();
}

function validateCreateOrganization(body) {
  requireObject(body);
  const errors = [];
  rejectUnknown(body, ['name', 'type', 'address'], errors);
  checkName(body.name, errors);
  if (!ORG_TYPES.includes(body.type)) errors.push({ field: 'type', message: `type ${oneOf(ORG_TYPES)}` });
  const address = checkAddress(body.address, errors);
  if (errors.length) throw new ValidationError(errors);
  return { name: body.name.trim(), type: body.type, address };
}

function validateUpdateOrganization(body) {
  requireObject(body);
  const errors = [];
  rejectUnknown(body, ['name', 'type', 'address'], errors);
  if (!['name', 'type', 'address'].some((k) => body[k] !== undefined)) {
    errors.push({ field: 'body', message: 'Cần ít nhất một trường để cập nhật: name, type hoặc address' });
  }
  const changes = {};
  if (body.name !== undefined) { checkName(body.name, errors); changes.name = typeof body.name === 'string' ? body.name.trim() : body.name; }
  if (body.type !== undefined) {
    if (!ORG_TYPES.includes(body.type)) errors.push({ field: 'type', message: `type ${oneOf(ORG_TYPES)}` });
    changes.type = body.type;
  }
  if (body.address !== undefined) changes.address = checkAddress(body.address, errors);
  if (errors.length) throw new ValidationError(errors);
  return changes;
}

function validateAuditQuery(query = {}) {
  const errors = [];
  const out = {
    entityType: enumQuery(query, 'entityType', AUDIT_ENTITY_TYPES, errors),
    action: enumQuery(query, 'action', AUDIT_ACTIONS, errors),
    entityId: idQuery(query, 'entityId', errors),
    actorId: idQuery(query, 'actorId', errors),
    from: dateQuery(query, 'from', errors),
    to: dateQuery(query, 'to', errors),
    ...parsePaging(query, errors),
  };
  if (!errors.length && out.from && out.to && out.from > out.to) errors.push({ field: 'from', message: 'from phải trước hoặc bằng to' });
  if (errors.length) throw new ValidationError(errors);
  return out;
}

module.exports = {
  parseId, validateUserListQuery, validateChangeRole, validateAssignOrganization, validateChangeStatus,
  validateOrgListQuery, validateCreateOrganization, validateUpdateOrganization, validateAuditQuery,
  ASSIGNABLE_ROLES, SETTABLE_STATUSES, ORG_TYPES, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES,
};
