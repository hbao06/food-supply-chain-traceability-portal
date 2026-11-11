# Module Trace (W7-TV2): truy xuất công khai

API cho người tiêu dùng quét QR hoặc nhập mã lô. **Không cần đăng nhập.** Hợp đồng API: `docs/openapi-spec.yaml`.

## Endpoint

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET | `/api/trace/{qrToken}` | Tra cứu theo token trong mã QR (`<mã lô>.<chữ ký HMAC>`). Sai chữ ký thì không truy vấn CSDL. |
| GET | `/api/trace/code/{batchCode}` | Tra cứu theo mã lô in trên sản phẩm (dạng `BATCH-2026-0001`). |

Phản hồi 200 (`PublicTrace`):

```json
{
  "batchCode": "BATCH-2026-0001",
  "productName": "Cà phê hữu cơ",
  "origin": "Đắk Lắk",
  "organizationName": "Nông trại A",
  "currentStatus": "RECEIVED",
  "events": [
    { "eventType": "CREATED", "location": "Đắk Lắk", "organizationName": "Nông trại A", "timestamp": "2026-11-02T08:00:00.000Z" }
  ]
}
```

## Bảo vệ dữ liệu

- **Danh sách trắng:** `toPublicTrace()` trong `trace.service.js` là nơi duy nhất quyết định trường nào được trả ra. Không có id, người tạo hay người ghi, email, số lượng, mô tả sự kiện, `qrData`, chữ ký.
- **Chỉ đọc qua hai view** `public_batch_trace` và `public_event_trace` của `schema.sql`, không truy vấn trực tiếp bảng `batches`, `users`. Câu SQL không chọn cột `description` của sự kiện.
- **Không lộ lô có tồn tại hay không:** token sai chữ ký, mã sai định dạng, mã không tồn tại đều trả cùng một lỗi `404 NOT_FOUND` ("Không tìm thấy thông tin truy xuất").
- Mã lô được kiểm tra định dạng trước khi truy vấn, và truy vấn luôn dùng tham số, nên chuỗi tấn công SQL bị từ chối ở bước đầu.
- **Giới hạn tần suất theo IP** (FR-QR-08): mặc định 60 lượt/phút, quá thì `429` kèm `Retry-After`. Đổi bằng `RATE_LIMIT_TRACE_MAX`; tắt bằng `RATE_LIMIT_DISABLED=true` hoặc `NODE_ENV=test`.
- Token chỉ kiểm tra được khi có `QR_HMAC_SECRET`; thiếu thì tra cứu theo token luôn 404, tra cứu theo mã lô vẫn chạy.

## Gắn vào app (`backend/src/app.js`)

```js
const { traceRouter } = require("./modules/trace/trace.routes");
app.use("/api/trace", traceRouter);   // không đi qua xác thực; đặt trước notFound
```

## Kiểm thử

```bash
cd backend
node --test test/*.test.js       # không cần CSDL
npm run dev                      # terminal 1
npm run smoke:trace              # terminal 2: kiểm thử HTTP với CSDL thật, kỳ vọng "TẤT CẢ ĐỀU PASS"
```
