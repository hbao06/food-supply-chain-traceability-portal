# Danh sách endpoint dự kiến (W1-TV2)

**Dự án:** Food Supply Chain Traceability & Provenance Portal – Nhóm 13
**Người phụ trách:** TV2 (Backend / API)
**Người review:** TV1
**Trạng thái:** Bản nháp tuần 1, đã đối chiếu với `docs/openapi.yaml` (v1.0.0) có sẵn trong repo.

## 1. Tài nguyên (resources)

| Tài nguyên | Ý nghĩa | Nguồn trong tài liệu |
| --- | --- | --- |
| User | Tài khoản và vai trò (Farmer, Distributor, Processor, Admin) | UR-05, FR-07 |
| Organization | Đơn vị/tổ chức của người dùng | Kế hoạch tuần 2 và tuần 4 |
| Batch | Lô thực phẩm, có mã duy nhất và trạng thái | UR-01, SR-FR-01 |
| Event | Sự kiện chuỗi cung ứng gắn với lô (SupplyChainEvent) | UR-02/03, SR-FR-04/06 |
| Trace | Timeline truy xuất, gồm bản nội bộ và bản công khai qua QR | UR-04, SR-FR-05 |

Ngoài ra có hai nhóm hỗ trợ: **QR** (QRCode gắn với lô) và **Audit log** (FR-08, FR-09).
Consumer không có tài khoản, chỉ dùng endpoint công khai.

## 2. Danh sách endpoint

Cột "Quyền": `Public` là không cần đăng nhập, `Auth` là mọi người dùng đã đăng nhập.
Cột "OpenAPI": **Có** là đã có trong `openapi.yaml`; **Thêm** là đề xuất bổ sung.

### 2.1. Auth và hồ sơ (làm ở tuần 4)

| Method | Đường dẫn | Quyền | OpenAPI | Mô tả |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | Public | Có | Đăng nhập, trả JWT. |
| POST | `/auth/register` | Public | Thêm | Đăng ký tài khoản. Không cho tự chọn vai trò Admin. |
| GET | `/users/me` | Auth | Thêm | Xem hồ sơ của mình. |
| PATCH | `/users/me` | Auth | Thêm | Cập nhật hồ sơ của mình. |

### 2.2. Quản trị người dùng và đơn vị (FR-07)

| Method | Đường dẫn | Quyền | OpenAPI | Mô tả |
| --- | --- | --- | --- | --- |
| GET | `/users` | Admin | Thêm | Danh sách người dùng. |
| PATCH | `/users/{id}/role` | Admin | Thêm | Gán hoặc đổi vai trò. |
| PATCH | `/users/{id}/status` | Admin | Thêm | Khóa hoặc mở khóa tài khoản. |
| GET | `/organizations` | Admin | Thêm | Danh sách đơn vị. |
| POST | `/organizations` | Admin | Thêm | Tạo đơn vị. |
| PATCH | `/organizations/{id}` | Admin | Thêm | Cập nhật đơn vị. |

### 2.3. Lô thực phẩm (UR-01, SR-01)

| Method | Đường dẫn | Quyền | OpenAPI | Mô tả |
| --- | --- | --- | --- | --- |
| POST | `/batches` | Farmer | Có | Tạo lô với mã duy nhất. Lưu Batch, QRCode và sự kiện CREATED trong một giao dịch. |
| GET | `/batches/{batchId}` | Auth | Có | Chi tiết một lô. |
| GET | `/batches` | Auth | Thêm | Danh sách lô, lọc theo trạng thái (`?status=`). Farmer chỉ thấy lô của mình. |
| PATCH | `/batches/{batchId}` | Farmer (chủ lô) | Thêm | Cập nhật thông tin nguồn gốc của lô. |

Không có `DELETE /batches/{batchId}`, vì lịch sử chỉ ghi thêm (FR-08, NFR-02).

### 2.4. Sự kiện chuỗi cung ứng (UR-02/03, SR-02)

| Method | Đường dẫn | Quyền | OpenAPI | Mô tả |
| --- | --- | --- | --- | --- |
| POST | `/batches/{batchId}/events` | Distributor, Processor | Có | Ghi sự kiện. Kiểm tra role theo loại sự kiện và thứ tự trạng thái; ghi sự kiện và đổi trạng thái trong cùng giao dịch. |
| GET | `/batches/{batchId}/events` | Auth | Có | Danh sách sự kiện của lô. |

