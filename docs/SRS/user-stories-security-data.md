# User Story bảo mật và dữ liệu — W2-TV3

**Dự án:** Food Supply Chain Traceability & Provenance Portal — Nhóm 13

**Người phụ trách:** Đặng Vĩnh Quang (TV3 - Database / Auth / Security)

**Người review:** Chung Nguyễn Minh Trí (TV2 - Backend / API)

**Bàn giao:** 6 User Story (yêu cầu tối thiểu 4), bao phủ phân quyền, quản lý đơn vị, audit log và khóa tài khoản.

## 1. Phạm vi và tài liệu tham chiếu

Tài liệu mô tả yêu cầu bảo mật và dữ liệu ở phía backend/CSDL. Các story giao diện tương ứng (đăng ký, đăng nhập, hồ sơ, đăng xuất) nằm trong [user-stories-ui-account.md](user-stories-ui-account.md); story nghiệp vụ lô nằm trong `user-stories-batch.md`.

- [Ma trận phân quyền](../permission-matrix.md)
- [ERD nháp v2](../ERD/erd-draft.md)
- [Bản nháp endpoint](../api-endpoints-draft.md)

Quy ước dùng chung cho mọi story trong tài liệu này (giống `user-stories-batch.md`):

| Tình huống | Mã phản hồi |
| --- | --- |
| Thiếu token, token sai hoặc hết hạn | `401 Unauthorized` |
| Tài khoản không ở trạng thái `ACTIVE`, hoặc đúng người nhưng sai vai trò | `403 Forbidden` |
| Bản ghi không tồn tại hoặc nằm ngoài phạm vi được xem | `404 Not Found` (không tiết lộ bản ghi có tồn tại hay không) |
| Dữ liệu đầu vào thiếu hoặc sai | `400 Bad Request` |
| Xung đột trạng thái hoặc dữ liệu trùng | `409 Conflict` |

## 2. Danh sách User Story

| Mã | User Story | Vai trò | Mảng yêu cầu | API tham chiếu dự kiến |
| --- | --- | --- | --- | --- |
| US-S01 | Duyệt tài khoản, gán vai trò và đơn vị | Admin | Phân quyền | `GET /users`, `PATCH /users/{id}/role`, `PATCH /users/{id}/status` |
| US-S02 | Chặn truy cập sai vai trò và ngoài phạm vi | Người dùng nội bộ | Phân quyền | Middleware áp dụng cho mọi endpoint nội bộ |
| US-S03 | Quản lý đơn vị tham gia chuỗi cung ứng | Admin | Quản lý đơn vị | `GET /organizations`, `POST /organizations`, `PATCH /organizations/{id}` |
| US-S04 | Khóa và mở khóa tài khoản | Admin | Khóa tài khoản | `PATCH /users/{id}/status` |
| US-S05 | Tự động ghi audit log khi dữ liệu thay đổi | Admin (người hưởng lợi) | Audit log | Không có endpoint ghi; hệ thống tự ghi |
| US-S06 | Tra cứu audit log và bảo vệ nhật ký khỏi chỉnh sửa | Admin | Audit log | `GET /audit-logs` |

## 3. User Story và Acceptance Criteria

### US-S01: Duyệt tài khoản, gán vai trò và đơn vị

**As an** Admin,

**I want** xem các tài khoản đang chờ duyệt, gán đơn vị, xác nhận hoặc đổi vai trò rồi kích hoạt tài khoản,

**So that** chỉ những người thuộc đơn vị thật trong chuỗi cung ứng mới được ghi dữ liệu vào hệ thống.

**AC01 — Duyệt tài khoản thành công**
- **Given** tôi đăng nhập với vai trò Admin và có tài khoản U ở trạng thái `PENDING`, vai trò đăng ký là `DISTRIBUTOR`.
- **When** tôi gán U vào một đơn vị có loại `DISTRIBUTOR` rồi chuyển trạng thái U sang `ACTIVE`.
- **Then** hệ thống lưu `organization_id`, `status = ACTIVE`, trả về `200 OK` và ghi một bản ghi `AUDIT_LOG` cho mỗi thay đổi (gán đơn vị, kích hoạt); từ lúc đó U đăng nhập được.

