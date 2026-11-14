# Food Supply Chain Traceability & Provenance Portal

Đồ án môn **Công nghệ Phần mềm (502045)** — **Nhóm 13 · Đề tài 19**.

Hệ thống truy xuất nguồn gốc thực phẩm: ghi nhận lịch sử lô hàng xuyên suốt chuỗi cung ứng và cho phép người tiêu dùng tra cứu nguồn gốc bằng mã QR hoặc mã lô.

## Chức năng chính

- **Quản lý lô:** Farmer tạo lô (mã lô duy nhất, mã QR), xem, sửa khi lô còn ở trạng thái `CREATED`, lọc và tìm kiếm.
- **Chuỗi sự kiện:** Distributor và Processor ghi sự kiện đúng vai trò và đúng thứ tự `CREATED → TRANSPORTED → RECEIVED → PROCESSED → PACKAGED → SHIPPED`; timeline của lô hiển thị đơn vị, địa điểm, thời gian.
- **Truy xuất công khai:** người tiêu dùng quét QR hoặc nhập mã lô, không cần đăng nhập, chỉ thấy dữ liệu được phép công khai.
- **Xác thực và phân quyền (RBAC):** JWT, mật khẩu băm bcrypt; Admin duyệt tài khoản, gán đơn vị, khóa/mở khóa, quản lý đơn vị.
- **Lịch sử chỉ thêm mới:** sự kiện và nhật ký không sửa, không xóa được; mọi thay đổi có dòng audit.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Frontend | React / Vite |
| Backend | Node.js + Express 5, REST API (đặc tả OpenAPI 3.1) |
| Database | PostgreSQL 16 |
| Xác thực | JWT, bcrypt, RBAC |
| Triển khai | Docker, Docker Compose |

## Cấu trúc dự án

```text
├── frontend/       # Giao diện người dùng
├── backend/        # API và xử lý nghiệp vụ (src/modules: auth, batches, events, trace, admin, health)
├── database/       # schema.sql, migrations, kiểm tra ràng buộc
├── tests/          # Kiểm thử
├── docs/           # SRS, UML, ERD, đặc tả API (openapi-spec.yaml)
├── .github/        # CI và mẫu Pull Request
├── .env.example    # Mẫu cấu hình môi trường
└── docker-compose.yml
```

## Phân công chính

| Thành viên | Phụ trách |
|---|---|
| Hoài Bảo | Frontend / UI-UX |
| Chung Nguyễn Minh Trí | Backend / API |
| Đặng Vĩnh Quang | Database / Auth / Security |
| Lê Bá Khánh Bình | QA / DevOps / Leader |

## Cài đặt và chạy

**Yêu cầu:** Git, Node.js 20 trở lên (khuyến nghị 22), PostgreSQL 16 hoặc Docker Desktop.

### 1. Lấy mã nguồn và cấu hình

```bash
git clone <REPOSITORY_URL>
cd food-supply-chain-traceability-portal
```

Sao chép `.env.example` thành `.env` (ở thư mục gốc) rồi điền:

| Biến | Ý nghĩa |
|---|---|
| `PORT` | Cổng backend (mặc định 3000) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Kết nối PostgreSQL. Chạy backend trên máy: `DB_HOST=localhost`. Với Docker Compose, `DB_PASSWORD` mặc định `postgres` |
| `JWT_SECRET` | **Bắt buộc**, tối thiểu 32 ký tự, không commit |
| `QR_HMAC_SECRET` | **Bắt buộc để tạo lô**, tối thiểu 32 ký tự, không commit |
| `TRACE_BASE_URL` | Địa chỉ trang truy xuất mà mã QR trỏ tới (mặc định `http://localhost:5173`) |
| `JWT_EXPIRES_IN`, `BCRYPT_COST` | Tùy chọn (mặc định `1h`, `10`) |
| `RATE_LIMIT_DISABLED`, `RATE_LIMIT_TRACE_MAX` | Tùy chọn: tắt hoặc chỉnh giới hạn tần suất khi thử nghiệm/demo |
| Biến tạo Admin đầu tiên | Xem `.env.example` và `database/Readme.md` |

Tạo chuỗi bí mật: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### 2. Cơ sở dữ liệu

Bật PostgreSQL (Docker: `docker compose up -d database`; hoặc PostgreSQL cài trên máy, tự tạo CSDL `food_traceability`). Rồi tạo bảng và Admin:

```bash
cd backend
npm install
npm run db:migrate        # tạo/cập nhật bảng
npm run db:seed:admin     # tạo Admin đầu tiên (chi tiết: database/Readme.md)
```

### 3. Chạy ứng dụng

Hai terminal riêng:

