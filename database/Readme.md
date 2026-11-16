# Database

PostgreSQL 16 (service `database` trong `docker-compose.yml`, CSDL `food_traceability`).

| File | Nội dung |
| --- | --- |
| `migrations/001_init_schema.sql` | Schema v1 (W3): 6 bảng, ràng buộc, trigger toàn vẹn, view công khai |
| `migrations/002_roles_table.sql` | Bảng `roles`; `users.role` thành khóa ngoại tới `roles` (W4) |
| `migrations/003_products_farms.sql` | Bảng `products`, cột `batches.product_id` (không bắt buộc), view `farms` (W5) |
| `migrations/004_event_types.sql` | Bảng `event_types` (thứ tự bước, vai trò được ghi); trạng thái lô và loại sự kiện thành khóa ngoại (W6) |
| `migrations/005_history_hash_chain.sql` | Chuỗi băm SHA-256 cho `audit_logs` và `supply_chain_events`; hàm `verify_audit_chain()`, `verify_batch_events(id)` (W6) |
| `migrations/006_app_db_role.sql` | Vai trò CSDL `fsc_app` quyền tối thiểu cho backend (W6) |
| `migrations/007_query_indexes.sql` | Chỉ mục cấp mã lô, tìm kiếm trigram (`pg_trgm`), danh sách lô / audit theo thời gian (W7) |
| `tests/schema-check.sql` | 78 ca kiểm tra ràng buộc và chỉ mục; dữ liệu thử được ROLLBACK |
| `tests/demo-check.sql` | Kiểm tra "CSDL sạch" trước khi demo / sau khi khôi phục: chuỗi băm, QR, trạng thái lô, tài khoản, dữ liệu thử còn sót, quyền `fsc_app`, bộ đếm id (W8, chỉ đọc) |
| `tests/perf/` | Dữ liệu 60 000 lô và câu đo truy vấn (W7) – chỉ cho CSDL thử |
| `scripts/backup.sh`, `backup.ps1` | Sao lưu CSDL trong Docker ra `backups/*.dump` (W8) |
| `scripts/restore.sh`, `restore.ps1` | Khôi phục an toàn từ bản sao lưu, tự chạy `demo-check.sql` (W8) |
| `scripts/dump-schema.sh` | Sinh lại `schema-current.sql` |
| `schema-current.sql` | **Toàn bộ schema hiện tại** (sau 001 → 007) để đọc / tra cứu; tự sinh, không sửa tay, không dùng để tạo CSDL (W8) |
| `schema.sql` | Bản v1 của Tuần 3, giữ để tham chiếu (giống hệt `001`, có test chặn lệch). **Đã cũ, không dùng để tạo CSDL, không dùng để tra cứu** – xem `schema-current.sql` |

Thiết kế và từ điển dữ liệu: [`docs/ERD/Readme.md`](../docs/ERD/Readme.md) · sơ đồ: [`docs/ERD/ERD-v3.pdf`](../docs/ERD/ERD-v3.pdf).

Bảng: `roles`, `event_types`, `organizations`, `products`, `users`, `batches`, `qr_codes`, `supply_chain_events`, `audit_logs`, và `schema_migrations` (do trình chạy migration quản lý).

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
- **Không sửa file migration đã chạy.** Trình chạy lưu checksum và sẽ dừng nếu nội dung bị sửa. Muốn thay đổi CSDL thì thêm file mới `008_ten_thay_doi.sql` (không viết `BEGIN`/`COMMIT` trong file).
- Làm lại từ đầu: `docker compose down -v` (xóa volume `postgres_data`), rồi chạy lại các lệnh trên.

Kiểm tra ràng buộc (CSDL trống, sau khi migrate):

```bash
docker compose exec -T database psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 < database/tests/schema-check.sql
```

PowerShell không có `<`, nên chép file vào container rồi chạy:

```powershell
docker compose cp database/tests/schema-check.sql database:/tmp/schema-check.sql
docker compose exec database psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 -f /tmp/schema-check.sql
```

Kết quả mong đợi: mọi dòng `PASS ...` và dòng cuối `ALL CHECKS PASSED`.

## Dữ liệu mẫu (W5, bổ sung W8)

`npm run db:seed:demo` nạp dữ liệu mẫu theo bảng seed trong `docs/test/test-plan.md` mục 3. **Chỉ dùng cho CSDL phát triển / demo** (từ chối chạy khi `NODE_ENV=production`).

