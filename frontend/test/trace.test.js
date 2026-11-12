import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTraceRoute,
  classifyTraceError,
  getPreviewPublicTrace,
  getTraceProgress,
  parseTraceInput,
  parseTraceRoute,
  sanitizePublicTrace,
} from '../src/trace/traceUtils.js'

test('traceUtils - parseTraceRoute resolves public trace search and result routes', () => {
  assert.deepEqual(parseTraceRoute('/trace'), { name: 'trace-search' })
  assert.deepEqual(parseTraceRoute('/trace/'), { name: 'trace-search' })
  assert.deepEqual(parseTraceRoute('/trace?preview=1'), { name: 'trace-search' })
  assert.deepEqual(parseTraceRoute('/trace/code'), { name: 'trace-search' })

  assert.deepEqual(parseTraceRoute('/trace/code/BATCH-2026-0001'), {
    name: 'trace-result',
    mode: 'code',
    identifier: 'BATCH-2026-0001',
  })

  assert.deepEqual(parseTraceRoute('/trace/BATCH-2026-0001.c3167123984dfb1?preview=1'), {
    name: 'trace-result',
    mode: 'token',
    identifier: 'BATCH-2026-0001.c3167123984dfb1',
  })

  assert.equal(parseTraceRoute('/login'), null)
  assert.equal(parseTraceRoute('/batches/101'), null)
})

test('traceUtils - parseTraceInput trims whitespace, rejects empty, and parses URLs/tokens/codes', () => {
  assert.equal(parseTraceInput('').valid, false)
  assert.equal(parseTraceInput('   \t\n  ').valid, false)
  assert.equal(parseTraceInput('A'.repeat(256)).valid, false)

  const codeResult = parseTraceInput('  BATCH-2026-0001  ')
  assert.equal(codeResult.valid, true)
  assert.equal(codeResult.mode, 'code')
  assert.equal(codeResult.identifier, 'BATCH-2026-0001')
  assert.equal(codeResult.route, '/trace/code/BATCH-2026-0001')

  const tokenResult = parseTraceInput('BATCH-2026-0001.hmacSig123')
  assert.equal(tokenResult.valid, true)
  assert.equal(tokenResult.mode, 'token')
  assert.equal(tokenResult.identifier, 'BATCH-2026-0001.hmacSig123')
  assert.equal(tokenResult.route, '/trace/BATCH-2026-0001.hmacSig123')

  const urlToken = parseTraceInput('https://foodtrace.vn/trace/BATCH-2026-0002.sigXYZ')
  assert.equal(urlToken.valid, true)
  assert.equal(urlToken.mode, 'token')
  assert.equal(urlToken.identifier, 'BATCH-2026-0002.sigXYZ')

  const urlCode = parseTraceInput('http://localhost:5173/trace/code/BATCH-2026-0003')
  assert.equal(urlCode.valid, true)
  assert.equal(urlCode.mode, 'code')
  assert.equal(urlCode.identifier, 'BATCH-2026-0003')

  const invalidUrl = parseTraceInput('https://example.com/other/path')
  assert.equal(invalidUrl.valid, false)
})

