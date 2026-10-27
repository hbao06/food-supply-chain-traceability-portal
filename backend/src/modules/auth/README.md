# Module Auth / Profile (W4-TV2)

Đăng ký, đăng nhập, xem và sửa hồ sơ. Hợp đồng API: `docs/openapi-spec.yaml`. Schema: `database/schema.sql`.

## Endpoint

| Method | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Công khai | Tạo tài khoản `PENDING` (chờ Admin duyệt và gán đơn vị). Không tự chọn ADMIN. |
| POST | `/api/auth/login` | Công khai | Trả `{ token, user }`. Chỉ tài khoản `ACTIVE` đăng nhập được. |
| GET | `/api/users/me` | Đã đăng nhập | Hồ sơ của mình. |
| PATCH | `/api/users/me` | Đã đăng nhập | Chỉ sửa `name`. |

## Mã lỗi (luôn dạng `{ code, message, details? }`)

| HTTP | code | Khi nào |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Sai dữ liệu; `details` = `[{ field, message }]` |
| 400 | `INVALID_JSON` | Body không phải JSON hợp lệ |
| 401 | `UNAUTHORIZED` | Thiếu header `Authorization: Bearer ...` |
| 401 | `INVALID_CREDENTIALS` | Sai email hoặc mật khẩu (cùng một thông báo) |
| 401 | `INVALID_TOKEN` / `TOKEN_EXPIRED` | Token sai / hết hạn |
| 403 | `ACCOUNT_PENDING` / `ACCOUNT_LOCKED` | Mật khẩu đúng nhưng tài khoản chưa duyệt / bị khóa |
| 403 | `FORBIDDEN` | Sai vai trò (`authorize(...)`) |
| 409 | `EMAIL_EXISTS` | Email đã đăng ký (không phân biệt hoa thường) |
| 409 | `CONFLICT` | Vi phạm ràng buộc CSDL (23505 / 23514 / 23503) |
| 500 | `INTERNAL_ERROR` | Lỗi không lường trước (chi tiết chỉ ghi log) |

## Cấu hình (`.env`)

```
JWT_SECRET=<chuỗi ngẫu nhiên >= 32 ký tự>     # bắt buộc, không commit
JWT_EXPIRES_IN=1h                             # tùy chọn
BCRYPT_COST=10                                # tùy chọn
DATABASE_URL=postgres://postgres:<mật khẩu>@database:5432/food_traceability
```

Cài thư viện: `npm install express pg bcryptjs jsonwebtoken`.

## Gắn vào app (`backend/src/app.js`)

```js
const { notFound, errorHandler } = require('./common/errorHandler');
const { authRouter, profileRouter } = require('./modules/auth/auth.routes');

app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', authRouter);
app.use('/api/users', profileRouter);
// ... các router khác (batches, events, trace) đặt ở đây ...
app.use(notFound);      // luôn đặt sau cùng
app.use(errorHandler);  // và đây là cuối cùng
```

## Quy tắc đã áp dụng

- Mật khẩu băm bằng bcrypt (bcryptjs), không bao giờ lưu, log hay trả ra. Audit không chứa mật khẩu hay hash.
- Sai email và sai mật khẩu trả cùng 401; email không tồn tại vẫn tốn thời gian so sánh như bình thường.
- Trạng thái `PENDING` / `LOCKED` chỉ lộ sau khi mật khẩu đúng.
- `REGISTER` và `UPDATE` ghi `audit_logs` cùng transaction với thay đổi; `LOGIN_FAILED` ghi tốt nhất có thể (lỗi audit không làm hỏng phản hồi 401).
- `PATCH /users/me` từ chối `role`, `email`, `status`, `organizationId` (400).
- Token chứa `sub` (userId), `role`, `organizationId`; thuật toán cố định HS256.

## Chạy test đơn vị (không cần CSDL, không cần cài thư viện)

```bash
cd backend && node --test test/*.test.js
```

## Thử thủ công

```bash
curl -s -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Nguyen Van A","email":"a@example.com","password":"password123","role":"FARMER"}'
# -> 201, status PENDING. Đăng nhập lúc này trả 403 ACCOUNT_PENDING.

# Chưa có endpoint Admin (tuần sau), duyệt tạm bằng SQL:
#   INSERT INTO organizations (name, type) VALUES ('Nông trại thử', 'FARM');
#   UPDATE users SET organization_id = (SELECT organization_id FROM organizations WHERE name='Nông trại thử'),
#                    status = 'ACTIVE' WHERE email = 'a@example.com';

curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"a@example.com","password":"password123"}'
curl -s localhost:3000/api/users/me -H "Authorization: Bearer <token>"
curl -s -X PATCH localhost:3000/api/users/me -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' -d '{"name":"Tên mới"}'
```
