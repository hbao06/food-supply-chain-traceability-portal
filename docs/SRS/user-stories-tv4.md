# User Story – TV4 (QA / DevOps / QR) – Tuần 2

> Mỗi mục `## US-...` bên dưới là nội dung của **một GitHub Issue** (script `scripts/create-w2-tv4-issues.sh` tách theo tiêu đề).
> Chuẩn viết: xem `acceptance-criteria-guide.md`.
> Đã căn chỉnh với `user-stories-batch.md` (TV2) và tài liệu User Story giao diện của TV1:
> QR được sinh tự động trong transaction tạo lô (US-B01), `qr_token` có chữ ký HMAC; truy cập ngoài phạm vi hoặc không tồn tại trả `404`, sai vai trò `403`, chưa đăng nhập `401`.
> Endpoint công khai theo bản nháp API: `GET /trace/{qrToken}` và `GET /trace/code/{batchCode}`. Endpoint `GET /batches/{batchId}/qr` là **đề xuất**, cần đối chiếu `docs/openapi-spec.yaml`.

## US-QR-01 - Mã QR có chữ ký HMAC gắn với lô
<!-- area: qr -->
**As a** Farmer
**I want** mã QR của lô được sinh tự động khi tôi tạo lô và có chữ ký HMAC
**So that** mỗi lô có đúng một định danh truy xuất không thể bị làm giả hoặc đoán ra.

**Ưu tiên:** High (Must) | **Phụ thuộc:** US-B01 (TV2): QR được sinh trong cùng Database Transaction với Batch và sự kiện `CREATED`

### Acceptance Criteria
**AC-QR-01-S1 (Success – QR sinh cùng lô)**
- Given Farmer đã đăng nhập
- When Farmer tạo lô thành công (US-B01)
- Then lô có đúng một bản ghi QR với `qr_token` gồm định danh lô và chữ ký HMAC tạo bằng khóa bí mật của server
- And QR chứa URL `https://<domain>/trace/<qr_token>`
- And phản hồi 201 của việc tạo lô có kèm dữ liệu QR

**AC-QR-01-S2 (Success – QR không đổi sau khi cập nhật lô)**
- Given lô A đang ở trạng thái `CREATED` và có `qr_token` là T
- When Farmer cập nhật thông tin lô A (US-B02)
- Then `qr_token` của lô A vẫn là T

**AC-QR-01-E1 (Error – lỗi khi sinh QR thì rollback)**
- Given khóa bí mật HMAC chưa được cấu hình hoặc việc sinh QR gặp lỗi
- When Farmer gửi yêu cầu tạo lô với dữ liệu hợp lệ
- Then hệ thống trả 500
- And không có Batch, QR hay sự kiện `CREATED` nào được lưu (transaction được rollback)

**AC-QR-01-E2 (Error – token bị sửa)**
- Given lô A có `qr_token` là T
- When người dùng sửa một ký tự của T rồi mở `/trace/<token đã sửa>`
- Then chữ ký không khớp và hệ thống trả 404 giống trường hợp token không tồn tại (xem AC-QR-03-E1)

**Ghi chú:** khóa bí mật (ví dụ biến môi trường `QR_HMAC_SECRET`, tên chốt cùng TV2) không được commit vào repo. Cấu trúc chi tiết của `qr_token` chốt ở thiết kế Tuần 3. Không có endpoint tạo QR riêng.

## US-QR-02 - Xem và tải mã QR của lô
<!-- area: qr -->
**As a** người dùng đã đăng nhập có quyền đọc lô (Farmer, Processor, Distributor hoặc Admin)
**I want** xem dữ liệu QR của lô và tải ảnh QR dạng PNG hoặc SVG
**So that** tôi in tem và dán lên bao bì sản phẩm.

**Ưu tiên:** High (Must) | **Phụ thuộc:** US-QR-01, quy tắc phạm vi đọc lô của TV2 (US-B04)

### Acceptance Criteria
**AC-QR-02-S1 (Success – xem dữ liệu QR)**
- Given người dùng có quyền đọc lô `BATCH-2026-0001`
- When người dùng gửi `GET /batches/{batchId}/qr` không kèm `format`
- Then hệ thống trả 200 kèm URL truy xuất `https://<domain>/trace/<qr_token>` của lô

