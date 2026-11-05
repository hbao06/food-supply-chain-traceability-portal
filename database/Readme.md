# Database

PostgreSQL 16 (service `database` trong `docker-compose.yml`, CSDL `food_traceability`).

| File | Nội dung |
| --- | --- |
| `migrations/001_init_schema.sql` | Schema v1 (W3): 6 bảng, ràng buộc, trigger toàn vẹn, view công khai |
| `migrations/002_roles_table.sql` | Bảng `roles`; `users.role` thành khóa ngoại tới `roles` (W4) |
| `migrations/003_products_farms.sql` | Bảng `products`, cột `batches.product_id` (không bắt buộc), view `farms` (W5) |
| `tests/schema-check.sql` | 53 ca kiểm tra ràng buộc; dữ liệu thử được ROLLBACK |
| `schema.sql` | Bản v1 của Tuần 3, giữ để tham chiếu (giống hệt `001`, có test chặn lệch). **Không dùng để tạo CSDL nữa** |

Thiết kế và từ điển dữ liệu: [`docs/ERD/Readme.md`](../docs/ERD/Readme.md) · sơ đồ: [`docs/ERD/ERD-v3.pdf`](../docs/ERD/ERD-v3.pdf).

Bảng: `roles`, `organizations`, `products`, `users`, `batches`, `qr_codes`, `supply_chain_events`, `audit_logs`, và `schema_migrations` (do trình chạy migration quản lý).

## Tạo / cập nhật CSDL (từ Tuần 4)

Cần `.env` ở thư mục gốc repo có `DB_HOST=localhost`, `DB_PASSWORD=postgres` (khi dùng Docker Compose).

```bash
docker compose up -d database

cd backend
npm run db:migrate              # chạy các migration chưa chạy, theo thứ tự
npm run db:migrate -- --status  # xem file nào đã chạy / chưa chạy
npm run db:seed:admin           # tạo Admin đầu tiên từ ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD trong .env
npm run db:seed:demo            # (tùy chọn) nạp dữ liệu mẫu cho phát triển / demo / kiểm thử – xem mục bên dưới
```

- CSDL đã tạo tay từ `schema.sql` ở Tuần 3: lần đầu chạy `db:migrate` sẽ ghi nhận `001` là đã chạy (baseline) và chỉ chạy các file sau (`002`, `003`…). **Không cần xóa dữ liệu.**
- Mỗi file chạy trong một transaction; lỗi thì không thay đổi gì. Có khóa để hai người không chạy cùng lúc.
- **Không sửa file migration đã chạy.** Trình chạy lưu checksum và sẽ dừng nếu nội dung bị sửa. Muốn thay đổi CSDL thì thêm file mới `004_ten_thay_doi.sql` (không viết `BEGIN`/`COMMIT` trong file).
- Làm lại từ đầu: `docker compose down -v` (xóa volume `postgres_data`), rồi chạy lại các lệnh trên.

Kiểm tra ràng buộc (CSDL trống, sau khi migrate):

```bash
docker compose exec -T database psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 < database/tests/schema-check.sql
```

Kết quả mong đợi: mọi dòng `PASS ...` và dòng cuối `ALL CHECKS PASSED`.

## Dữ liệu mẫu (W5)

`npm run db:seed:demo` nạp dữ liệu mẫu theo bảng seed trong `docs/test/test-plan.md` mục 3. **Chỉ dùng cho CSDL phát triển / demo** (từ chối chạy khi `NODE_ENV=production`).

- Cần `QR_HMAC_SECRET` trong `.env` **giống với backend**, để QR của lô mẫu quét được ở trang truy xuất. `TRACE_BASE_URL` tùy chọn (mặc định `http://localhost:5173`).
- Mật khẩu chung của mọi tài khoản mẫu: `SEED_USER_PASSWORD` trong `.env`, không đặt thì là `Demo12345`.
- Chạy lại an toàn: đã có dữ liệu mẫu thì bỏ qua. Cần CSDL chưa có các mã lô `BATCH-2026-0001…0102` và email `@demo.local` bên dưới (nếu đã có thì dừng và báo rõ).
- Toàn bộ chạy trong một transaction và đi qua đủ ràng buộc / trigger của CSDL; mỗi dòng tạo ra có audit (`source: "seed"`).

