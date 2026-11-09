# ERD v3.3 – Cơ sở dữ liệu (W3-TV3, cập nhật W4, W5, W6)

**Dự án:** Food Supply Chain Traceability & Provenance Portal – Nhóm 13
**Người phụ trách:** Đặng Vĩnh Quang (TV3 - Database / Auth / Security)
**Người review:** Chung Nguyễn Minh Trí (TV2 - Backend / API)
**Hệ quản trị:** PostgreSQL 16
**Bàn giao tuần 3:** `docs/ERD/ERD-v3.pdf` (sơ đồ), `database/schema.sql` (schema v1), `database/tests/schema-check.sql`.
**Cập nhật tuần 4 (v3.1):** thêm bảng `roles` (`database/migrations/002_roles_table.sql`); từ tuần 4 CSDL được tạo bằng migration (`database/migrations`), `schema.sql` chỉ giữ để tham chiếu.
**Cập nhật tuần 5 (v3.2):** thêm bảng `products`, cột `batches.product_id`, view `farms` (`database/migrations/003_products_farms.sql`) và dữ liệu mẫu (`npm run db:seed:demo`).
**Cập nhật tuần 6 (v3.3):** thêm bảng `event_types` (migration 004), chuỗi băm `prev_hash` / `row_hash` cho `audit_logs` và `supply_chain_events` (migration 005), vai trò CSDL `fsc_app` (migration 006).

ERD v3 thay cho bản nháp v2 (`erd-draft.md`). Tên bảng và cột được thống nhất với Class Diagram (`docs/UML/class-diagram.dot`) và OpenAPI (`docs/openapi-spec.yaml`, bản W3-TV2): CSDL dùng `snake_case`, API dùng `camelCase` tương ứng.

## 1. Sơ đồ

```mermaid
erDiagram
    ROLES ||--o{ USERS : "gán cho"
    ROLES ||--o{ EVENT_TYPES : "được ghi bởi"
    EVENT_TYPES ||--o{ SUPPLY_CHAIN_EVENTS : "phân loại"
    EVENT_TYPES ||--o{ BATCHES : "trạng thái"
    ORGANIZATIONS ||--o{ PRODUCTS : "có sản phẩm"
    PRODUCTS |o--o{ BATCHES : "được sản xuất thành"
    ORGANIZATIONS |o--o{ USERS : "có thành viên"
    ORGANIZATIONS ||--o{ BATCHES : "sở hữu"
    USERS ||--o{ BATCHES : "tạo"
    BATCHES ||--|| QR_CODES : "có"
    BATCHES ||--|{ SUPPLY_CHAIN_EVENTS : "có"
    USERS ||--o{ SUPPLY_CHAIN_EVENTS : "ghi"
    USERS |o--o{ AUDIT_LOGS : "gây ra"

    ROLES {
        varchar role_code PK "ADMIN | FARMER | PROCESSOR | DISTRIBUTOR"
        varchar name "NOT NULL"
        varchar description "NOT NULL"
        boolean self_register "được tự đăng ký"
    }

    EVENT_TYPES {
        varchar code PK "CREATED → SHIPPED"
        smallint seq_no UK "thứ tự bước"
        varchar role_code FK "vai trò được ghi"
        varchar name
        varchar description
        boolean sendable "FALSE: hệ thống tự ghi"
    }

    ORGANIZATIONS {
        bigint organization_id PK
        varchar name "NOT NULL, UNIQUE cùng type"
        varchar type "FARM | PROCESSOR | DISTRIBUTOR"
        varchar address
        timestamptz created_at
        timestamptz updated_at
    }

    USERS {
        bigint user_id PK
        bigint organization_id FK "NULL với ADMIN hoặc khi PENDING"
        varchar name "NOT NULL"
        varchar email UK "duy nhất, không phân biệt hoa thường"
        varchar password_hash "bcrypt, CHECK định dạng"
        varchar role FK "roles.role_code"
        varchar status "PENDING | ACTIVE | LOCKED"
        timestamptz created_at
        timestamptz updated_at
    }

    PRODUCTS {
        bigint product_id PK
        bigint organization_id FK "nông trại (type FARM)"
        varchar name "UNIQUE trong nông trại"
        varchar category "NOT NULL"
        varchar unit "đơn vị của quantity"
        text description
        timestamptz created_at
        timestamptz updated_at
    }

    BATCHES {
        bigint batch_id PK
        varchar batch_code UK "BATCH-YYYY-NNNN"
        bigint product_id FK "không bắt buộc"
        varchar product_name "NOT NULL, tự lấy từ products"
        varchar origin "NOT NULL"
        numeric quantity "lớn hơn 0"
        timestamptz creation_date
        varchar current_status FK "event_types.code, mặc định CREATED"
        bigint created_by FK "Farmer tạo lô"
        bigint organization_id FK "đơn vị sở hữu"
        timestamptz updated_at
    }

    QR_CODES {
        bigint qr_id PK
        bigint batch_id FK "UNIQUE, 1 lô - 1 QR"
        varchar qr_data UK "URL chứa qrToken"
        varchar signature_hmac "HMAC-SHA256 của batch_code"
        timestamptz created_at
    }

    SUPPLY_CHAIN_EVENTS {
        bigint event_id PK
        bigint batch_id FK "UNIQUE cùng event_type"
        bigint actor_id FK "user ghi sự kiện"
        varchar event_type FK "event_types.code"
        timestamptz timestamp "thời điểm xảy ra"
        varchar location "NOT NULL"
        text description
        timestamptz created_at "thời điểm ghi"
        char prev_hash "băm sự kiện trước của lô"
        char row_hash "sha256, kiểm tra bằng verify_batch_events"
    }

    AUDIT_LOGS {
        bigint audit_id PK
        bigint actor_id FK "NULL nếu hệ thống tự ghi"
        varchar action "CREATE | UPDATE | LOCK | ..."
        varchar entity_type "USER | ORGANIZATION | BATCH | EVENT | QR_CODE"
        bigint entity_id
        jsonb old_value
        jsonb new_value
        timestamptz created_at
        bigint chain_seq UK "vị trí trong chuỗi"
        char prev_hash
        char row_hash "sha256, kiểm tra bằng verify_audit_chain"
    }
```

