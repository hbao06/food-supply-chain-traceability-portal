# Ma trận phân quyền (W1-TV3)

**Dự án:** Food Supply Chain Traceability & Provenance Portal – Nhóm 13
**Người phụ trách:** Đặng Vĩnh Quang (TV3 - Database / Auth / Security)
**Người review:** Chung Nguyễn Minh Trí (TV2 - Backend / API)
**Trạng thái:** Bản nháp tuần 1. Endpoint lấy từ `docs/api-endpoints-draft.md`, bảng dữ liệu theo `docs/ERD/erd-draft.md`.

## 1. Vai trò

| Vai trò | Ai | Có tài khoản |
| --- | --- | --- |
| Admin | Quản trị hệ thống | Có, không thuộc đơn vị nào |
| Farmer | Người sản xuất, thuộc đơn vị `FARM` | Có |
| Processor | Cơ sở chế biến / đóng gói, thuộc đơn vị `PROCESSOR` | Có |
| Distributor | Vận chuyển / phân phối, thuộc đơn vị `DISTRIBUTOR` | Có |
| Consumer | Người tiêu dùng quét QR hoặc nhập mã lô | Không |

## 2. Ký hiệu

| Ký hiệu | Nghĩa |
| --- | --- |
| ✔ | Được phép, mọi bản ghi |
| ✘ | Không được phép (401 nếu chưa đăng nhập, 403 nếu sai vai trò) |
| **Của mình** | Farmer: chỉ lô thuộc đơn vị mình (`batch.organization_id = user.organization_id`). Với `/users/me`: chỉ tài khoản của chính mình |
| **Phạm vi** | Processor / Distributor: chỉ lô mà đơn vị mình đã ghi ít nhất một sự kiện, hoặc lô đang ở bước chờ vai trò mình tiếp nhận (xem 4.3) |
| — | Không áp dụng |

## 3. Ma trận

Bảng được xoay (endpoint theo hàng, vai trò theo cột) vì có 25 endpoint mà chỉ có 5 vai trò, để bảng không bị tràn ngang khi xem trên GitHub.

### 3.1. Auth và hồ sơ

| Endpoint | Admin | Farmer | Processor | Distributor | Consumer |
| --- | :-: | :-: | :-: | :-: | :-: |
| `POST /auth/login` | ✔ | ✔ | ✔ | ✔ | — |
| `POST /auth/register` | — | ✔ | ✔ | ✔ | — |
| `GET /users/me` | ✔ | Của mình | Của mình | Của mình | ✘ |
| `PATCH /users/me` | ✔ | Của mình | Của mình | Của mình | ✘ |

`POST /auth/register` không cần đăng nhập. Người dùng không được tự chọn ADMIN (xem câu 6). `PATCH /users/me` chỉ sửa được `name` và mật khẩu (phải nhập mật khẩu cũ), không sửa được `role`, `status`, `organization_id`, `email`.

### 3.2. Quản trị người dùng và đơn vị

| Endpoint | Admin | Farmer | Processor | Distributor | Consumer |
| --- | :-: | :-: | :-: | :-: | :-: |
| `GET /users` | ✔ | ✘ | ✘ | ✘ | ✘ |
| `PATCH /users/{id}/role` | ✔ | ✘ | ✘ | ✘ | ✘ |
| `PATCH /users/{id}/status` | ✔ | ✘ | ✘ | ✘ | ✘ |
| `GET /organizations` | ✔ | ✘ | ✘ | ✘ | ✘ |
| `POST /organizations` | ✔ | ✘ | ✘ | ✘ | ✘ |
| `PATCH /organizations/{id}` | ✔ | ✘ | ✘ | ✘ | ✘ |

Admin không được tự hạ quyền hoặc tự khóa chính mình, để hệ thống luôn còn ít nhất một Admin hoạt động.

### 3.3. Lô thực phẩm

| Endpoint | Admin | Farmer | Processor | Distributor | Consumer |
| --- | :-: | :-: | :-: | :-: | :-: |
| `POST /batches` | ✘ | ✔ | ✘ | ✘ | ✘ |
| `GET /batches` | ✔ | Của mình | Phạm vi | Phạm vi | ✘ |
| `GET /batches/{batchId}` | ✔ | Của mình | Phạm vi | Phạm vi | ✘ |
| `PATCH /batches/{batchId}` | ✘ | Của mình | ✘ | ✘ | ✘ |

- Admin chỉ xem, không tạo hay sửa lô, để dữ liệu nguồn gốc luôn do đơn vị thật nhập.
- `PATCH /batches/{batchId}` chỉ sửa được các trường mô tả (`origin`, `quantity`, `production_date`) và chỉ khi lô còn ở trạng thái `CREATED`. Không sửa được `batch_code`, `current_status`, `organization_id`, `created_by`. Mỗi lần sửa ghi `audit_log` kèm giá trị cũ và mới.

### 3.4. Sự kiện chuỗi cung ứng

| Endpoint | Admin | Farmer | Processor | Distributor | Consumer |
| --- | :-: | :-: | :-: | :-: | :-: |
| `POST /batches/{batchId}/events` | ✘ | Của mình (*) | Phạm vi (*) | Phạm vi (*) | ✘ |
| `GET /batches/{batchId}/events` | ✔ | Của mình | Phạm vi | Phạm vi | ✘ |

(*) Ngoài vai trò, mỗi vai trò chỉ được ghi đúng loại sự kiện của mình, và sự kiện phải đúng thứ tự trạng thái. Sai loại → 403, sai thứ tự → 409. Bảng loại sự kiện theo vai trò sẽ chốt cùng tên trạng thái ở tuần 3 (xem mục 4 của `erd-draft.md`). Hướng hiện tại:

