import test from 'node:test'
import assert from 'node:assert/strict'
import { api, errorMessage, ApiError } from '../src/api.js'
import {
  parseAuditLogsResponse,
  parseAuditLogsPage,
  parseVerifyResponse,
  createVerifyErrorResult,
  getAuditBatchCode,
} from '../src/admin/auditHelpers.js'

test('audit - API methods listAuditLogs and verifyAuditChain are defined', () => {
  assert.equal(typeof api.listAuditLogs, 'function')
  assert.equal(typeof api.verifyAuditChain, 'function')
})

test('audit - parseAuditLogsResponse & parseAuditLogsPage parse backend { items, page, limit, total } contract', () => {
  const backendResponse = {
    items: [
      {
        auditId: 101,
        actorId: 2,
        actorName: 'Nguyễn Văn An',
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
        actorName: 'Nhà máy Chế biến',
        action: 'CREATE',
        entityType: 'EVENT',
        entityId: 45,
        oldValue: null,
        newValue: { batchId: 12, eventType: 'RECEIVED' },
        createdAt: '2026-11-16T09:00:00.000Z',
      },
    ],
    page: 1,
    limit: 20,
    total: 42,
  }

  const result = parseAuditLogsResponse(backendResponse)
  assert.equal(Array.isArray(result), true)
  assert.equal(result.length, 2)
  assert.equal(result[0].auditId, 101)
  assert.equal(result[0].createdAt, '2026-11-16T08:30:00.000Z')
  assert.equal(result[0].newValue.batchCode, 'FR-2026-0012')

  const pageObj = parseAuditLogsPage(backendResponse)
  assert.equal(pageObj.items.length, 2)
  assert.equal(pageObj.total, 42)
  assert.equal(pageObj.page, 1)
  assert.equal(pageObj.limit, 20)

  assert.deepEqual(parseAuditLogsResponse({ data: [result[0]] }), [result[0]])
  assert.deepEqual(parseAuditLogsResponse([result[0]]), [result[0]])
  assert.deepEqual(parseAuditLogsResponse(null), [])
  assert.deepEqual(parseAuditLogsResponse(undefined), [])
})

test('audit - getAuditBatchCode extracts batch code from DTOs', () => {
  assert.equal(getAuditBatchCode({ batchCode: 'FR-2026-0001' }), 'FR-2026-0001')
  assert.equal(getAuditBatchCode({ newValue: { batchCode: 'FR-2026-0002' } }), 'FR-2026-0002')
  assert.equal(getAuditBatchCode({ oldValue: { batchCode: 'FR-2026-0003' } }), 'FR-2026-0003')
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
  assert.equal(parsed.status, 'verified')
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
  assert.equal(parsed.status, 'broken')
  assert.equal(parsed.verified, false, 'Khi auditLog.valid là false, verified phải là false')
  assert.equal(parsed.count, 7)
  assert.equal(parsed.firstBrokenId, 8)
  assert.equal(parsed.reason, 'prev_hash mismatch')
  assert.ok(parsed.message.includes('Chuỗi băm bị gián đoạn tại bản ghi #8'))
  assert.ok(parsed.message.includes('prev_hash mismatch'))
})

test('audit - createVerifyErrorResult separates server/network error from broken chain integrity', () => {
  const errRes = createVerifyErrorResult('Máy chủ đang gặp sự cố. Vui lòng thử lại.')
  assert.equal(errRes.status, 'error')
  assert.equal(errRes.verified, false)
  assert.equal(errRes.firstBrokenId, null)
  assert.equal(errRes.count, 0)
  assert.match(errRes.message, /Máy chủ đang gặp sự cố/)
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
