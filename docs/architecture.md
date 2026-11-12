# Kiến trúc hệ thống — Food Supply Chain Traceability Portal

## 1. Lựa chọn kiến trúc

Hệ thống được xây dựng theo kiến trúc Client–Server với giao diện lập trình REST API, tổ chức theo kiến trúc phân lớp (Layered Architecture) 3 tầng, backend theo mô hình Monolith phân module (Modular Monolith).

Lý do lựa chọn gắn với đặc thù chức năng của đề tài:

- Hệ thống có hai nhóm người dùng rất khác nhau: người dùng nội bộ (Farmer, Processor, Distributor, Admin) thao tác qua giao diện web sau đăng nhập, và người tiêu dùng chỉ quét mã QR bằng điện thoại để xem thông tin công khai. Client–Server + REST cho phép một backend duy nhất phục vụ cả hai nhóm qua cùng một API, trong đó endpoint truy xuất công khai được tách riêng về cơ chế bảo vệ (token QR có chữ ký) so với endpoint nội bộ (JWT + phân quyền).
- Nghiệp vụ truy xuất nguồn gốc có quy tắc thứ tự sự kiện chặt chẽ (một lô hàng phải đi đúng chuỗi CREATED → TRANSPORTED → RECEIVED → PROCESSED → PACKAGED → SHIPPED) và yêu cầu toàn vẹn lịch sử (không được sửa/xóa sự kiện đã ghi). Tầng nghiệp vụ tập trung (service) là nơi duy nhất thực thi các quy tắc này, còn tầng dữ liệu hỗ trợ bằng ràng buộc chỉ-thêm-mới và chuỗi băm — đây là lý do hệ thống cần một tầng Application rõ ràng thay vì để giao diện truy cập thẳng CSDL.
- Quy mô nhóm 4 thành viên và thời gian 8 tuần phù hợp với Modular Monolith: mỗi thành viên phụ trách một module nhưng vẫn triển khai và kiểm thử chung một hệ thống, tránh chi phí vận hành của Microservices.

## 2. Sơ đồ kiến trúc

```mermaid
flowchart TB
  subgraph Client["Tầng trình diễn"]
    FE["React 19 + Vite — ứng dụng nội bộ (đăng nhập)"]
    PUB["Trang truy xuất công khai — quét QR, không cần tài khoản"]
  end
  subgraph API["Backend Express 5 — Modular Monolith"]
    MW["Middleware: securityHeaders → authenticate (JWT) → currentUser → rbac → rateLimit"]
    AUTH["Module Auth"]
    BATCH["Module Batches + QR (HMAC)"]
    EVT["Module Events — máy trạng thái chuỗi sự kiện"]
    AUD["Module Audit — nhật ký + chuỗi băm"]
  end
  DB[("PostgreSQL 16")]
  FE --> MW
  PUB --> MW
  MW --> AUTH
  MW --> BATCH
  MW --> EVT
  MW --> AUD
  AUTH --> DB
  BATCH --> DB
  EVT --> DB
  AUD --> DB
```

## 3. Các tầng kiến trúc và ánh xạ với chức năng

| Tầng / thành phần | Công nghệ | Chức năng đảm nhiệm | Nơi trong mã nguồn |
|---|---|---|---|
| Trình diễn — ứng dụng nội bộ | React 19 SPA (Vite) | Đăng nhập/đăng ký, quản lý lô hàng, ghi sự kiện, xem timeline, dashboard theo vai trò | `frontend/src/` |
| Trình diễn — trang truy xuất công khai | React (route công khai) + thư viện qrcode | Hiển thị mã QR; người tiêu dùng xem nguồn gốc và dòng thời gian của lô | `frontend/src/batches/BatchQrModal.jsx`, trang trace |
| Ứng dụng — lớp middleware | Express middleware | Header bảo mật → xác thực JWT (`authenticate`) → nạp người dùng hiện tại (`currentUser`) → phân quyền (`rbac`) → giới hạn tần suất (`rateLimit`) | `backend/src/middleware/`, `backend/src/app.js` |
| Ứng dụng — Module Auth | Express (routes/controller/service/repository) | Đăng ký, đăng nhập, hồ sơ cá nhân, vai trò và trạng thái tài khoản (PENDING/ACTIVE/LOCKED) | `backend/src/modules/auth/` |
| Ứng dụng — Module Batches | Express (routes/controller/service/repository) | Tạo lô (mã lô tự sinh BATCH-YYYY-NNNN), sửa lô khi còn CREATED, phạm vi xem theo đơn vị, sinh token QR ký HMAC | `backend/src/modules/batches/`, `backend/src/common/qrToken.js` |
| Ứng dụng — Module Events | Express (routes/controller/service/repository) | Ghi sự kiện chuỗi cung ứng, kiểm tra máy trạng thái thứ tự (sai thứ tự → 409 INVALID_SEQUENCE), timeline của lô | `backend/src/modules/events/` |
| Ứng dụng — Module Audit | Express (routes/controller/service/repository) | Nhật ký kiểm toán chỉ-thêm-mới cho mọi thao tác, chuỗi băm chống sửa đổi, tra cứu nhật ký cho Admin | `backend/src/modules/audit/` |
| Dữ liệu | PostgreSQL 16, pg Pool | 6 migration (001–006): schema, bảng vai trò, sản phẩm/nông trại, loại sự kiện, chuỗi băm lịch sử, vai trò CSDL tối thiểu fsc_app | `database/migrations/`, `backend/src/db/` |

