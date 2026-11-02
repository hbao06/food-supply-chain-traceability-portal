# Middleware bảo mật (W4-TV3)

**Người phụ trách:** Đặng Vĩnh Quang (TV3 - Database / Auth / Security) · **Review:** Chung Nguyễn Minh Trí (TV2)

Các module Batch / Event / Trace / Admin (tuần 5–7) dùng các middleware dưới đây thay vì tự viết kiểm tra quyền.
Quyền theo vai trò lấy từ `docs/permission-matrix.md`; mã lỗi theo quy ước chung (401 / 403 / 404 / 429).

| File | Dùng để | Lỗi trả về |
| --- | --- | --- |
| `authenticate.js` (TV2) | Kiểm tra JWT, gắn `req.auth` | 401 `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` |
| `currentUser.js` | Đọc lại tài khoản từ CSDL mỗi yêu cầu: tài khoản vừa bị khóa hoặc đổi vai trò / đơn vị không dùng tiếp quyền cũ trong token | 401; 403 `ACCOUNT_PENDING` / `ACCOUNT_LOCKED` |
| `rbac.js` | Quyền theo vai trò (`requirePermission`), phạm vi đọc lô (`batchReadScope`), vai trò ghi sự kiện (`canRecordEvent`) | 403 `FORBIDDEN` (sai vai trò); ngoài phạm vi → service trả 404 |
| `rateLimit.js` | Giới hạn tần suất theo IP | 429 `TOO_MANY_REQUESTS` + `Retry-After` |
| `securityHeaders.js` | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` | – |

## 1. Bảo vệ một route

```js
const { requireAuth } = require('../auth/auth.routes');           // [authenticate, loadCurrentUser]
const { requirePermission } = require('../../middleware/rbac');

router.post('/',            requireAuth, requirePermission('batch:create'), controller.create);
router.get('/:batchId',     requireAuth, requirePermission('batch:read'),   controller.getById);
router.post('/:batchId/events', requireAuth, requirePermission('event:create'), controller.addEvent);
```

Luôn dùng `requireAuth` (không dùng `authenticate` một mình) cho route nội bộ.
Sau `requireAuth`, `req.auth = { userId, role, organizationId, status }` là dữ liệu **lấy từ CSDL**.
`requirePermission` kiểm tra thêm `status === 'ACTIVE'`; nếu route quên `requireAuth` (req.auth chỉ từ token, không có `status`) thì trả 500 kèm log nêu tên route, để phát hiện ngay khi chạy thử.

Tên quyền có sẵn (`PERMISSIONS` trong `rbac.js`):

| Quyền | Vai trò |
| --- | --- |
| `profile:read`, `profile:update`, `batch:read`, `event:read`, `timeline:read`, `qr:read` | Mọi vai trò nội bộ |
| `batch:create`, `batch:update` | FARMER |
| `event:create` | PROCESSOR, DISTRIBUTOR (CREATED do hệ thống ghi khi tạo lô) |
| `user:read`, `user:change-role`, `user:change-status`, `organization:read`, `organization:write`, `audit:read` | ADMIN |

Gõ sai tên quyền thì ứng dụng báo lỗi ngay khi khởi động, không đợi tới lúc có người gọi API.

## 2. Lọc phạm vi lô trong SQL (404 khi ngoài phạm vi)

`requirePermission` chỉ kiểm tra **vai trò**. Việc **lô nào** được thấy phải lọc ngay trong câu SQL bằng `batchReadScope`, để lô ngoài phạm vi trả 404 giống hệt lô không tồn tại (US-S02 AC04).

```js
const { batchReadScope } = require('../../middleware/rbac');

// Chi tiết một lô: $1 = batchId, phạm vi bắt đầu từ $2
const scope = batchReadScope(req.auth, { alias: 'b', startIndex: 2, includeAwaiting: true });
const r = await db.query(
  `SELECT b.* FROM batches b WHERE b.batch_id = $1 AND ${scope.clause}`,
  [batchId, ...scope.params]
);
if (!r.rows[0]) throw new NotFoundError();   // ngoài phạm vi hoặc không tồn tại: cùng 404

// Danh sách lô: KHÔNG dùng includeAwaiting
const list = batchReadScope(req.auth, { alias: 'b', startIndex: 1 });
await db.query(`SELECT ... FROM batches b WHERE ${list.clause} ORDER BY b.creation_date DESC LIMIT ...`, [...list.params]);
```

| Vai trò | Thấy lô nào |
| --- | --- |
| ADMIN | Mọi lô |
| FARMER | Lô có `organization_id` = đơn vị mình |
| PROCESSOR, DISTRIBUTOR | Lô mà đơn vị mình đã ghi ít nhất một sự kiện. Với `includeAwaiting: true` (chỉ khi tra **đúng một** lô theo id hoặc mã để tiếp nhận): thêm lô đang chờ vai trò mình ghi bước kế tiếp |

## 3. Ghi sự kiện

```js
const { canRecordEvent, nextEventType } = require('../../middleware/rbac');

if (!canRecordEvent(req.auth.role, body.eventType)) throw new ForbiddenError();          // 403 sai vai trò
if (body.eventType !== nextEventType(batch.current_status)) throw new ConflictError('INVALID_SEQUENCE'); // 409
// Chỉ cần INSERT vào supply_chain_events: CSDL tự cập nhật batches.current_status trong cùng transaction.
```

CSDL cũng kiểm tra lại vai trò và thứ tự bằng trigger (lớp chặn cuối), nên nếu backend sót thì vẫn bị từ chối (SQLSTATE `23514` → 409).

## 4. Giới hạn tần suất

Đã gắn sẵn trong `app.js`:

| Route | Đếm | Mặc định | Biến `.env` |
| --- | --- | --- | --- |
| `POST /api/auth/login` | Chỉ lần **sai** (phản hồi ≥ 400), theo IP + email | 10 lần / 15 phút | `RATE_LIMIT_LOGIN_MAX` |
| `POST /api/auth/register` | Mọi lần, theo IP | 30 lần / 15 phút | `RATE_LIMIT_REGISTER_MAX` |

Đăng nhập đúng không bị tính, và khóa theo IP + email nên cả lớp dùng chung một IP vẫn đăng nhập bình thường.
Tắt hẳn khi `NODE_ENV=test` hoặc `RATE_LIMIT_DISABLED=true` (smoke test, demo). Cửa sổ thời gian: `RATE_LIMIT_WINDOW_MINUTES`.

Dùng lại cho truy xuất công khai (FR-QR-08, tuần 7):

```js
const { createRateLimiter } = require('../../middleware/rateLimit');
const traceLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
router.get('/:qrToken', traceLimiter, controller.traceByToken);
```

Bộ đếm nằm trong bộ nhớ của một tiến trình Node (đủ cho một container backend), tối đa `maxKeys` khóa (mặc định 10 000; đầy thì bỏ khóa hết hạn rồi tới khóa cũ nhất). Nếu đặt sau reverse proxy cần `app.set('trust proxy', 1)`.

## 5. Kiểm thử

```bash
cd backend && npm test        # gồm currentUser, rbac, rateLimit, securityHeaders, passwordPolicy, migrator, seedAdmin
```
