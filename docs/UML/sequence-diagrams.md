# Sequence Diagram – TV4 (Tuần 3)

> Bàn giao W3-TV4: Sequence Diagram cho **tạo lô** và **quét QR** (kèm xem/tải QR).
> Người lập: TV4 | Người review: TV3 | Ảnh PNG (độ phân giải cao) và mã nguồn Mermaid: thư mục [`sequence/`](sequence)
> Các sơ đồ bám theo SRS v1.5 (`docs/SRS/SRS-v1.md`), `docs/SRS/user-stories-tv4.md` và `docs/SRS/user-stories-batch.md`. Trong sơ đồ, **Auth (JWT, RBAC)**, **QR Service** và **Trace Service** là thành phần logic.

## Quy ước
- Đường liền là yêu cầu, đường đứt là phản hồi; số thứ tự ở mỗi mũi tên là thứ tự thực hiện.
- Khung `alt` là các nhánh điều kiện (thành công, lỗi, ngoài quyền); khung nền xám là phạm vi Database Transaction.
- Mã lỗi: 401 chưa đăng nhập hoặc token hết hạn, 403 sai vai trò hoặc tài khoản không `ACTIVE` (PENDING/LOCKED), 404 ngoài phạm vi hoặc không tồn tại, 400 dữ liệu sai, 429 vượt giới hạn tần suất.

## SD-01. Tạo lô thực phẩm và sinh mã QR

| Thông tin | Nội dung |
|---|---|
| User Story | US-B01 (TV2), US-QR-01 |
| Yêu cầu chức năng | FR-BATCH-01..03, FR-BATCH-12, FR-QR-01, FR-QR-02 |
| Ca kiểm thử | TC-BATCH-01..03, TC-QR-01..04 (xem `docs/test/test-plan.md`) |

**Diễn giải**

- Farmer tạo lô qua `POST /batches`; hệ thống kiểm tra JWT, trạng thái `ACTIVE` và vai trò trước khi xử lý (401 chưa đăng nhập/token sai; 403 sai vai trò hoặc PENDING/LOCKED).
- `batches`, `qr_codes`, sự kiện `CREATED` và `audit_logs` được ghi trong **một Database Transaction**, theo thứ tự đó. Bản ghi QR lưu `qr_data` và `signature_hmac`; audit được ghi cùng transaction theo US-S05.
- Nếu sinh QR lỗi (ví dụ thiếu khóa) thì ROLLBACK toàn bộ, trả 500 và không để lại Batch, QR hay sự kiện nào.
- Dữ liệu sai (thiếu tên, số lượng ≤ 0) trả 400 trước khi mở transaction.

![SD-01. Tạo lô thực phẩm và sinh mã QR](sequence/SD-01-tao-lo-sinh-qr.png)

<details><summary>Mã nguồn Mermaid (GitHub tự hiển thị)</summary>

```mermaid
sequenceDiagram
    autonumber
    actor F as Farmer
    participant FE as Frontend<br/>(React)
    participant API as Backend API
    participant AU as Auth<br/>(JWT, RBAC)
    participant SV as Batch<br/>Service
    participant QR as QR Service<br/>(HMAC)
    participant DB as PostgreSQL

    F->>FE: Nhập tên sản phẩm, nguồn gốc, số lượng, bấm "Tạo lô"
    FE->>API: POST /batches (JWT + dữ liệu lô)
    API->>AU: Xác thực JWT, kiểm tra vai trò Farmer
    alt Chưa đăng nhập hoặc token hết hạn
        AU-->>API: Từ chối
        API-->>FE: 401 Unauthorized
    else Không phải Farmer hoặc tài khoản không ACTIVE (PENDING/LOCKED)
        AU-->>API: Từ chối
        API-->>FE: 403 Forbidden
    else Hợp lệ
        AU-->>API: OK (userId, organizationId)
        API->>SV: createBatch(dữ liệu, userId, organizationId)
        alt Dữ liệu sai (thiếu tên, số lượng ≤ 0)
            SV-->>API: Lỗi kiểm tra dữ liệu
            API-->>FE: 400 Bad Request (không lưu gì)
        else Dữ liệu hợp lệ
            rect rgb(238, 238, 238)
            Note over SV,DB: Một Database Transaction
            SV->>DB: BEGIN
            SV->>DB: INSERT Batch (batch_code duy nhất, trạng thái CREATED)
            DB-->>SV: batch_id
            SV->>QR: sinh qr_token từ batch_code<br/>(HMAC-SHA256, khóa QR_HMAC_SECRET)
            alt Sinh QR lỗi (ví dụ thiếu QR_HMAC_SECRET)
                QR-->>SV: Lỗi
                SV->>DB: ROLLBACK
            else Sinh QR thành công
                QR-->>SV: qr_token
                SV->>DB: INSERT qr_codes (batch_id, qr_data, signature_hmac)
                SV->>DB: INSERT supply_chain_events (CREATED)
                SV->>DB: INSERT audit_logs (action=CREATE, entity_type=BATCH)
                SV->>DB: COMMIT
            end
            end
            alt Đã ROLLBACK
                SV-->>API: Lỗi hệ thống
        API-->>FE: 500 (không lưu batch, QR, sự kiện, audit)
            else Đã COMMIT
                SV-->>API: lô + QR + sự kiện CREATED
                API-->>FE: 201 Created
                FE-->>F: Hiển thị lô vừa tạo và mã QR
            end
        end
    end
```

