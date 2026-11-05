import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BATCH_STATUSES,
  STATUS_META,
  SUPPLY_CHAIN_STEPS,
  formatQuantity,
  formatDateOnly,
  formatDateTime,
  PREVIEW_BATCHES,
} from '../src/batches/batchConstants.js'

test('batchConstants - 6 canonical statuses exist in order', () => {
  assert.equal(BATCH_STATUSES.length, 6)
  assert.deepEqual(BATCH_STATUSES, [
    'CREATED',
    'TRANSPORTED',
    'RECEIVED',
    'PROCESSED',
    'PACKAGED',
    'SHIPPED',
  ])
})

test('batchConstants - STATUS_META has metadata for each status', () => {
  for (const st of BATCH_STATUSES) {
    const meta = STATUS_META[st]
    assert.ok(meta, `Thiếu metadata cho ${st}`)
    assert.ok(meta.label, `Thiếu label cho ${st}`)
    assert.ok(meta.badgeClass, `Thiếu badgeClass cho ${st}`)
    assert.ok(meta.description, `Thiếu description cho ${st}`)
    assert.equal(typeof meta.canEdit, 'boolean')
  }

  // Only CREATED can be edited
  assert.equal(STATUS_META.CREATED.canEdit, true)
  assert.equal(STATUS_META.TRANSPORTED.canEdit, false)
  assert.equal(STATUS_META.RECEIVED.canEdit, false)
  assert.equal(STATUS_META.PROCESSED.canEdit, false)
  assert.equal(STATUS_META.PACKAGED.canEdit, false)
  assert.equal(STATUS_META.SHIPPED.canEdit, false)
})

test('batchConstants - SUPPLY_CHAIN_STEPS contains 6 stages with roles', () => {
  assert.equal(SUPPLY_CHAIN_STEPS.length, 6)
  const types = SUPPLY_CHAIN_STEPS.map((s) => s.type)
  assert.deepEqual(types, BATCH_STATUSES)
})

test('batchConstants - formatQuantity formats number with localized unit', () => {
  assert.equal(formatQuantity(null), '—')
  assert.equal(formatQuantity(undefined), '—')
  assert.equal(formatQuantity('invalid'), '—')
  assert.match(formatQuantity(1000), /1[.,]000 kg/)
  assert.match(formatQuantity(1250.5), /1[.,]250[.,]5 kg/)
  assert.match(formatQuantity(50.25, 'tấn'), /50[.,]25 tấn/)
})

test('batchConstants - formatDateOnly and formatDateTime handle valid and invalid dates', () => {
  assert.equal(formatDateOnly(null), '—')
  assert.equal(formatDateTime(null), '—')
  const iso = '2026-11-04T08:30:00.000Z'
  assert.ok(formatDateOnly(iso).includes('2026'))
  assert.ok(formatDateTime(iso).includes('2026'))
})

test('batchConstants - PREVIEW_BATCHES has realistic sample batches', () => {
  assert.ok(PREVIEW_BATCHES.length >= 5)
  for (const b of PREVIEW_BATCHES) {
    assert.ok(b.batchId, 'Thiếu batchId')
    assert.match(b.batchCode, /^BATCH-2026-\d{4}$/, 'Mã lô không đúng định dạng')
    assert.ok(b.productName, 'Thiếu productName')
    assert.ok(b.origin, 'Thiếu origin')
    assert.ok(b.quantity > 0, 'Quantity phải > 0')
    assert.ok(BATCH_STATUSES.includes(b.currentStatus), 'Status không hợp lệ')
  }
})
