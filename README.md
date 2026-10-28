# Food Supply Chain Traceability & Provenance Portal

Đồ án môn **Công nghệ Phần mềm (502045)** — **Nhóm 13 · Đề tài 19**.

Hệ thống truy xuất nguồn gốc thực phẩm, ghi nhận lịch sử lô hàng xuyên suốt chuỗi cung ứng và cho phép người tiêu dùng tra cứu thông tin bằng mã QR.

## Chức năng chính

- Quản lý lô hàng và các sự kiện sản xuất, vận chuyển, chế biến, đóng gói, phân phối.
- Hiển thị nguồn gốc và dòng thời gian của lô hàng qua mã QR.
- Xác thực người dùng và phân quyền theo vai trò (RBAC).
- Lưu lịch sử truy vết theo cơ chế chỉ thêm mới; điều chỉnh được ghi bằng sự kiện bổ sung.

## Công nghệ dự kiến

| Thành phần | Công nghệ |
|---|---|
| Frontend | React / Next.js |
| Backend | Node.js + Express / NestJS, REST API |
| Database | PostgreSQL |
| Xác thực | JWT, RBAC |
| Triển khai | Docker, Docker Compose |

Frontend giao tiếp với backend qua REST API. Backend xử lý nghiệp vụ, kiểm tra thứ tự sự kiện và truy cập cơ sở dữ liệu.

## Cấu trúc dự án

```text
├── frontend/       # Giao diện người dùng
├── backend/        # API và xử lý nghiệp vụ
├── database/       # Schema và migration
├── tests/          # Kiểm thử
├── docs/           # SRS, UML, ERD và đặc tả API
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

**Yêu cầu:** Git, Node.js LTS; Docker và Docker Compose nếu chạy bằng container.

1. Clone repository:

   ```bash
   git clone <REPOSITORY_URL>
   cd food-supply-chain-traceability-portal
   ```

2. Sao chép `.env.example` thành `.env`, sau đó đặt `DB_PASSWORD` (trùng `POSTGRES_PASSWORD` trong `docker-compose.yml`), `JWT_SECRET` (tối thiểu 32 ký tự) và các biến cần thiết.

3. Cài đặt và chạy frontend, backend trong hai terminal riêng:

   **Frontend**

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   **Backend**

   ```bash
   cd backend
   npm install
   npm run dev
   ```

Có thể chạy bằng Docker khi cấu hình Compose đã hoàn tất:

```bash
docker compose up --build
```

## Quy ước đóng góp

- Tạo branch riêng từ `main`: `feature/`, `fix/`, `test/`, `docs/` hoặc `chore/`.
- Commit theo dạng `<type>: <mô tả ngắn>`, ví dụ `feat: add batch API`.
- Tạo Pull Request kèm Issue liên quan và kết quả kiểm thử; merge sau khi được review và CI thành công.
- Trao đổi với thành viên liên quan trước khi thay đổi API contract hoặc phần việc chung.
- Không commit `.env`, mật khẩu, khóa API hoặc token.

## Tài liệu

Các tài liệu SRS, UML, ERD và đặc tả REST API được lưu trong thư mục `docs/`.
