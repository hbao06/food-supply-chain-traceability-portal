import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BATCH_STATUSES,
  STATUS_META,
  SUPPLY_CHAIN_STEPS,
  ROLE_LABELS_VI,
  formatQuantity,
  formatDateOnly,
  formatDateTime,
  productImage,
  resolveBatchImage,
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

test('batchConstants - SUPPLY_CHAIN_STEPS contains 6 stages with Vietnamese role labels', () => {
  assert.equal(SUPPLY_CHAIN_STEPS.length, 6)
  const types = SUPPLY_CHAIN_STEPS.map((s) => s.type)
  assert.deepEqual(types, BATCH_STATUSES)
  for (const step of SUPPLY_CHAIN_STEPS) {
    assert.ok(ROLE_LABELS_VI[step.role], `Thiếu nhãn tiếng Việt cho ${step.role}`)
  }
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

test('batchConstants - productImage maps Vietnamese product names to assets', () => {
  assert.equal(productImage('Cà phê Arabica Cầu Đất'), '/products/coffee.jpg')
  assert.equal(productImage('Gạo ST25 Sóc Trăng'), '/products/rice.jpg')
  assert.equal(productImage('Hạt điều rang muối Bình Phước'), '/products/cashew.jpg')
  assert.equal(productImage('Thanh long ruột đỏ Chợ Gạo'), '/products/dragonfruit.jpg')
  assert.equal(productImage('Chè Ô Long Mộc Châu'), '/products/tea.jpg')
})
test('batchConstants - resolveBatchImage prefers explicit imageUrl over keyword fallback', () => {
  assert.equal(
    resolveBatchImage({ productName: 'Nhãn xuồng Mỹ Đức', imageUrl: 'https://example.com/nhan.jpg' }),
    'https://example.com/nhan.jpg'
  )
  assert.equal(
    resolveBatchImage('Nhãn xuồng Mỹ Đức', 'data:image/jpeg;base64,/9j/4AAQ'),
    'data:image/jpeg;base64,/9j/4AAQ'
  )
  assert.equal(
    resolveBatchImage({ productName: 'Cà phê Arabica', imageUrl: null }),
    '/products/coffee.jpg'
  )
})