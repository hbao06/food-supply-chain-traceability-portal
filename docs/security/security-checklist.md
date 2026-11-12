# Security checklist (W7-TV3)

**Dự án:** Food Supply Chain Traceability & Provenance Portal – Nhóm 13
**Người rà soát:** Đặng Vĩnh Quang (TV3 - Database / Auth / Security) · **Review:** Chung Nguyễn Minh Trí (TV2 - Backend / API)
**Nhiệm vụ tuần 7:** Rà soát rò rỉ dữ liệu, quyền đọc, giới hạn dữ liệu cá nhân và chỉ mục `batch_code`. Bàn giao: security checklist và tối ưu truy vấn.
**Phạm vi:** `main` sau PR #57 (backend, database, `docker-compose.yml`; frontend chỉ xem phần lưu token và hiển thị dữ liệu). Kết quả đo truy vấn: [`query-optimization.md`](query-optimization.md).

Ký hiệu: ✅ đạt, có bằng chứng · 🔧 sửa trong PR này · ⚠️ rủi ro còn lại, cần nhóm quyết định · ⏳ chức năng chưa có, ghi sẵn yêu cầu để kiểm khi làm.

## 0. Tóm tắt

| Nhóm | ✅ | 🔧 | ⚠️ | ⏳ |
| --- | :-: | :-: | :-: | :-: |
| 1. Rò rỉ dữ liệu | 11 | 3 | 2 | – |
| 2. Quyền đọc | 7 | – | 1 | 2 |
| 3. Dữ liệu cá nhân | 4 | 2 | 3 | – |
| 4. Chỉ mục và truy vấn | 2 | 4 | – | – |

**Đã sửa trong PR này (🔧):**
1. `docker-compose.yml`: khóa ký QR `QR_HMAC_SECRET` được đặt nhầm ở service **frontend**. Hậu quả là backend chạy trong Docker không có khóa (tạo lô lỗi 500), còn container frontend lại giữ một bí mật không dùng tới. Đã chuyển sang service backend.
2. `docker-compose.yml`: cổng PostgreSQL `5432` đang mở cho mọi máy cùng mạng (Wi-Fi trường), trong khi mật khẩu là `postgres`. Nay chỉ mở cho `127.0.0.1`.
3. CORS đang cho **mọi website** gọi API. Nay chỉ cho các nguồn trong `CORS_ORIGIN`; mặc định là frontend `http://localhost:5173`.
4. Audit `LOGIN_FAILED` không lưu nguyên email gõ vào nữa (`ng***@gmail.com`). Audit `REGISTER` không lưu email.
5. Chỉ mục `batch_code`, tìm kiếm, danh sách lô và audit (migration 007), kèm câu SQL cấp mã lô và tìm theo mã mới. Thời gian giảm từ 6–90 ms xuống dưới 1 ms trên 60 000 lô.

**Cần nhóm quyết định (⚠️), đề xuất ở mục 5:**
- **R-07:** Processor / Distributor mở được theo id **82 %** số lô của toàn hệ thống, kể cả lô của Distributor khác đang vận chuyển.
- **P-04:** tên nhân viên của đơn vị khác hiện trên timeline.
- **P-05:** mô tả sự kiện là chữ tự do nhưng được công khai.

## 1. Rò rỉ dữ liệu