**AC02 — Vai trò và loại đơn vị không khớp**
- **Given** tôi là Admin và tài khoản U có vai trò `FARMER`.
- **When** tôi gán U vào đơn vị có loại `PROCESSOR`, hoặc kích hoạt U khi chưa gán đơn vị.
- **Then** hệ thống từ chối với `400 Bad Request`, thông báo rõ lý do và giữ nguyên dữ liệu của U.

**AC03 — Không cấp quyền Admin qua đăng ký, không tự hạ quyền**
- **Given** tôi là Admin.
- **When** tôi đổi vai trò của chính mình, hoặc thao tác khiến hệ thống không còn Admin nào ở trạng thái `ACTIVE`.
- **Then** hệ thống từ chối với `409 Conflict` và không thay đổi dữ liệu. Vai trò `ADMIN` chỉ được tạo từ dữ liệu seed hoặc do một Admin khác gán.

**AC04 — Người không phải Admin**
- **Given** tôi đăng nhập với vai trò Farmer, Processor hoặc Distributor.
- **When** tôi gọi `GET /users`, `PATCH /users/{id}/role` hoặc `PATCH /users/{id}/status`.
- **Then** hệ thống trả về `403 Forbidden` và không trả về danh sách người dùng.

### US-S02: Chặn truy cập sai vai trò và ngoài phạm vi

**As a** người dùng nội bộ (Farmer, Processor, Distributor),

**I want** hệ thống chỉ cho tôi thao tác đúng vai trò và chỉ thấy dữ liệu thuộc phạm vi của đơn vị mình,

**So that** dữ liệu của đơn vị tôi không bị đơn vị khác xem hoặc sửa, và không ai ghi sự kiện giả vào lô của tôi.

**AC01 — Truy cập hợp lệ**
- **Given** tôi là Farmer `ACTIVE` thuộc đơn vị X, có token hợp lệ, và lô A thuộc đơn vị X.
- **When** tôi xem chi tiết lô A.
- **Then** hệ thống trả về `200 OK` cùng dữ liệu lô A. Vai trò và đơn vị dùng để kiểm tra được lấy từ CSDL theo `user_id` trong token, không lấy từ dữ liệu client gửi lên.

**AC02 — Thiếu hoặc sai token**
- **Given** tôi chưa đăng nhập, gửi token sai chữ ký hoặc token đã hết hạn.
- **When** tôi gọi bất kỳ endpoint nội bộ nào.
- **Then** hệ thống trả về `401 Unauthorized`, không xử lý yêu cầu.

**AC03 — Sai vai trò**
- **Given** tôi là Distributor `ACTIVE`.
- **When** tôi gọi `POST /batches` hoặc một endpoint chỉ dành cho Admin.
- **Then** hệ thống trả về `403 Forbidden` và không tạo hay thay đổi dữ liệu.

**AC04 — Ngoài phạm vi đơn vị**
- **Given** tôi là Farmer thuộc đơn vị X và lô B thuộc đơn vị Y.
- **When** tôi xem, sửa lô B hoặc xem sự kiện, timeline, QR của lô B.
- **Then** hệ thống trả về `404 Not Found` giống hệt khi lô không tồn tại, không tiết lộ thông tin nào về lô B.

**AC05 — Gửi trường không được phép sửa**
- **Given** tôi là người dùng `ACTIVE`.
- **When** tôi gửi `role`, `status`, `organization_id` hoặc `email` trong `PATCH /users/me`.
- **Then** hệ thống bỏ qua hoặc từ chối các trường đó (`400 Bad Request`), vai trò và đơn vị của tôi không thay đổi.

### US-S03: Quản lý đơn vị tham gia chuỗi cung ứng

**As an** Admin,

