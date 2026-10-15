# User Story nghiệp vụ lô (W2-TV2)

**Dự án:** Food Supply Chain Traceability & Provenance Portal – Nhóm 13
**Người phụ trách:** Chung Nguyễn Minh Trí (TV2 - Backend / API)
**Người review:** Trương Huỳnh Hoài Bảo (TV1 - Lead UI/UX)
**Phạm vi:** Tạo lô, cập nhật lô, tìm kiếm lô, xem chi tiết lô và API timeline.

Quy ước:
- Mỗi story có As a / I want / So that.
- Mỗi story có ít nhất một kịch bản thành công và các kịch bản lỗi/phân quyền, viết theo Given-When-Then.
- Tên trạng thái theo báo cáo tiến độ (`CREATED`, `TRANSPORTED`, `RECEIVED`, `PROCESSED`, `PACKAGED`, `SHIPPED`).
- Mã lỗi và logic truy cập nhất quán với `docs/api-endpoints-draft.md`:
  + Phân quyền đọc lô: Farmer/Distributor/Processor xem được các lô thuộc đơn vị (`organization_id`) của mình. Admin xem tất cả.
  + Khi truy cập lô/timeline ngoài phạm vi quyền hạn hoặc không tồn tại: Trả về `404 Not Found` (để bảo mật, không tiết lộ sự tồn tại của dữ liệu).
  + Khi chưa đăng nhập hoặc token hết hạn: Trả về `401 Unauthorized`.
  + Khi thao tác sai vai trò (ví dụ Distributor cố tạo lô): Trả về `403 Forbidden`.

| Mã | Tên story | Vai trò | Endpoint liên quan |
| --- | --- | --- | --- |
| US-B01 | Tạo lô thực phẩm | Farmer | `POST /batches` |
| US-B02 | Cập nhật thông tin lô | Farmer | `PATCH /batches/{batchId}` |
| US-B03 | Tìm kiếm và lọc danh sách lô | Người dùng đã đăng nhập | `GET /batches` |
| US-B04 | Xem chi tiết lô | Người dùng đã đăng nhập | `GET /batches/{batchId}` |
| US-B05 | Xem timeline của lô | Người dùng đã đăng nhập | `GET /batches/{batchId}/timeline` |

---

## US-B01: Tạo lô thực phẩm

**As a** Farmer,
**I want** tạo một lô thực phẩm mới với tên sản phẩm, nguồn gốc và số lượng,
**So that** lô có mã duy nhất và hệ thống bắt đầu ghi lại nguồn gốc từ khâu sản xuất.

**Kịch bản thành công**
- **Given** tôi đã đăng nhập với vai trò Farmer
- **When** tôi gửi yêu cầu tạo lô với đầy đủ thông tin hợp lệ (tên sản phẩm, nguồn gốc, số lượng > 0)
- **Then** hệ thống thực hiện 1 Database Transaction để:
  1. Tạo lô mới với `batch_id` tự tăng và sinh `batch_code` duy nhất.
  2. Tự động sinh mã `QR_CODE` chứa chữ ký HMAC (`qr_token`) gắn liền với lô.
  3. Ghi sự kiện khởi tạo `CREATED` vào bảng `SUPPLY_CHAIN_EVENT`.
- **And** hệ thống trả về mã `201 Created` kèm thông tin chi tiết lô, dữ liệu QR và thông tin sự kiện `CREATED`.

**Kịch bản lỗi (dữ liệu không hợp lệ)**
- **Given** tôi đã đăng nhập với vai trò Farmer
- **When** tôi gửi thiếu tên sản phẩm hoặc số lượng nhỏ hơn hoặc bằng 0
- **Then** hệ thống từ chối lưu dữ liệu, rollback transaction và trả về `400 Bad Request` kèm thông báo chỉ rõ trường sai.