Không có endpoint sửa hoặc xóa sự kiện.

### 2.5. Truy xuất và QR (UR-04, SR-03)

| Method | Đường dẫn | Quyền | OpenAPI | Mô tả |
| --- | --- | --- | --- | --- |
| GET | `/batches/{batchId}/timeline` | Auth | Có (hiện chưa yêu cầu đăng nhập) | Timeline đầy đủ của lô, dành cho người dùng trong hệ thống. |
| GET | `/trace/{qrToken}` | Public | Thêm | Consumer quét QR. Xác minh chữ ký HMAC, tìm lô, chỉ trả timeline công khai. |
| GET | `/batches/{batchId}/qr` | Auth | Có (hiện chưa yêu cầu đăng nhập) | Lấy thông tin mã QR của lô. |
| POST | `/batches/{batchId}/qr` | Farmer | Có | Sinh QR cho lô (xem điểm cần thống nhất số 3). |

### 2.6. Audit log (UR-05, FR-09)

| Method | Đường dẫn | Quyền | OpenAPI | Mô tả |
| --- | --- | --- | --- | --- |
| GET | `/audit-logs` | Admin | Thêm | Tra cứu nhật ký, lọc theo lô, người thực hiện, loại sự kiện, khoảng thời gian. |

Audit log do hệ thống tự ghi khi dữ liệu thay đổi (UC08), nên không có endpoint ghi từ bên ngoài.

## 3. Mã lỗi chính dự kiến

| Mã | Khi nào |
| --- | --- |
| 400 | Dữ liệu đầu vào thiếu hoặc không hợp lệ. |
| 401 | Thiếu token hoặc token sai/hết hạn. |
| 403 | Đúng người dùng nhưng sai quyền (ví dụ Distributor gửi PACKAGED). |
| 404 | Không tìm thấy lô; QR sai chữ ký hoặc không tồn tại (không lộ dữ liệu nội bộ). |
| 409 | Trùng mã lô, hoặc sự kiện sai thứ tự trạng thái. `openapi.yaml` hiện chưa có mã 409. |

## 4. Điểm cần thống nhất với nhóm

Sau khi đối chiếu với `openapi.yaml` v1.0.0 và báo cáo tiến độ, có các chỗ lệch sau:

1. **Tên trạng thái và loại sự kiện không khớp báo cáo.**
   - Báo cáo (State Machine): CREATED → TRANSPORTED → RECEIVED → PROCESSED → PACKAGED → SHIPPED.
   - `openapi.yaml`, trạng thái lô: CREATED, IN_TRANSIT, PROCESSING, PACKAGED, DISTRIBUTED, COMPLETED.
   - `openapi.yaml`, loại sự kiện: PRODUCTION, TRANSPORTATION, PROCESSING, PACKAGING, DISTRIBUTION. Không có bước nhận hàng (RECEIVED).
   - Cần chốt một bộ tên dùng chung cho UML, ERD, API và code (mốc tuần 3).
2. **Truy xuất công khai và HMAC.** Báo cáo yêu cầu QR có chữ ký HMAC (NFR-01, SR-FR-05). `openapi.yaml` hiện cho xem timeline theo `batchId` kiểu số nguyên không cần đăng nhập, và `qr_data` là `.../trace/1001`, dễ đoán. Đề xuất thêm `GET /trace/{qrToken}` làm endpoint công khai, còn `/timeline` yêu cầu đăng nhập.
3. **Sinh QR.** Báo cáo (UC04) sinh QR trong cùng giao dịch tạo lô. `openapi.yaml` có thêm `POST /batches/{batchId}/qr` riêng. Cần chốt giữ để tạo lại QR hay bỏ.
4. **Mã lô duy nhất.** Kế hoạch tuần 5 yêu cầu `batch_code` unique, nhưng `Batch` trong `openapi.yaml` chỉ có `batch_id` kiểu số nguyên. Cần thống nhất với TV3 (ERD).
5. **Organization** chưa có trong Class Diagram của báo cáo. Cần TV3 xác nhận khi làm ERD.
6. **Đăng ký tài khoản:** ai được chọn role Farmer/Distributor/Processor khi đăng ký, hay chỉ Admin gán role? Cần chốt với TV3 (ma trận quyền).
7. **Một số endpoint đọc chưa có `security`** (`GET /batches/{batchId}`, `/events`, `/qr`), có thể lộ dữ liệu nội bộ. Cần rà lại cùng TV3.
