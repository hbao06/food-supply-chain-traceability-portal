import test from 'node:test'
import assert from 'node:assert/strict'
import { PREVIEW_AUDIT_LOGS } from '../src/batches/batchConstants.js'
import { api, errorMessage, ApiError } from '../src/api.js'
import {
  parseAuditLogsResponse,
  parseVerifyResponse,
  getAuditBatchCode,
} from '../src/admin/auditHelpers.js'

test('audit - PREVIEW_AUDIT_LOGS exists and contains valid structure', () => {
  assert.ok(Array.isArray(PREVIEW_AUDIT_LOGS))
  assert.ok(PREVIEW_AUDIT_LOGS.length >= 5)

  for (const log of PREVIEW_AUDIT_LOGS) {
    assert.ok(log.auditId, 'Mỗi bản ghi phải có auditId')
    assert.ok(log.timestamp || log.createdAt, 'Mỗi bản ghi phải có timestamp hoặc createdAt')
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

test('audit - parseAuditLogsResponse parses backend { items, page, limit, total } contract', () => {
  const backendResponse = {
    items: [
      {
        auditId: 101,
        actorId: 2,
        actorName: 'Nguyễn Văn Nông Dân',
        action: 'CREATE',
        entityType: 'BATCH',
        entityId: 12,
        oldValue: null,
        newValue: { batchCode: 'FR-2026-0012', quantity: 500 },
        createdAt: '2026-11-16T08:30:00.000Z',
      },
      {
        auditId: 102,
        actorId: 3,
        actorName: 'Công ty Chế biến',
        action: 'EVENT',
        entityType: 'EVENT',
        entityId: 45,
        oldValue: null,
        newValue: { batchId: 12, eventType: 'RECEIVED' },
        createdAt: '2026-11-16T09:00:00.000Z',
      },
    ],
    page: 1,
    limit: 20,
    total: 2,
  }

  const result = parseAuditLogsResponse(backendResponse)
  assert.equal(Array.isArray(result), true)
  assert.equal(result.length, 2)
  assert.equal(result[0].auditId, 101)
  assert.equal(result[0].createdAt, '2026-11-16T08:30:00.000Z')
  assert.equal(result[0].newValue.batchCode, 'FR-2026-0012')

  // Fallback testing for other envelopes
  assert.deepEqual(parseAuditLogsResponse({ data: [result[0]] }), [result[0]])
  assert.deepEqual(parseAuditLogsResponse([result[0]]), [result[0]])
  assert.deepEqual(parseAuditLogsResponse(null), [])
  assert.deepEqual(parseAuditLogsResponse(undefined), [])
})

test('audit - getAuditBatchCode extracts batch code from DTOs and preview logs', () => {
  assert.equal(getAuditBatchCode({ batchCode: 'BATCH-001' }), 'BATCH-001')
  assert.equal(getAuditBatchCode({ newValue: { batchCode: 'BATCH-002' } }), 'BATCH-002')
  assert.equal(getAuditBatchCode({ oldValue: { batchCode: 'BATCH-003' } }), 'BATCH-003')
  assert.equal(getAuditBatchCode({ entityType: 'BATCH', entityId: 99 }), 'Lô #99')
  assert.equal(getAuditBatchCode({ entityType: 'USER', entityId: 5 }), null)
  assert.equal(getAuditBatchCode(null), null)
})

test('audit - parseVerifyResponse maps valid backend hash chain verification', () => {
  const backendVerifySuccess = {
    auditLog: {
      checked: 18,
      valid: true,
      firstBrokenId: null,
      reason: null,
    },
    valid: true,
    checkedAt: '2026-11-16T10:00:00.000Z',
  }

  const parsed = parseVerifyResponse(backendVerifySuccess)
  assert.equal(parsed.verified, true)
  assert.equal(parsed.count, 18)
  assert.equal(parsed.firstBrokenId, null)
  assert.equal(parsed.reason, null)
  assert.equal(parsed.timestamp, '2026-11-16T10:00:00.000Z')
  assert.ok(parsed.message.includes('Toàn bộ 18 bản ghi chuỗi băm kiểm toán đều hợp lệ'))
})

test('audit - parseVerifyResponse maps broken hash chain with firstBrokenId and reason', () => {
  const backendVerifyBroken = {
    auditLog: {
      checked: 7,
      valid: false,
      firstBrokenId: 8,
      reason: 'prev_hash mismatch',
    },
    valid: false,
    checkedAt: '2026-11-16T10:05:00.000Z',
  }

  const parsed = parseVerifyResponse(backendVerifyBroken)
  assert.equal(parsed.verified, false, 'Khi auditLog.valid là false, verified phải là false')
  assert.equal(parsed.count, 7)
  assert.equal(parsed.firstBrokenId, 8)
  assert.equal(parsed.reason, 'prev_hash mismatch')
  assert.ok(parsed.message.includes('Chuỗi băm bị gián đoạn tại bản ghi #8'))
  assert.ok(parsed.message.includes('prev_hash mismatch'))
})

test('audit - parseVerifyResponse never defaults missing or malformed response to true', () => {
  assert.equal(parseVerifyResponse(null).verified, false)
  assert.equal(parseVerifyResponse({}).verified, false)
  assert.equal(parseVerifyResponse({ auditLog: { valid: false } }).verified, false)
  assert.equal(parseVerifyResponse({ auditLog: { valid: true }, valid: false }).verified, false)
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
