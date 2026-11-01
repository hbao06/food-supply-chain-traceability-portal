'use strict';

// Phân quyền theo vai trò (RBAC) – W4-TV3.
// Một nguồn duy nhất cho quyền của từng vai trò, theo docs/permission-matrix.md và openapi-spec.yaml.
// Các module Batch / Event / Trace / Admin dùng requirePermission(...) thay vì tự liệt kê vai trò,
// và dùng batchReadScope(...) để lọc phạm vi dữ liệu ngay trong câu SQL.
//
// Thứ tự middleware trên một route nội bộ:
//   router.post('/batches', requireAuth, requirePermission('batch:create'), controller.create)
// trong đó requireAuth = [authenticate, loadCurrentUser] (xem modules/auth/auth.routes.js).

const { UnauthorizedError, ForbiddenError } = require('../common/errors');

const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  FARMER: 'FARMER',
  PROCESSOR: 'PROCESSOR',
  DISTRIBUTOR: 'DISTRIBUTOR',
});
const { ADMIN, FARMER, PROCESSOR, DISTRIBUTOR } = ROLES;
const ALL = [ADMIN, FARMER, PROCESSOR, DISTRIBUTOR];

// Quyền -> vai trò được phép. "Được phép" ở đây chỉ là bước 1 (đúng vai trò, sai thì 403);
// bước 2 (đúng phạm vi bản ghi, sai thì 404) do batchReadScope / service kiểm tra.
const PERMISSIONS = Object.freeze({
  // Hồ sơ của chính mình
  'profile:read': ALL,
  'profile:update': ALL,
  // Quản trị (US-S01, US-S03, US-S04, US-S06)
  'user:read': [ADMIN],
  'user:change-role': [ADMIN],
  'user:change-status': [ADMIN],
  'organization:read': [ADMIN],
  'organization:write': [ADMIN],
  'audit:read': [ADMIN],
  // Lô (US-B01..B05). Admin chỉ xem, không tạo/sửa lô.
  'batch:create': [FARMER],
  'batch:update': [FARMER],
  'batch:read': ALL,
  // Sự kiện: CREATED do hệ thống ghi khi tạo lô, nên chỉ Processor / Distributor gửi sự kiện.
  'event:create': [PROCESSOR, DISTRIBUTOR],
  'event:read': ALL,
  'timeline:read': ALL,
  'qr:read': ALL,
});

function rolesFor(permission) {
  const roles = PERMISSIONS[permission];
  if (!roles) throw new Error(`Quyền không tồn tại: ${permission}`);
  return roles;
}

const can = (role, permission) => rolesFor(permission).includes(role);

// Middleware: 401 nếu chưa xác thực, 403 FORBIDDEN nếu vai trò không có quyền.
// Tên quyền sai bị phát hiện ngay khi khởi động (ném lỗi lúc tạo route), không phải lúc chạy.
function requirePermission(permission) {
  const roles = rolesFor(permission);
  return function checkPermission(req, res, next) {
    if (!req.auth) return next(new UnauthorizedError());
    if (!roles.includes(req.auth.role)) return next(new ForbiddenError());
    return next();
  };
}

// ---------------------------------------------------------------------------
// Sự kiện chuỗi cung ứng – giống trigger check_event_rules trong CSDL
// ---------------------------------------------------------------------------
const EVENT_SEQUENCE = Object.freeze(['CREATED', 'TRANSPORTED', 'RECEIVED', 'PROCESSED', 'PACKAGED', 'SHIPPED']);
const EVENT_TYPE_ROLE = Object.freeze({
  CREATED: FARMER,
  TRANSPORTED: DISTRIBUTOR,
  RECEIVED: DISTRIBUTOR,
  PROCESSED: PROCESSOR,
  PACKAGED: PROCESSOR,
  SHIPPED: DISTRIBUTOR,
});

function nextEventType(currentStatus) {
  const i = EVENT_SEQUENCE.indexOf(currentStatus);
  return i >= 0 && i < EVENT_SEQUENCE.length - 1 ? EVENT_SEQUENCE[i + 1] : null;
}

// Vai trò có được GỬI loại sự kiện này không (CREATED không gửi qua API) -> sai thì 403.
const canRecordEvent = (role, eventType) => eventType !== 'CREATED' && EVENT_TYPE_ROLE[eventType] === role;

// Các trạng thái lô mà bước kế tiếp thuộc về vai trò này (lô "đang chờ" vai trò đó tiếp nhận).
const statusesAwaiting = (role) => EVENT_SEQUENCE.filter((s) => EVENT_TYPE_ROLE[nextEventType(s)] === role);

// ---------------------------------------------------------------------------
// Phạm vi đọc lô (permission-matrix.md mục 4.3, FR-BATCH-08, US-S02 AC04)
// ---------------------------------------------------------------------------
// Trả { clause, params } để ghép vào WHERE. Ngoài phạm vi thì câu SQL không trả dòng nào -> service trả 404.
//   ADMIN       : mọi lô
//   FARMER      : lô thuộc đơn vị mình (batches.organization_id)
//   PROCESSOR /
//   DISTRIBUTOR : lô mà đơn vị mình đã ghi ít nhất một sự kiện;
//                 thêm includeAwaiting = true khi tra cứu ĐÚNG một lô (theo id hoặc mã) để tiếp nhận:
//                 cho thấy cả lô đang chờ vai trò mình ghi bước kế tiếp. Không dùng cho danh sách.
//
// Ví dụ:
//   const scope = batchReadScope(req.auth, { alias: 'b', startIndex: 2 });
//   db.query(`SELECT ... FROM batches b WHERE b.batch_id = $1 AND ${scope.clause}`, [batchId, ...scope.params]);
const IDENT_RE = /^[a-z_][a-z0-9_]*$/i;

function batchReadScope(auth, { alias = 'b', startIndex = 1, includeAwaiting = false } = {}) {
  if (!IDENT_RE.test(alias)) throw new Error(`alias không hợp lệ: ${alias}`);
  if (!Number.isInteger(startIndex) || startIndex < 1) throw new Error('startIndex phải là số nguyên ≥ 1');
  const p = (k) => `$${startIndex + k}`;

  if (!auth) return { clause: 'FALSE', params: [] };
  if (auth.role === ADMIN) return { clause: 'TRUE', params: [] };
  if (auth.organizationId == null) return { clause: 'FALSE', params: [] };

  if (auth.role === FARMER) {
    return { clause: `${alias}.organization_id = ${p(0)}`, params: [auth.organizationId] };
  }

  if (auth.role === PROCESSOR || auth.role === DISTRIBUTOR) {
    const handled = `EXISTS (SELECT 1 FROM supply_chain_events scope_e
        JOIN users scope_u ON scope_u.user_id = scope_e.actor_id
        WHERE scope_e.batch_id = ${alias}.batch_id AND scope_u.organization_id = ${p(0)})`;
    if (!includeAwaiting) return { clause: handled, params: [auth.organizationId] };
    return {
      clause: `(${handled} OR ${alias}.current_status = ANY(${p(1)}::text[]))`,
      params: [auth.organizationId, statusesAwaiting(auth.role)],
    };
  }

  return { clause: 'FALSE', params: [] }; // vai trò lạ: không thấy gì
}

module.exports = {
  ROLES,
  PERMISSIONS,
  can,
  requirePermission,
  EVENT_SEQUENCE,
  EVENT_TYPE_ROLE,
  nextEventType,
  canRecordEvent,
  statusesAwaiting,
  batchReadScope,
};