**AC-QR-02-S2 (Success – tải PNG)**
- Given người dùng có quyền đọc lô `BATCH-2026-0001`
- When người dùng yêu cầu `format=png`
- Then nhận file `QR-BATCH-2026-0001.png` kích thước tối thiểu 512x512 px
- And quét file này bằng ứng dụng đọc QR mở đúng URL truy xuất của lô

**AC-QR-02-S3 (Success – tải SVG)**
- Given người dùng có quyền đọc lô `BATCH-2026-0001`
- When người dùng yêu cầu `format=svg`
- Then nhận file `QR-BATCH-2026-0001.svg` hiển thị không vỡ nét khi phóng to

**AC-QR-02-E1 (Error – ngoài phạm vi hoặc không tồn tại)**
- Given lô B thuộc đơn vị khác mà người dùng không có quyền đọc, hoặc lô `BATCH-2026-9999` không tồn tại
- When người dùng yêu cầu QR của lô đó
- Then hệ thống trả 404 và không trả dữ liệu QR nào

**AC-QR-02-E2 (Error – chưa đăng nhập)**
- Given người dùng chưa đăng nhập hoặc token đã hết hạn
- When người dùng yêu cầu QR của một lô
- Then hệ thống trả 401

**AC-QR-02-E3 (Error – định dạng không hỗ trợ)**
- Given người dùng có quyền đọc lô `BATCH-2026-0001`
- When người dùng yêu cầu `format=gif`
- Then hệ thống trả 400 và liệt kê các định dạng hỗ trợ (`png`, `svg`)

**Ghi chú:** quy tắc 404/401/403 theo FR-BATCH-12.

## US-QR-03 - Quét QR hoặc nhập mã lô để xem truy xuất công khai
<!-- area: qr -->
**As a** Người tiêu dùng (không cần đăng nhập)
**I want** quét mã QR hoặc nhập mã lô để xem nguồn gốc và hành trình của sản phẩm
**So that** tôi kiểm chứng được sản phẩm đáng tin cậy trước khi mua hoặc dùng.

**Ưu tiên:** High (Must) | **Phụ thuộc:** US-QR-01, US-B05 (dữ liệu timeline, TV2), US-UI05 và US-UI06 (giao diện, TV1)
**Phân biệt với TV1:** TV1 lo giao diện tra cứu và hiển thị kết quả; User Story này quy định hành vi và dữ liệu của endpoint công khai.

### Acceptance Criteria
**AC-QR-03-S1 (Success – qua QR)**
- Given `qr_token` hợp lệ (chữ ký đúng) của lô `BATCH-2026-0001`
- When người dùng mở `/trace/<qr_token>` mà không đăng nhập
- Then hệ thống trả 200 gồm tên sản phẩm, mã lô, xuất xứ, đơn vị và timeline sự kiện theo thứ tự từ cũ đến mới
- And trang tải xong trong dưới 3 giây trên mạng 4G thông thường

**AC-QR-03-S2 (Success – qua mã lô)**
- Given lô `BATCH-2026-0001` tồn tại
- When người dùng gửi `GET /trace/code/BATCH-2026-0001` mà không đăng nhập
- Then hệ thống trả 200 với cùng nội dung và cùng giới hạn trường như AC-QR-03-S1

**AC-QR-03-S3 (Success – lô mới tạo)**
- Given lô `BATCH-2026-0002` vừa được tạo và chỉ có sự kiện `CREATED`
- When người dùng truy xuất lô này
- Then hệ thống trả 200 với đúng một sự kiện `CREATED`

**AC-QR-03-S4 (Success – chỉ trả dữ liệu công khai)**
- Given lô `BATCH-2026-0001` có dữ liệu nội bộ (email người dùng, mã người dùng, mã người thực hiện, audit log)
- When người dùng truy xuất công khai bằng QR hoặc bằng mã lô
- Then phản hồi chỉ chứa các trường được phép công khai
- And không chứa email, mã người dùng, mã người thực hiện hay audit log

**AC-QR-03-E1 (Error – token không hợp lệ)**
- Given `qr_token` không tồn tại hoặc có chữ ký không hợp lệ
- When người dùng mở `/trace/<qr_token>`
- Then hệ thống trả 404 với thông báo "Không tìm thấy thông tin truy xuất hợp lệ"
- And phản hồi không cho biết token không tồn tại hay sai chữ ký

**AC-QR-03-E2 (Error – mã lô không tồn tại)**
- Given không có lô nào mã `BATCH-2026-9999`
- When người dùng gửi `GET /trace/code/BATCH-2026-9999`
- Then hệ thống trả 404 với cùng thông báo như AC-QR-03-E1