- Cần `QR_HMAC_SECRET` trong `.env` **giống với backend**, để QR của lô mẫu quét được ở trang truy xuất. `TRACE_BASE_URL` tùy chọn (mặc định `http://localhost:5173`).
- Mật khẩu chung của mọi tài khoản mẫu: `SEED_USER_PASSWORD` trong `.env`, không đặt thì là `Demo12345`.
- Chạy lại an toàn: đã có dữ liệu mẫu thì bỏ qua. Cần CSDL chưa có các mã lô `BATCH-2026-0001…0102` và email `@demo.local` bên dưới (nếu đã có thì dừng và báo rõ).
- Toàn bộ chạy trong một transaction và đi qua đủ ràng buộc / trigger của CSDL; mỗi dòng tạo ra có audit (`source: "seed"`, không chứa email).
- Không có dữ liệu cá nhân thật: email `@demo.local`, mô tả sự kiện không có biển số xe / số điện thoại (test `seedDemo.test.js` chặn).
- Chạy được cả khi backend dùng vai trò `fsc_app` (đã thử trên CSDL thật).

| Mã (test plan) | Email | Vai trò | Trạng thái | Đơn vị |
| --- | --- | --- | --- | --- |
| `admin_1` | admin_1@demo.local | ADMIN | ACTIVE | – |
| `farmer_a` | farmer_a@demo.local | FARMER | ACTIVE | HTX Cà phê Cầu Đất (nông trại A) |
| `farmer_b` | farmer_b@demo.local | FARMER | ACTIVE | Nông trại Sầu riêng Cái Mơn (nông trại B) |
| `processor_a` | processor_a@demo.local | PROCESSOR | ACTIVE | Công ty Chế biến Nông sản Sài Gòn |
| `distributor_a` | distributor_a@demo.local | DISTRIBUTOR | ACTIVE | Vận tải Lạnh Miền Nam |
| `distributor_b` | distributor_b@demo.local | DISTRIBUTOR | ACTIVE | Phân phối Thực phẩm Sạch Hà Nội |
| `user_pending` | user_pending@demo.local | FARMER | PENDING | – |
| `user_locked` | user_locked@demo.local | DISTRIBUTOR | LOCKED | Vận tải Lạnh Miền Nam |

| Lô | Nông trại | Sản phẩm | Trạng thái | Dùng để kiểm thử |
| --- | --- | --- | --- | --- |
| `BATCH-2026-0001` | A | Cà phê Arabica Cầu Đất, 500 kg | CREATED | Sửa lô được; QR; Distributor thấy lô đang chờ |
| `BATCH-2026-0002` | A | Cà phê Robusta rang xay, 300 kg | SHIPPED (đủ 6 bước) | Sửa lô bị từ chối (409); timeline đầy đủ |
| `BATCH-2026-0003` | A | Cà phê Arabica Cầu Đất, 200 kg | RECEIVED | Processor thấy lô đang chờ chế biến |
| `BATCH-2026-0004` | A | Cà phê Arabica Cầu Đất, 120 kg | TRANSPORTED (distributor_b) | Distributor B có dữ liệu; lô đang vận chuyển (W8) |
| `BATCH-2026-0005` | A | Cà phê Robusta rang xay, 250 kg | PROCESSED | Processor ghi tiếp PACKAGED (W8) |
| `BATCH-2026-0101` | B | Sầu riêng Ri6, 1000 kg | PACKAGED | Ngoài phạm vi của farmer_a (404); chờ SHIPPED |
| `BATCH-2026-0102` | B | Sầu riêng Ri6, 150 kg | CREATED | Lô mới của nông trại B |

Đủ 6 trạng thái: CREATED (0001, 0102), TRANSPORTED (0004), RECEIVED (0003), PROCESSED (0005), PACKAGED (0101), SHIPPED (0002).

Phạm vi đọc lô với dữ liệu này (W8, chạy `batchReadScope` thật trên CSDL đã seed):

| Tài khoản | Danh sách `GET /batches` | Mở được theo id (thêm lô đang chờ vai trò mình) |
| --- | --- | --- |
| admin_1 | tất cả 7 lô | tất cả |
| farmer_a | 0001, 0002, 0003, 0004, 0005 | như danh sách |
| farmer_b | 0101, 0102 | như danh sách |
| processor_a | 0002, 0005, 0101 | thêm 0003 |
| distributor_a | 0002, 0003, 0005, 0101 | thêm 0001, 0004, 0102 (0004 do distributor_b đang vận chuyển – xem R-07 trong security checklist) |
| distributor_b | 0004 | thêm 0001, 0101, 0102 |

