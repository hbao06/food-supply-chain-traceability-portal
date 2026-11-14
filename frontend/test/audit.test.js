import test from 'node:test'
import assert from 'node:assert/strict'
import { PREVIEW_AUDIT_LOGS } from '../src/batches/batchConstants.js'
import { api, errorMessage, ApiError } from '../src/api.js'

test('audit - PREVIEW_AUDIT_LOGS exists and contains valid structure', () => {
  assert.ok(Array.isArray(PREVIEW_AUDIT_LOGS))
  assert.ok(PREVIEW_AUDIT_LOGS.length >= 5)

  for (const log of PREVIEW_AUDIT_LOGS) {
    assert.ok(log.auditId, 'Mỗi bản ghi phải có auditId')
    assert.ok(log.timestamp, 'Mỗi bản ghi phải có timestamp')
    assert.ok(log.actorName, 'Mỗi bản ghi phải có actorName')
    assert.ok(log.actorRole, 'Mỗi bản ghi phải có actorRole')
    assert.ok(log.action, 'Mỗi bản ghi phải có action')
    assert.ok(log.entityType, 'Mỗi bản ghi phải có entityType')
    assert.ok(log.hash, 'Mỗi bản ghi phải có SHA-256 hash')
    assert.ok(log.previousHash, 'Mỗi bản ghi phải có previousHash')
    assert.equal(log.hash.length, 64, 'SHA-256 hash phải có độ dài 64 hex characters')
    assert.equal(log.previousHash.length, 64, 'Previous hash phải có độ dài 64 hex characters')
  }
})

test('audit - Hash chain links sequentially without break', () => {
  for (let i = 1; i < PREVIEW_AUDIT_LOGS.length; i++) {
    const prev = PREVIEW_AUDIT_LOGS[i - 1]
    const curr = PREVIEW_AUDIT_LOGS[i]
    assert.equal(
      curr.previousHash,
      prev.hash,
      `Bản ghi #${curr.auditId} previousHash phải khớp tuyệt đối với hash của #${prev.auditId}`
    )
  }
})

test('audit - API methods listAuditLogs and verifyAuditChain are defined', () => {
  assert.equal(typeof api.listAuditLogs, 'function')
  assert.equal(typeof api.verifyAuditChain, 'function')
})

test('audit - errorMessage maps W8 security and audit error codes properly', () => {
  assert.equal(
    errorMessage(new ApiError(400, 'HASH_MISMATCH')),
    'Cảnh báo: Phát hiện sai lệch chuỗi băm dữ liệu kiểm toán.'
  )
  assert.equal(
    errorMessage(new ApiError(400, 'HASH_CHAIN_BROKEN')),
    'Cảnh báo tính toàn vẹn: Chuỗi băm lịch sử sự kiện bị gián đoạn.'
  )
  assert.equal(
    errorMessage(new ApiError(403, 'FORBIDDEN')),
    'Bạn không có quyền thực hiện thao tác này đối với vai trò hiện tại.'
  )
})