Mỗi module của backend đều tổ chức 4 lớp `routes → controller → service → repository`: routes gắn đường dẫn và middleware, controller điều phối HTTP, service thực thi quy tắc nghiệp vụ, repository là nơi duy nhất chạm vào CSDL.

## 4. Cơ chế vận hành

Luồng xử lý một yêu cầu (request): Trình duyệt gửi HTTP request kèm JWT (trừ trang truy xuất công khai) → request đi qua chuỗi middleware (header bảo mật, xác thực token, nạp trạng thái tài khoản mới nhất từ CSDL, kiểm tra quyền theo ma trận phân quyền, giới hạn tần suất) → routes chuyển tới controller → service thực thi quy tắc nghiệp vụ → repository truy vấn PostgreSQL → kết quả trả về dạng JSON; mọi thao tác thay đổi dữ liệu đồng thời ghi một dòng nhật ký qua Module Audit.

Bốn cơ chế đặc thù của hệ thống:

1. **Xác thực không trạng thái (stateless) bằng JWT + phân quyền RBAC:** sau đăng nhập, server cấp JWT; mỗi request tự mang theo token nên server không lưu session. Quyền được kiểm hai lớp: theo vai trò (permission như `batch:create`, `event:create`, `qr:read`) và theo phạm vi đơn vị (người dùng chỉ thấy lô của tổ chức mình; ngoài phạm vi trả 404 thay vì 403 để không lộ sự tồn tại của dữ liệu).
2. **Máy trạng thái (state machine) cho chuỗi sự kiện:** trạng thái lô hàng chỉ được chuyển theo đúng thứ tự CREATED → TRANSPORTED → RECEIVED → PROCESSED → PACKAGED → SHIPPED, mỗi loại sự kiện chỉ do đúng vai trò ghi (TRANSPORTED/RECEIVED/SHIPPED — Distributor; PROCESSED/PACKAGED — Processor). Ghi sai thứ tự bị từ chối bằng lỗi 409 INVALID_SEQUENCE và không làm thay đổi dữ liệu.
3. **Lịch sử chỉ-thêm-mới + chuỗi băm (hash chain):** sự kiện và nhật ký kiểm toán không có đường sửa/xóa (trigger ở tầng CSDL + vai trò fsc_app bị tước quyền UPDATE/DELETE trên bảng lịch sử); mỗi dòng nhật ký chứa mã băm liên kết với dòng trước, nên sửa đổi một dòng trong quá khứ sẽ làm đứt toàn bộ chuỗi phía sau và bị phát hiện khi kiểm chứng.
4. **Mã QR ký HMAC cho truy xuất công khai:** token trong mã QR có dạng mã lô + `.` + chữ ký HMAC-SHA256 (khóa bí mật `QR_HMAC_SECRET` chỉ nằm trong cấu hình server, tối thiểu 32 ký tự); người tiêu dùng không cần tài khoản vẫn xem được nguồn gốc lô hàng, nhưng không thể đoán hoặc giả mạo token của lô khác. Chữ ký được kiểm bằng phép so sánh an toàn theo thời gian (`timingSafeEqual`). Endpoint công khai còn được giới hạn tần suất để chống quét dữ liệu hàng loạt, và chỉ trả các trường công khai (không lộ email, mã người dùng hay dữ liệu audit).

## 5. Nền tảng và công cụ

| Thành phần | Công nghệ / công cụ thật | Ghi chú |
|---|---|---|
| Frontend | React 19, Vite, thư viện qrcode | SPA thuần, không dùng Next.js |
| Backend | Node.js, Express 5, REST API | Kiểm thử bằng `node --test` |
| Cơ sở dữ liệu | PostgreSQL 16, thư viện pg | Quản lý thay đổi bằng migration 001–006 |
| Xác thực / bảo mật | JWT (jsonwebtoken), bcryptjs, HMAC-SHA256 | RBAC theo ma trận quyền `docs/permission-matrix.md` |
| Đặc tả API | OpenAPI (`docs/openapi-spec.yaml`) | Là hợp đồng API giữa frontend và backend |
| Triển khai | Docker, Docker Compose (3 service: frontend, backend, database) | `docker-compose.yml` + Dockerfile từng phần |
| Quản lý mã nguồn / CI | GitHub, GitHub Actions (CI: cài đặt → lint → test → build ở mỗi PR) | Merge chỉ khi có review + CI xanh |
| Quản lý công việc | GitHub Issues/Projects, tài liệu trong `docs/` (SRS, UML, ERD) | Theo kế hoạch 8 tuần của nhóm |