Bản in: [`ERD-v3.pdf`](ERD-v3.pdf) · ảnh: [`ERD-v3.png`](ERD-v3.png).

## 2. Từ điển dữ liệu

### 2.0 `roles` (thêm ở W4, migration 002)
| Cột | Kiểu | Ràng buộc | API |
| --- | --- | --- | --- |
| role_code | VARCHAR(20) | PK; CHECK `^[A-Z_]{3,20}$` | Role (enum) |
| name | VARCHAR(50) | NOT NULL | – |
| description | VARCHAR(255) | NOT NULL | – |
| self_register | BOOLEAN | NOT NULL, mặc định FALSE; TRUE với FARMER, PROCESSOR, DISTRIBUTOR | – |

Dữ liệu cố định 4 dòng, trigger chặn UPDATE / DELETE (đổi mã vai trò sẽ làm sai trigger CSDL và middleware RBAC). Thêm vai trò mới bằng migration mới. Quyền của từng vai trò nằm trong `backend/src/middleware/rbac.js` theo `docs/permission-matrix.md`.


### 2.0b `products` (thêm ở W5, migration 003)
| Cột | Kiểu | Ràng buộc | API |
| --- | --- | --- | --- |
| product_id | BIGINT IDENTITY | PK | productId |
| organization_id | BIGINT | FK → organizations, RESTRICT; đơn vị phải là FARM; không đổi khi sản phẩm đã có lô | organizationId |
| name | VARCHAR(150) | NOT NULL, không rỗng; UNIQUE (organization_id, lower(name)) | name |
| category | VARCHAR(50) | NOT NULL, không rỗng | category |
| unit | VARCHAR(20) | NOT NULL, mặc định `kg` – đơn vị của `batches.quantity` | unit |
| description | TEXT | | description |
| created_at, updated_at | TIMESTAMPTZ | NOT NULL | – |

**Ánh xạ tên trong kế hoạch tuần 5:** *Product* → `products`; *Farm* → `organizations` có `type = 'FARM'` (xem bằng view `farms`: `farm_id`, `name`, `address`, `product_count`, `batch_count`); *ProductBatch* → `batches`.

### 2.0c `event_types` (thêm ở W6, migration 004)
| Cột | Kiểu | Ràng buộc | API |
| --- | --- | --- | --- |
| code | VARCHAR(20) | PK; CHECK `^[A-Z_]{3,20}$` | EventType (enum) |
| seq_no | SMALLINT | NOT NULL, UNIQUE, ≥ 1 – sự kiện mới phải là `seq_no` hiện tại + 1 | – |
| role_code | VARCHAR(20) | FK → roles – vai trò duy nhất được ghi | – |
| name, description | VARCHAR | NOT NULL | – |
| sendable | BOOLEAN | FALSE với CREATED (hệ thống tự ghi khi tạo lô) | – |