**I want** tạo, xem và cập nhật các đơn vị (nông trại, cơ sở chế biến, nhà phân phối),

**So that** mỗi tài khoản và mỗi lô gắn với một đơn vị thật, làm cơ sở cho phạm vi dữ liệu và cho tên đơn vị hiển thị trên trang truy xuất công khai.

**AC01 — Tạo đơn vị thành công**
- **Given** tôi là Admin.
- **When** tôi tạo đơn vị với tên, loại (`FARM`, `PROCESSOR` hoặc `DISTRIBUTOR`) và địa chỉ hợp lệ.
- **Then** hệ thống tạo đơn vị, trả về `201 Created` kèm `organization_id` và ghi `AUDIT_LOG`.

**AC02 — Dữ liệu không hợp lệ hoặc trùng**
- **Given** tôi là Admin.
- **When** tôi bỏ trống tên, gửi loại không thuộc danh sách cho phép, hoặc tạo đơn vị trùng tên và trùng loại với một đơn vị đã có.
- **Then** hệ thống trả về `400 Bad Request` (dữ liệu sai) hoặc `409 Conflict` (trùng), không tạo đơn vị.

**AC03 — Cập nhật đơn vị đang được sử dụng**
- **Given** đơn vị X đã có thành viên hoặc đã sở hữu lô.
- **When** tôi đổi tên hoặc địa chỉ của X.
- **Then** hệ thống cập nhật, trả về `200 OK` và ghi `AUDIT_LOG` kèm giá trị cũ và mới.
- **When** tôi đổi loại của X (ví dụ từ `FARM` sang `DISTRIBUTOR`).
- **Then** hệ thống từ chối với `409 Conflict`, vì đổi loại sẽ làm sai vai trò của thành viên và lịch sử lô.

**AC04 — Không xóa đơn vị**
- **Given** bất kỳ người dùng nào.
- **When** tìm cách xóa một đơn vị.
- **Then** hệ thống không cung cấp endpoint xóa; khóa ngoại từ `USER`, `PRODUCT`, `BATCH` tới `ORGANIZATION` dùng `ON DELETE RESTRICT` nên kể cả thao tác trực tiếp trên CSDL cũng không xóa được đơn vị đang có dữ liệu.

**AC05 — Người không phải Admin**
- **Given** tôi là Farmer, Processor hoặc Distributor.
- **When** tôi gọi các endpoint `/organizations`.
- **Then** hệ thống trả về `403 Forbidden`.

### US-S04: Khóa và mở khóa tài khoản

**As an** Admin,

**I want** khóa ngay một tài khoản khi người đó rời đơn vị hoặc có dấu hiệu ghi dữ liệu sai, và mở khóa khi cần,

**So that** người không còn thẩm quyền không thể tiếp tục thao tác, nhưng lịch sử họ đã ghi vẫn được giữ nguyên.

**AC01 — Khóa tài khoản thành công và có hiệu lực ngay**
- **Given** tôi là Admin và tài khoản U đang `ACTIVE`, U vẫn còn một token chưa hết hạn.
- **When** tôi chuyển U sang `LOCKED`.
- **Then** hệ thống lưu `status = LOCKED`, trả về `200 OK`, ghi `AUDIT_LOG`; mọi yêu cầu tiếp theo của U, kể cả bằng token cũ, bị từ chối với `403 Forbidden` (middleware đọc lại `status` từ CSDL mỗi yêu cầu).

**AC02 — Đăng nhập khi đang bị khóa**
- **Given** tài khoản U đang `LOCKED`.
- **When** U đăng nhập đúng email và mật khẩu.
- **Then** hệ thống trả về `403 Forbidden` với thông báo "Tài khoản đã bị khóa", không cấp token.

**AC03 — Dữ liệu lịch sử được giữ nguyên**
- **Given** U đã từng tạo lô hoặc ghi sự kiện trước khi bị khóa.
- **When** U bị khóa.
- **Then** các lô, sự kiện và audit log do U tạo không bị xóa hay sửa; trang truy xuất công khai vẫn hiển thị các sự kiện đó.

