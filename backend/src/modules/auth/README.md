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

## Cấu hình (`.env` ở thư mục gốc repo, sao chép từ `.env.example`)

CSDL dùng các biến sẵn có của repo (không dùng `DATABASE_URL`):

```
DB_HOST=localhost        # chạy backend trên máy; trong Docker Compose tự đặt là "database"
DB_PORT=5432
DB_NAME=food_traceability
DB_USER=postgres
DB_PASSWORD=postgres     # trùng POSTGRES_PASSWORD trong docker-compose.yml
```

Thêm cho Auth:

```
JWT_SECRET=<chuỗi ngẫu nhiên >= 32 ký tự>   # bắt buộc, không commit; thiếu hoặc ngắn thì backend dừng ngay khi khởi động
JWT_EXPIRES_IN=1h                           # tùy chọn, mặc định 1h
BCRYPT_COST=10                              # tùy chọn, mặc định 10
```

`src/app.js` nạp `backend/.env` trước, rồi `.env` ở thư mục gốc repo, nên chạy `npm run dev` trong `backend/` vẫn đọc được `.env` ở gốc.
Tạo `JWT_SECRET` nhanh: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

Cài thư viện: `npm install pg bcryptjs jsonwebtoken` (Express 5, cors, dotenv đã có sẵn).
Thêm vào `package.json`: `"scripts": { "test": "node --test test/*.test.js", "smoke:auth": "node scripts/smoke-auth.js" }`.

## Gắn vào app (`backend/src/app.js`)

```js
const { notFound, errorHandler } = require("./common/errorHandler");
const { authRouter, profileRouter } = require("./modules/auth/auth.routes");

app.use(express.json());
app.get("/api/health", /* giữ nguyên */);
app.use("/api/auth", authRouter);
app.use("/api/users", profileRouter);
// ... router của các module khác (batches, events, trace) đặt ở đây ...
app.use(notFound);      // luôn đặt sau cùng
app.use(errorHandler);  // và đây là cuối cùng
```

Các `require` của module Auth phải đứng SAU `require("dotenv").config()` vì chúng đọc `process.env` ngay khi nạp.

Express 5 tự chuyển lỗi của handler async sang `errorHandler` nên không cần wrapper `asyncHandler`.
Khi không gửi body, Express 5 để `req.body` là `undefined`; validator xử lý trường hợp này (trả 400).

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

## Kiểm thử

**1. Test đơn vị** (không cần CSDL, không cần cài thư viện):

```bash
cd backend && node --test test/*.test.js     # kỳ vọng: 33 pass, 0 fail
```

**2. Kiểm thử HTTP đầu-cuối với CSDL thật** (đăng ký -> đăng nhập -> xem hồ sơ -> đổi tên, kèm các ca lỗi):

```bash
docker compose up -d database               # CSDL, rồi tạo schema từ database/schema.sql (xem database/README.md)
cd backend && npm run dev                   # terminal 1: chạy backend (hoặc: docker compose up -d backend)
cd backend && npm run smoke:auth            # terminal 2: chạy kiểm thử HTTP
```

Script `scripts/smoke-auth.js` in `PASS` / `FAIL` từng bước và kết thúc bằng `TẤT CẢ ĐỀU PASS`. Nó kiểm tra:
201 đăng ký (PENDING, không lộ mật khẩu), 409 email trùng, 400 dữ liệu sai và JSON hỏng, 401 sai mật khẩu / không token / token sai,
403 `ACCOUNT_PENDING`, đăng nhập sau khi duyệt, `GET` và `PATCH /users/me` (không sửa được `role`), 404 đường dẫn lạ,
mật khẩu lưu bcrypt, và audit có đúng `REGISTER`, `UPDATE`, `LOGIN_FAILED`.
Chưa có endpoint Admin duyệt tài khoản nên script duyệt tạm bằng SQL. Mỗi lần chạy tạo thêm một tài khoản thử (audit chỉ ghi thêm nên không xóa được), chỉ dùng CSDL phát triển.