| Mã (test plan) | Email | Vai trò | Trạng thái | Đơn vị |
| --- | --- | --- | --- | --- |
| `admin_1` | admin_1@demo.local | ADMIN | ACTIVE | – |
| `farmer_a` | farmer_a@demo.local | FARMER | ACTIVE | HTX Cà phê Cầu Đất (nông trại A) |
| `farmer_b` | farmer_b@demo.local | FARMER | ACTIVE | Nông trại Sầu riêng Cái Mơn (nông trại B) |
| `processor_a` | processor_a@demo.local | PROCESSOR | ACTIVE | Công ty Chế biến Nông sản Sài Gòn |
| `distributor_a` | distributor_a@demo.local | DISTRIBUTOR | ACTIVE | Vận tải Lạnh Miền Nam |
| `distributor_b` | distributor_b@demo.local | DISTRIBUTOR | ACTIVE | Phân phối Thực phẩm Sạch Hà Nội (chưa xử lý lô nào) |
| `user_pending` | user_pending@demo.local | FARMER | PENDING | – |
| `user_locked` | user_locked@demo.local | DISTRIBUTOR | LOCKED | Vận tải Lạnh Miền Nam |

| Lô | Nông trại | Sản phẩm | Trạng thái | Dùng để kiểm thử |
| --- | --- | --- | --- | --- |
| `BATCH-2026-0001` | A | Cà phê Arabica Cầu Đất, 500 kg | CREATED | Sửa lô được; QR; Distributor thấy lô đang chờ |
| `BATCH-2026-0002` | A | Cà phê Robusta rang xay, 300 kg | SHIPPED (đủ 6 bước) | Sửa lô bị từ chối (409); timeline đầy đủ |
| `BATCH-2026-0003` | A | Cà phê Arabica Cầu Đất, 200 kg | RECEIVED | Processor thấy lô đang chờ chế biến |
| `BATCH-2026-0101` | B | Sầu riêng Ri6, 1000 kg | PACKAGED | Ngoài phạm vi của farmer_a (404); chờ SHIPPED |
| `BATCH-2026-0102` | B | Sầu riêng Ri6, 150 kg | CREATED | Lô mới của nông trại B |

Phạm vi đọc lô với dữ liệu này (đã kiểm tra trên CSDL thật): farmer_a thấy 0001, 0002, 0003; farmer_b thấy 0101, 0102; processor_a thấy 0002, 0101 (thêm 0003 khi tra để tiếp nhận); distributor_b không thấy lô nào trong danh sách (thấy 0001, 0101, 0102 khi tra để tiếp nhận); admin_1 thấy tất cả.

Mã lô tạo qua API sau khi seed sẽ tiếp tục từ `BATCH-2026-0103`.

## Lưu ý cho backend

- `supply_chain_events` và `audit_logs` chỉ INSERT. Không viết code UPDATE/DELETE hai bảng này.
- Tạo lô: trong **một transaction** INSERT `batches` → `qr_codes` → `supply_chain_events` (CREATED) → `audit_logs`.
- Ghi sự kiện: chỉ INSERT vào `supply_chain_events`; CSDL tự cập nhật `batches.current_status`.
- Lỗi ràng buộc trả về SQLSTATE `23505` (trùng), `23514` (vi phạm CHECK / quy tắc nghiệp vụ), `23503` (khóa ngoại), `42501` (sửa bảng append-only hoặc bảng `roles`). Backend vẫn tự kiểm tra trước để trả đúng 400/403/404/409.
- `/trace/...` đọc từ view `public_batch_trace`, `public_event_trace` để không lộ cột nội bộ.
- `batches.product_id` không bắt buộc. Gửi `product_id` mà không gửi `product_name` thì CSDL tự lấy tên từ `products`; sản phẩm phải thuộc đúng nông trại của lô (sai → SQLSTATE `23514`).
- Phân quyền và phạm vi đọc lô: dùng middleware trong [`backend/src/middleware`](../backend/src/middleware/README.md).