</details>

## SD-02. Quét mã QR và truy xuất công khai

| Thông tin | Nội dung |
|---|---|
| User Story | US-QR-03, US-UI05, US-UI06 (TV1) |
| Yêu cầu chức năng | FR-QR-05..08, FR-UI-14..18 |
| Ca kiểm thử | TC-QR-11..17, TC-UI-05..09 (xem `docs/test/test-plan.md`) |

**Diễn giải**

- Người tiêu dùng quét QR, mở `/trace/{qrToken}`; endpoint công khai không yêu cầu JWT.
- Giới hạn tần suất (60 yêu cầu/phút/IP) được kiểm tra trước; vượt giới hạn trả 429 kèm `Retry-After`.
- Hệ thống xác minh chữ ký HMAC của token. Token sai chữ ký, sai định dạng hoặc không có lô tương ứng đều trả **cùng một** 404 "Không tìm thấy thông tin truy xuất hợp lệ" để không lộ lý do.
- Dữ liệu trả về chỉ gồm trường công khai; email, mã người dùng, người thực hiện và audit log được ẩn.
- Tra cứu bằng mã lô (`GET /trace/code/{batchCode}`) đi cùng luồng, bỏ bước xác minh chữ ký.

![SD-02. Quét mã QR và truy xuất công khai](sequence/SD-02-quet-qr.png)

<details><summary>Mã nguồn Mermaid (GitHub tự hiển thị)</summary>

```mermaid
sequenceDiagram
    autonumber
    actor C as Người tiêu dùng
    participant PH as Điện thoại<br/>(camera)
    participant FE as Frontend<br/>(React)
    participant API as Backend API
    participant RL as Giới hạn<br/>tần suất
    participant TS as Trace<br/>Service
    participant QR as QR Service<br/>(HMAC)
    participant DB as PostgreSQL

    C->>PH: Quét mã QR trên bao bì
    PH->>FE: Mở URL /trace/{qrToken}
    FE->>API: GET /trace/{qrToken} (không cần JWT)
    API->>RL: Kiểm tra giới hạn (60 yêu cầu/phút/IP)
    alt Vượt giới hạn
        RL-->>API: Từ chối
        API-->>FE: 429 Too Many Requests (Retry-After)
        FE-->>C: "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút"<br/>kèm thao tác Thử lại
    else Trong giới hạn
        RL-->>API: OK
        API->>TS: getTraceByToken(qrToken)
        TS->>QR: verify(qrToken)<br/>(so sánh chữ ký HMAC)
        alt Chữ ký sai hoặc token sai định dạng
            QR-->>TS: Không hợp lệ
            TS-->>API: Không tìm thấy
            API-->>FE: 404 "Không tìm thấy thông tin truy xuất hợp lệ"
            FE-->>C: Thông báo + liên kết về trang nhập mã lô
        else Chữ ký đúng
            QR-->>TS: batch_code
            TS->>DB: SELECT public_batch_trace theo batch_code<br/>(chỉ các cột công khai của lô)
            TS->>DB: SELECT public_event_trace theo batch_code<br/>(chỉ các cột công khai, thời gian tăng dần)
            alt Không có lô
                DB-->>TS: Rỗng
                TS-->>API: Không tìm thấy
                API-->>FE: 404 (cùng thông báo)
                FE-->>C: Thông báo + liên kết về trang nhập mã lô
            else Có lô
                DB-->>TS: Thông tin lô + timeline
                TS-->>API: Dữ liệu công khai<br/>(đã ẩn email, mã người dùng, người thực hiện, audit log)
                API-->>FE: 200 OK
                FE-->>C: Hiển thị thông tin lô và timeline từ cũ đến mới
            end
        end
    end
    Note over C,DB: Tra cứu bằng mã lô (GET /trace/code/{batchCode}) đi cùng luồng từ bước 4,<br/>bỏ bước verify chữ ký. Lỗi mạng hoặc hệ thống: giao diện báo lỗi và cho Thử lại
```