| ID | Kiểm tra | KQ | Bằng chứng |
| --- | --- | :-: | --- |
| D-01 | Phản hồi API không có `password_hash`, `signature_hmac`, `prev_hash` / `row_hash` / `chain_seq` | ✅ | DTO chỉ chọn đúng các trường được phép. `security.test.js` SEC-02 đưa vào hàng CSDL có thêm các cột nhạy cảm và kiểm tra DTO của User / Batch / Event / AuditLog |
| D-02 | OpenAPI không khai báo trường nhạy cảm trong phản hồi | ✅ | SEC-03: không schema nào có `hash`, `signature`, `secret`, `salt`; chỉ 2 schema yêu cầu (đăng ký, đăng nhập) có `password` |
| D-03 | Lỗi không lộ stack trace, câu SQL hay tên ràng buộc CSDL | ✅ | `errorHandler.js` chỉ trả `{code, message, details?}`; SQLSTATE 23505/23514/23503 → 409 thông báo chung (`errorHandler.test.js`) |
| D-04 | Header không lộ framework; không cache dữ liệu cá nhân; không gửi URL (có mã lô / token QR) sang trang khác | ✅ | `x-powered-by` tắt, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `nosniff`, `X-Frame-Options: DENY` (`app.test.js`, `securityHeaders.test.js`) |
| D-05 | Đăng nhập sai không cho biết email có tồn tại | ✅ | Cùng thông báo cho sai email / sai mật khẩu; email không tồn tại vẫn so sánh với hash giả để thời gian phản hồi như nhau; trạng thái PENDING/LOCKED chỉ báo sau khi đúng mật khẩu (`auth.service.test.js`) |
| D-06 | Log không chứa dữ liệu cá nhân, token, mật khẩu | ✅ | Chỉ lỗi 5xx được `console.error`; không log body, header hay token. Rate limiter giữ IP trong bộ nhớ có hạn, không ghi ra file |
| D-07 | Bí mật không nằm trong repo | ✅ | `.env`, `.env.*` trong `.gitignore`; `.env.example` để trống. `JWT_SECRET` < 32 ký tự → backend không khởi động (`config/env.js`). Đã quét `git ls-files`: không có `.env`, khóa hay chứng chỉ |
| D-08 | Bí mật chỉ cấp cho service cần nó | 🔧 | `QR_HMAC_SECRET`, `TRACE_BASE_URL` chuyển từ service `frontend` sang `backend` trong `docker-compose.yml`. Vite chỉ đưa biến `VITE_*` vào bundle nên khóa chưa lộ ra trình duyệt, nhưng không có lý do để container frontend giữ nó |
| D-09 | CSDL không mở ra mạng | 🔧 | `ports: "127.0.0.1:5432:5432"`. Backend trong Docker vẫn kết nối qua mạng nội bộ `database:5432`; chạy backend trên máy (`DB_HOST=localhost`) vẫn được |
| D-10 | CORS chỉ cho nguồn tin cậy | 🔧 | `middleware/corsOptions.js`, `CORS_ORIGIN` (mặc định `http://localhost:5173`; `*` phải đặt rõ). So khớp chính xác, không khớp một phần (`localhost:5173.evil.example` bị từ chối). Phương thức chỉ `GET, POST, PATCH`. Kiểm tra trong SEC-05, `app.test.js` |
| D-11 | View công khai không có cột nội bộ | ✅ | `public_batch_trace`, `public_event_trace` không có cột `*_id`, email, `created_by`, `actor*` (`schema-check.sql`) |
| D-12 | Token QR không giả được, không lộ chữ ký qua API | ✅ | HMAC-SHA256 với khóa trong `.env`, so sánh `timingSafeEqual`; `GET /batches/{id}/qr` không SELECT `signature_hmac` (SEC-02) |
| D-13 | Audit không chứa mật khẩu / token | ✅ | Bỏ khóa nhạy cảm ở mọi cấp lồng nhau (`audit.sanitize.js`) và CHECK `chk_audit_no_secrets` trong CSDL (`audit.test.js`) |
| D-14 | SQL injection | ✅ | Mọi câu SQL truyền tham số `$n`. Tên cột chỉ lấy từ danh sách trắng (`COLUMN_OF`, alias của `batchReadScope` kiểm bằng regex); `%` và `_` trong từ khóa tìm kiếm được thoát. TC-BATCH-10 `' OR 1=1 --` |
| D-15 | Đăng ký dò được email đã dùng (`409 EMAIL_EXISTS`) | ⚠️ | Giữ lại vì người dùng cần biết email trùng (US-S02). Đã giảm bằng rate limit 30 lần / 15 phút / IP. Chấp nhận |
| D-16 | Token phiên ở frontend | ⚠️ | `sessionStorage`: mất khi đóng tab, không gửi tự động như cookie (nên không bị CSRF), nhưng script XSS đọc được. React tự escape và không dùng `dangerouslySetInnerHTML` / `innerHTML` (đã tìm trong `frontend/src`). Chấp nhận ở phạm vi đồ án |

