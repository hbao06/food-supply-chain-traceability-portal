# Báo cáo kiểm thử Tuần 8 (W8-TV4)

| Thông tin | Nội dung |
|---|---|
| Tuần | 8 — Hồi quy toàn bộ, đo coverage, Docker, báo cáo (theo mục 7 của test-plan) |
| Người lập | TV4 (Lê Bá Khánh Bình), QA / DevOps |
| Ngày lập | 14/11/2026 |
| Mã nguồn kiểm thử | `main` tại 1e77cb2 (sau khi PR #59 và PR #62 merge) cộng phần việc W8-TV4 trong PR này |
| Môi trường | Backend: `node --test` với Express và CSDL giả trong bộ nhớ (không cần PostgreSQL); Frontend: `node --test`, ESLint, Vite build; Docker: theo mục 4 |

## 1. Kết quả hồi quy tự động

| Bộ kiểm thử | Tổng | Đạt | Không đạt | Bỏ qua | Ghi chú |
|---|---|---|---|---|---|
| Backend (`npm test`) | 274 | 274 | 0 | 0 | Trước tuần 8: 266 đạt, 8 bỏ qua (TC-QR-04, 11–17 chờ PR #59) |
| Frontend (`npm test`) | 19 | 19 | 0 | 0 | Kèm `npm run lint` đạt và `npm run build` đạt |

## 2. Nhóm TC-QR và truy xuất công khai: 17/17 đạt

PR #59 (W7-TV2) đã merge, endpoint `/api/trace` có trên `main`, nên 8 ca còn treo được
bỏ đánh dấu bỏ qua và chạy thật trong `backend/test/qr.http.test.js`:

- Harness nối **module trace thật** (service + controller) với repo giả đọc cùng dữ
  liệu trong bộ nhớ với repo lô, trả đúng hình dạng của hai view công khai
  `public_batch_trace` / `public_event_trace`.
- Rate limiter dựng theo đúng cấu hình bản thật (60 yêu cầu/phút/IP) và được đặt lại
  (`reset()`) trước mỗi ca, nên TC-QR-17 kiểm được yêu cầu thứ 61 trả 429 mà không
  bị các ca trước làm nhiễu bộ đếm.
- TC-QR-04, 11, 12, 13, 14, 15, 16, 17: đều đạt; file test chạy lặp 3 lần cho kết
  quả ổn định. Trạng thái trong `docs/test/test-plan.md` mục 5.1 đã cập nhật tương ứng.

## 3. Coverage và cổng chất lượng (NFR-05, TC-QA-01, TC-QA-04)

- Đo bằng trình chạy test tích hợp của Node trên toàn bộ backend:
  **dòng 93,47% — nhánh 96,19% — hàm 87,13%**, đều vượt ngưỡng 60% của test-plan
  (mục tiêu 80% cho module lõi cũng đạt ở mức toàn dự án).
- Thêm script `npm run test:coverage` (trong `backend/package.json`) chạy test kèm
  ngưỡng cứng 60% cho cả ba chỉ số, và thêm bước **Backend - coverage** vào CI
  (`.github/workflows/ci.yml`). CI chuyển sang Node 22 vì cờ ngưỡng coverage
  (`--test-coverage-lines` và tương tự) chỉ có từ Node 22; Node 20 chưa hỗ trợ.
- Đã kiểm chứng cơ chế cổng tại máy: chạy cùng lệnh với ngưỡng dòng 99% cho kết quả
  thất bại với lỗi `93.47% line coverage does not meet threshold of 99%` và mã thoát 1 —
  tức coverage dưới ngưỡng thì CI đỏ và chặn merge, đúng kỳ vọng của TC-QA-04.
- Phạm vi cổng: áp dụng cho backend (nơi chứa toàn bộ API test). Frontend hiện có
  19 test đạt + lint + build trong CI nhưng chưa đo coverage riêng; ghi nhận là việc
  cải tiến tiếp theo, không thuộc tiêu chí ra của tuần 8.

## 4. Nhóm TC-DEP (Docker)

Chạy trên máy Windows có Docker Desktop theo `docs/deployment.md`. Cột kết quả điền
từ lần chạy thực tế trước khi merge PR này:

| Mã | Kết quả |
|---|---|
| TC-DEP-01 | Đạt — docker compose ps: 3 service Up; frontend http://localhost:5173 trả 200 (cổng CSDL phía host đổi sang 15432 vì Windows giữ cổng 5432) |
| TC-DEP-02 | Đạt — backend dừng với lỗi nêu rõ JWT_SECRET phải được đặt |
| TC-DEP-03 | Đạt — chiếm trước cổng 5173 bằng một container Docker khác: Compose báo lỗi bind (ports are not available), frontend không khởi động được; giải phóng cổng thì cả 3 service Up, frontend trả 200. Ghi chú: listener tạm chỉ nghe 127.0.0.1 không tạo xung đột bind trên Windows/Docker Desktop (SO_REUSEADDR cho phép bind chồng) nên không dùng làm bằng chứng. |

Phần chuẩn bị đã xong trong PR này: `docker-compose.yml` cho phép chọn tài khoản
CSDL của backend qua `BACKEND_DB_USER` / `BACKEND_DB_PASSWORD` (mặc định giữ nguyên
`postgres`), và `docs/deployment.md` mô tả quy trình chuyển bản demo sang vai trò
`fsc_app` + đổi mật khẩu `postgres` (hạng mục triển khai của TV4 trong
`docs/security/security-checklist.md`).

## 5. Yêu cầu phi chức năng liên quan

- **NFR-01 (truy xuất công khai dưới 3 giây):** TC-QR-11 đạt trong harness (phản hồi
  cục bộ, chỉ mang tính tương đối). Số đo chính thức trên bản triển khai thật thực
  hiện trên bản Docker ở mục 4: mở trang truy xuất bằng token hợp lệ và ghi thời
  gian phản hồi tại đó.
- **NFR-04 (giới hạn 60 yêu cầu/phút/IP):** đạt qua TC-QR-17.
- **NFR-05 (coverage từ 60% trong CI):** đạt — xem mục 3.

## 6. Việc còn mở ngoài phạm vi báo cáo này

- PR #64 (W8-TV2: API quản trị, health check, OpenAPI, README) đang chờ review của
  TV1. Sau khi PR #64 merge, CI trên `main` sẽ chạy lại toàn bộ hồi quy gồm cả phần
  mới (số test tăng theo PR #64); kết quả đó là căn cứ chốt tiêu chí ra cuối cùng.
- TC-SEC-10 và các kiểm tra mức CSDL chạy bằng `database/tests/schema-check.sql`
  trên PostgreSQL thật (phạm vi TV3), không chạy trong bộ test tự động của báo cáo này.