test('traceUtils - sanitizePublicTrace strips internal fields and sorts events oldest to newest', () => {
  const dirty = {
    batchId: 99,
    batchCode: 'BATCH-2026-0001',
    productName: 'Cà phê Arabica',
    origin: 'Đà Lạt, Lâm Đồng',
    organizationName: 'HTX Cầu Đất',
    organizationId: 1,
    createdBy: 2,
    email: 'secret@internal.local',
    currentStatus: 'TRANSPORTED',
    events: [
      {
        eventId: 20,
        batchId: 99,
        actorId: 4,
        actorName: 'Nguyễn Nội Bộ',
        email: 'driver@internal.local',
        eventType: 'TRANSPORTED',
        location: 'TP.HCM',
        organizationName: 'Vận tải Xanh',
        timestamp: '2026-11-05T10:00:00.000Z',
        description: 'Vận chuyển xe lạnh',
      },
      {
        eventId: 10,
        batchId: 99,
        actorId: 2,
        actorName: 'Chủ vườn bí mật',
        eventType: 'CREATED',
        location: 'Đà Lạt',
        organizationName: 'HTX Cầu Đất',
        timestamp: '2026-11-04T08:00:00.000Z',
      },
    ],
  }

  const clean = sanitizePublicTrace(dirty)
  assert.equal(clean.batchCode, 'BATCH-2026-0001')
  assert.equal('batchId' in clean, false)
  assert.equal('createdBy' in clean, false)
  assert.equal('organizationId' in clean, false)
  assert.equal('email' in clean, false)

  assert.equal(clean.events.length, 2)
  // Chronological oldest -> newest
  assert.equal(clean.events[0].eventType, 'CREATED')
  assert.equal(clean.events[1].eventType, 'TRANSPORTED')
  // No private actor fields
  assert.equal('actorName' in clean.events[0], false)
  assert.equal('actorId' in clean.events[0], false)
  assert.equal('email' in clean.events[1], false)
  assert.equal('eventId' in clean.events[1], false)
})

test('traceUtils - getPreviewPublicTrace resolves valid code/token and rejects tampered token', () => {
  const byCode = getPreviewPublicTrace({ mode: 'code', identifier: 'batch-2026-0001' })
  assert.ok(byCode)
  assert.equal(byCode.batchCode, 'BATCH-2026-0001')
  assert.equal(byCode.events.length, 1)
  assert.equal('actorName' in byCode.events[0], false)

  const byToken = getPreviewPublicTrace({
    mode: 'token',
    identifier: 'BATCH-2026-0006.4c5d6e7f8a9b01',
  })
  assert.ok(byToken)
  assert.equal(byToken.batchCode, 'BATCH-2026-0006')
  assert.equal(byToken.events.length, 6)

  // Tampered token (1 char modified) -> null (404)
  const tampered = getPreviewPublicTrace({
    mode: 'token',
    identifier: 'BATCH-2026-0006.4c5d6e7f8a9b02',
  })
  assert.equal(tampered, null)

  // Unknown batch code -> null (404)
  assert.equal(getPreviewPublicTrace({ mode: 'code', identifier: 'BATCH-2026-9999' }), null)
})

test('traceUtils - classifyTraceError distinguishes 404, 429, and network/5xx errors', () => {
  const notFound = classifyTraceError({ status: 404, code: 'NOT_FOUND' })
  assert.equal(notFound.kind, 'not_found')
  assert.equal(notFound.title, 'Không tìm thấy thông tin truy xuất hợp lệ')
  assert.equal(notFound.retryable, false)

  const rateLimited = classifyTraceError({ status: 429, code: 'TOO_MANY_REQUESTS', retryAfter: 30 })
  assert.equal(rateLimited.kind, 'rate_limited')
  assert.match(rateLimited.message, /Bạn thao tác quá nhanh/)
  assert.match(rateLimited.message, /30 giây/)
  assert.equal(rateLimited.retryable, true)

  const netErr = classifyTraceError({ status: 0, code: 'NETWORK_ERROR' })
  assert.equal(netErr.kind, 'network_error')
  assert.equal(netErr.retryable, true)
})

test('traceUtils - buildTraceRoute and getTraceProgress compute routes and percentages', () => {
  assert.equal(buildTraceRoute('code', 'BATCH-2026-0001'), '/trace/code/BATCH-2026-0001')
  assert.equal(buildTraceRoute('token', 'A.B', { preview: true }), '/trace/A.B?preview=1')

  const p1 = getTraceProgress('CREATED')
  assert.equal(p1.completedSteps, 1)
  assert.equal(p1.totalSteps, 6)

  const p6 = getTraceProgress('SHIPPED')
  assert.equal(p6.completedSteps, 6)
  assert.equal(p6.percent, 100)
})
