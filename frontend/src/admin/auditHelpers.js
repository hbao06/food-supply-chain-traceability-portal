/**
 * Helper utilities for Audit Logs and Cryptographic Chain Verification.
 * Aligned with backend contract in backend/src/modules/audit/audit.service.js
 */

/**
 * Chuẩn hóa và bóc tách danh sách audit logs từ API response.
 * Backend trả về: { items: [...], page: 1, limit: 20, total: N }
 */
export function parseAuditLogsResponse(res) {
  if (!res) return []
  if (Array.isArray(res.items)) return res.items
  if (Array.isArray(res.data)) return res.data
  if (Array.isArray(res)) return res
  return []
}

/**
 * Chuẩn hóa kết quả xác thực chuỗi băm mật mã từ backend GET /api/audit-logs/verify.
 * Backend trả về: { auditLog: { checked, valid, firstBrokenId, reason }, valid, checkedAt }
 */
export function parseVerifyResponse(res) {
  if (!res) {
    return {
      verified: false,
      count: 0,
      firstBrokenId: null,
      reason: 'Phản hồi rỗng',
      message: 'Không nhận được dữ liệu xác thực từ máy chủ.',
    }
  }

  const auditLog = res.auditLog || {}
  // valid = true chỉ khi auditLog.valid === true và res.valid !== false (không mặc định true)
  const isValid = auditLog.valid === true && res.valid !== false
  const checked = Number(auditLog.checked ?? 0)
  const firstBrokenId = auditLog.firstBrokenId ?? null
  const reason = auditLog.reason ?? null

  return {
    verified: isValid,
    count: checked,
    firstBrokenId,
    reason,
    timestamp: res.checkedAt || new Date().toISOString(),
    message: isValid
      ? (checked > 0
          ? `Toàn bộ ${checked} bản ghi chuỗi băm kiểm toán đều hợp lệ và toàn vẹn.`
          : 'Chuỗi kiểm toán hợp lệ (chưa có bản ghi nào).')
      : `Cảnh báo: Chuỗi băm bị gián đoạn tại bản ghi #${firstBrokenId || '?'}${reason ? ` (${reason})` : ''}!`,
  }
}

/**
 * Trích xuất mã lô hàng từ audit log entry.
 * Phù hợp với cả dữ liệu DTO từ toAuditDto (có newValue/oldValue) và preview logs.
 */
export function getAuditBatchCode(log) {
  if (!log) return null
  return (
    log.batchCode ||
    log.newValue?.batchCode ||
    log.oldValue?.batchCode ||
    (log.entityType === 'BATCH' && log.entityId ? `Lô #${log.entityId}` : null)
  )
}
