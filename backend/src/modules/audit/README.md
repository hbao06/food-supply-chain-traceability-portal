# Module Audit log (W6-TV3)

**Người phụ trách:** Đặng Vĩnh Quang (TV3 - Database / Auth / Security) · **Review:** Chung Nguyễn Minh Trí (TV2)

Ghi và tra cứu nhật ký thay đổi (US-S05, US-S06). Nhật ký **chỉ ghi thêm**: không có hàm hay endpoint sửa / xóa.

| File | Nội dung |
| --- | --- |
| `audit.sanitize.js` | Kiểm tra `action` / `entityType`; lọc bỏ khóa nhạy cảm (mật khẩu, hash, token, chữ ký…) ở mọi cấp; giới hạn độ sâu và kích thước (8 KB) |
| `audit.repository.js` | `insertAudit` (ghi), `searchAudit` (tìm), `verifyAuditChain`, `verifyBatchEvents` (kiểm tra chuỗi băm) |
| `audit.validators.js` | Tham số `GET /audit-logs` theo OpenAPI → 400 đúng trường |
| `audit.service.js` | DTO camelCase, kết quả kiểm tra toàn vẹn |
| `audit.routes.js` | `GET /api/audit-logs`, `GET /api/audit-logs/verify` – chỉ ADMIN (`audit:read`) |

## Ghi audit (mọi module)

```js
const { insertAudit } = require('../audit/audit.repository');   // hoặc từ auth.repository như trước – cùng một hàm

await withTransaction(async (tx) => {
  const row = await repo.updateSomething(tx, ...);
  await insertAudit(tx, {                 // CÙNG transaction với thay đổi (US-S05 AC02)
    actorId: req.auth.userId,             // null nếu không xác định được người dùng
    action: 'UPDATE',                     // CREATE | UPDATE | REGISTER | LOGIN_FAILED | APPROVE | CHANGE_ROLE | LOCK | UNLOCK | ASSIGN_ORGANIZATION
    entityType: 'BATCH',                  // USER | ORGANIZATION | BATCH | EVENT | QR_CODE
    entityId: batchId,
    oldValue: { quantity: 500 },
    newValue: { quantity: 480 },
  });
});
```

- Khóa nhạy cảm (`password`, `passwordHash`, `token`, `jwt`, `secret`, `signature…`, `authorization`…) bị **bỏ hẳn**, ở mọi cấp lồng nhau. Không cần tự lọc trước khi gọi.
- `action` / `entityType` sai là lỗi lập trình → ném `Error` (500) **trước khi** gửi SQL.
- `chain_seq`, `prev_hash`, `row_hash` do CSDL tự cấp (trigger `audit_chain_append`); backend không gửi.

`auth.repository.insertAudit` giờ chính là hàm này, nên batches, events và auth tự động dùng service mới mà không phải sửa code.

## Tra cứu – `GET /api/audit-logs` (US-S06)

| Tham số | Kiểu | Ghi chú |
| --- | --- | --- |
| `entityType`, `action` | enum | Theo `AuditEntityType`, `AuditAction` trong OpenAPI |
| `entityId`, `actorId` | số nguyên dương | |
| `from`, `to` | ISO 8601 (`2026-11-09` hoặc `2026-11-09T08:00:00+07:00`) | `from > to` → 400 |
| `page`, `limit` | số nguyên | mặc định 1 / 20, `limit` ≤ 100 |

Trả `{ items, page, limit, total }`, mới nhất trước. Mỗi item: `auditId, actorId, actorName, action, entityType, entityId, oldValue, newValue, createdAt`.

## Kiểm tra toàn vẹn – `GET /api/audit-logs/verify[?batchId=…]`

Trigger append-only chặn sửa / xóa lịch sử, nhưng người quản trị CSDL vẫn có thể tắt trigger. Chuỗi băm SHA-256 (migration 005) giúp **phát hiện** việc đó: sửa, xóa hay chèn một dòng làm hỏng chuỗi từ dòng đó trở đi.

```json
{
  "auditLog":    { "checked": 40, "valid": true, "firstBrokenId": null, "reason": null },
  "batchEvents": { "batchId": 3, "checked": 4, "valid": false, "firstBrokenId": 17, "reason": "Nội dung sự kiện đã bị sửa" },
  "valid": false,
  "checkedAt": "2026-11-09T13:30:00.000Z"
}
```

Không gửi `batchId` thì chỉ kiểm tra chuỗi audit. Lô không tồn tại hoặc chưa có sự kiện → 404.
Có thể gọi trực tiếp trong SQL: `SELECT * FROM verify_audit_chain();`, `SELECT * FROM verify_batch_events(3);`.

## Kiểm thử

```bash
cd backend && npm test                      # test/audit.test.js (15 ca, không cần CSDL)
# CSDL: database/tests/schema-check.sql (event_types, chuỗi băm, mô phỏng sửa lịch sử, quyền fsc_app)
```
