'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTraceService, toPublicTrace } = require('../src/modules/trace/trace.service');
const { createQrTokenService } = require('../src/common/qrToken');

const qr = createQrTokenService({ secret: 'k'.repeat(40) });

// CSDL giả. Hàng của view cố ý có thêm cột nội bộ để chứng minh danh sách trắng loại chúng ra.
function setup() {
  const calls = { batch: 0, events: 0 };
  const repo = {
    async findPublicBatch(_d, code) {
      calls.batch += 1;
      return code === 'BATCH-2026-0001'
        ? { batch_code: code, product_name: 'Cà phê', origin: 'Đắk Lắk', organization_name: 'Nông trại A', current_status: 'RECEIVED',
            batch_id: 1, created_by: 10, organization_id: 1, quantity: '500.00', actor_email: 'farmer@example.com' }
        : null;
    },
    async listPublicEvents() {
      calls.events += 1;
      return [
        { event_type: 'CREATED', location: 'Đắk Lắk', organization_name: 'Nông trại A', timestamp: new Date('2026-11-02T08:00:00Z'), description: 'ghi chú nội bộ', actor_id: 10 },
        { event_type: 'TRANSPORTED', location: 'QL14', organization_name: 'Phân phối D', timestamp: new Date('2026-11-02T09:00:00Z'), description: null, actor_id: 20 },
      ];
    },
  };
  return { calls, service: createTraceService({ db: {}, repo, qr }) };
}

const PUBLIC_KEYS = ['batchCode', 'currentStatus', 'events', 'organizationName', 'origin', 'productName'];
const EVENT_KEYS = ['eventType', 'location', 'organizationName', 'timestamp'];

test('tra cứu theo mã lô: trả đúng các trường công khai', async () => {
  const { service } = setup();
  const t = await service.byCode('BATCH-2026-0001');
  assert.deepEqual(Object.keys(t).sort(), PUBLIC_KEYS);
  assert.deepEqual([t.batchCode, t.productName, t.origin, t.organizationName, t.currentStatus], ['BATCH-2026-0001', 'Cà phê', 'Đắk Lắk', 'Nông trại A', 'RECEIVED']);
  assert.deepEqual(t.events.map((e) => e.eventType), ['CREATED', 'TRANSPORTED']);
});

test('mỗi sự kiện chỉ có loại, địa điểm, đơn vị, thời gian', async () => {
  const { service } = setup();
  const t = await service.byCode('BATCH-2026-0001');
  for (const e of t.events) assert.deepEqual(Object.keys(e).sort(), EVENT_KEYS);
});

test('KHÔNG lộ dữ liệu nội bộ: id, người tạo/ghi, email, số lượng, mô tả sự kiện', async () => {
  const { service } = setup();
  const json = JSON.stringify(await service.byCode('BATCH-2026-0001'));
  for (const leak of ['batch_id', 'batchId', 'created_by', 'createdBy', 'organization_id', 'organizationId', 'actor', 'email', 'quantity', 'description', 'ghi chú nội bộ', 'qrData', 'signature']) {
    assert.ok(!json.includes(leak), `không được lộ: ${leak}`);
  }
});

test('tra cứu theo token QR hợp lệ trả cùng kết quả với tra cứu theo mã lô', async () => {
  const { service } = setup();
  const viaToken = await service.byToken(qr.token('BATCH-2026-0001'));
  assert.deepEqual(viaToken, await service.byCode('BATCH-2026-0001'));
});

test('token sai chữ ký, bị sửa mã lô, thiếu chữ ký: 404 và KHÔNG truy vấn CSDL', async () => {
  const { service, calls } = setup();
  const good = qr.token('BATCH-2026-0001');
  for (const bad of [good.slice(0, -2) + 'xx', good.replace('0001', '0002'), 'BATCH-2026-0001', '.abc', '', 'x'.repeat(500)]) {
    const e = await service.byToken(bad).catch((x) => x);
    assert.equal(e.status, 404, bad.slice(0, 30));
  }
  assert.equal(calls.batch, 0);
});

test('token đúng chữ ký nhưng lô không tồn tại -> 404', async () => {
  const { service } = setup();
  assert.equal((await service.byToken(qr.token('BATCH-2026-0099')).catch((e) => e)).status, 404);
});

test('mã lô sai định dạng -> 404 mà không truy vấn CSDL (kể cả chuỗi tấn công SQL)', async () => {
  const { service, calls } = setup();
  for (const bad of ['abc', "BATCH-2026-0001'; DROP TABLE batches;--", 'batch-2026-0001', 'BATCH-26-1', '', undefined, 42]) {
    assert.equal((await service.byCode(bad).catch((e) => e)).status, 404, String(bad));
  }
  assert.equal(calls.batch, 0);
});

test('mọi trường hợp không tìm thấy trả cùng mã và thông báo (không lộ lô có tồn tại hay không)', async () => {
  const { service } = setup();
  const errs = await Promise.all([
    service.byCode('BATCH-2026-0099').catch((e) => e), service.byCode('abc').catch((e) => e),
    service.byToken('x.y').catch((e) => e), service.byToken(qr.token('BATCH-2026-0099')).catch((e) => e),
  ]);
  assert.equal(new Set(errs.map((e) => `${e.status}|${e.code}|${e.message}`)).size, 1);
  assert.equal(errs[0].message, 'Không tìm thấy thông tin truy xuất');
});

test('thiếu QR_HMAC_SECRET: tra cứu theo token trả 404, tra cứu theo mã lô vẫn chạy', async () => {
  const noKey = createTraceService({ db: {}, repo: setup().service && { findPublicBatch: async () => ({ batch_code: 'BATCH-2026-0001', product_name: 'A', origin: 'B', organization_name: null, current_status: 'CREATED' }), listPublicEvents: async () => [] }, qr: createQrTokenService({ secret: undefined }) });
  assert.equal((await noKey.byToken('BATCH-2026-0001.abc').catch((e) => e)).status, 404);
  assert.equal((await noKey.byCode('BATCH-2026-0001')).organizationName, null);
});

test('toPublicTrace: tổ chức null được giữ là null, không phải undefined', () => {
  const t = toPublicTrace({ batch_code: 'BATCH-2026-0001', product_name: 'A', origin: 'B', current_status: 'CREATED' }, [{ event_type: 'CREATED', location: 'L', timestamp: new Date(0) }]);
  assert.equal(t.organizationName, null);
  assert.equal(t.events[0].organizationName, null);
});