**AC-QR-03-E3 (Error – lạm dụng)**
- Given một địa chỉ IP đã gửi hơn 60 yêu cầu trong 1 phút đến các endpoint truy xuất công khai (QR hoặc mã lô)
- When IP đó gửi thêm một yêu cầu
- Then hệ thống trả 429 và yêu cầu không được xử lý

**Ghi chú:** các endpoint công khai không yêu cầu JWT. Giao diện hiển thị lỗi 429 do TV1 xử lý (US-UI06 cần bổ sung).

## US-QA-01 - Kiểm thử tự động trên mỗi Pull Request
<!-- area: qa -->
**As a** Thành viên nhóm phát triển
**I want** hệ thống CI tự chạy lint và test mỗi khi mở hoặc cập nhật Pull Request
**So that** lỗi được phát hiện sớm và chỉ code đạt yêu cầu mới được merge vào `main`.

**Ưu tiên:** High (Must) | **Phụ thuộc:** workflow `.github/workflows/ci.yml`, branch protection

### Acceptance Criteria
**AC-QA-01-S1 (Success)**
- Given PR vào `main`, mọi test đều đạt và độ phủ (coverage) từ 60% trở lên
- When workflow `CI` chạy xong
- Then check `CI` hiển thị xanh trên PR
- And PR đủ điều kiện merge khi có thêm 1 review được Approve

**AC-QA-01-S2 (Success – PR chỉ đổi tài liệu)**
- Given PR chỉ thay đổi các file trong `docs/`
- When workflow `CI` chạy xong
- Then check `CI` hiển thị xanh để PR không bị chặn merge

**AC-QA-01-E1 (Error – test thất bại)**
- Given PR có ít nhất một test thất bại
- When workflow `CI` chạy xong
- Then check `CI` hiển thị đỏ và nút merge bị chặn
- And log nêu rõ tên test và dòng lỗi

**AC-QA-01-E2 (Error – độ phủ thấp)**
- Given mọi test đạt nhưng coverage dưới 60%
- When workflow `CI` chạy xong
- Then check `CI` đỏ với thông báo coverage thấp hơn ngưỡng

**AC-QA-01-E3 (Error – lỗi cài đặt phụ thuộc)**
- Given `package-lock.json` không khớp `package.json`
- When bước cài đặt chạy
- Then job dừng với lỗi rõ ràng và cho phép chạy lại (re-run) sau khi sửa

**Ghi chú:** ngưỡng 60% áp dụng từ Tuần 4; trước đó CI chạy lint/test ở mức cơ bản.

## US-DEPLOY-01 - Chạy hệ thống bằng Docker
<!-- area: devops -->
**As a** Thành viên mới của nhóm hoặc Người đánh giá đồ án
**I want** dựng toàn bộ hệ thống (frontend, backend, database) bằng một lệnh Docker Compose
**So that** môi trường chạy nhanh, nhất quán và không phải cài thủ công từng thành phần.

**Ưu tiên:** Medium (Should) | **Phụ thuộc:** `docker-compose.yml`, `Dockerfile` của frontend/backend

### Acceptance Criteria
**AC-DEPLOY-01-S1 (Success)**
- Given máy đã cài Docker và file `.env` được tạo từ `.env.example`
- When chạy `docker compose up --build`
- Then các dịch vụ frontend, backend, database khởi động thành công
- And backend kết nối được database và frontend truy cập được trên cổng đã cấu hình

**AC-DEPLOY-01-E1 (Error – thiếu biến môi trường bắt buộc)**
- Given file `.env` thiếu một biến bắt buộc (ví dụ `JWT_SECRET` hoặc `QR_HMAC_SECRET`)
- When chạy `docker compose up`
- Then backend dừng với thông báo nêu rõ tên biến còn thiếu
- And hệ thống không khởi động với giá trị mặc định không an toàn

**AC-DEPLOY-01-E2 (Error – xung đột cổng)**
- Given cổng của frontend đang bị ứng dụng khác sử dụng
- When chạy `docker compose up`
- Then Docker báo lỗi xung đột cổng
- And README hướng dẫn đổi cổng trong `.env`

**Ghi chú:** repo đã có `docker-compose.yml`; đối chiếu và bổ sung hướng dẫn vào README. Danh sách biến bắt buộc ghi trong `backend/.env.example`.
