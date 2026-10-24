# Database

PostgreSQL 16 (service `database` trong `docker-compose.yml`, CSDL `food_traceability`).

| File | Nội dung |
| --- | --- |
| `schema.sql` | Schema v1: 6 bảng, ràng buộc, trigger toàn vẹn, view công khai (W3-TV3) |
| `tests/schema-check.sql` | 39 ca kiểm tra ràng buộc; dữ liệu thử được ROLLBACK |

Thiết kế và từ điển dữ liệu: [`docs/ERD/Readme.md`](../docs/ERD/Readme.md) · sơ đồ: [`docs/ERD/ERD-v3.pdf`](../docs/ERD/ERD-v3.pdf).

Bảng: `organizations`, `users`, `batches`, `qr_codes`, `supply_chain_events`, `audit_logs`.

## Chạy

```bash
docker compose up -d database

# Tạo schema (CSDL trống)
docker compose exec -T database psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 < database/schema.sql

# Kiểm tra
docker compose exec -T database psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 < database/tests/schema-check.sql
```

Làm lại từ đầu: `docker compose down -v` (xóa volume `postgres_data`) rồi chạy lại hai lệnh trên.

## Lưu ý cho backend

- `supply_chain_events` và `audit_logs` chỉ INSERT. Không viết code UPDATE/DELETE hai bảng này.
- Tạo lô: trong **một transaction** INSERT `batches` → `qr_codes` → `supply_chain_events` (CREATED) → `audit_logs`.
- Ghi sự kiện: chỉ INSERT vào `supply_chain_events`; CSDL tự cập nhật `batches.current_status`.
- Lỗi ràng buộc trả về SQLSTATE `23505` (trùng), `23514` (vi phạm CHECK / quy tắc nghiệp vụ), `23503` (khóa ngoại), `42501` (sửa bảng append-only). Backend vẫn tự kiểm tra trước để trả đúng 400/403/404/409.
- `/trace/...` đọc từ view `public_batch_trace`, `public_event_trace` để không lộ cột nội bộ.
