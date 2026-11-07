'use strict';

const { ValidationError } = require('../../common/errors');

// CREATED do hệ thống tự ghi khi tạo lô nên không gửi qua API.
const SENDABLE_TYPES = ['TRANSPORTED', 'RECEIVED', 'PROCESSED', 'PACKAGED', 'SHIPPED'];
// Người gọi KHÔNG được gửi: người ghi (lấy từ token), thời điểm (lấy giờ của máy chủ), lô (lấy từ đường dẫn).
const ALLOWED_FIELDS = ['eventType', 'location', 'description'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function validateCreateEvent(body) {
  if (!isPlainObject(body)) {
    throw new ValidationError([{ field: 'body', message: 'Nội dung yêu cầu phải là một JSON object' }]);
  }
  const errors = [];
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.includes(key)) errors.push({ field: key, message: 'Không được phép gửi trường này' });
  }

  if (body.eventType === 'CREATED') {
    errors.push({ field: 'eventType', message: 'CREATED do hệ thống tự ghi khi tạo lô, không gửi qua API' });
  } else if (!SENDABLE_TYPES.includes(body.eventType)) {
    errors.push({ field: 'eventType', message: `Loại sự kiện phải là một trong: ${SENDABLE_TYPES.join(', ')}` });
  }

  if (typeof body.location !== 'string' || body.location.trim() === '') {
    errors.push({ field: 'location', message: 'Địa điểm không được để trống' });
  } else if (body.location.trim().length > 255) {
    errors.push({ field: 'location', message: 'Địa điểm tối đa 255 ký tự' });
  }

  let description = null;
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') errors.push({ field: 'description', message: 'Mô tả phải là chuỗi' });
    else if (body.description.length > 1000) errors.push({ field: 'description', message: 'Mô tả tối đa 1000 ký tự' });
    else description = body.description.trim() === '' ? null : body.description.trim();
  }

  if (errors.length) throw new ValidationError(errors);
  return { eventType: body.eventType, location: body.location.trim(), description };
}

module.exports = { validateCreateEvent, SENDABLE_TYPES };
