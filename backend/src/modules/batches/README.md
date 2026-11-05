# Module Batches (W5-TV2)

API lô thực phẩm: tạo, xem, danh sách có lọc và tìm kiếm, sửa, lấy QR. Hợp đồng API: `docs/openapi-spec.yaml`. Schema: `database/schema.sql`.
Phụ thuộc: middleware của TV3 (`middleware/rbac.js`, `middleware/currentUser.js`) và `modules/auth` của W4.

## Endpoint

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| POST | `/api/batches` | FARMER | Tạo lô: lô + QR + sự kiện CREATED + audit trong một transaction. Mã lô do máy chủ cấp. |
| GET | `/api/batches` | mọi vai trò | Danh sách theo phạm vi. Lọc `status`, tìm `q` (tên sản phẩm hoặc mã lô), phân trang `page`, `limit` (tối đa 100). Mới nhất trước. |
| GET | `/api/batches/{batchId}` | mọi vai trò | Chi tiết một lô trong phạm vi. |
| PATCH | `/api/batches/{batchId}` | FARMER | Sửa `productName`, `origin`, `quantity`, chỉ khi lô còn `CREATED`. |
| GET | `/api/batches/{batchId}/qr` | mọi vai trò | Thông tin QR của lô (`qrData` là URL trong ảnh QR). |

## Quy tắc

- **Thứ tự kiểm tra:** chưa đăng nhập 401 → tài khoản chưa duyệt/bị khóa 403 → sai vai trò 403 → dữ liệu sai 400 → lô không tồn tại **hoặc ngoài phạm vi** 404 (cùng một kết quả) → lô đã rời `CREATED` 409 `BATCH_NOT_EDITABLE`.
- **Phạm vi** (`batchReadScope` của TV3): Admin thấy tất cả; Farmer thấy lô của đơn vị mình; Processor/Distributor thấy lô mà đơn vị mình đã ghi sự kiện, và khi xem đúng một lô còn thấy lô đang chờ bước của vai trò mình. Danh sách không có phần "đang chờ".
- **Mã lô** `BATCH-YYYY-NNNN`, số thứ tự tăng theo năm. Cấp trong transaction dưới khóa `pg_advisory_xact_lock`, nên hai người tạo cùng lúc không trùng mã (UNIQUE trong CSDL là lớp chặn cuối).
- **Tạo lô** ghi 3 dòng audit (BATCH, QR_CODE, EVENT) cùng transaction: lỗi ở bước nào thì hoàn tác tất cả.
- **Sửa lô** chỉ ghi audit `UPDATE` với giá trị cũ/mới của các trường thật sự thay đổi; gửi lại giá trị cũ thì không ghi gì.
- `quantity` là số, > 0, tối đa 2 chữ số thập phân, tối đa 9.999.999.999,99. `batchCode`, `currentStatus`, `createdBy`, `organizationId` không sửa được (400).

## Cấu hình thêm (`.env`)

```
QR_HMAC_SECRET=<chuỗi ngẫu nhiên >= 32 ký tự>   # khóa ký QR, không commit; thiếu thì tạo lô trả 500
TRACE_BASE_URL=http://localhost:5173            # trang truy xuất công khai mà QR trỏ tới
```

Tạo khóa: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## Gắn vào app (`backend/src/app.js`)

```js
const { batchesRouter } = require("./modules/batches/batches.routes");
app.use("/api/batches", batchesRouter);   // đặt trước notFound
```

## Kiểm thử

```bash
cd backend
npm run test:auth          # hoặc: node --test test/*.test.js  (không cần CSDL)
npm run dev                # terminal 1
npm run smoke:batches      # terminal 2: kiểm thử HTTP với CSDL thật, kỳ vọng "TẤT CẢ ĐỀU PASS"
```

Chưa có endpoint Admin duyệt tài khoản, nên script smoke tạo đơn vị và duyệt tài khoản thử bằng SQL. Mỗi lần chạy tạo dữ liệu mới (audit chỉ ghi thêm nên không xóa được), chỉ dùng CSDL phát triển.
