# Tối ưu truy vấn và chỉ mục `batch_code` (W7-TV3)

**Người thực hiện:** Đặng Vĩnh Quang (TV3 - Database / Auth / Security) · **Review:** Chung Nguyễn Minh Trí (TV2)
**Thay đổi:** `database/migrations/007_query_indexes.sql`, `nextBatchCode` và tìm kiếm `q` trong `backend/src/modules/batches/batches.repository.js`.
**Đi kèm:** [`security-checklist.md`](security-checklist.md) mục 4.

## 1. Cách đo

- PostgreSQL 16, collation `en-US` (giống image `postgres:16-alpine` và bản cài trên Windows; khác `C`, vì `C` cho phép btree thường dùng được với `LIKE 'abc%'` nên sẽ cho số đẹp hơn thực tế).
- Dữ liệu: `database/tests/perf/seed-volume.sql`. Có 16 đơn vị, 80 người dùng, **60 000 lô** (2025 và 2026), **142 800 sự kiện** và **60 000 audit**. Mọi dòng đều đi qua đủ trigger và ràng buộc.
- Hai CSDL được nạp cùng dữ liệu:
  - CSDL "trước" chỉ chạy migration 001–006.
  - CSDL "sau" chạy 001–007.
  - Cả hai đều chạy `VACUUM ANALYZE` trước khi đo.
- Mỗi câu chạy `EXPLAIN (ANALYZE)` 7 lần, bỏ 2 lần đầu (cache nguội) và lấy trung vị của 5 lần còn lại.
- Câu SQL là câu của backend, với tham số thay bằng giá trị mẫu. Xem `database/tests/perf/explain-queries.sql`.

Quy mô thật của đồ án nhỏ hơn nhiều (vài trăm lô), nên con số tuyệt đối không quan trọng bằng **dạng kế hoạch**: quét cả bảng thì chậm dần theo số lô, còn đọc qua chỉ mục thì gần như không đổi.

## 2. Kết quả

Thời gian thực thi trong CSDL, đơn vị ms (trung vị):

| Truy vấn (nơi dùng) | Trước | Sau | Kế hoạch trước | Kế hoạch sau |
| --- | ---: | ---: | --- | --- |
| **Q1 Cấp mã lô** `nextBatchCode` (POST /batches), câu cũ `LIKE 'BATCH-2026-%'` | 60 | 112 | `Index Only uq_batches_batch_code` (đọc hết chỉ mục) | `Bitmap idx_batches_batch_code_trgm` |
| **Q1 Cấp mã lô**, câu mới `split_part(...)` | 22 | **0,04** | `Index Only uq_batches_batch_code` (đọc hết chỉ mục) | `Index idx_batches_code_year_seq` (1 dòng) |
| Q2 Tra cứu đúng một mã lô (QR / trace) | 0,15 | 0,13 | `Index uq_batches_batch_code` | không đổi |
| Q3 Tìm `q='Hồ tiêu'` (nhiều lô khớp, trang 1) | 89 | **0,32** | `Seq Scan` | `Index idx_batches_created_desc` |
| Q3 Tìm `q='12345'` (ít lô khớp, trang 1) | 85 | **0,17** | `Seq Scan` | `Bitmap` hai chỉ mục trigram |
| Q3 Tìm `q='12345'`, đếm tổng | 89 | **0,15** | `Seq Scan` | `Bitmap` hai chỉ mục trigram |
| Q3 Tìm bằng đủ mã lô, câu cũ `ILIKE '%BATCH-2026-0420%'` | 91 | 0,92 (*) | `Seq Scan` | `Bitmap` trigram, có lúc `Seq Scan` |
| Q3 Tìm bằng đủ mã lô, câu mới (so khớp đúng) | 54 | **0,15** | `Seq Scan` | `Bitmap uq_batches_batch_code` |
| Q4 Danh sách lô của Admin (trang 1) | 16 | **0,04** | `Seq Scan` rồi sắp xếp | `Index Only idx_batches_created_desc` |
| Q4 Danh sách lô của Farmer (trang 1) | 6,15 | **0,05** | `Bitmap idx_batches_organization` rồi sắp xếp | `Index Only idx_batches_org_created_desc` |
| Q4 Lọc `status=CREATED` (trang 1) | 13 | **0,05** | `Seq Scan` rồi sắp xếp | `Index Only idx_batches_status_created` |
| Q5 Danh sách lô của Distributor (trang 1) | 15 | **0,59** | `Seq Scan` + EXISTS | `Index Only idx_batches_created_desc` + EXISTS |
| Q5 Đếm lô của Distributor | 26 | 17 | `Seq Scan` sự kiện | `Index Only idx_events_actor_batch` |
| Q6 Audit mới nhất (trang 1) | 20 | **0,04** | `Seq Scan` rồi sắp xếp | `Index idx_audit_created_desc` |
| Q6 Audit lọc `entityType=BATCH` | 20 | **0,05** | `Seq Scan` | `Index Only idx_audit_type_created` |
| Q6 Audit lọc `actorId` | 2,88 | **0,06** | `Bitmap idx_audit_actor` rồi sắp xếp | `Index Only idx_audit_actor_created` |

