# Security checklist (W7-TV3, rà soát lại W8-TV3)

**Dự án:** Food Supply Chain Traceability & Provenance Portal – Nhóm 13
**Người rà soát:** Đặng Vĩnh Quang (TV3 - Database / Auth / Security) · **Review:** Chung Nguyễn Minh Trí (TV2 - Backend / API)
**Nhiệm vụ tuần 7:** Rà soát rò rỉ dữ liệu, quyền đọc, giới hạn dữ liệu cá nhân và chỉ mục `batch_code`. Bàn giao: security checklist và tối ưu truy vấn.
**Phạm vi:** `main` sau PR #57 (backend, database, `docker-compose.yml`; frontend chỉ xem phần lưu token và hiển thị dữ liệu). Kết quả đo truy vấn: [`query-optimization.md`](query-optimization.md).

**Rà soát lại tuần 8:** `main` sau PR #59 (truy xuất công khai), #62 (QR), #64 (API quản trị, health check). Nhiệm vụ: "Rà soát schema, backup/seed, bảo mật, quyền và dữ liệu trình diễn. Bàn giao: Database sạch và security checklist." Kết quả ở **mục 7** (mới) và cột trạng thái các mục cũ đã cập nhật (đánh dấu *W8*).

Ký hiệu: ✅ đạt, có bằng chứng · 🔧 sửa trong PR của người rà soát (W7 hoặc W8) · ⚠️ rủi ro còn lại, cần nhóm quyết định · ⏳ chức năng chưa có, ghi sẵn yêu cầu để kiểm khi làm.

## W8 – Tóm tắt rà soát lại

| Nhóm | ✅ | 🔧 | ⚠️ | ⏳ |
| --- | :-: | :-: | :-: | :-: |
| 1. Rò rỉ dữ liệu | 11 | 3 | 2 | – |
| 2. Quyền đọc | 9 | – | 3 | – |
| 3. Dữ liệu cá nhân | 5 | 2 | 2 | – |
| 4. Chỉ mục và truy vấn | 2 | 4 | – | – |
| 7. Schema, sao lưu, dữ liệu demo (W8) | 9 | 8 | 1 | – |

- Hai mục ⏳ của tuần 7 đã có code và **đạt**: R-09 `/api/trace` (đọc chỉ qua view, 404 chung, giới hạn 60 lượt/phút, không trả `description`) và R-10 API quản trị (mọi route có `requirePermission`, không nâng ai lên ADMIN được, không khóa được Admin cuối cùng, mọi thay đổi có audit).
- P-05 (mô tả sự kiện bị công khai) **hết rủi ro ở trang công khai**: `trace.repository` không chọn cột `description`.
- Còn mở: **R-07** (Processor / Distributor mở được lô "đang chờ" của cả hệ thống theo id; trên dữ liệu demo, distributor_a mở được lô 0004 do distributor_b đang vận chuyển), **P-04** (tên nhân viên đơn vị khác trên timeline), 2 mục nhỏ mới R-11, R-12 (mục 2), S-07 (mục 7).
- Việc W8 của TV3 (🔧, mục 7): `schema-current.sql`, sao lưu / khôi phục an toàn, `demo-check.sql` kiểm tra "CSDL sạch", dữ liệu demo đủ 6 trạng thái và không có dữ liệu cá nhân thừa.

