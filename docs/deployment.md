# Hướng dẫn triển khai và kiểm tra Docker (W8-TV4)

Tài liệu này bổ sung cho mục chạy Docker trong `README.md` (cách chạy cơ bản, biến môi
trường, xử lý sự cố thường gặp). Nội dung ở đây gồm: bảng kiểm cho các ca triển khai
TC-DEP-01..03 trong `docs/test/test-plan.md`, và quy trình chuyển bản demo sang cấu
hình an toàn hơn theo `docs/security/security-checklist.md` (mục triển khai, W8-TV4):
backend kết nối CSDL bằng vai trò `fsc_app` thay vì superuser `postgres`.

## 1. Kiểm tra TC-DEP trên máy có Docker

Điều kiện: Docker Desktop đang chạy; đang ở thư mục gốc của repo.

| Mã | Cách kiểm | Kết quả mong đợi |
|---|---|---|
| TC-DEP-01 | Tạo `.env` theo README, chạy `docker compose up --build`, chờ các service ổn định rồi chạy `docker compose ps`; mở `http://localhost:5173` | Cả 3 service (frontend, backend, database) đều chạy; backend không báo lỗi kết nối CSDL trong `docker compose logs backend`; giao diện frontend mở được |
| TC-DEP-02 | Chạy backend mà không đặt `JWT_SECRET` (hoặc đặt ngắn hơn 32 ký tự) | Backend dừng ngay và log nêu rõ `JWT_SECRET phải được đặt trong .env và dài tối thiểu 32 ký tự` (kiểm tra tại `backend/src/config/env.js`); không chạy với giá trị mặc định |
| TC-DEP-03 | Chiếm trước cổng 5173 (hoặc 3000) rồi `docker compose up` | Docker báo xung đột cổng; xử lý: đổi phía trái của ánh xạ cổng trong `docker-compose.yml` (ví dụ `"5174:5173"`) rồi chạy lại  Trên Windows, tiến trình chiếm cổng phải giữ cổng ở tầng bind (ví dụ một container Docker khác); listener tạm chỉ nghe 127.0.0.1 có thể bị Docker bind chồng nên không tạo xung đột. |

Sau khi kiểm xong, dừng bằng `docker compose down` (không thêm `-v` để giữ dữ liệu
trong volume `postgres_data`).

## 2. Chuyển backend sang vai trò `fsc_app` cho bản demo

Vai trò `fsc_app` do migration `006_app_db_role.sql` tạo (quyền tối thiểu, không sửa
được lịch sử sự kiện và audit — chi tiết và bằng chứng kiểm thử ở `database/Readme.md`).
Mặc định `docker-compose.yml` vẫn chạy bằng `postgres` để máy mới clone về chạy được
ngay; khi demo hoặc triển khai thì chuyển như sau:

1. Chạy hệ thống một lần với cấu hình mặc định và chạy migration như hướng dẫn ở
   `database/Readme.md` (migration luôn chạy bằng tài khoản quản trị `postgres`).
2. Đặt mật khẩu đăng nhập cho `fsc_app`:
   `docker compose exec database psql -U postgres -d food_traceability -c "ALTER ROLE fsc_app LOGIN PASSWORD '<mật khẩu mạnh>'"`
3. Tạo (hoặc sửa) file `.env` ở thư mục gốc của repo, thêm hai dòng:
   `BACKEND_DB_USER=fsc_app` và `BACKEND_DB_PASSWORD=<mật khẩu ở bước 2>`.
   Compose tự đọc file này và truyền vào service backend qua hai biến
   `BACKEND_DB_USER` / `BACKEND_DB_PASSWORD` trong `docker-compose.yml`
   (không đặt thì mặc định vẫn là `postgres` / `postgres`).
4. Khởi động lại backend: `docker compose up -d backend`. Kiểm tra nhanh: đăng nhập,
   tạo một lô, mở trang truy xuất bằng QR — các luồng phải chạy bình thường.
5. Đổi mật khẩu của chính `postgres`: với volume đã khởi tạo từ trước, biến
   `POSTGRES_PASSWORD` trong compose **không còn tác dụng**; đổi bằng lệnh:
   `docker compose exec database psql -U postgres -c "ALTER ROLE postgres PASSWORD '<mật khẩu mới>'"`.
   Làm bước này **sau** bước 4 (khi backend không còn dùng `postgres` nữa) và ghi lại
   mật khẩu mới ở nơi an toàn của nhóm — các lần chạy migration sau vẫn cần nó.

## 3. Lưu ý cổng và truy cập

- Cổng CSDL phía host chỉ mở ở `127.0.0.1:15432` (máy khác trong cùng mạng không nối trực tiếp được). Cổng `5432` chỉ dùng trong mạng nội bộ Docker và khi kết nối tới PostgreSQL cài trực tiếp trên máy; frontend 5173 và backend 3000 mở trên máy chạy Docker.
- Muốn demo cho máy khác cùng mạng xem giao diện: mở `http://<IP LAN của máy>:5173`
  và đặt `CORS_ORIGIN` / `TRACE_BASE_URL` tương ứng trong `.env` trước khi build lại
  frontend.
