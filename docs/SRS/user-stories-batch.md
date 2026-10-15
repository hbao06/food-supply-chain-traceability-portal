# User Story nghiệp vụ lô (W2-TV2)

**Dự án:** Food Supply Chain Traceability & Provenance Portal – Nhóm 13
**Người phụ trách:** Chung Nguyễn Minh Trí (TV2 - Backend / API)
**Người review:** Trương Huỳnh Hoài Bảo (TV1 - Lead UI/UX)
**Phạm vi:** tạo lô, cập nhật lô, tìm kiếm lô, xem chi tiết lô và API timeline.

Quy ước:
- Mỗi story có As a / I want / So that.
- Mỗi story có ít nhất một kịch bản thành công và một kịch bản lỗi, viết theo Given-When-Then.
- Tên trạng thái theo báo cáo tiến độ (CREATED, TRANSPORTED, RECEIVED, PROCESSED, PACKAGED, SHIPPED). Nếu nhóm chốt bộ tên khác thì cập nhật lại ở đây.
- Mã lỗi theo `docs/api-endpoints-draft.md`.
- Phạm vi đọc nội bộ: Farmer chỉ đọc lô do mình tạo; Distributor/Processor chỉ đọc lô trong phạm vi xử lý; Admin đọc toàn bộ. Áp dụng đồng nhất cho danh sách, chi tiết và timeline. Ngoài phạm vi trả 403; lô không tồn tại trả 404.
- Đây là bản nháp yêu cầu. Các khác biệt về trạng thái, loại sự kiện và bảo mật so với `docs/openapi-spec.yaml` vẫn cần được nhóm thống nhất theo mục 4 của bản nháp endpoint; chưa khẳng định hai tài liệu đã đồng bộ.

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
- **When** tôi gửi tên sản phẩm, nguồn gốc và số lượng hợp lệ
- **Then** hệ thống tạo lô với `batch_code` duy nhất, trạng thái CREATED, tạo mã QR có token ký HMAC và ghi sự kiện CREATED trong cùng một giao dịch, trả về 201 cùng thông tin lô. Nếu một bước thất bại, toàn bộ giao dịch được rollback, không để lại lô, QR hoặc sự kiện khởi tạo riêng lẻ.

**Kịch bản lỗi**
- **Given** tôi đã đăng nhập với vai trò Farmer
- **When** tôi gửi thiếu tên sản phẩm, thiếu nguồn gốc hoặc số lượng, hoặc số lượng nhỏ hơn hoặc bằng 0
- **Then** hệ thống trả 400 kèm thông báo chỉ rõ trường sai, và không tạo lô nào.

**Kịch bản lỗi (phân quyền)**
- **Given** tôi đăng nhập với vai trò Distributor hoặc chưa đăng nhập
- **When** tôi gửi yêu cầu tạo lô
- **Then** hệ thống trả 403 (sai quyền) hoặc 401 (chưa đăng nhập).

---

## US-B02: Cập nhật thông tin lô

**As a** Farmer,
**I want** cập nhật thông tin nguồn gốc của lô do tôi tạo,
**So that** dữ liệu lô luôn chính xác khi tôi phát hiện nhập sai hoặc thiếu.

**Kịch bản thành công**
- **Given** tôi là Farmer, là chủ của lô A và lô A đang ở trạng thái CREATED
- **When** tôi gửi thông tin nguồn gốc cần sửa hợp lệ cho lô A
- **Then** hệ thống lưu thay đổi và thêm một dòng audit log (người sửa, thời điểm, giá trị cũ và mới) trong cùng giao dịch, trả 200 cùng thông tin mới; không sửa hoặc xóa sự kiện hay audit log đã có.

**Kịch bản lỗi (lô đã chuyển trạng thái)**
- **Given** tôi là Farmer và là chủ của lô A, nhưng lô A đã chuyển khỏi CREATED
- **When** tôi gửi yêu cầu cập nhật nguồn gốc lô A
- **Then** hệ thống trả 409 do trạng thái không cho phép cập nhật, dữ liệu lô và lịch sử đã ghi không thay đổi. Đây là trường hợp 409 bổ sung cho PATCH, cần cập nhật vào bản nháp endpoint khi chốt API.

**Kịch bản lỗi (dữ liệu không hợp lệ)**
- **Given** tôi là Farmer, là chủ của lô A đang ở trạng thái CREATED
- **When** tôi gửi nguồn gốc rỗng hoặc yêu cầu sửa mã lô, chủ lô hay trạng thái qua PATCH
- **Then** hệ thống trả 400, không cập nhật lô hoặc thêm bản ghi audit thành công.

**Kịch bản lỗi (xác thực và vai trò)**
- **Given** tôi thiếu token, token sai/hết hạn, hoặc đăng nhập bằng vai trò không phải Farmer
- **When** tôi gửi yêu cầu cập nhật lô
- **Then** hệ thống trả 401 cho token thiếu/sai/hết hạn, hoặc 403 cho vai trò không được phép; dữ liệu không thay đổi.

**Kịch bản lỗi**
- **Given** tôi là Farmer nhưng lô A do Farmer khác tạo
- **When** tôi gửi yêu cầu cập nhật lô A
- **Then** hệ thống trả 403 và dữ liệu lô không thay đổi.

**Kịch bản lỗi (không tồn tại)**
- **Given** tôi là Farmer
- **When** tôi cập nhật một mã lô không tồn tại
- **Then** hệ thống trả 404.