Mã lô tạo qua API sau khi seed sẽ tiếp tục từ `BATCH-2026-0103`.

## Chuẩn bị CSDL sạch để demo (W8)

```bash
docker compose down -v                    # xóa volume postgres_data (MẤT dữ liệu cũ – sao lưu trước nếu cần)
docker compose up -d database
cd backend
npm run db:migrate
npm run db:seed:admin
npm run db:seed:demo                      # QR_HMAC_SECRET, TRACE_BASE_URL phải giống backend lúc demo
cd ..
docker compose cp database/tests/demo-check.sql database:/tmp/demo-check.sql
docker compose exec database psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 -f /tmp/demo-check.sql
```

Kết quả mong đợi: `CSDL SẠCH: 0 FAIL`. `WARN` thường gặp: `fsc_app chưa bật đăng nhập` (bật theo `docs/deployment.md` nếu demo bằng `fsc_app`).
Demo từ máy khác trong mạng: đặt `TRACE_BASE_URL=http://<IP máy>:5173` **trước** `db:seed:demo`, vì địa chỉ này được ghi vào QR của lô mẫu (`demo-check.sql` in ra địa chỉ đang dùng).

## Sao lưu và khôi phục (W8)

Chạy ở thư mục gốc repo khi service `database` đang chạy. Windows dùng bản `.ps1` (cùng chức năng):

```powershell
powershell -ExecutionPolicy Bypass -File database\scripts\backup.ps1
#   -> backups\fsc-food_traceability-20261116-140000.dump
powershell -ExecutionPolicy Bypass -File database\scripts\restore.ps1 -File backups\fsc-food_traceability-20261116-140000.dump -Yes
```

```bash
bash database/scripts/backup.sh
bash database/scripts/restore.sh backups/fsc-food_traceability-20261116-140000.dump --yes
```

- Định dạng `pg_dump -Fc` (nén). File tạo **trong container** rồi chép ra bằng `docker compose cp`, không dùng `>` vì PowerShell làm hỏng file nhị phân.
- Khôi phục không xóa CSDL đang dùng cho tới khi bản sao lưu đã khôi phục **thành công** vào CSDL tạm `food_traceability_restore`; file hỏng thì CSDL cũ giữ nguyên.
- Tự tạo vai trò `fsc_app` nếu chưa có (pg_dump không chứa vai trò; thiếu thì lệnh GRANT trong bản sao lưu lỗi). Mật khẩu đăng nhập của `fsc_app` không nằm trong bản sao lưu: khôi phục sang máy mới thì đặt lại.
- Sau khi khôi phục tự chạy `demo-check.sql`: chuỗi băm, QR, bộ đếm id… vẫn đúng. Trigger được tạo sau khi nạp dữ liệu nên trigger append-only không chặn việc khôi phục, và chuỗi băm giữ nguyên.
- Đã thử (CSDL demo, cụm PostgreSQL mới chưa có `fsc_app`): khôi phục thành công, `CSDL SẠCH: 0 FAIL`, sau đó ghi audit mới bằng `fsc_app` nối tiếp đúng chuỗi.
- **Bản sao lưu chứa hash mật khẩu, email, họ tên**: `backups/` và `*.dump` đã có trong `.gitignore` (test SEC-07); không gửi lên nhóm chat / Drive công khai.

## Lịch sử chỉ ghi thêm và phân quyền CSDL (W6)

Ba lớp bảo vệ cho `audit_logs` và `supply_chain_events`:

| Lớp | Cơ chế | Chặn / phát hiện |
| --- | --- | --- |
| 1. Trigger | `forbid_modification` (từ 001) | Chặn UPDATE / DELETE / TRUNCATE, kể cả superuser – trừ khi tắt trigger |
| 2. Quyền CSDL | Vai trò `fsc_app` chỉ có SELECT + INSERT trên hai bảng, không được tắt trigger (không phải chủ bảng) | Backend bị lỗi hoặc bị chiếm quyền cũng không sửa được lịch sử |
| 3. Chuỗi băm | `row_hash = sha256(prev_hash \| nội dung)`; audit một chuỗi chung, sự kiện một chuỗi mỗi lô | **Phát hiện** sửa / xóa / chèn của người có quyền quản trị: `SELECT * FROM verify_audit_chain();` hoặc `GET /api/audit-logs/verify` |