**Kịch bản lỗi (phân quyền & xác thực)**
- **Given** tôi đăng nhập với vai trò Distributor/Processor hoặc chưa đăng nhập
- **When** tôi gửi yêu cầu tạo lô
- **Then** hệ thống trả về `403 Forbidden` (nếu sai vai trò) hoặc `401 Unauthorized` (nếu chưa đăng nhập).

---

## US-B02: Cập nhật thông tin lô

**As a** Farmer,
**I want** cập nhật thông tin nguồn gốc của lô do tôi hoặc đơn vị tôi tạo khi lô đang ở trạng thái `CREATED`,
**So that** dữ liệu lô luôn chính xác khi phát hiện nhập sai hoặc thiếu ở khâu sản xuất.

**Kịch bản thành công**
- **Given** tôi là Farmer thuộc đơn vị sở hữu lô A và lô A đang ở trạng thái `CREATED`
- **When** tôi gửi thông tin cập nhật hợp lệ cho lô A
- **Then** hệ thống lưu thay đổi, trả về `200 OK` cùng thông tin mới của lô, đồng thời tự động ghi vết thay đổi vào `AUDIT_LOG`.

**Kịch bản lỗi (lô đã chuyển trạng thái)**
- **Given** tôi là Farmer thuộc đơn vị sở hữu lô A nhưng lô A đã chuyển sang trạng thái khác (`TRANSPORTED`, `RECEIVED`, `PROCESSED`,...)
- **When** tôi gửi yêu cầu cập nhật thông tin lô A
- **Then** hệ thống từ chối cập nhật và trả về mã lỗi `400 Bad Request` (hoặc `409 Conflict`) thông báo chỉ được sửa lô ở trạng thái `CREATED`.

**Kịch bản lỗi (truy cập ngoài phạm vi sở hữu)**
- **Given** tôi là Farmer thuộc đơn vị X nhưng lô B do đơn vị Y tạo
- **When** tôi gửi yêu cầu cập nhật lô B
- **Then** hệ thống từ chối và trả về mã lỗi `404 Not Found` (hoặc `403 Forbidden`) và giữ nguyên dữ liệu lô B.

**Kịch bản lỗi (không tồn tại)**
- **Given** tôi là Farmer đã đăng nhập
- **When** tôi gửi yêu cầu cập nhật một mã lô không tồn tại
- **Then** hệ thống trả về `404 Not Found`.

---

## US-B03: Tìm kiếm và lọc danh sách lô

**As a** người dùng đã đăng nhập (Farmer, Distributor, Processor hoặc Admin),
**I want** xem danh sách lô thuộc phạm vi quản lý của đơn vị mình và lọc theo trạng thái hoặc tìm theo tên sản phẩm, mã lô,
**So that** tôi nhanh chóng tìm đúng các lô hàng liên quan để xử lý.

**Kịch bản thành công**
- **Given** tôi đã đăng nhập và hệ thống có nhiều lô hàng ở các trạng thái khác nhau
- **When** tôi gọi danh sách lô kèm bộ lọc trạng thái (ví dụ `status=CREATED`) hoặc từ khóa tìm kiếm
- **Then** hệ thống trả về `200 OK` với danh sách các lô khớp điều kiện.
- **And** phạm vi dữ liệu được lọc theo vai trò:
  + Farmer, Distributor, Processor: chỉ thấy các lô thuộc đơn vị (`organization_id`) của mình hoặc lô mà đơn vị mình đã tiếp nhận/xử lý.
  + Admin: thấy toàn bộ danh sách lô trong hệ thống.
  + Nếu không có lô nào khớp thì trả về danh sách rỗng `[]`.

**Kịch bản lỗi (trạng thái không hợp lệ)**
- **Given** tôi đã đăng nhập
- **When** tôi lọc theo một trạng thái không hợp lệ (ví dụ `status=ABC`)
- **Then** hệ thống trả về `400 Bad Request` kèm thông báo các giá trị trạng thái hợp lệ.

**Kịch bản lỗi (chưa đăng nhập)**
- **Given** tôi chưa đăng nhập hoặc token hết hạn
- **When** tôi gọi API lấy danh sách lô
- **Then** hệ thống trả về `401 Unauthorized`.