## 2. Quyền đọc

### 2.1 Bảng quyền theo endpoint (đã đối chiếu với code)

| Endpoint | Vai trò (403 nếu sai) | Phạm vi bản ghi (404 nếu ngoài) |
| --- | --- | --- |
| `POST /auth/register`, `/auth/login` | Công khai | – (rate limit) |
| `GET`, `PATCH /users/me` | Mọi tài khoản ACTIVE | Chỉ chính mình (`req.auth.userId`) |
| `POST /batches` | FARMER | Đơn vị của mình |
| `GET /batches` | Mọi vai trò | Admin: tất cả; Farmer: đơn vị mình; Processor/Distributor: lô đơn vị mình đã ghi sự kiện |
| `GET /batches/{id}`, `/qr`, `/events`, `/timeline` | Mọi vai trò | Như trên, **cộng** lô đang chờ vai trò mình (R-07) |
| `PATCH /batches/{id}` | FARMER | Đơn vị mình và lô còn `CREATED` |
| `POST /batches/{id}/events` | PROCESSOR, DISTRIBUTOR | Như GET chi tiết, kèm đúng thứ tự bước |
| `GET /audit-logs`, `/audit-logs/verify` | ADMIN | – |

### 2.2 Kiểm tra

| ID | Kiểm tra | KQ | Bằng chứng |
| --- | --- | :-: | --- |
| R-01 | Mọi route không công khai có `requireAuth` và `requirePermission(...)` | ✅ | SEC-01 quét mọi file `*.routes.js`. Bỏ `requirePermission` ở một route thì test fail (đã thử). Route công khai phải ghi vào danh sách `PUBLIC_ROUTES` |
| R-02 | Vai trò / trạng thái / đơn vị lấy từ CSDL ở mỗi yêu cầu, không tin token | ✅ | `loadCurrentUser` (`currentUser.test.js`); SEC-01 kiểm tra `requireAuth` của mọi module có `createLoadCurrentUser` |
| R-03 | Ngoài phạm vi trả 404 (không cho biết lô có tồn tại) | ✅ | TC-BATCH-13, TC-BATCH-17 (`batches.http.test.js`, `events.http.test.js`) |
| R-04 | Lọc phạm vi trong câu SQL, không lọc sau khi đọc | ✅ | `batchReadScope` ghép vào `WHERE` (`rbac.test.js`). Tìm đúng mã lô của đơn vị khác vẫn 0 kết quả (chạy thử trên CSDL thật) |
| R-05 | Admin chỉ xem, không tạo / sửa lô hay ghi sự kiện | ✅ | `PERMISSIONS` (`rbac.test.js`), TC-EVT-04 |
| R-06 | Lớp CSDL: backend kết nối bằng vai trò không sửa / xóa được lịch sử | ✅ | `fsc_app` (migration 006, `schema-check.sql`) |
| R-07 | **Processor / Distributor mở lô "đang chờ" theo id** | ⚠️ | Xem bên dưới |
| R-08 | Phân trang và kích thước đầu vào có giới hạn | ✅ | `limit ≤ 100`, `q ≤ 100` ký tự, body ≤ 100 KB |
| R-09 | `/trace/{qrToken}`, `/trace/code/{batchCode}` (công khai) | ⏳ | Có trong OpenAPI, chưa có route. Khi làm cần: đọc **chỉ** từ hai view công khai; token sai → 404 (`qrToken.verify` trả `null`); chuẩn hóa `batchCode` thành chữ hoa; rate limit theo IP; thêm route vào `PUBLIC_ROUTES` của SEC-01 |
| R-10 | `/users`, `/organizations` (Admin) | ⏳ | Chưa có route. Khi làm: `requirePermission('user:*' / 'organization:*')`; kiểm thử TC-SEC-01…05 |