**AC04 — Mở khóa**
- **Given** tài khoản U đang `LOCKED`.
- **When** tôi chuyển U về `ACTIVE`.
- **Then** U đăng nhập lại được và hệ thống ghi `AUDIT_LOG` cho thao tác mở khóa.

**AC05 — Thao tác không hợp lệ**
- **Given** tôi là Admin.
- **When** tôi tự khóa chính mình, khóa Admin `ACTIVE` cuối cùng, hoặc gửi trạng thái không thuộc `PENDING`, `ACTIVE`, `LOCKED`.
- **Then** hệ thống từ chối với `409 Conflict` (hai trường hợp đầu) hoặc `400 Bad Request` (trạng thái sai), không thay đổi dữ liệu.

### US-S05: Tự động ghi audit log khi dữ liệu thay đổi

**As an** Admin,

**I want** mọi thay đổi dữ liệu quan trọng và thao tác bảo mật đều được hệ thống tự ghi lại kèm người thực hiện và thời điểm,

**So that** khi có tranh chấp về nguồn gốc lô hoặc nghi ngờ dữ liệu bị sửa, tôi truy được ai đã làm gì, lúc nào.

**AC01 — Các thao tác phải được ghi**
- **Given** hệ thống đang hoạt động.
- **When** xảy ra một trong các thao tác: tạo hoặc sửa lô; ghi sự kiện chuỗi cung ứng; sinh lại QR; đăng ký tài khoản; duyệt, đổi vai trò, khóa hoặc mở khóa tài khoản; tạo hoặc sửa đơn vị; đăng nhập thất bại.
- **Then** hệ thống ghi một bản ghi `AUDIT_LOG` gồm `actor_id` (để trống nếu không xác định được người dùng), `action`, `entity`, `entity_id`, `created_at` và `detail` (giá trị cũ/mới nếu là thao tác sửa).

**AC02 — Ghi audit cùng giao dịch với thay đổi dữ liệu**
- **Given** một thao tác ghi dữ liệu đang diễn ra.
- **When** việc ghi `AUDIT_LOG` thất bại.
- **Then** toàn bộ thao tác bị rollback và trả về lỗi; không tồn tại thay đổi dữ liệu nào mà không có bản ghi audit tương ứng.

**AC03 — Không ghi thông tin nhạy cảm**
- **Given** thao tác liên quan đến tài khoản (đăng ký, đổi mật khẩu, đăng nhập thất bại).
- **When** hệ thống ghi `AUDIT_LOG`.
- **Then** trường `detail` không chứa mật khẩu, `password_hash`, JWT hay token QR.

**AC04 — Không có đường ghi từ bên ngoài**
- **Given** bất kỳ người dùng nào, kể cả Admin.
- **When** tìm cách tạo bản ghi audit qua API.
- **Then** không có endpoint `POST`/`PUT`/`PATCH`/`DELETE` cho audit log; yêu cầu tới các phương thức đó trả về `404 Not Found` hoặc `405 Method Not Allowed`.

### US-S06: Tra cứu audit log và bảo vệ nhật ký khỏi chỉnh sửa

**As an** Admin,

**I want** tra cứu audit log theo lô, người thực hiện, loại thao tác và khoảng thời gian, và chắc chắn rằng không ai sửa hay xóa được nhật ký,

**So that** nhật ký là bằng chứng tin cậy khi kiểm tra sự cố hoặc chứng minh nguồn gốc.

**AC01 — Tra cứu có lọc**
- **Given** tôi là Admin và hệ thống có các bản ghi audit.
- **When** tôi gọi `GET /audit-logs` với bộ lọc `entity`, `entity_id`, `actor_id`, `action`, `from`, `to`.
- **Then** hệ thống trả về `200 OK` các bản ghi khớp, sắp xếp mới nhất trước, có phân trang; không trả về `password_hash` hay token.