6 dòng cố định (CREATED / FARMER, TRANSPORTED / DISTRIBUTOR, RECEIVED / DISTRIBUTOR, PROCESSED / PROCESSOR, PACKAGED / PROCESSOR, SHIPPED / DISTRIBUTOR); trigger chặn sửa / xóa. `batches.current_status` và `supply_chain_events.event_type` là khóa ngoại tới bảng này (thay CHECK của W3).

**Chuỗi băm (W6, migration 005)** – thêm vào `audit_logs` (`chain_seq` UNIQUE, `prev_hash`, `row_hash`) và `supply_chain_events` (`prev_hash`, `row_hash`), đều CHAR(64) hex, do trigger cấp:
`row_hash = sha256(prev_hash | các cột của dòng)`; dòng đầu dùng `prev_hash = 000…0`. Audit là một chuỗi chung theo `chain_seq`; sự kiện là một chuỗi cho mỗi lô theo `event_types.seq_no`. Kiểm tra: `verify_audit_chain()`, `verify_batch_events(batch_id)`.

### 2.1 `organizations`
| Cột | Kiểu | Ràng buộc | API |
| --- | --- | --- | --- |
| organization_id | BIGINT IDENTITY | PK | organizationId |
| name | VARCHAR(150) | NOT NULL, không rỗng; UNIQUE (name, type) | name |
| type | VARCHAR(20) | CHECK FARM / PROCESSOR / DISTRIBUTOR; không đổi khi đã có thành viên hoặc lô | type ⚠️ |
| address | VARCHAR(255) | | address ⚠️ |
| created_at, updated_at | TIMESTAMPTZ | NOT NULL, mặc định now() | – |

### 2.2 `users`
| Cột | Kiểu | Ràng buộc | API |
| --- | --- | --- | --- |
| user_id | BIGINT IDENTITY | PK | userId |
| organization_id | BIGINT | FK → organizations, RESTRICT; NULL với ADMIN; bắt buộc khi ACTIVE (trừ ADMIN); loại đơn vị phải khớp vai trò | organizationId |
| name | VARCHAR(100) | NOT NULL, không rỗng | name |
| email | VARCHAR(255) | NOT NULL, định dạng email; UNIQUE trên `lower(email)` | email |
| password_hash | VARCHAR(255) | NOT NULL; CHECK đúng định dạng bcrypt (chặn lưu mật khẩu thô) | **không bao giờ trả ra** |
| role | VARCHAR(20) | FK → roles.role_code (trước W4 là CHECK) | role |
| status | VARCHAR(20) | CHECK PENDING / ACTIVE / LOCKED; mặc định PENDING | status |
| created_at, updated_at | TIMESTAMPTZ | NOT NULL | – |

### 2.3 `batches`
| Cột | Kiểu | Ràng buộc | API |
| --- | --- | --- | --- |
| batch_id | BIGINT IDENTITY | PK | batchId |
| batch_code | VARCHAR(30) | NOT NULL, UNIQUE (có chỉ mục), CHECK `^BATCH-[0-9]{4}-[0-9]{4,}$` | batchCode |
| product_id | BIGINT | FK → products, RESTRICT; không bắt buộc; sản phẩm phải thuộc đúng nông trại của lô; chỉ đổi khi lô còn CREATED | productId (W5, tùy chọn) |
| product_name | VARCHAR(150) | NOT NULL, không rỗng; nếu chỉ gửi `product_id` thì CSDL tự lấy tên từ `products` (ảnh chụp tên lúc tạo lô) | productName |
| origin | VARCHAR(255) | NOT NULL, không rỗng | origin |
| quantity | NUMERIC(12,2) | NOT NULL, > 0 | quantity |
| creation_date | TIMESTAMPTZ | NOT NULL, mặc định now(), không sửa | creationDate |
| current_status | VARCHAR(20) | CHECK thuộc EventType; mặc định CREATED; chỉ tiến một bước | currentStatus |
| created_by | BIGINT | FK → users, RESTRICT; phải là Farmer ACTIVE của đơn vị sở hữu | createdBy |
| organization_id | BIGINT | FK → organizations, RESTRICT; NOT NULL | organizationId ⚠️ |
| updated_at | TIMESTAMPTZ | NOT NULL | – |

### 2.4 `qr_codes`
| Cột | Kiểu | Ràng buộc | API |
| --- | --- | --- | --- |
| qr_id | BIGINT IDENTITY | PK | qrId |
| batch_id | BIGINT | FK → batches, RESTRICT; UNIQUE (1 lô – 1 QR) | batchId |
| qr_data | VARCHAR(512) | NOT NULL, UNIQUE; phải chứa signature_hmac | qrData |
| signature_hmac | VARCHAR(128) | NOT NULL | (nội bộ) |
| created_at | TIMESTAMPTZ | NOT NULL | createdAt |