**R-07 – chi tiết.**
- Với `includeAwaiting`, Distributor xem được **mọi** lô ở trạng thái `CREATED`, `TRANSPORTED`, `PACKAGED` của toàn hệ thống; Processor xem được mọi lô `RECEIVED`, `PROCESSED`.
- Đo trên CSDL thử 60 000 lô: danh sách của một Distributor có 10 000 lô, nhưng nhập id thì mở được **49 200 lô (82 %)**. Trong đó có **6 000 lô TRANSPORTED do Distributor khác** đang vận chuyển. Mỗi lô mở được kèm timeline, tức cả tên người ghi (P-04).
- `batch_id` tăng dần nên dò được bằng cách tăng id.
- Thiết kế này để bên nhận "tiếp nhận" được lô, nên không sửa đơn phương trong PR này: thay đổi sẽ đổi quy tắc nghiệp vụ và các test TC-BATCH-15, TC-EVT-04 của TV2 / TV4. Đề xuất ở mục 5.

## 3. Giới hạn dữ liệu cá nhân

### 3.1 Dữ liệu cá nhân trong hệ thống

| Dữ liệu | Lưu ở | Ai đọc được qua API | Ghi chú |
| --- | --- | --- | --- |
| Họ tên người dùng | `users.name` | Chính mình (`/users/me`); người dùng nội bộ có lô trong phạm vi (`actorName` ở sự kiện / timeline); Admin (audit) | Công khai (`/trace`) **không** có tên người (view chỉ có tên đơn vị) |
| Email | `users.email` | Chính mình; Admin | Không còn ghi vào audit `REGISTER`; `LOGIN_FAILED` chỉ lưu bản đã che |
| Mật khẩu | `users.password_hash` (bcrypt, CHECK chặn lưu mật khẩu thô) | Không ai | Audit và DTO đều bỏ |
| Địa điểm / mô tả sự kiện | `supply_chain_events.location`, `description` | Người dùng nội bộ trong phạm vi; **công khai** qua `/trace` | Chữ tự do (P-05) |
| IP người gọi | Bộ nhớ của rate limiter | Không ai | Không ghi vào CSDL hay log |

Hệ thống chỉ thu họ tên, email và mật khẩu; không thu số điện thoại, địa chỉ nhà hay số CCCD. Dữ liệu mẫu dùng email `@demo.local`, `@perf.local` (không phải người thật).

### 3.2 Kiểm tra

| ID | Kiểm tra | KQ | Bằng chứng |
| --- | --- | :-: | --- |
| P-01 | Thu thập tối thiểu | ✅ | Bảng `users` chỉ có tên, email, hash; `validateRegister` chỉ lấy `name, email, password, role`, trường gửi thừa (ví dụ `phone`) bị bỏ qua và không được lưu |
| P-02 | Hồ sơ chỉ của chính mình; không tự đổi vai trò / trạng thái / đơn vị | ✅ | `/users/me` dùng `req.auth.userId`, `PATCH` chỉ nhận `name` (TC-SEC-04) |
| P-03 | Audit `LOGIN_FAILED` không lưu nguyên chuỗi gõ vào ô email | 🔧 | `maskEmail()` (`audit.sanitize.js`): `NguyenVanA@Gmail.com` → `ng***@gmail.com`. Vẫn nhận ra một đợt dò nhắm vào cùng tài khoản / tên miền; tài khoản có thật đã xác định bằng `entityId`. Kiểm tra trong SEC-04, `auth.service.test.js` |
| P-03b | Audit `REGISTER` không lưu email | 🔧 | Email đã có trong `users` (`entityId` trỏ tới); audit thì không xóa được nên không chép thêm (`auth.service.test.js`) |
| P-04 | Tên nhân viên của đơn vị khác trên timeline nội bộ | ⚠️ | `actorName` trả cho mọi người dùng xem được lô (kết hợp R-07 thì phạm vi rộng). Đề xuất ở mục 5 |
| P-05 | Mô tả sự kiện là chữ tự do và được công khai | ⚠️ | Người ghi có thể lỡ nhập số điện thoại / tên tài xế. Đề xuất: ghi chú dưới ô nhập "Nội dung này hiển thị công khai khi quét QR" (TV1) |
| P-06 | Audit chỉ ghi thêm nên dữ liệu cá nhân trong audit không xóa được | ⚠️ | Hệ quả của yêu cầu chống sửa lịch sử (US-S05). Giảm thiểu: không chép email / dữ liệu thừa vào audit (P-03, P-03b), audit chỉ Admin đọc. Chấp nhận, ghi vào báo cáo |
| P-07 | Phản hồi có dữ liệu cá nhân không bị cache | ✅ | `Cache-Control: no-store` (D-04) |
| P-08 | Dữ liệu mẫu / dữ liệu đo không phải người thật | ✅ | `@demo.local`, `@perf.local`; seed demo từ chối chạy khi `NODE_ENV=production` |