(*) Kế hoạch của câu cũ không ổn định. Khi tìm bằng đủ mã lô, mọi lô đều có các bộ ba ký tự `BAT`, `TCH`, `-20`…, nên ước lượng chi phí của chỉ mục trigram rất cao. Trong lần đo trước khi `VACUUM ANALYZE`, PostgreSQL chọn quét cả bảng và mất **91 ms**. Câu mới so khớp đúng mã qua chỉ mục UNIQUE nên luôn nhanh.

## 3. Thay đổi và lý do

### 3.1 Cấp mã lô (`nextBatchCode`)

Mã lô được cấp trong lúc giữ khóa advisory (`lockBatchCodeSequence`), để hai người tạo lô cùng lúc không nhận trùng mã. Vì vậy mọi lần tạo lô **phải chờ nhau** trong suốt thời gian câu này chạy. Câu cũ đọc toàn bộ mã của năm rồi lấy số lớn nhất, nên chậm dần theo số lô.

- **Chỉ thêm chỉ mục mà không đổi câu SQL thì không có tác dụng.** Q1 câu cũ trên CSDL "sau" vẫn mất 112 ms. Với collation `en-US`, btree thường không dùng được cho `LIKE 'abc%'`, còn `MAX(substring(...))` vẫn phải đọc hết mọi mã của năm.
- **Cách làm:**
  - Thêm chỉ mục biểu thức `((split_part(batch_code,'-',2)::int), (split_part(batch_code,'-',3)::int) DESC)`.
  - Viết lại câu SQL thành `WHERE năm = … ORDER BY số DESC LIMIT 1`, nên PostgreSQL chỉ đọc đúng một dòng của chỉ mục.
- **Đúng cả khi số thứ tự vượt 4 chữ số:** câu mới so sánh theo số, nên `…-10000 > …-9999`. Nếu so sánh theo chuỗi thì sẽ ra ngược lại. `schema-check.sql` có ca kiểm tra việc này.
- **Biểu thức trong câu SQL phải giống hệt chỉ mục.** Test `SEC-06` (`backend/test/security.test.js`) so câu SQL của repository với file migration để chặn việc sửa lệch.

### 3.2 Tìm kiếm `q`

- `ILIKE '%…%'` không dùng được btree. Chỉ mục **trigram** (GIN, extension `pg_trgm`) chia chuỗi thành các bộ ba ký tự, nên tìm được chuỗi con và không phân biệt hoa thường.
- Từ khóa dưới 3 ký tự không dùng được trigram. Khi đó PostgreSQL quét cả bảng, kết quả vẫn đúng.
- Khi người dùng gõ **đủ một mã lô**, đây là trường hợp hay gặp nhất (chép từ nhãn / QR). Backend so khớp đúng `batch_code = UPPER(q)` qua chỉ mục UNIQUE và vẫn tìm `q` trong tên sản phẩm. Khác biệt duy nhất so với trước: gõ `BATCH-2026-0420` sẽ không còn ra thêm `BATCH-2026-04201`. Phạm vi đọc theo vai trò vẫn áp dụng như cũ: Farmer của đơn vị khác tìm đúng mã vẫn không thấy lô.