## 0. Tóm tắt (tuần 7)

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
| D-09 | CSDL không mở ra mạng | 🔧 | `ports: "127.0.0.1:5432:5432"`. Backend trong Docker vẫn kết nối qua mạng nội bộ `database:5432`; chạy backend trên máy (`DB_HOST=localhost`) vẫn được. *W8:* PR #66 (TV4) đổi cổng phía máy thành `127.0.0.1:15432` – vẫn chỉ mở cho chính máy đó; khi merge thì `DB_PORT=15432` cho lệnh chạy trên máy |
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
| R-09 | `/api/trace/{qrToken}`, `/api/trace/code/{batchCode}` (công khai) | ✅ *W8* | PR #59: chỉ đọc 2 view công khai, không chọn `description`; mọi trường hợp không có kết quả (sai chữ ký, sai định dạng, không tồn tại) trả **cùng** 404; token > 200 ký tự bị từ chối trước khi tính HMAC; 60 lượt / phút / IP; route nằm trong `PUBLIC_ROUTES` của SEC-01. Kiểm thử TC-QR-04, 11–17. Đã chạy `trace.repository` bằng `fsc_app` trên CSDL demo. Còn R-11 |
| R-10 | `/api/users`, `/api/organizations`, `/api/audit-logs` (Admin) | ✅ *W8* | PR #64: mọi route `requireAuth` + `requirePermission` (SEC-01 tự kiểm). Đổi vai trò chỉ sang FARMER / PROCESSOR / DISTRIBUTOR và không đổi vai trò của Admin (không leo thang thành ADMIN qua API); không tự đổi trạng thái của mình; không khóa Admin hoạt động cuối cùng; duyệt / mở khóa cần có đơn vị; mỗi thay đổi ghi audit cùng transaction. Tài khoản bị khóa mất quyền ngay ở yêu cầu kế tiếp (`loadCurrentUser`). Đã chạy `admin.repository` bằng `fsc_app`: đủ quyền, không cần DELETE. Còn R-12 |
| R-11 | Tra cứu công khai theo mã lô phân biệt hoa thường | ⚠️ *W8, nhỏ* | `GET /api/trace/code/batch-2026-0001` → 404 dù lô có tồn tại (`BATCH_CODE_RE` chỉ nhận chữ hoa). Người dùng gõ tay mã in trên nhãn dễ gặp. Đề xuất TV2: `batchCode.trim().toUpperCase()` trước khi kiểm tra (CHECK của CSDL bảo đảm mã luôn viết hoa) |
| R-12 | Hai cài đặt cho `GET /api/audit-logs` | ⚠️ *W8, dọn code* | `app.use('/api', adminRouter)` đứng trước `app.use('/api/audit-logs', auditRouter)` nên `GET /api/audit-logs` do module admin (#64) xử lý; route cùng đường dẫn của module audit (W6) không bao giờ chạy, còn `/api/audit-logs/verify` vẫn thuộc module audit. Không sai quyền (cả hai chỉ ADMIN) nhưng hai bản dễ lệch nhau. Đề xuất: TV2 + TV3 giữ một bản (bỏ route `GET /` của `audit.routes.js` hoặc của admin) và ghi rõ trong README module |

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
| P-05 | Mô tả sự kiện là chữ tự do và được công khai | ✅ *W8* | API công khai (#59) không trả `description`; chỉ người dùng nội bộ trong phạm vi lô thấy. Dữ liệu demo đã bỏ biển số xe khỏi mô tả; `demo-check.sql` cảnh báo nếu mô tả / địa điểm có chuỗi giống số điện thoại, biển số, email. `location` vẫn công khai, nên giữ ở mức địa danh |
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

*W8 – trạng thái các đề xuất:* 4 (ghi chú trên form) không còn cần cho trang công khai (P-05). 5 đã làm (#59, R-09). 6 đang làm trong PR #66 (TV4: `BACKEND_DB_USER` / `BACKEND_DB_PASSWORD`, `docs/deployment.md`). 1, 2, 3 **chưa có quyết định của nhóm** – R-07, P-04 vẫn mở; đề xuất 1 là thay đổi quy tắc nghiệp vụ (bên vận chuyển phải là bên nhận) nên cần nhóm đồng ý trước khi viết migration.

## 6. Kiểm tra lại

```bash
cd backend && npm test                                   # gồm test/security.test.js (SEC-01…07)
psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 -f database/tests/schema-check.sql   # 78 PASS, CSDL trống
psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 -f database/tests/demo-check.sql     # W8: CSDL demo sạch
# tối ưu truy vấn: docs/security/query-optimization.md mục 5
```
Chạy trong Docker và PowerShell: xem `database/Readme.md` (chép file vào container rồi `psql -f`).

## 7. Schema, sao lưu, dữ liệu trình diễn (W8)

### 7.1 Rà soát schema (sau 001 → 007, chạy truy vấn danh mục hệ thống trên CSDL mới migrate)

| ID | Kiểm tra | KQ | Bằng chứng |
| --- | --- | :-: | --- |
| S-01 | Mọi bảng có khóa chính; không bảng / cột thừa | ✅ | 10 bảng đều có PK. Cột cho phép NULL đều có lý do: `actor_id` (audit do hệ thống ghi), `entity_id`, `old_value` / `new_value`, `batches.product_id` (không bắt buộc), `organizations.address`, `products.description`, `supply_chain_events.description`, `users.organization_id` (PENDING / ADMIN) |
| S-02 | Khóa ngoại có chỉ mục | ✅ | Chỉ 2 khóa ngoại không có chỉ mục, đều trỏ vào bảng tra cứu 6 dòng và bị trigger chặn xóa: `supply_chain_events.event_type → event_types`, `event_types.role_code → roles`. Không cần thêm chỉ mục |
| S-03 | Không có quyền thừa cho PUBLIC / hàm SECURITY DEFINER | ✅ | PUBLIC không có quyền trên bảng nào; không hàm nào `SECURITY DEFINER` (trigger chạy với quyền người gọi, không mở đường vòng quyền) |
| S-04 | Quyền `fsc_app` đúng thiết kế sau khi thêm module trace / admin | ✅ | SELECT + INSERT trên `audit_logs`, `supply_chain_events`, `qr_codes`; thêm UPDATE trên `organizations`, `users`, `products`, `batches`; chỉ SELECT trên `roles`, `event_types`, các view; không DELETE ở đâu. Seed admin, seed demo, `admin.repository`, `trace.repository` đều chạy được bằng `fsc_app` trên CSDL thật |
| S-05 | Có một nơi đọc **toàn bộ** schema hiện tại | 🔧 | `database/schema.sql` chỉ là bản W3 (= 001) nhưng code nhiều chỗ ghi "đúng database/schema.sql". Thêm `database/schema-current.sql` (sinh tự động bằng `pg_dump --schema-only` sau 001 → 007, giữ comment). Đã thử: chạy file này vào CSDL trống thành công; sinh hai lần cho kết quả giống hệt. Test `migrator.test.js` báo lỗi nếu thêm migration mà quên sinh lại |
| S-06 | Trình tự chạy lại từ đầu sạch | ✅ | 001 → 007 chạy trên CSDL trống, `schema-check.sql` 78/78 PASS |
| S-07 | Thứ tự sự kiện cho trang công khai viết cứng | ⚠️ *nhỏ* | `trace.repository` sắp xếp phụ theo mảng `['CREATED', …, 'SHIPPED']` viết trong code, trong khi thứ tự chuẩn nằm ở `event_types.seq_no` (W6). Đề xuất TV2: `JOIN event_types t ON t.code = event_type ORDER BY "timestamp", t.seq_no` |

### 7.2 Sao lưu và khôi phục

| ID | Kiểm tra | KQ | Bằng chứng |
| --- | --- | :-: | --- |
| B-01 | Có quy trình sao lưu chạy được trên Windows và Linux | 🔧 | `database/scripts/backup.ps1` / `backup.sh`: `pg_dump -Fc` tạo file **trong container** rồi `docker compose cp` ra `backups/` (không dùng `>`: PowerShell đổi mã hóa làm hỏng file nhị phân) |
| B-02 | Khôi phục không làm mất CSDL đang dùng nếu bản sao lưu hỏng | 🔧 | `restore.ps1` / `restore.sh`: bắt buộc `-Yes` / `--yes`; kiểm tra file, khôi phục vào CSDL tạm `<tên>_restore`, **chỉ khi thành công** mới xóa CSDL cũ và đổi tên. Đã thử với file hỏng: dừng ở bước 1, CSDL cũ còn nguyên |
| B-03 | Khôi phục sang máy mới (chưa có vai trò `fsc_app`) | 🔧 | pg_dump không chứa vai trò, nên `GRANT … TO fsc_app` trong bản sao lưu sẽ lỗi (đã tái hiện). Script tạo `fsc_app` trước khi khôi phục. Đã thử trên một cụm PostgreSQL mới: khôi phục thành công |
| B-04 | Dữ liệu sau khôi phục còn toàn vẹn | ✅ | Trigger được tạo sau khi nạp dữ liệu nên append-only không chặn khôi phục; chuỗi băm audit và 7 chuỗi sự kiện vẫn hợp lệ; bộ đếm id tiếp tục đúng (ghi audit mới bằng `fsc_app` nối tiếp chuỗi). Script tự chạy `demo-check.sql` sau khi khôi phục |
| B-05 | Bản sao lưu không bị lỡ commit / chia sẻ | 🔧 | Chứa hash mật khẩu, email, họ tên. `.gitignore` thêm `backups/`, `*.dump`, `*.backup`; test SEC-07 kiểm tra `.gitignore` và các script |

### 7.3 Dữ liệu trình diễn và "CSDL sạch"

| ID | Kiểm tra | KQ | Bằng chứng |
| --- | --- | :-: | --- |
| M-01 | Có cách kiểm tra CSDL sạch trước khi demo | 🔧 | `database/tests/demo-check.sql` (chỉ đọc, kết thúc bằng ROLLBACK), gồm 15 mục: migration đủ; chuỗi băm audit và từng lô; mỗi lô đúng 1 QR có chữ ký khớp mã lô; trạng thái lô = sự kiện cuối; có Admin ACTIVE và đủ vai trò; không còn dữ liệu đo hiệu năng; email ngoài `@demo.local`; số điện thoại / biển số / email trong mô tả; quyền `fsc_app`; bộ đếm id. Có FAIL thì mã thoát ≠ 0. Đã thử: CSDL demo → `0 FAIL`; CSDL bị sửa lén 1 sự kiện và hạ bộ đếm `users` → bắt được cả hai; CSDL đo hiệu năng → báo dữ liệu thử còn sót |
| M-02 | Dữ liệu demo đủ để trình diễn mọi vai trò / trạng thái | 🔧 | Thêm `BATCH-2026-0004` (TRANSPORTED, distributor_b) và `BATCH-2026-0005` (PROCESSED): đủ 6 trạng thái, mọi Distributor / Processor đều có lô (test `seedDemo.test.js`) |
| M-03 | Dữ liệu demo không chứa dữ liệu cá nhân thật / thừa | 🔧 | Email chỉ `@demo.local`; bỏ biển số xe `51C-123.45` khỏi mô tả sự kiện; audit của seed không chứa email (cùng quy tắc W7). Test chặn biển số, số điện thoại, email trong audit |
| M-04 | Mật khẩu tài khoản demo | ✅ | Chỉ lưu bcrypt; mật khẩu chung `SEED_USER_PASSWORD` (mặc định `Demo12345`, chỉ cho demo); `seed-demo.js` từ chối chạy khi `NODE_ENV=production` |
| M-05 | QR của dữ liệu demo quét được ở máy demo | ✅ | QR ký bằng `QR_HMAC_SECRET` và `TRACE_BASE_URL` lúc seed; `demo-check.sql` in ra địa chỉ đang dùng để kiểm trước khi in QR |
| M-06 | Tài liệu chuẩn bị CSDL demo | ✅ | `database/Readme.md` mục "Chuẩn bị CSDL sạch để demo" và "Sao lưu và khôi phục" (kèm lệnh PowerShell) |