---

## US-B04: Xem chi tiết lô

**As a** người dùng đã đăng nhập,
**I want** xem đầy đủ thông tin của một lô hàng (sản phẩm, nguồn gốc, số lượng, trạng thái hiện tại, người tạo) thuộc thẩm quyền đơn vị mình,
**So that** tôi biết chính xác lô đang ở bước nào trước khi xử lý.

**Kịch bản thành công**
- **Given** tôi đã đăng nhập và lô A thuộc phạm vi quản lý của đơn vị tôi (hoặc tôi là Admin)
- **When** tôi gửi yêu cầu xem chi tiết lô A
- **Then** hệ thống trả về `200 OK` cùng toàn bộ thông tin chi tiết của lô A và trạng thái hiện tại.

**Kịch bản lỗi (truy cập ngoài phạm vi thẩm quyền)**
- **Given** tôi đã đăng nhập nhưng lô B thuộc đơn vị khác mà tôi không có quyền đọc
- **When** tôi gửi yêu cầu xem chi tiết lô B
- **Then** hệ thống trả về `404 Not Found` để bảo mật và giấu sự tồn tại của lô B.

**Kịch bản lỗi (không tồn tại hoặc chưa đăng nhập)**
- **Given** tôi chưa đăng nhập hoặc truy cập mã lô không có trong hệ thống
- **When** tôi gửi yêu cầu xem chi tiết lô
- **Then** hệ thống trả về `401 Unauthorized` (chưa đăng nhập) hoặc `404 Not Found` (mã lô không tồn tại).

---

## US-B05: Xem timeline của lô

**As a** người dùng đã đăng nhập,
**I want** xem toàn bộ chuỗi sự kiện lịch sử của một lô hàng thuộc đơn vị mình theo thứ tự thời gian,
**So that** tôi truy xuất được lô đã đi qua những khâu nào, ai thực hiện và vào thời điểm nào.

**Kịch bản thành công (lô có nhiều sự kiện)**
- **Given** tôi đã đăng nhập và lô A thuộc thẩm quyền của tôi đã trải qua nhiều sự kiện (`CREATED`, `TRANSPORTED`, `RECEIVED`,...)
- **When** tôi gọi API xem timeline của lô A
- **Then** hệ thống trả về `200 OK` gồm thông tin tổng quan lô và danh sách sự kiện được sắp xếp theo thời gian tăng dần (từ cũ đến mới).

**Kịch bản thành công (lô mới tạo)**
- **Given** lô B vừa được tạo và chỉ mới có sự kiện `CREATED`
- **When** tôi gọi API xem timeline của lô B
- **Then** hệ thống trả về `200 OK` với đúng 1 sự kiện `CREATED`.

**Kịch bản lỗi (truy cập ngoài phạm vi thẩm quyền)**
- **Given** tôi đã đăng nhập nhưng lô C thuộc đơn vị khác mà tôi không có quyền truy cập
- **When** tôi gọi API xem timeline của lô C
- **Then** hệ thống trả về `404 Not Found` để bảo mật dữ liệu.

**Kịch bản lỗi (không tồn tại hoặc chưa đăng nhập)**
- **Given** tôi chưa đăng nhập hoặc gọi timeline của mã lô không tồn tại
- **When** tôi gửi yêu cầu
- **Then** hệ thống trả về `401 Unauthorized` (chưa đăng nhập) hoặc `404 Not Found` (mã lô không tồn tại).

---

## Ghi chú
- Timeline công khai cho Consumer (quét QR không cần đăng nhập) được xử lý riêng tại endpoint công khai `GET /trace/{qrToken}` thuộc phạm vi US-B04 của TV4 và giao diện của TV1.
- Logic phân quyền và xử lý truy cập ngoài thẩm quyền thống nhất dùng mã lỗi `404 Not Found` đối với tài nguyên lô để ngăn chặn hành vi dò quét mã lô của đơn vị khác.