</details>

## SD-03. Xem và tải mã QR của lô

| Thông tin | Nội dung |
|---|---|
| User Story | US-QR-02 |
| Yêu cầu chức năng | FR-QR-03, FR-QR-04, FR-BATCH-12 |
| Ca kiểm thử | TC-QR-05..10 (xem `docs/test/test-plan.md`) |

**Diễn giải**

- Người dùng có quyền đọc lô gọi `GET /batches/{batchId}/qr` (JWT). Endpoint này là **đề xuất**, cần đối chiếu OpenAPI.
- Farmer đọc lô thuộc đơn vị mình; Processor/Distributor đọc lô mà đơn vị của họ đã ghi ít nhất một sự kiện; Admin đọc mọi lô. Ngoài phạm vi hoặc không tồn tại trả 404; chưa đăng nhập trả 401.
- Không kèm `format` thì trả URL truy xuất (JSON); `format=png` (≥ 512 px) hoặc `svg` thì trả file `QR-{batch_code}.{đuôi}`; định dạng khác trả 400.

![SD-03. Xem và tải mã QR của lô](sequence/SD-03-xem-tai-qr.png)

<details><summary>Mã nguồn Mermaid (GitHub tự hiển thị)</summary>

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng<br/>(có quyền đọc lô)
    participant FE as Frontend<br/>(React)
    participant API as Backend API
    participant AU as Auth<br/>(JWT, RBAC)
    participant SV as Batch<br/>Service
    participant QR as QR Service
    participant DB as PostgreSQL

    U->>FE: Chọn xem hoặc tải mã QR của lô
    FE->>API: GET /batches/{batchId}/qr?format=png|svg (JWT)
    API->>AU: Xác thực JWT
    alt Chưa đăng nhập hoặc token hết hạn
        AU-->>API: Từ chối
        API-->>FE: 401 Unauthorized
    else Hợp lệ
        AU-->>API: OK (userId, organizationId, vai trò)
        API->>SV: getBatchQr(batchId, phạm vi người dùng)
        alt Vai trò FARMER
            SV->>DB: SELECT batches + qr_codes theo organization_id của Farmer
        else Vai trò PROCESSOR hoặc DISTRIBUTOR
            SV->>DB: SELECT batches + qr_codes cho lô có sự kiện do organization_id này ghi
        else Vai trò ADMIN
            SV->>DB: SELECT batches + qr_codes không giới hạn đơn vị
        end
        alt Lô ngoài phạm vi hoặc không tồn tại
            DB-->>SV: Rỗng
            SV-->>API: Không tìm thấy
            API-->>FE: 404 Not Found (không trả dữ liệu QR)
        else Có quyền đọc lô
            DB-->>SV: batch_code, qr_data, signature_hmac
            alt Không có format
                SV-->>API: QRCode { qrData, batchId, ... }
                API-->>FE: 200 OK (JSON theo schema QRCode của OpenAPI)
            else format = png hoặc svg
                SV->>QR: tạo ảnh QR từ URL truy xuất (png ≥ 512 px hoặc svg)
                QR-->>SV: Ảnh QR
                SV-->>API: Ảnh QR-{batch_code}.{đuôi}
                API-->>FE: 200 OK (file)
                FE-->>U: Tải file QR để in tem
            else format không hỗ trợ (ví dụ gif)
                SV-->>API: Định dạng sai
                API-->>FE: 400 Bad Request (liệt kê png, svg)
            end
        end
    end
```

</details>

## Điểm chờ xác nhận
- Cấu trúc `qr_token` và tên biến `QR_HMAC_SECRET` theo SRS P1/P2.
- Endpoint `GET /batches/{batchId}/qr` và phản hồi JSON theo schema `QRCode.qrData` OpenAPI; điểm mở P3 chỉ còn ảnh PNG/SVG vì OpenAPI hiện mới mô tả `qrData`.
- Mã lỗi khi truy cập ngoài phạm vi (404) và thông báo lỗi truy xuất dùng chung (chờ TV3, TV1), SRS mục 10.

## Cách xuất lại ảnh PNG
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i docs/UML/sequence/SD-01-tao-lo-sinh-qr.mmd -o docs/UML/sequence/SD-01-tao-lo-sinh-qr.png -s 3 -b white
```