**Cho backend chạy bằng `fsc_app`** (khuyến nghị khi demo / triển khai; migration vẫn chạy bằng `postgres`):

```bash
docker compose exec database psql -U postgres -d food_traceability -c "ALTER ROLE fsc_app LOGIN PASSWORD 'doi-mat-khau-nay'"
# backend/.env:  DB_USER=fsc_app   DB_PASSWORD=doi-mat-khau-nay
```

Đã kiểm tra trên CSDL thật: với `fsc_app`, các luồng tạo lô, QR, sự kiện, audit, sửa lô vẫn chạy; UPDATE / DELETE / TRUNCATE lịch sử, DELETE lô, sửa `event_types`, tắt trigger đều bị PostgreSQL từ chối.

## Chỉ mục và tối ưu truy vấn (W7)

Migration 007. Đo trên 60 000 lô / 143 000 sự kiện / 60 000 audit: [`docs/security/query-optimization.md`](../docs/security/query-optimization.md). Tự đo lại: `database/tests/perf/` (chỉ trên CSDL thử).

| Truy vấn | Chỉ mục | Trước → sau |
| --- | --- | --- |
| Cấp mã lô `nextBatchCode` (đổi câu SQL) | `idx_batches_code_year_seq` trên `(năm, số thứ tự)` tách từ `batch_code` | 60 ms → 0,04 ms |
| Tra cứu đúng một mã lô (QR) | `uq_batches_batch_code` (có từ 001) | 0,1 ms (giữ nguyên) |
| Tìm kiếm `q` (ILIKE `%…%`) | `idx_batches_product_name_trgm`, `idx_batches_batch_code_trgm` (GIN, `pg_trgm`); gõ đủ mã lô thì so khớp đúng qua `uq_batches_batch_code` | 85–91 ms → 0,15–0,9 ms |
| Danh sách lô / audit trang 1 | `(… , creation_date DESC, batch_id DESC)`, `(… , created_at DESC, audit_id DESC)` | 3–20 ms → < 0,1 ms |

- Câu SQL cấp mã lô phải giữ **đúng** biểu thức `split_part(batch_code, '-', 2)::int` / `split_part(batch_code, '-', 3)::int` thì mới dùng được chỉ mục (test `SEC-06` trong `backend/test/security.test.js` chặn lệch).
- Từ khóa tìm kiếm ngắn hơn 3 ký tự không dùng được chỉ mục trigram (PostgreSQL quét bảng, vẫn đúng kết quả).
- `pg_trgm` có sẵn trong PostgreSQL (Docker `postgres:16-alpine` và bản cài trên Windows), là extension "trusted" nên tài khoản chủ CSDL tạo được.

## Lưu ý cho backend

- `supply_chain_events` và `audit_logs` chỉ INSERT. Không viết code UPDATE/DELETE hai bảng này. Không gửi các cột `chain_seq`, `prev_hash`, `row_hash` (CSDL tự cấp).
- Ghi audit bằng `insertAudit` của module audit (`backend/src/modules/audit/README.md`): tự lọc khóa nhạy cảm.
- Loại sự kiện, thứ tự và vai trò được ghi nằm trong bảng `event_types` (không viết cứng thêm ở nơi khác).
- Tạo lô: trong **một transaction** INSERT `batches` → `qr_codes` → `supply_chain_events` (CREATED) → `audit_logs`.
- Ghi sự kiện: chỉ INSERT vào `supply_chain_events`; CSDL tự cập nhật `batches.current_status`.
- Lỗi ràng buộc trả về SQLSTATE `23505` (trùng), `23514` (vi phạm CHECK / quy tắc nghiệp vụ), `23503` (khóa ngoại), `42501` (sửa bảng append-only hoặc bảng `roles`). Backend vẫn tự kiểm tra trước để trả đúng 400/403/404/409.
- `/trace/...` đọc từ view `public_batch_trace`, `public_event_trace` để không lộ cột nội bộ.
- Tra cứu tên bảng / cột: `database/schema-current.sql` (bản đầy đủ hiện tại). Các comment "đúng database/schema.sql" trong code nói tới bản W3, đã cũ.
- `batches.product_id` không bắt buộc. Gửi `product_id` mà không gửi `product_name` thì CSDL tự lấy tên từ `products`; sản phẩm phải thuộc đúng nông trại của lô (sai → SQLSTATE `23514`).
- Phân quyền và phạm vi đọc lô: dùng middleware trong [`backend/src/middleware`](../backend/src/middleware/README.md).