| Vai trò | Loại sự kiện được ghi (phương án B / phương án A) |
| --- | --- |
| Farmer | PRODUCTION / CREATED (tự sinh khi tạo lô) |
| Distributor | TRANSPORTATION, DISTRIBUTION / TRANSPORTED, SHIPPED |
| Processor | PROCESSING, PACKAGING / RECEIVED, PROCESSED, PACKAGED |

Không có endpoint sửa hoặc xóa sự kiện cho bất kỳ vai trò nào.

### 3.5. Truy xuất và QR

| Endpoint | Admin | Farmer | Processor | Distributor | Consumer |
| --- | :-: | :-: | :-: | :-: | :-: |
| `GET /batches/{batchId}/timeline` | ✔ | Của mình | Phạm vi | Phạm vi | ✘ |
| `GET /batches/{batchId}/qr` | ✔ | Của mình | Phạm vi | Phạm vi | ✘ |
| `POST /batches/{batchId}/qr` | ✘ | Của mình | ✘ | ✘ | ✘ |
| `GET /trace/{qrToken}` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /trace/code/{batchCode}` | ✔ | ✔ | ✔ | ✔ | ✔ |

`POST /batches/{batchId}/qr` sinh token mới thay cho token cũ (vẫn giữ quan hệ 1 lô – 1 QR). QR cũ đã in sẽ không còn dùng được, nên mỗi lần sinh lại phải ghi `audit_log`.

### 3.6. Audit log

| Endpoint | Admin | Farmer | Processor | Distributor | Consumer |
| --- | :-: | :-: | :-: | :-: | :-: |
| `GET /audit-logs` | ✔ | ✘ | ✘ | ✘ | ✘ |

Không vai trò nào được ghi, sửa hoặc xóa audit log qua API. Hệ thống tự ghi.

## 4. Quy tắc kiểm tra quyền (cho middleware tuần 4)

1. **Thứ tự kiểm tra:** token hợp lệ (401) → tài khoản `ACTIVE` (403) → đúng vai trò (403) → đúng phạm vi bản ghi (404) → dữ liệu hợp lệ (400) → đúng thứ tự trạng thái (409).
2. **Vai trò và trạng thái lấy từ CSDL**, không tin `role` trong body request. JWT chỉ chứa `user_id`, `role` và có thời hạn ngắn. Middleware đọc lại `status` của user mỗi request, để tài khoản vừa bị khóa không dùng tiếp được token cũ.
3. **Phạm vi của Processor/Distributor:** được xem lô nếu đơn vị mình đã ghi ít nhất một sự kiện trên lô đó. Để tiếp nhận lô mới, họ tra cứu đúng mã bằng `GET /batches?code=<batchCode>` (khớp chính xác, không liệt kê toàn bộ) khi lô đang ở trạng thái chờ vai trò của họ.
4. **Ngoài phạm vi trả 404 thay vì 403**, để không xác nhận lô đó có tồn tại. Đề xuất này khác bảng mã lỗi hiện tại trong `docs/api-endpoints-draft.md` (đang ghi 403 cho "Farmer xem lô của người khác"); cần Trí chốt.
5. **Endpoint công khai** chỉ trả các trường được liệt kê ở quy tắc 7 trong `erd-draft.md`. Token QR sai chữ ký hoặc mã lô không tồn tại đều trả 404 với cùng một thông báo.

## 5. Trả lời các điểm mở trong `docs/api-endpoints-draft.md`

### Câu 6 – Ai được chọn vai trò khi đăng ký?

Người đăng ký **được chọn** một trong ba vai trò FARMER, PROCESSOR, DISTRIBUTOR, **không được chọn ADMIN**. Gửi `role = ADMIN` → 400. Tài khoản mới có `status = PENDING`, chưa dùng được:

1. `POST /auth/register` → tạo user `PENDING`, chưa có `organization_id`.
2. Đăng nhập khi đang `PENDING` → 403, thông báo "Tài khoản đang chờ duyệt".
3. Admin xem danh sách, gắn đơn vị (cùng loại với vai trò), có thể đổi vai trò, rồi chuyển sang `ACTIVE` qua `PATCH /users/{id}/status`.
4. Tài khoản Admin đầu tiên được tạo bằng dữ liệu seed, không qua đăng ký.

Lý do: nếu cho tự chọn vai trò mà không duyệt, bất kỳ ai cũng có thể tự xưng Distributor rồi ghi sự kiện giả vào chuỗi. Nếu chỉ Admin tạo tài khoản thì mất luồng đăng ký mà kế hoạch tuần 4 yêu cầu.

Thay đổi kéo theo trong ERD: `user.status` thêm giá trị `PENDING` (ACTIVE | LOCKED | PENDING). Đã cập nhật trong `erd-draft.md`.

### Câu 7 – Endpoint đọc nào phải đăng nhập?

**Tất cả endpoint dưới `/batches/...` đều phải đăng nhập** (thêm `security: bearerAuth`), gồm cả `GET /batches/{batchId}`, `/events`, `/timeline`, `/qr`. Lý do:

- Các endpoint này trả dữ liệu nội bộ (`actor_id`, `created_by`, số lượng), và `batchId` là số tự tăng nên dễ dò.
- Consumer đã có hai endpoint công khai riêng (`/trace/{qrToken}` và `/trace/code/{batchCode}`) chỉ trả dữ liệu được phép.

Chỉ có 4 endpoint không cần đăng nhập: `POST /auth/login`, `POST /auth/register`, `GET /trace/{qrToken}`, `GET /trace/code/{batchCode}`.

Việc cần làm với `docs/openapi-spec.yaml` (Trí, tuần 3): thêm `security` cho các endpoint đọc ở trên và thêm hai endpoint `/trace`.