`qrToken = <batch_code>.<signature_hmac>`, `signature_hmac = base64url(HMAC-SHA256(QR_HMAC_SECRET, batch_code))` (SRS P1). Khóa `QR_HMAC_SECRET` chỉ nằm trong biến môi trường, không lưu trong CSDL.

### 2.5 `supply_chain_events` (append-only)
| Cột | Kiểu | Ràng buộc | API |
| --- | --- | --- | --- |
| event_id | BIGINT IDENTITY | PK | eventId |
| batch_id | BIGINT | FK → batches, RESTRICT; UNIQUE (batch_id, event_type) | batchId |
| actor_id | BIGINT | FK → users, RESTRICT; phải ACTIVE và đúng vai trò của loại sự kiện | actorId |
| event_type | VARCHAR(20) | CHECK thuộc EventType; đúng thứ tự | eventType |
| timestamp | TIMESTAMPTZ | NOT NULL, mặc định now() | timestamp |
| location | VARCHAR(255) | NOT NULL, không rỗng | location |
| description | TEXT | | description |
| created_at | TIMESTAMPTZ | NOT NULL | – |

Chỉ mục `(batch_id, timestamp)` phục vụ lấy timeline.

### 2.6 `audit_logs` (append-only)
| Cột | Kiểu | Ràng buộc | API |
| --- | --- | --- | --- |
| audit_id | BIGINT IDENTITY | PK | auditId |
| actor_id | BIGINT | FK → users, RESTRICT; NULL khi không xác định được người dùng | actorId |
| action | VARCHAR(50) | CHECK CREATE / UPDATE / REGISTER / LOGIN_FAILED / APPROVE / CHANGE_ROLE / LOCK / UNLOCK / ASSIGN_ORGANIZATION | action |
| entity_type | VARCHAR(30) | CHECK USER / ORGANIZATION / BATCH / EVENT / QR_CODE | entityType |
| entity_id | BIGINT | | entityId |
| old_value, new_value | JSONB | CHECK không chứa khóa password / token / signature | oldValue, newValue |
| created_at | TIMESTAMPTZ | NOT NULL | createdAt |

Chỉ mục `(entity_type, entity_id)`, `(actor_id)`, `(created_at DESC)` phục vụ `GET /audit-logs` có lọc.

## 3. Trạng thái lô và loại sự kiện (đã chốt)

Dùng một enum `EventType` cho cả `batches.current_status` và `supply_chain_events.event_type`, theo OpenAPI và Class Diagram:

| Thứ tự | EventType | Vai trò được ghi |
| --- | --- | --- |
| 1 | CREATED | FARMER (hệ thống ghi khi tạo lô) |
| 2 | TRANSPORTED | DISTRIBUTOR |
| 3 | RECEIVED | DISTRIBUTOR |
| 4 | PROCESSED | PROCESSOR |
| 5 | PACKAGED | PROCESSOR |
| 6 | SHIPPED | DISTRIBUTOR |

Sự kiện mới phải là bước kế tiếp của `current_status`. INSERT sự kiện hợp lệ thì CSDL tự cập nhật `batches.current_status` trong cùng transaction.

## 4. Quy tắc dữ liệu được CSDL tự bảo vệ

Các quy tắc dưới đây vẫn phải được kiểm tra ở backend để trả mã lỗi đúng (400/403/404/409). CSDL là lớp chặn cuối, để dữ liệu không sai kể cả khi backend có lỗi hoặc có người thao tác trực tiếp trên CSDL.

