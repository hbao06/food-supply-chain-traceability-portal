'use strict';

// Kiểm thử HTTP đầu-cuối với CSDL thật cho API truy xuất công khai (W7-TV2):
// quét QR / nhập mã lô, không cần đăng nhập, chỉ trả trường được phép công khai.
//   cd backend && npm run smoke:trace        (API_URL=... để đổi địa chỉ; PowerShell: $env:API_URL="...")
const { stamp, check, call, ensureServer, setupActors, run } = require('./lib/smoke-helpers');

const SECRET_NOTE = `GHI-CHU-NOI-BO-${stamp}`;
const ev = (eventType, extra = {}) => ({ eventType, location: `Điểm ${eventType}`, ...extra });
const PUBLIC_KEYS = ['batchCode', 'currentStatus', 'events', 'organizationName', 'origin', 'productName'];

run(async () => {
  await ensureServer();
  const a = await setupActors();

  console.log('\n[Chuẩn bị] tạo lô và ghi sự kiện bằng API nội bộ...');
  const created = await call('POST', '/api/batches', { token: a.farmerA.token, body: { productName: `Hồ tiêu smoke ${stamp}`, origin: 'Gia Lai', quantity: 250 } });
  if (created.status !== 201) throw new Error(`Không tạo được lô thử: ${JSON.stringify(created)}`);
  const { batchId, batchCode } = created.body;
  const qr = await call('GET', `/api/batches/${batchId}/qr`, { token: a.farmerA.token });
  const qrToken = (qr.body?.qrData || '').split('/trace/')[1];
  if (!qrToken) throw new Error(`Không lấy được qrData: ${JSON.stringify(qr)}`);
  const ev1 = await call('POST', `/api/batches/${batchId}/events`, { token: a.distributor.token, body: ev('TRANSPORTED', { description: SECRET_NOTE }) });
  const ev2 = await call('POST', `/api/batches/${batchId}/events`, { token: a.distributor.token, body: ev('RECEIVED') });
  const ev3 = await call('POST', `/api/batches/${batchId}/events`, { token: a.processor.token, body: ev('PROCESSED') });
  if (![ev1, ev2, ev3].every((r) => r.status === 201)) throw new Error('Không ghi được sự kiện thử');

  console.log('\n[Tra cứu theo mã QR, KHÔNG có token đăng nhập]');
  const byToken = await call('GET', `/api/trace/${encodeURIComponent(qrToken)}`);
  check('GET /api/trace/{qrToken} -> 200', byToken.status === 200, byToken);
  const t = byToken.body;
  check('Chỉ có các trường công khai', JSON.stringify(Object.keys(t || {}).sort()) === JSON.stringify(PUBLIC_KEYS), Object.keys(t || {}));
  check('Thông tin lô: mã lô, sản phẩm, nguồn gốc, đơn vị, trạng thái', t?.batchCode === batchCode && t?.productName === `Hồ tiêu smoke ${stamp}` && t?.origin === 'Gia Lai' && t?.organizationName === a.farmerA.orgName && t?.currentStatus === 'PROCESSED', t);
  check('Timeline đúng thứ tự', (t?.events || []).map((e) => e.eventType).join() === 'CREATED,TRANSPORTED,RECEIVED,PROCESSED', t?.events);
  check('Mỗi sự kiện chỉ có loại, địa điểm, đơn vị, thời gian', (t?.events || []).every((e) => JSON.stringify(Object.keys(e).sort()) === JSON.stringify(['eventType', 'location', 'organizationName', 'timestamp']) && e.organizationName && e.location && e.timestamp), t?.events);
  check('Đơn vị từng bước đúng (nông trại, phân phối, chế biến)', t?.events?.[0]?.organizationName === a.farmerA.orgName && t?.events?.[1]?.organizationName === a.distributor.orgName && t?.events?.[3]?.organizationName === a.processor.orgName, t?.events?.map((e) => e.organizationName));
  const body = JSON.stringify(t);
  for (const leak of [SECRET_NOTE, 'email', 'smoke.', 'userId', 'actor', 'createdBy', 'batchId', 'organizationId', 'quantity', 'qrData', 'signature', 'password']) {
    check(`Không lộ "${leak}"`, !body.includes(leak));
  }

  console.log('\n[Tra cứu theo mã lô]');
  const byCode = await call('GET', `/api/trace/code/${batchCode}`);
  check('GET /api/trace/code/{batchCode} -> 200, cùng nội dung với tra cứu theo QR', byCode.status === 200 && JSON.stringify(byCode.body) === JSON.stringify(t), byCode);
  const withAuth = await call('GET', `/api/trace/code/${batchCode}`, { token: a.admin.token });
  check('Có đăng nhập Admin vẫn chỉ thấy dữ liệu công khai', JSON.stringify(withAuth.body) === JSON.stringify(t));

  console.log('\n[Không tìm thấy: mọi trường hợp cùng một kết quả]');
  const tampered = await call('GET', `/api/trace/${encodeURIComponent(qrToken.slice(0, -2) + 'xx')}`);
  const wrongCode = await call('GET', `/api/trace/${encodeURIComponent(qrToken.replace(batchCode, 'BATCH-2026-9999'))}`);
  const unknown = await call('GET', '/api/trace/code/BATCH-2026-999999');
  const malformed = await call('GET', '/api/trace/code/abc');
  const injection = await call('GET', `/api/trace/code/${encodeURIComponent("BATCH-2026-0001'; DROP TABLE batches;--")}`);
  const noSig = await call('GET', `/api/trace/${batchCode}`);
  for (const [name, r] of [['Chữ ký bị sửa', tampered], ['Mã lô trong token bị đổi', wrongCode], ['Mã lô không tồn tại', unknown], ['Mã lô sai định dạng', malformed], ['Chuỗi tấn công SQL', injection], ['Token thiếu chữ ký', noSig]]) {
    check(`${name} -> 404 NOT_FOUND`, r.status === 404 && r.body?.code === 'NOT_FOUND', r);
  }
  const same = new Set([tampered, wrongCode, unknown, malformed, injection, noSig].map((r) => JSON.stringify(r.body)));
  check('Cả 6 trường hợp trả đúng cùng một nội dung lỗi (không lộ lô có tồn tại)', same.size === 1, [...same]);
  check('Sau các yêu cầu sai, tra cứu đúng vẫn chạy', (await call('GET', `/api/trace/code/${batchCode}`)).status === 200);
});