### 3.3 Danh sách lô, danh sách audit

- API sắp xếp `ORDER BY creation_date DESC, batch_id DESC` (audit dùng `created_at DESC, audit_id DESC`) rồi lấy 20 dòng.
- Chỉ mục cũ chỉ có một cột, nên `idx_audit_created_at (created_at DESC)` không phục vụ được việc sắp xếp theo hai cột. PostgreSQL phải đọc hết bảng rồi sắp xếp.
- Chỉ mục mới có đúng thứ tự sắp xếp, nên PostgreSQL dừng ngay sau 20 dòng.
- Chỉ mục mới bắt đầu bằng cùng cột với chỉ mục cũ, nên thay luôn chỉ mục cũ: `idx_batches_organization`, `idx_batches_status`, `idx_audit_created_at`, `idx_audit_actor`, `idx_events_actor`. Kiểm tra khóa ngoại và lọc theo cột đó vẫn dùng được chỉ mục mới.
- **Phân trang sâu** (`OFFSET` lớn) vẫn phải bỏ qua từng dòng. Với `limit ≤ 100` và quy mô đồ án thì chấp nhận được.

### 3.4 Phạm vi Processor / Distributor

- Điều kiện `EXISTS (sự kiện do đơn vị mình ghi)` dùng chỉ mục mới `(actor_id, batch_id)` để đọc chỉ mục mà không phải đọc bảng (index-only).
- Trang đầu nhanh vì PostgreSQL đi theo thứ tự thời gian và dừng sớm.
- Đếm tổng vẫn phải xét mọi lô của đơn vị (17 ms với 10 000 lô): đây là giới hạn của `COUNT(*)`. Nếu sau này cần nhanh hơn, có thể thêm cột "đơn vị đang giữ lô" do trigger cập nhật. Chưa cần ở quy mô đồ án.

## 4. Chi phí

| | Trước | Sau |
| --- | ---: | ---: |
| Dung lượng chỉ mục `batches` (60 000 lô) | 10 MB | 47 MB (trong đó trigram 17 MB) |
| Chèn 5 000 lô trong một lệnh | 137 ms | 219 ms (≈ 0,04 ms / lô) |

Lô được ghi ít và đọc nhiều (danh sách, tìm kiếm, timeline, quét QR), nên đổi thêm khoảng 0,02 ms mỗi lần ghi để đọc nhanh hơn 100–500 lần là hợp lý. `CREATE INDEX` trong migration khóa ghi bảng trong vài giây khi bảng lớn. Ở quy mô đồ án thì không đáng kể; nếu triển khai thật với bảng lớn nên dùng `CREATE INDEX CONCURRENTLY` ngoài transaction.

## 5. Tự đo lại

```bash
createdb -U postgres fsc_perf
cd backend && DB_NAME=fsc_perf npm run db:migrate && cd ..
psql -U postgres -d fsc_perf -1 -v ON_ERROR_STOP=1 -f database/tests/perf/seed-volume.sql
psql -U postgres -d fsc_perf -c "VACUUM ANALYZE"
psql -U postgres -d fsc_perf -f database/tests/perf/explain-queries.sql
dropdb -U postgres fsc_perf
```

Trên Windows CMD thay dòng thứ hai bằng `cd backend && set DB_NAME=fsc_perf&& npm run db:migrate && cd ..`.
`seed-volume.sql` từ chối chạy nếu CSDL đã có người dùng hoặc lô, nên không thể lỡ chạy vào CSDL dev / demo.