**AC02 — Bộ lọc không hợp lệ**
- **Given** tôi là Admin.
- **When** tôi gửi `from` lớn hơn `to`, ngày sai định dạng, hoặc kích thước trang vượt giới hạn.
- **Then** hệ thống trả về `400 Bad Request` kèm thông báo trường sai.

**AC03 — Người không phải Admin**
- **Given** tôi là Farmer, Processor hoặc Distributor.
- **When** tôi gọi `GET /audit-logs`.
- **Then** hệ thống trả về `403 Forbidden`.

**AC04 — Chặn sửa và xóa ở mức CSDL**
- **Given** có quyền kết nối CSDL bằng tài khoản mà backend sử dụng.
- **When** chạy câu lệnh `UPDATE` hoặc `DELETE` trên bảng `audit_log` hoặc `supply_chain_event`.
- **Then** câu lệnh bị từ chối (trigger hoặc `REVOKE UPDATE, DELETE`), dữ liệu không thay đổi. Muốn điều chỉnh thì ghi thêm bản ghi mới, không sửa bản ghi cũ.

## 4. Ánh xạ tới thiết kế dữ liệu

| Story | Bảng / cột liên quan trong ERD v2 | Ghi chú cho `schema.sql` tuần 3 |
| --- | --- | --- |
| US-S01 | `user.role`, `user.status`, `user.organization_id`, `organization.type` | CHECK cho `role`, `status`; `organization_id` bắt buộc khi `ACTIVE` (trừ ADMIN) |
| US-S02 | `user.role`, `user.organization_id`, `batch.organization_id` | Chỉ mục `batch(organization_id)` để lọc phạm vi |
| US-S03 | `organization` | UNIQUE `(name, type)`; FK tới `organization` dùng `ON DELETE RESTRICT` |
| US-S04 | `user.status` | Middleware đọc `status` mỗi yêu cầu |
| US-S05 | `audit_log` | Ghi trong cùng transaction; `actor_id` cho phép NULL |
| US-S06 | `audit_log`, `supply_chain_event` | Chỉ mục `(entity, entity_id)`, `(actor_id)`, `created_at`; trigger chặn UPDATE/DELETE |

## 5. Các điểm cần thống nhất

| Nội dung | Đề xuất hiện tại | Cần chốt với |
| --- | --- | --- |
| Khóa tạm thời sau nhiều lần đăng nhập sai | Chưa đưa vào story bắt buộc. Nếu làm, cần thêm `failed_login_count`, `locked_until` vào `user` | Cả nhóm (tuần 3) |
| Ràng buộc vai trò ↔ loại đơn vị | FARMER ↔ FARM, PROCESSOR ↔ PROCESSOR, DISTRIBUTOR ↔ DISTRIBUTOR | Trí, Hoài Bảo |
| Ghi audit cho đăng nhập thành công | Chưa ghi (tránh phình bảng); chỉ ghi đăng nhập thất bại | Bình (kiểm thử) |
| Chính sách mật khẩu | Tối thiểu 8 ký tự, có chữ và số | Hoài Bảo (US-UI01, US-UI03) |
| Giao diện quản trị (duyệt tài khoản, đơn vị, audit log) | Chưa có màn hình trong `ui-screen-list.md` | Hoài Bảo (tuần 3) |

## 6. Kiểm tra bàn giao

- 6 story có As a / I want / So that; mỗi story có ít nhất một kịch bản thành công và một kịch bản lỗi theo Given–When–Then.
- Bao phủ đủ 4 mảng của task: phân quyền (US-S01, US-S02), quản lý đơn vị (US-S03), khóa tài khoản (US-S04), audit log (US-S05, US-S06).
- Mã lỗi thống nhất với `user-stories-batch.md` và `permission-matrix.md` (ngoài phạm vi trả 404).
- Mỗi story sẽ được tạo thành một GitHub Issue (template User Story, nhãn `type: user-story`, `area: auth-security` hoặc `area: database`, `week-2`).
