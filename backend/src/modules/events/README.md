# Module Events và Timeline (W6-TV2)

API ghi sự kiện chuỗi cung ứng, danh sách sự kiện và timeline của lô. Hợp đồng API: `docs/openapi-spec.yaml`. Dựa trên `modules/batches` (W5) và middleware của TV3.

## Endpoint

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| POST | `/api/batches/{batchId}/events` | PROCESSOR, DISTRIBUTOR | Ghi sự kiện kế tiếp của lô. |
| GET | `/api/batches/{batchId}/events` | mọi vai trò | Sự kiện của lô, cũ → mới. |
| GET | `/api/batches/{batchId}/timeline` | mọi vai trò | `{ batch, events }`, mỗi sự kiện có `actorName`, `organizationName`, `location`, `timestamp`. |

## Quy tắc chuyển trạng thái

Chuỗi duy nhất: `CREATED → TRANSPORTED → RECEIVED → PROCESSED → PACKAGED → SHIPPED`.

| Loại sự kiện | Vai trò được ghi |
| --- | --- |
| TRANSPORTED, RECEIVED, SHIPPED | DISTRIBUTOR |
| PROCESSED, PACKAGED | PROCESSOR |
| CREATED | hệ thống ghi khi tạo lô (gửi qua API là 400) |

- **Thứ tự kiểm tra:** sai vai trò cho loại sự kiện 403 → lô không tồn tại hoặc ngoài phạm vi 404 → sai thứ tự (nhảy cóc, trùng, sau SHIPPED) 409 `INVALID_SEQUENCE`.
- **Người ghi và thời điểm do máy chủ đặt** (người ghi lấy từ token, thời gian lấy `now()` của CSDL). Gửi `timestamp`, `actorId` hay `batchId` là 400, nên không thể ghi lùi ngày hay giả danh.
- Lô được khóa dòng (`FOR UPDATE`) khi ghi, nên hai sự kiện đồng thời không cùng vượt qua kiểm tra thứ tự. Trigger của CSDL kiểm tra lại và tự đồng bộ `batches.current_status`.
- Mỗi sự kiện ghi 2 dòng audit trong cùng transaction: `CREATE EVENT` và `UPDATE BATCH` (trạng thái cũ → mới).
- Sự kiện không sửa, không xóa được (trigger append-only). Điều chỉnh sai sót phải ghi bằng sự kiện bổ sung của quy trình sau này.
- Processor chỉ thấy lô khi đơn vị mình đã ghi sự kiện hoặc lô đang chờ bước của Processor (ở `RECEIVED` hoặc `PROCESSED`); Distributor tương tự (ở `CREATED`, `TRANSPORTED` hoặc `PACKAGED`).

## Gắn vào app (`backend/src/app.js`)

```js
const { eventsRouter, timelineRouter } = require("./modules/events/events.routes");
app.use("/api/batches/:batchId/events", eventsRouter);
app.use("/api/batches/:batchId/timeline", timelineRouter);
app.use("/api/batches", batchesRouter);   // module W5
```

## Kiểm thử

```bash
cd backend
node --test test/*.test.js     # không cần CSDL
npm run dev                    # terminal 1
npm run smoke:events           # terminal 2: kiểm thử HTTP với CSDL thật, kỳ vọng "TẤT CẢ ĐỀU PASS"
```

Script `smoke-events.js` đi hết chuỗi 6 bước với 3 vai trò, thử mọi ca lỗi (401, 403, 404, 409, 400), kiểm tra timeline, audit và tính bất biến của sự kiện.