```bash
# Backend (http://localhost:3000)
cd backend
npm run dev

# Frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Hoặc chạy cả ba dịch vụ bằng Docker (đã chạy bước 2 trên máy với `DB_HOST=localhost`):

```bash
docker compose up --build
```

Kiểm tra backend: mở `http://localhost:3000/api/health` (tiến trình) và `http://localhost:3000/api/health/ready` (có kết nối CSDL).

### 4. Luồng sử dụng mẫu

1. Người dùng đăng ký (Farmer, Distributor hoặc Processor): tài khoản ở trạng thái chờ duyệt.
2. Admin đăng nhập, tạo đơn vị (`POST /api/organizations`), gán đơn vị cho tài khoản (`PATCH /api/users/{id}/organization`) rồi duyệt (`PATCH /api/users/{id}/status` với `{"status":"ACTIVE"}`).
3. Farmer tạo lô; Distributor và Processor lần lượt ghi sự kiện; xem timeline của lô.
4. Người tiêu dùng mở `/trace/...` từ mã QR hoặc gọi `GET /api/trace/code/{batchCode}` (không cần đăng nhập).

## Tài liệu API

Đặc tả đầy đủ (24 endpoint, mã lỗi, ví dụ) nằm ở [`docs/openapi-spec.yaml`](docs/openapi-spec.yaml). Để xem dạng giao diện: mở [editor.swagger.io](https://editor.swagger.io), chọn **File > Import file** và chọn file này.

Quy ước chung:
- Mọi lỗi trả về dạng `{ "code": "...", "message": "...", "details": [...] }`; `code` ổn định để frontend hiển thị thông báo.
- Danh sách trả về `{ items, page, limit, total }`, `limit` tối đa 100.
- Lô ngoài phạm vi truy cập trả 404 giống lô không tồn tại.
- Xác thực: header `Authorization: Bearer <token>` (lấy từ `POST /api/auth/login`).

## Kiểm thử

```bash
cd backend
node --test test/*.test.js     # kiểm thử đơn vị, không cần CSDL

# Kiểm thử HTTP đầu-cuối với CSDL thật (cần backend đang chạy ở terminal khác):
npm run smoke:auth      # đăng ký, đăng nhập, hồ sơ
npm run smoke:batches   # lô
npm run smoke:events    # sự kiện và timeline
npm run smoke:trace     # truy xuất công khai
npm run smoke:admin     # quản trị
npm run check:openapi   # mọi endpoint trong OpenAPI phải có trên backend

# Kiểm tra ràng buộc cơ sở dữ liệu (xem database/Readme.md):
psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 -f database/tests/schema-check.sql
```

Các script smoke tạo dữ liệu thử mới ở mỗi lần chạy (nhật ký chỉ ghi thêm nên không xóa được): chỉ chạy trên CSDL phát triển.

## Xử lý sự cố thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Backend dừng với "JWT_SECRET phải được đặt..." | Đặt `JWT_SECRET` (>= 32 ký tự) trong `.env`, chạy lại backend |
| Tạo lô trả 500 | Đặt `QR_HMAC_SECRET` (>= 32 ký tự) trong `.env`, chạy lại backend |
| `ECONNREFUSED ... 5432` | PostgreSQL chưa chạy hoặc sai `DB_HOST`/`DB_PORT` |
| `password authentication failed` | `DB_PASSWORD` trong `.env` không khớp mật khẩu PostgreSQL |
| `relation ... does not exist` | Chưa chạy `npm run db:migrate` |
| Đăng nhập trả 403 `ACCOUNT_PENDING` | Tài khoản chờ Admin gán đơn vị và duyệt |
| Nhận 429 khi thử nghiệm | Đặt `RATE_LIMIT_DISABLED=true` trong `.env` và chạy lại backend |
| Sửa `.env` mà không có tác dụng | Tắt backend (Ctrl+C) và chạy lại, `.env` chỉ được đọc khi khởi động |

## Quy ước đóng góp

- Tạo branch riêng từ `main`: `feature/`, `feat/`, `fix/`, `test/`, `docs/` hoặc `chore/`.
- Commit theo dạng `<type>: <mô tả ngắn>`, ví dụ `feat: add batch API`.
- Tạo Pull Request kèm Issue liên quan và kết quả kiểm thử; merge sau khi được review và CI thành công.
- Trao đổi với thành viên liên quan trước khi thay đổi API contract hoặc phần việc chung.
- Không commit `.env`, mật khẩu, khóa API hoặc token.

## Tài liệu

SRS, UML, ERD, ma trận quyền và đặc tả REST API được lưu trong thư mục `docs/`; hướng dẫn cơ sở dữ liệu ở `database/Readme.md`; mỗi module backend có `README.md` riêng trong `backend/src/modules/<tên>/`.