| # | Quy tắc | Cơ chế | Nguồn |
| --- | --- | --- | --- |
| R1 | Không lưu mật khẩu thô | CHECK định dạng bcrypt | NFR-02 |
| R2 | Email duy nhất, không phân biệt hoa thường | UNIQUE INDEX `lower(email)` | US-UI01 |
| R3 | Vai trò khớp loại đơn vị; Admin không thuộc đơn vị; ACTIVE phải có đơn vị | CHECK + trigger `check_user_rules` | US-S01 |
| R4 | Không hạ quyền hoặc khóa Admin ACTIVE cuối cùng | trigger `check_user_rules` | US-S01, US-S04 |
| R5 | Không đổi loại đơn vị đã có thành viên hoặc lô; không xóa đơn vị đang dùng | trigger + FK RESTRICT | US-S03 |
| R6 | Chỉ Farmer ACTIVE tạo lô cho đơn vị mình; `batch_code` duy nhất; `quantity > 0` | CHECK + UNIQUE + trigger `check_batch_rules` | US-B01 |
| R7 | Chỉ sửa thông tin lô khi còn CREATED; không sửa mã lô, người tạo, đơn vị | trigger `check_batch_rules` | US-B02 |
| R8 | Mỗi lô đúng một QR | UNIQUE `qr_codes.batch_id` | FR-QR-01 |
| R9 | Sự kiện đúng vai trò, đúng thứ tự, không trùng; người ghi phải ACTIVE | trigger `check_event_rules` + UNIQUE | US-B05, US-S04 |
| R10 | `supply_chain_events` và `audit_logs` chỉ INSERT (chặn UPDATE / DELETE / TRUNCATE) | trigger `forbid_modification` | US-S05, US-S06 |
| R11 | Audit không chứa mật khẩu, token, chữ ký | CHECK `chk_audit_no_secrets` | US-S05 AC03 |
| R12 | Không xóa lô | FK RESTRICT từ qr_codes / events; không có endpoint DELETE | FR-BATCH |
| R13 | Dữ liệu công khai không lộ id nội bộ, email | view `public_batch_trace`, `public_event_trace` | FR-QR-06 |

## 5. Điểm lệch với Class Diagram / OpenAPI (cần TV2 cập nhật)

| # | Nội dung | Lý do giữ trong CSDL | Đề xuất |
| --- | --- | --- | --- |
| D1 | `Organization` trong Class Diagram chỉ có `organizationId`, `name` | Cần `type` để kiểm tra vai trò ↔ đơn vị (US-S01) và quản lý đơn vị (US-S03) | Thêm `type`, `address` vào Class Diagram |
| D2 | `Batch` không có `organizationId` | Phạm vi đọc/sửa của Farmer theo đơn vị (FR-BATCH-08); `PublicTrace.organizationName` cần biết đơn vị sở hữu | Thêm `organizationId` vào Class Diagram và schema `Batch` |
| D3 | Enum `Role` có `CONSUMER` | Consumer không có tài khoản (ma trận quyền, SRS 2.1), nên CSDL không lưu | Bỏ `CONSUMER` khỏi `Role`, hoặc ghi chú "không lưu trong users" |
| D4 | OpenAPI chưa có endpoint quản trị `/users`, `/users/{id}/role`, `/users/{id}/status`, `/organizations`, `/audit-logs` | Có trong ma trận quyền và US-S01, S03, S04, S06 | Bổ sung trước tuần 4 |
| D5 | Bản nháp v2 có bảng `product` | Class Diagram/OpenAPI để `productName` trực tiếp trên `Batch` | W3 theo UML (bỏ bảng). **W5 thêm lại `products` theo kế hoạch tuần 5**, nhưng `batches.product_id` không bắt buộc và `productName` giữ nguyên, nên API không phải đổi. Đề xuất TV2 bổ sung `Product` vào Class Diagram và `productId` (tùy chọn) vào `CreateBatchRequest` |

## 6. Thay đổi so với ERD v2 (`erd-draft.md`)

| Thay đổi | Lý do |
| --- | --- |
| Bỏ bảng `product`, thêm `batches.product_name` | Thống nhất với Class Diagram / OpenAPI (D5) |
| Tên bảng số nhiều (`users`, `batches`…) | `user` là từ khóa của PostgreSQL |
| `batches.production_date` → `creation_date` | Thống nhất với `creationDate` của API |
| `supply_chain_events.event_time` → `timestamp` | Thống nhất với API |
| `qr_codes.token` → `qr_data` + `signature_hmac` | Thống nhất với Class Diagram (`qrData`, `signatureHMAC`) và SRS P1 |
| `audit_logs.entity`, `detail` → `entity_type`, `old_value`, `new_value` | Thống nhất với Class Diagram |
| Chốt 6 trạng thái CREATED → SHIPPED | OpenAPI W3, SRS mục 10 #10 |
| Thêm UNIQUE `(batch_id, event_type)`, trigger thứ tự, trigger append-only, view công khai | Bảo vệ toàn vẹn chuỗi ở mức CSDL |

## 7. Cách chạy và kiểm tra

```bash
# Tạo / cập nhật CSDL bằng migration (từ W4)
cd backend && npm run db:migrate

# Kiểm tra 70 ràng buộc trên CSDL trống sau khi migrate (dữ liệu thử được ROLLBACK, CSDL giữ nguyên)
psql -h localhost -U postgres -d food_traceability -v ON_ERROR_STOP=1 -f database/tests/schema-check.sql
```

Chi tiết: [`database/Readme.md`](../../database/Readme.md).

Kết quả mong đợi: mọi dòng `PASS ...` và dòng cuối `ALL CHECKS PASSED`.