## 4. Chỉ mục `batch_code` và tối ưu truy vấn

Chi tiết, số đo và cách đo lại: [`query-optimization.md`](query-optimization.md).

| ID | Kiểm tra | KQ | Bằng chứng |
| --- | --- | :-: | --- |
| I-01 | Tra cứu đúng một mã lô (QR, `/trace/code`) dùng chỉ mục | ✅ | `uq_batches_batch_code` (có từ 001), 0,13 ms |
| I-02 | Mã lô không trùng khi tạo đồng thời | ✅ | Khóa advisory và UNIQUE (từ W5) |
| I-03 | Cấp mã lô không quét cả bảng trong lúc giữ khóa | 🔧 | `idx_batches_code_year_seq` và câu SQL mới: 60 ms → 0,04 ms. So sánh theo số (`…-10000 > …-9999`). Kiểm tra trong `schema-check.sql`, SEC-06 |
| I-04 | Tìm kiếm `q` không quét cả bảng | 🔧 | Chỉ mục trigram (`pg_trgm`): 85–89 ms → 0,15–0,3 ms. Gõ đủ mã lô thì so khớp đúng qua chỉ mục UNIQUE (SEC-06) |
| I-05 | Danh sách lô / audit trang 1 không sắp xếp cả bảng | 🔧 | Chỉ mục theo đúng thứ tự `ORDER BY`: 3–20 ms → < 0,1 ms |
| I-06 | Không thừa chỉ mục làm chậm ghi | 🔧 | Bỏ 5 chỉ mục cũ trùng chức năng; chèn lô chậm thêm khoảng 0,02 ms / lô |

## 5. Đề xuất cho nhóm (không làm trong PR này)

| # | Việc | Liên quan | Người đề xuất làm | Khi nào |
| --- | --- | --- | --- | --- |
| 1 | `RECEIVED` chỉ do **cùng đơn vị** đã ghi `TRANSPORTED` (thêm vào trigger `check_event_rules` và `batchReadScope`), để Distributor khác không mở / nhận lô đang vận chuyển | R-07 | TV3 (CSDL) + TV2 (service) | W8 |
| 2 | Tiếp nhận lô `CREATED` / `PACKAGED` bằng **mã lô** (quét QR / nhãn) thay vì `batch_id`: endpoint `GET /batches/by-code/{batchCode}` với `includeAwaiting`, còn `GET /batches/{id}` chỉ trong phạm vi thường. Không dò được bằng cách tăng id | R-07 | TV2 | W8 |
| 3 | Timeline nội bộ: tên người ghi chỉ hiện với cùng đơn vị và Admin; đơn vị khác chỉ thấy tên đơn vị (cần sửa TC-BATCH-15) | P-04 | TV2 + TV4 | W8 |
| 4 | Ghi chú "nội dung công khai" dưới ô mô tả / địa điểm sự kiện | P-05 | TV1 | W8 |
| 5 | Khi làm `/trace`: theo yêu cầu R-09 và thêm vào `PUBLIC_ROUTES` | R-09 | TV2 | khi làm |
| 6 | Demo / triển khai: backend dùng `DB_USER=fsc_app` (`database/Readme.md`) và đổi mật khẩu `postgres` | D-09, R-06 | TV4 | W8 |

## 6. Kiểm tra lại

```bash
cd backend && npm test                                   # gồm test/security.test.js (SEC-01…06)
psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 -f database/tests/schema-check.sql   # 78 PASS
# tối ưu truy vấn: docs/security/query-optimization.md mục 5
```
