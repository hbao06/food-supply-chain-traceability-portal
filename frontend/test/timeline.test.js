import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NEXT_EVENT_MAP,
  EVENT_ROLE_MAP,
  getNextEventType,
  canUserAddEvent,
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

test('timeline - canUserAddEvent checks authentication, role authorization, and batch status', () => {
  const batchCreated = { batchId: 101, currentStatus: 'CREATED' }
  const batchShipped = { batchId: 106, currentStatus: 'SHIPPED' }

  // Unauthenticated user cannot add events
  const checkGuest = canUserAddEvent(null, batchCreated)
  assert.equal(checkGuest.allowed, false)
  assert.match(checkGuest.reason, /đăng nhập/)

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
  assert.match(procReceived.reason, /Đơn vị phân phối/)

  // Farmer cannot record next event after CREATED
  const farmer = { role: 'FARMER' }
  const checkFarmer = canUserAddEvent(farmer, batchCreated)
  assert.equal(checkFarmer.allowed, false)
  assert.match(checkFarmer.reason, /Nông trại/)
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
