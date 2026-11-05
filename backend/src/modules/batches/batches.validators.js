'use strict';

const { ValidationError } = require('../../common/errors');

const STATUSES = ['CREATED', 'TRANSPORTED', 'RECEIVED', 'PROCESSED', 'PACKAGED', 'SHIPPED'];
const MAX_QUANTITY = 9999999999.99; // NUMERIC(12,2) trong schema.sql
const MAX_PAGE_LIMIT = 100;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function requireObject(body) {
  if (!isPlainObject(body)) {
    throw new ValidationError([{ field: 'body', message: 'Nội dung yêu cầu phải là một JSON object' }]);
  }
}

function checkText(value, field, label, max, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ field, message: `${label} không được để trống` });
  } else if (value.trim().length > max) {
    errors.push({ field, message: `${label} tối đa ${max} ký tự` });
  }
}

function checkQuantity(value, errors) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({ field: 'quantity', message: 'Số lượng phải là một số' });
  } else if (value <= 0) {
    errors.push({ field: 'quantity', message: 'Số lượng phải lớn hơn 0' });
  } else if (value > MAX_QUANTITY) {
    errors.push({ field: 'quantity', message: 'Số lượng quá lớn' });
  } else if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    errors.push({ field: 'quantity', message: 'Số lượng tối đa 2 chữ số thập phân' });
  }
}

const round2 = (n) => Math.round(n * 100) / 100;

function validateCreateBatch(body) {
  requireObject(body);
  const errors = [];
  checkText(body.productName, 'productName', 'Tên sản phẩm', 150, errors);
  checkText(body.origin, 'origin', 'Nguồn gốc', 255, errors);
  checkQuantity(body.quantity, errors);
  if (errors.length) throw new ValidationError(errors);
  return { productName: body.productName.trim(), origin: body.origin.trim(), quantity: round2(body.quantity) };
}

// PATCH: chỉ sửa productName, origin, quantity. Mã lô, trạng thái, người tạo, đơn vị không được sửa.
const EDITABLE_FIELDS = ['productName', 'origin', 'quantity'];

function validateUpdateBatch(body) {
  requireObject(body);
  const errors = [];
  for (const key of Object.keys(body)) {
    if (!EDITABLE_FIELDS.includes(key)) errors.push({ field: key, message: 'Không được phép sửa trường này' });
  }
  if (!EDITABLE_FIELDS.some((k) => body[k] !== undefined)) {
    errors.push({ field: 'body', message: 'Cần ít nhất một trường để cập nhật: productName, origin hoặc quantity' });
  }
  const changes = {};
  if (body.productName !== undefined) { checkText(body.productName, 'productName', 'Tên sản phẩm', 150, errors); changes.productName = body.productName; }
  if (body.origin !== undefined) { checkText(body.origin, 'origin', 'Nguồn gốc', 255, errors); changes.origin = body.origin; }
  if (body.quantity !== undefined) { checkQuantity(body.quantity, errors); changes.quantity = body.quantity; }
  if (errors.length) throw new ValidationError(errors);
  if (changes.productName !== undefined) changes.productName = changes.productName.trim();
  if (changes.origin !== undefined) changes.origin = changes.origin.trim();
  if (changes.quantity !== undefined) changes.quantity = round2(changes.quantity);
  return changes;
}

const toStringOrUndefined = (v) => (typeof v === 'string' ? v : undefined);

function validateListQuery(query = {}) {
  const errors = [];
  const out = { status: undefined, q: undefined, page: 1, limit: 20 };

  if (query.status !== undefined) {
    if (typeof query.status !== 'string' || !STATUSES.includes(query.status)) {
      errors.push({ field: 'status', message: `Trạng thái phải là một trong: ${STATUSES.join(', ')}` });
    } else out.status = query.status;
  }
  if (query.q !== undefined) {
    const q = toStringOrUndefined(query.q);
    if (q === undefined) errors.push({ field: 'q', message: 'Từ khóa tìm kiếm không hợp lệ' });
    else if (q.trim().length > 100) errors.push({ field: 'q', message: 'Từ khóa tối đa 100 ký tự' });
    else if (q.trim() !== '') out.q = q.trim();
  }
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

// batchId trên đường dẫn: số nguyên dương. Sai định dạng -> 400 (không liên quan phạm vi nên không lộ thông tin).
function parseBatchId(raw) {
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,14}$/.test(raw)) {
    throw new ValidationError([{ field: 'batchId', message: 'batchId phải là số nguyên dương' }]);
  }
  return Number(raw);
}

module.exports = { validateCreateBatch, validateUpdateBatch, validateListQuery, parseBatchId, STATUSES, MAX_PAGE_LIMIT };
