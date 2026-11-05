# Database

PostgreSQL 16 (service `database` trong `docker-compose.yml`, CSDL `food_traceability`).

| File | Nội dung |
| --- | --- |
| `migrations/001_init_schema.sql` | Schema v1 (W3): 6 bảng, ràng buộc, trigger toàn vẹn, view công khai |
| `migrations/002_roles_table.sql` | Bảng `roles`; `users.role` thành khóa ngoại tới `roles` (W4) |
| `tests/schema-check.sql` | 43 ca kiểm tra ràng buộc; dữ liệu thử được ROLLBACK |
| `schema.sql` | Bản v1 của Tuần 3, giữ để tham chiếu (giống hệt `001`, có test chặn lệch). **Không dùng để tạo CSDL nữa** |

Thiết kế và từ điển dữ liệu: [`docs/ERD/Readme.md`](../docs/ERD/Readme.md) · sơ đồ: [`docs/ERD/ERD-v3.pdf`](../docs/ERD/ERD-v3.pdf).

Bảng: `roles`, `organizations`, `users`, `batches`, `qr_codes`, `supply_chain_events`, `audit_logs`, và `schema_migrations` (do trình chạy migration quản lý).

## Tạo / cập nhật CSDL (từ Tuần 4)

Cần `.env` ở thư mục gốc repo có `DB_HOST=localhost`, `DB_PASSWORD=postgres` (khi dùng Docker Compose).

```bash
docker compose up -d database

cd backend
npm run db:migrate              # chạy các migration chưa chạy, theo thứ tự
npm run db:migrate -- --status  # xem file nào đã chạy / chưa chạy
npm run db:seed:admin           # tạo Admin đầu tiên từ ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD trong .env
```

- CSDL đã tạo tay từ `schema.sql` ở Tuần 3: lần đầu chạy `db:migrate` sẽ ghi nhận `001` là đã chạy (baseline) và chỉ chạy `002`. **Không cần xóa dữ liệu.**
- Mỗi file chạy trong một transaction; lỗi thì không thay đổi gì. Có khóa để hai người không chạy cùng lúc.
- **Không sửa file migration đã chạy.** Trình chạy lưu checksum và sẽ dừng nếu nội dung bị sửa. Muốn thay đổi CSDL thì thêm file mới `003_ten_thay_doi.sql` (không viết `BEGIN`/`COMMIT` trong file).
- Làm lại từ đầu: `docker compose down -v` (xóa volume `postgres_data`), rồi chạy lại các lệnh trên.

Kiểm tra ràng buộc (CSDL trống, sau khi migrate):

```bash
docker compose exec -T database psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 < database/tests/schema-check.sql
```

Kết quả mong đợi: mọi dòng `PASS ...` và dòng cuối `ALL CHECKS PASSED`.

## Lưu ý cho backend

- `supply_chain_events` và `audit_logs` chỉ INSERT. Không viết code UPDATE/DELETE hai bảng này.
- Tạo lô: trong **một transaction** INSERT `batches` → `qr_codes` → `supply_chain_events` (CREATED) → `audit_logs`.
- Ghi sự kiện: chỉ INSERT vào `supply_chain_events`; CSDL tự cập nhật `batches.current_status`.
- Lỗi ràng buộc trả về SQLSTATE `23505` (trùng), `23514` (vi phạm CHECK / quy tắc nghiệp vụ), `23503` (khóa ngoại), `42501` (sửa bảng append-only hoặc bảng `roles`). Backend vẫn tự kiểm tra trước để trả đúng 400/403/404/409.
- `/trace/...` đọc từ view `public_batch_trace`, `public_event_trace` để không lộ cột nội bộ.
- Phân quyền và phạm vi đọc lô: dùng middleware trong [`backend/src/middleware`](../backend/src/middleware/README.md).
