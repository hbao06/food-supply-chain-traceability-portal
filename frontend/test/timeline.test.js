import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BATCH_STATUSES,
  NEXT_EVENT_MAP,
  EVENT_ROLE_MAP,
  getNextEventType,
  canUserAddEvent,
  PREVIEW_EVENTS,
  formatRelativeTime,
} from '../src/batches/batchConstants.js'

test('timeline - NEXT_EVENT_MAP enforces strict canonical sequence', () => {
  assert.equal(NEXT_EVENT_MAP.CREATED, 'TRANSPORTED')
  assert.equal(NEXT_EVENT_MAP.TRANSPORTED, 'RECEIVED')
  assert.equal(NEXT_EVENT_MAP.RECEIVED, 'PROCESSED')
  assert.equal(NEXT_EVENT_MAP.PROCESSED, 'PACKAGED')
  assert.equal(NEXT_EVENT_MAP.PACKAGED, 'SHIPPED')
  assert.equal(NEXT_EVENT_MAP.SHIPPED, null)
})

test('timeline - getNextEventType returns correct sequential next status', () => {
  assert.equal(getNextEventType('CREATED'), 'TRANSPORTED')
  assert.equal(getNextEventType('TRANSPORTED'), 'RECEIVED')
  assert.equal(getNextEventType('RECEIVED'), 'PROCESSED')
  assert.equal(getNextEventType('PROCESSED'), 'PACKAGED')
  assert.equal(getNextEventType('PACKAGED'), 'SHIPPED')
  assert.equal(getNextEventType('SHIPPED'), null)
  assert.equal(getNextEventType('UNKNOWN'), null)
})

test('timeline - EVENT_ROLE_MAP assigns proper roles per supply chain event', () => {
  assert.deepEqual(EVENT_ROLE_MAP.TRANSPORTED, ['DISTRIBUTOR'])
  assert.deepEqual(EVENT_ROLE_MAP.RECEIVED, ['DISTRIBUTOR'])
  assert.deepEqual(EVENT_ROLE_MAP.PROCESSED, ['PROCESSOR'])
  assert.deepEqual(EVENT_ROLE_MAP.PACKAGED, ['PROCESSOR'])
  assert.deepEqual(EVENT_ROLE_MAP.SHIPPED, ['DISTRIBUTOR'])
})

test('timeline - canUserAddEvent checks role authorization and batch status', () => {
  const batchCreated = { batchId: 101, currentStatus: 'CREATED' }
  const batchShipped = { batchId: 106, currentStatus: 'SHIPPED' }

  // Admin cannot record supply chain events (read/audit only)
  const admin = { role: 'ADMIN' }
  const checkAdmin = canUserAddEvent(admin, batchCreated)
  assert.equal(checkAdmin.allowed, false)
  assert.match(checkAdmin.reason, /Quản trị viên/)
  assert.equal(canUserAddEvent(admin, batchShipped).allowed, false)

  // Distributor can record TRANSPORTED on CREATED batch
  const distributor = { role: 'DISTRIBUTOR' }
  const checkDist = canUserAddEvent(distributor, batchCreated)
  assert.equal(checkDist.allowed, true)
  assert.equal(checkDist.nextType, 'TRANSPORTED')

  // Batch at TRANSPORTED: next is RECEIVED, must be DISTRIBUTOR not PROCESSOR
  const batchTransported = { batchId: 102, currentStatus: 'TRANSPORTED' }
  const distReceived = canUserAddEvent(distributor, batchTransported)
  assert.equal(distReceived.allowed, true)
  assert.equal(distReceived.nextType, 'RECEIVED')

  const processor = { role: 'PROCESSOR' }
  const procReceived = canUserAddEvent(processor, batchTransported)
  assert.equal(procReceived.allowed, false)
  assert.match(procReceived.reason, /DISTRIBUTOR/)

  // Farmer cannot record next event after CREATED
  const farmer = { role: 'FARMER' }
  const checkFarmer = canUserAddEvent(farmer, batchCreated)
  assert.equal(checkFarmer.allowed, false)
  assert.match(checkFarmer.reason, /Nhà sản xuất/)
})

test('timeline - PREVIEW_EVENTS contains required 4 core factors for each event (Đơn vị, Địa điểm, Thời gian, Trạng thái)', () => {
  const batchIds = Object.keys(PREVIEW_EVENTS)
  assert.ok(batchIds.length >= 6, 'Cần ít nhất 6 lô có sự kiện')

  for (const [batchId, events] of Object.entries(PREVIEW_EVENTS)) {
    assert.ok(Array.isArray(events), `Sự kiện lô ${batchId} phải là mảng`)
    assert.ok(events.length > 0, `Lô ${batchId} phải có ít nhất 1 sự kiện`)

    events.forEach((event, idx) => {
      // 1. ĐƠN VỊ (Organization / Actor)
      assert.ok(event.organizationName, `Lô ${batchId} sự kiện #${idx} thiếu organizationName (Đơn vị)`)
      assert.ok(typeof event.organizationName === 'string')

      // 2. ĐỊA ĐIỂM (Location)
      assert.ok(event.location, `Lô ${batchId} sự kiện #${idx} thiếu location (Địa điểm)`)
      assert.ok(typeof event.location === 'string')

      // 3. THỜI GIAN (Timestamp)
      assert.ok(event.timestamp, `Lô ${batchId} sự kiện #${idx} thiếu timestamp (Thời gian)`)
      const d = new Date(event.timestamp)
      assert.equal(isNaN(d.getTime()), false, `Timestamp không hợp lệ: ${event.timestamp}`)

      // 4. TRẠNG THÁI (EventType / Status)
      assert.ok(event.eventType, `Lô ${batchId} sự kiện #${idx} thiếu eventType (Trạng thái)`)
      assert.ok(BATCH_STATUSES.includes(event.eventType), `EventType ${event.eventType} không thuộc canonical statuses`)
    })
  }
})

test('timeline - Batch 106 has all 6 supply chain stages completed in order', () => {
  const events = PREVIEW_EVENTS[106]
  assert.equal(events.length, 6)
  const sequence = events.map((e) => e.eventType)
  assert.deepEqual(sequence, [
    'CREATED',
    'TRANSPORTED',
    'RECEIVED',
    'PROCESSED',
    'PACKAGED',
    'SHIPPED',
  ])
})

test('timeline - formatRelativeTime formats recent and past dates properly', () => {
  assert.equal(formatRelativeTime(null), '')
  assert.equal(formatRelativeTime(undefined), '')

  const now = new Date().toISOString()
  assert.equal(formatRelativeTime(now), 'Vừa xong')

  const pastDate = '2026-01-01T00:00:00.000Z'
  const formatted = formatRelativeTime(pastDate)
  assert.ok(formatted.includes('2026') || formatted.includes('ngày trước'))
})
