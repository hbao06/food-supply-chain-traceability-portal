'use strict';

// Kiểm thử HTTP đầu-cuối với CSDL thật cho API sự kiện và timeline (W6-TV2):
// ghi sự kiện đúng vai trò và thứ tự, timeline, phạm vi, audit, bất biến.
//   cd backend && npm run smoke:events        (API_URL=... để đổi địa chỉ; PowerShell: $env:API_URL="...")
const { stamp, pool, check, call, ensureServer, setupActors, run } = require('./lib/smoke-helpers');

const ev = (eventType, extra = {}) => ({ eventType, location: `Điểm ${eventType}`, ...extra });

run(async () => {
  await ensureServer();
  const a = await setupActors();
  const created = await call('POST', '/api/batches', { token: a.farmerA.token, body: { productName: `Sầu riêng smoke ${stamp}`, origin: 'Đắk Lắk', quantity: 100 } });
  if (created.status !== 201) throw new Error(`Không tạo được lô thử: ${JSON.stringify(created)}`);
  const id = created.body.batchId;
  const url = `/api/batches/${id}/events`;
  const post = (who, body) => call('POST', url, { token: who.token, body });
  const status = async () => (await call('GET', `/api/batches/${id}`, { token: a.farmerA.token })).body?.currentStatus;

  console.log('\n[Kiểm tra quyền và đầu vào]');
  check('Không token -> 401', (await call('POST', url, { body: ev('TRANSPORTED') })).status === 401);
  check('Farmer ghi sự kiện -> 403', (await post(a.farmerA, ev('TRANSPORTED'))).status === 403);
  check('Admin ghi sự kiện -> 403', (await post(a.admin, ev('TRANSPORTED'))).status === 403);
  const created400 = await post(a.distributor, ev('CREATED'));
  check('Gửi CREATED -> 400 (hệ thống tự ghi)', created400.status === 400 && created400.body?.details?.[0]?.field === 'eventType', created400);
  check('Thiếu địa điểm -> 400', (await post(a.distributor, { eventType: 'TRANSPORTED' })).status === 400);
  check('Gửi timestamp tự đặt -> 400', (await post(a.distributor, ev('TRANSPORTED', { timestamp: '2020-01-01T00:00:00Z' }))).status === 400);
  check('Gửi actorId tự đặt -> 400', (await post(a.distributor, ev('TRANSPORTED', { actorId: 1 }))).status === 400);
  const roleMismatch = await post(a.distributor, ev('PROCESSED'));
  check('Distributor ghi PROCESSED (việc của Processor) -> 403', roleMismatch.status === 403 && roleMismatch.body?.code === 'FORBIDDEN', roleMismatch);
  check('Processor ghi TRANSPORTED -> 403', (await post(a.processor, ev('TRANSPORTED'))).status === 403);
  check('Processor chưa tới lượt ghi PROCESSED -> 404 (lô ngoài phạm vi)', (await post(a.processor, ev('PROCESSED'))).status === 404);
  check('batchId không phải số -> 400', (await call('POST', '/api/batches/abc/events', { token: a.distributor.token, body: ev('TRANSPORTED') })).status === 400);
  check('Lô không tồn tại -> 404', (await call('POST', '/api/batches/999999999/events', { token: a.distributor.token, body: ev('TRANSPORTED') })).status === 404);
  const skip = await post(a.distributor, ev('SHIPPED'));
  check('Nhảy cóc CREATED -> SHIPPED -> 409 INVALID_SEQUENCE', skip.status === 409 && skip.body?.code === 'INVALID_SEQUENCE', skip);
  check('Trạng thái lô vẫn CREATED sau các lỗi', (await status()) === 'CREATED');

  console.log('\n[Ghi chuỗi sự kiện đầy đủ]');
  const first = await post(a.distributor, ev('TRANSPORTED', { description: 'Xe tải 51C-123.45' }));
  check('Distributor ghi TRANSPORTED -> 201', first.status === 201 && first.body?.eventType === 'TRANSPORTED', first);
  check('Sự kiện có người ghi, đơn vị, thời gian, mô tả', first.body?.actorId === a.distributor.userId && first.body?.organizationName === a.distributor.orgName && !!first.body?.timestamp && first.body?.description === 'Xe tải 51C-123.45', first.body);
  check('Trạng thái lô đổi sang TRANSPORTED', (await status()) === 'TRANSPORTED');
  check('Ghi trùng TRANSPORTED -> 409', (await post(a.distributor, ev('TRANSPORTED'))).status === 409);
  for (const [who, type] of [[a.distributor, 'RECEIVED'], [a.processor, 'PROCESSED'], [a.processor, 'PACKAGED'], [a.distributor, 'SHIPPED']]) {
    const r = await post(who, ev(type));
    check(`${who.role} ghi ${type} -> 201, lô sang ${type}`, r.status === 201 && (await status()) === type, r);
  }
  const after = await post(a.distributor, ev('SHIPPED'));
  check('Ghi tiếp sau SHIPPED -> 409', after.status === 409 && after.body?.code === 'INVALID_SEQUENCE', after);

  console.log('\n[Timeline]');
  const t = await call('GET', `/api/batches/${id}/timeline`, { token: a.farmerA.token });
  const types = (t.body?.events || []).map((e) => e.eventType);
  check('Timeline có đủ 6 sự kiện đúng thứ tự', t.status === 200 && types.join() === 'CREATED,TRANSPORTED,RECEIVED,PROCESSED,PACKAGED,SHIPPED', types);
  const times = (t.body?.events || []).map((e) => new Date(e.timestamp).getTime());
  check('Thời gian không giảm (cũ -> mới)', times.every((x, i) => i === 0 || x >= times[i - 1]), times);
  check('Mỗi sự kiện có đơn vị, địa điểm, người ghi', (t.body?.events || []).every((e) => e.organizationName && e.location && e.actorName), t.body?.events);
  check('Thông tin lô trong timeline: SHIPPED', t.body?.batch?.currentStatus === 'SHIPPED' && t.body?.batch?.batchId === id, t.body?.batch);
  const list = await call('GET', url, { token: a.farmerA.token });
  check('GET /events cùng nội dung với timeline.events', JSON.stringify(list.body) === JSON.stringify(t.body?.events));
  check('Processor đã ghi sự kiện xem được timeline', (await call('GET', `/api/batches/${id}/timeline`, { token: a.processor.token })).status === 200);
  check('Admin xem được timeline', (await call('GET', `/api/batches/${id}/timeline`, { token: a.admin.token })).status === 200);
  check('Farmer đơn vị khác -> 404', (await call('GET', `/api/batches/${id}/timeline`, { token: a.farmerB.token })).status === 404);
  check('Timeline lô không tồn tại -> 404', (await call('GET', '/api/batches/999999999/timeline', { token: a.farmerA.token })).status === 404);
  check('Không token -> 401', (await call('GET', `/api/batches/${id}/timeline`)).status === 401);
  const patch = await call('PATCH', `/api/batches/${id}`, { token: a.farmerA.token, body: { quantity: 1 } });
  check('Sửa lô sau khi đã SHIPPED -> 409 BATCH_NOT_EDITABLE', patch.status === 409 && patch.body?.code === 'BATCH_NOT_EDITABLE', patch);

  console.log('\n[Kiểm tra trong CSDL]');
  const rows = await pool.query('SELECT event_type FROM supply_chain_events WHERE batch_id = $1 ORDER BY event_id', [id]);
  check('CSDL có đúng 6 sự kiện, không có sự kiện nào từ các lần bị từ chối', rows.rows.length === 6, rows.rows);
  const audit = await pool.query(
    `SELECT action || ':' || entity_type AS k, count(*)::int AS n FROM audit_logs
     WHERE (entity_type = 'EVENT' AND entity_id IN (SELECT event_id FROM supply_chain_events WHERE batch_id = $1))
        OR (entity_type = 'BATCH' AND entity_id = $1) GROUP BY 1`, [id]);
  const counts = Object.fromEntries(audit.rows.map((r) => [r.k, r.n]));
  check('Audit: CREATE EVENT 6, UPDATE BATCH 5 (mỗi lần đổi trạng thái), CREATE BATCH 1', counts['CREATE:EVENT'] === 6 && counts['UPDATE:BATCH'] === 5 && counts['CREATE:BATCH'] === 1, counts);
  let blocked = false;
  try { await pool.query(`UPDATE supply_chain_events SET location = 'sửa trộm' WHERE batch_id = $1`, [id]); } catch (err) { blocked = true; }
  check('Sự kiện bất biến: UPDATE trực tiếp trong CSDL bị chặn', blocked);
});