---

## US-B03: Tìm kiếm và lọc danh sách lô

**As a** người dùng đã đăng nhập (Farmer, Distributor, Processor hoặc Admin),
**I want** xem danh sách lô và lọc theo trạng thái hoặc tìm theo tên sản phẩm, mã lô,
**So that** tôi nhanh chóng tìm đúng lô cần xử lý.

**Kịch bản thành công**
- **Given** tôi đã đăng nhập và hệ thống có nhiều lô ở các trạng thái khác nhau
- **When** tôi gọi danh sách với bộ lọc trạng thái (ví dụ `status=CREATED`) hoặc từ khóa
- **Then** hệ thống trả 200 với các lô khớp điều kiện trong phạm vi đọc nội bộ đã quy định. Bộ lọc không được mở rộng quyền đọc. Nếu không có lô nào khớp trong phạm vi thì trả danh sách rỗng.

**Kịch bản thành công (tìm theo mã lô)**
- **Given** tôi đã đăng nhập và được phép xem lô A có `batch_code` xác định
- **When** tôi gọi danh sách với `code` bằng mã lô A
- **Then** hệ thống trả 200 và chỉ gồm lô khớp mã trong phạm vi được phép; mã lô ngoài phạm vi trả danh sách rỗng.

**Kịch bản lỗi**
- **Given** tôi đã đăng nhập
- **When** tôi lọc theo một trạng thái không tồn tại (ví dụ `status=ABC`)
- **Then** hệ thống trả 400 kèm thông báo các giá trị hợp lệ.

**Kịch bản lỗi (chưa đăng nhập)**
- **Given** tôi chưa đăng nhập hoặc token hết hạn
- **When** tôi gọi danh sách lô
- **Then** hệ thống trả 401.

---

## US-B04: Xem chi tiết lô

**As a** người dùng đã đăng nhập,
**I want** xem đầy đủ thông tin của một lô (sản phẩm, nguồn gốc, số lượng, trạng thái hiện tại, người tạo),
**So that** tôi biết chính xác lô đang ở bước nào trước khi xử lý.

**Kịch bản thành công**
- **Given** tôi đã đăng nhập, lô A tồn tại và thuộc phạm vi đọc nội bộ của tôi
- **When** tôi mở chi tiết lô A
- **Then** hệ thống trả 200 với thông tin lô A, gồm trạng thái hiện tại.

**Kịch bản lỗi**
- **Given** tôi đã đăng nhập
- **When** tôi mở chi tiết một mã lô không tồn tại
- **Then** hệ thống trả 404 và không lộ thông tin nội bộ.

**Kịch bản lỗi (ngoài phạm vi)**
- **Given** tôi đã đăng nhập nhưng lô A không thuộc phạm vi đọc nội bộ của tôi
- **When** tôi mở chi tiết lô A
- **Then** hệ thống trả 403 và không trả dữ liệu lô A.

**Kịch bản lỗi (xác thực)**
- **Given** tôi thiếu token hoặc token sai/hết hạn
- **When** tôi mở chi tiết lô A
- **Then** hệ thống trả 401 và không trả dữ liệu nội bộ.

---

## US-B05: Xem timeline của lô

**As a** người dùng đã đăng nhập,
**I want** xem toàn bộ sự kiện của một lô theo thứ tự thời gian,
**So that** tôi truy ra được lô đã đi qua những khâu nào, ai thực hiện và khi nào.

**Kịch bản thành công**
- **Given** tôi đã đăng nhập, được phép đọc lô A và lô A đã có nhiều sự kiện (CREATED, TRANSPORTED, RECEIVED...)
- **When** tôi gọi timeline của lô A
- **Then** hệ thống trả 200 với thông tin lô và danh sách sự kiện sắp xếp từ cũ đến mới, mỗi sự kiện có loại, địa điểm, người thực hiện và thời điểm.

**Kịch bản thành công (lô mới)**
- **Given** tôi đã đăng nhập, được phép đọc lô B và lô B vừa được tạo, chưa có sự kiện nào ngoài CREATED
- **When** tôi gọi timeline của lô B
- **Then** hệ thống trả 200 với đúng một sự kiện CREATED.

**Kịch bản lỗi**
- **Given** tôi đã đăng nhập
- **When** tôi gọi timeline của một mã lô không tồn tại
- **Then** hệ thống trả 404.

**Kịch bản lỗi (ngoài phạm vi)**
- **Given** tôi đã đăng nhập nhưng lô A không thuộc phạm vi đọc nội bộ của tôi
- **When** tôi gọi timeline của lô A
- **Then** hệ thống trả 403 và không trả thông tin lô hoặc sự kiện nội bộ.

**Kịch bản lỗi (xác thực)**
- **Given** tôi thiếu token hoặc token sai/hết hạn
- **When** tôi gọi timeline của lô A
- **Then** hệ thống trả 401 và không trả dữ liệu nội bộ.

---

## Ghi chú

- Timeline công khai cho Consumer (quét QR, không cần đăng nhập) thuộc story QR của TV4 và story giao diện truy xuất của TV1, nên không viết ở đây.
- Quy tắc chuyển trạng thái và quyền ghi sự kiện (Distributor, Processor) sẽ làm thành story riêng ở tuần 6 nếu nhóm cần.
- Khi hoàn thành, mỗi story được tạo thành một GitHub Issue (mốc cuối tuần 2).
