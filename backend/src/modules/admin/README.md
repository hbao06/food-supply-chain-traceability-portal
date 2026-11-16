# Module Admin (W8-TV2): quản trị

Duyệt và quản lý tài khoản, quản lý đơn vị, tra cứu nhật ký. **Chỉ vai trò ADMIN** (vai trò khác nhận 403). Hợp đồng API: `docs/openapi-spec.yaml`.

## Endpoint

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET | `/api/users` | Danh sách tài khoản, lọc `status`, `role`, phân trang. Có `organizationName`, không có mật khẩu. |
| PATCH | `/api/users/{userId}/organization` | Gán đơn vị (loại đơn vị phải khớp vai trò). |
| PATCH | `/api/users/{userId}/status` | `ACTIVE` = duyệt hoặc mở khóa, `LOCKED` = khóa. |
| PATCH | `/api/users/{userId}/role` | Đổi vai trò FARMER / PROCESSOR / DISTRIBUTOR, có thể kèm `organizationId`. |
| GET | `/api/organizations` | Danh sách đơn vị, lọc `type`, phân trang. |
| POST | `/api/organizations` | Tạo đơn vị `{ name, type, address? }`. |
| PATCH | `/api/organizations/{organizationId}` | Sửa `name`, `type`, `address`. Không có endpoint xóa đơn vị. |
| GET | `/api/audit-logs` | Nhật ký, lọc `entityType`, `entityId`, `actorId`, `action`, `from`, `to`, phân trang, mới nhất trước. |

## Luồng duyệt tài khoản mới

1. Người dùng đăng ký: tài khoản `PENDING`, chưa có đơn vị, chưa đăng nhập được (403 `ACCOUNT_PENDING`).
2. Admin gán đơn vị: `PATCH /users/{id}/organization` (đơn vị FARM cho Farmer, PROCESSOR cho Processor, DISTRIBUTOR cho Distributor).
3. Admin duyệt: `PATCH /users/{id}/status` với `{ "status": "ACTIVE" }`. Chưa có đơn vị thì 409 `ORGANIZATION_REQUIRED`.
4. Khóa tài khoản có hiệu lực ngay, kể cả với token đã cấp (`currentUser` đọc lại CSDL mỗi yêu cầu).

## Quy tắc

- **Mọi thay đổi ghi audit cùng transaction:** `ASSIGN_ORGANIZATION`, `APPROVE`, `UNLOCK`, `LOCK`, `CHANGE_ROLE` (USER), `CREATE`, `UPDATE` (ORGANIZATION), kèm giá trị cũ và mới. Lỗi ở bước audit thì hoàn tác cả thay đổi.
- **Không đổi vai trò Admin qua API** và không gán `ADMIN` (Admin do `npm run db:seed:admin` tạo). Admin không thuộc đơn vị nào.
- **Admin không tự khóa mình** (409 `CANNOT_MODIFY_SELF`); không khóa Admin đang hoạt động cuối cùng (409 `LAST_ADMIN`).
- **Đổi vai trò cần đơn vị cùng loại:** lệch thì 409 `ORG_TYPE_MISMATCH`; gửi kèm `organizationId` để đổi cả hai cùng lúc.
- **Đơn vị đã có thành viên hoặc lô không đổi loại** (409 `ORGANIZATION_IN_USE`); trùng tên và loại thì 409 `ORGANIZATION_EXISTS`.
- Đặt lại đúng giá trị đang có thì trả 200, không ghi audit.
- Dòng tài khoản được khóa (`FOR UPDATE`) khi sửa, nên hai Admin không sửa chồng nhau. Trigger của CSDL vẫn là lớp chặn cuối.

## Gắn vào app (`backend/src/app.js`)

```js
const { adminRouter } = require("./modules/admin/admin.routes");
const { healthRouter } = require("./modules/health/health.routes");

app.use("/api/users", profileRouter);      // có sẵn: /api/users/me
app.use("/api", adminRouter);              // đặt SAU profileRouter, trước notFound
app.use("/api/health", healthRouter);      // /api/health/ready kiểm tra kết nối CSDL
```

## Kiểm thử

```bash
cd backend
node --test test/*.test.js     # không cần CSDL
npm run dev                    # terminal 1
npm run smoke:admin            # terminal 2: kiểm thử HTTP với CSDL thật, kỳ vọng "TẤT CẢ ĐỀU PASS"
npm run check:openapi          # mọi endpoint trong OpenAPI phải có trên backend
```
