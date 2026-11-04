'use strict';

// Kiểm thử HTTP đầu-cuối với CSDL thật cho API lô (W5-TV2): tạo, xem, danh sách, lọc, sửa, QR, phạm vi, audit.
//   cd backend && npm run smoke:batches        (API_URL=... để đổi địa chỉ; PowerShell: $env:API_URL="...")
const { stamp, pool, check, call, ensureServer, setupActors, run } = require('./lib/smoke-helpers');

run(async () => {
  await ensureServer();
  const a = await setupActors();
  const product = `Cà phê smoke ${stamp}`;
  const good = { productName: product, origin: 'Đắk Lắk', quantity: 500 };

  console.log('\n[Tạo lô]');
  check('Không có token -> 401', (await call('POST', '/api/batches', { body: good })).status === 401);
  const asDist = await call('POST', '/api/batches', { token: a.distributor.token, body: good });
  check('Distributor tạo lô -> 403 FORBIDDEN', asDist.status === 403 && asDist.body?.code === 'FORBIDDEN', asDist);
  check('Admin tạo lô -> 403', (await call('POST', '/api/batches', { token: a.admin.token, body: good })).status === 403);
  const bad = await call('POST', '/api/batches', { token: a.farmerA.token, body: { productName: '', origin: '  ', quantity: -1 } });
  check('Dữ liệu sai -> 400 kèm 3 lỗi theo trường', bad.status === 400 && bad.body?.details?.length === 3, bad);
  check('quantity là chuỗi -> 400', (await call('POST', '/api/batches', { token: a.farmerA.token, body: { ...good, quantity: '500' } })).status === 400);

  const c1 = await call('POST', '/api/batches', { token: a.farmerA.token, body: good });
  const b1 = c1.body;
  check('Farmer tạo lô -> 201', c1.status === 201, c1);
  check('Mã lô đúng định dạng BATCH-YYYY-NNNN', /^BATCH-\d{4}-\d{4,}$/.test(b1?.batchCode || ''), b1?.batchCode);
  check('Lô mới ở CREATED, thuộc đơn vị và người tạo', b1?.currentStatus === 'CREATED' && b1?.createdBy === a.farmerA.userId && b1?.organizationId === a.farmerA.orgId, b1);
  check('quantity trả về là số', b1?.quantity === 500, b1?.quantity);
  const c2 = await call('POST', '/api/batches', { token: a.farmerA.token, body: good });
  const seq = (code) => Number(code.split('-')[2]);
  check('Hai lô có mã khác nhau, số thứ tự tăng', c2.status === 201 && seq(c2.body.batchCode) > seq(b1.batchCode), [b1?.batchCode, c2.body?.batchCode]);

  console.log('\n[Danh sách và lọc]');
  const qs = `q=${encodeURIComponent(product)}`;
  const listA = await call('GET', `/api/batches?${qs}`, { token: a.farmerA.token });
  check('Farmer A thấy đúng 2 lô của đơn vị mình', listA.status === 200 && listA.body?.total === 2 && listA.body?.items?.length === 2, listA.body);
  const listB = await call('GET', `/api/batches?${qs}`, { token: a.farmerB.token });
  check('Farmer B không thấy lô của đơn vị khác', listB.status === 200 && listB.body?.total === 0, listB.body);
  const listAdmin = await call('GET', `/api/batches?${qs}`, { token: a.admin.token });
  check('Admin thấy mọi lô', listAdmin.body?.total === 2, listAdmin.body);
  const listProc = await call('GET', `/api/batches?${qs}`, { token: a.processor.token });
  check('Processor chưa ghi sự kiện nào thì danh sách rỗng', listProc.body?.total === 0, listProc.body);
  check('Lọc status=CREATED', (await call('GET', `/api/batches?${qs}&status=CREATED`, { token: a.farmerA.token })).body?.total === 2);
  check('Lọc status=SHIPPED -> 0', (await call('GET', `/api/batches?${qs}&status=SHIPPED`, { token: a.farmerA.token })).body?.total === 0);
  const page2 = await call('GET', `/api/batches?${qs}&limit=1&page=2`, { token: a.farmerA.token });
  check('Phân trang limit=1 page=2', page2.body?.items?.length === 1 && page2.body?.total === 2 && page2.body?.page === 2, page2.body);
  check('Sắp xếp mới nhất trước', listA.body?.items?.[0]?.batchId === c2.body?.batchId, listA.body?.items?.map((x) => x.batchId));
  check('Tìm theo mã lô', (await call('GET', `/api/batches?q=${b1.batchCode}`, { token: a.farmerA.token })).body?.total === 1);
  check('status sai -> 400', (await call('GET', '/api/batches?status=ABC', { token: a.farmerA.token })).status === 400);
  check('limit quá lớn -> 400', (await call('GET', '/api/batches?limit=1000', { token: a.farmerA.token })).status === 400);
  check('Ký tự % trong từ khóa không khớp mọi lô', (await call('GET', '/api/batches?q=%25', { token: a.farmerA.token })).body?.total === 0);

  console.log('\n[Xem một lô và phạm vi]');
  const id = b1.batchId;
  check('Farmer A xem lô của mình -> 200', (await call('GET', `/api/batches/${id}`, { token: a.farmerA.token })).body?.batchCode === b1.batchCode);
  const other = await call('GET', `/api/batches/${id}`, { token: a.farmerB.token });
  const missing = await call('GET', '/api/batches/999999999', { token: a.farmerA.token });
  check('Farmer B xem lô đơn vị khác -> 404', other.status === 404 && other.body?.code === 'NOT_FOUND', other);
  check('Lô không tồn tại trả đúng cùng kết quả (không lộ)', missing.status === 404 && JSON.stringify(missing.body) === JSON.stringify(other.body), missing);
  check('Distributor xem được lô đang chờ bước của mình', (await call('GET', `/api/batches/${id}`, { token: a.distributor.token })).status === 200);
  check('Processor chưa tới lượt -> 404', (await call('GET', `/api/batches/${id}`, { token: a.processor.token })).status === 404);
  check('Admin xem được', (await call('GET', `/api/batches/${id}`, { token: a.admin.token })).status === 200);
  check('batchId không phải số -> 400', (await call('GET', '/api/batches/abc', { token: a.farmerA.token })).status === 400);

  console.log('\n[Sửa lô]');
  check('Farmer B sửa lô đơn vị khác -> 404', (await call('PATCH', `/api/batches/${id}`, { token: a.farmerB.token, body: { quantity: 1 } })).status === 404);
  check('Distributor sửa lô -> 403', (await call('PATCH', `/api/batches/${id}`, { token: a.distributor.token, body: { quantity: 1 } })).status === 403);
  const upd = await call('PATCH', `/api/batches/${id}`, { token: a.farmerA.token, body: { quantity: 480 } });
  check('Farmer A sửa số lượng -> 200', upd.status === 200 && upd.body?.quantity === 480, upd);
  check('Không sửa được batchCode/currentStatus -> 400', (await call('PATCH', `/api/batches/${id}`, { token: a.farmerA.token, body: { batchCode: 'BATCH-2026-9999', currentStatus: 'SHIPPED' } })).status === 400);
  check('Body rỗng -> 400', (await call('PATCH', `/api/batches/${id}`, { token: a.farmerA.token, body: {} })).status === 400);
  check('Số lượng sai -> 400', (await call('PATCH', `/api/batches/${id}`, { token: a.farmerA.token, body: { quantity: 0 } })).status === 400);
  const same = await call('PATCH', `/api/batches/${id}`, { token: a.farmerA.token, body: { quantity: 480 } });
  check('Gửi lại giá trị cũ -> 200, không đổi', same.status === 200 && same.body?.quantity === 480, same);

  console.log('\n[QR]');
  const qr = await call('GET', `/api/batches/${id}/qr`, { token: a.farmerA.token });
  check('Lấy QR -> 200, qrData chứa mã lô và chữ ký', qr.status === 200 && qr.body?.qrData?.includes(`/trace/${b1.batchCode}.`), qr);
  check('Farmer B lấy QR lô khác -> 404', (await call('GET', `/api/batches/${id}/qr`, { token: a.farmerB.token })).status === 404);

  console.log('\n[Kiểm tra trong CSDL]');
  const audit = await pool.query(
    `SELECT action || ':' || entity_type AS k, count(*)::int AS n FROM audit_logs
     WHERE (entity_type = 'BATCH' AND entity_id = $1)
        OR (entity_type = 'QR_CODE' AND entity_id IN (SELECT qr_id FROM qr_codes WHERE batch_id = $1))
        OR (entity_type = 'EVENT' AND entity_id IN (SELECT event_id FROM supply_chain_events WHERE batch_id = $1))
     GROUP BY 1`, [id]);
  const counts = Object.fromEntries(audit.rows.map((r) => [r.k, r.n]));
  check('Audit: CREATE BATCH 1, CREATE QR_CODE 1, CREATE EVENT 1, UPDATE BATCH 1', counts['CREATE:BATCH'] === 1 && counts['CREATE:QR_CODE'] === 1 && counts['CREATE:EVENT'] === 1 && counts['UPDATE:BATCH'] === 1, counts);
  const ev = await pool.query('SELECT event_type, actor_id FROM supply_chain_events WHERE batch_id = $1', [id]);
  check('Lô có đúng 1 sự kiện CREATED do Farmer tạo ghi', ev.rows.length === 1 && ev.rows[0].event_type === 'CREATED' && Number(ev.rows[0].actor_id) === a.farmerA.userId, ev.rows);
  const codes = await pool.query('SELECT count(DISTINCT batch_code)::int AS n, count(*)::int AS total FROM batches WHERE product_name = $1', [product]);
  check('Mã lô không trùng', codes.rows[0].n === codes.rows[0].total, codes.rows[0]);
});
