'use strict';

// Kiểm thử HTTP đầu-cuối với CSDL thật cho API quản trị (W8-TV2): duyệt tài khoản, gán đơn vị, đổi vai trò,
// khóa/mở khóa, quản lý đơn vị, tra cứu nhật ký.
//   cd backend && npm run smoke:admin        (API_URL=... để đổi địa chỉ; PowerShell: $env:API_URL="...")
const { stamp, PASSWORD, check, call, ensureServer, setupActors, run } = require('./lib/smoke-helpers');

run(async () => {
  await ensureServer();
  const a = await setupActors(); // a.admin tạo bằng SQL; các tài khoản khác đã được duyệt sẵn
  const adm = (method, path, body) => call(method, path, { token: a.admin.token, body });

  console.log('\n[Phân quyền]');
  check('Không token -> 401', (await call('GET', '/api/users')).status === 401);
  for (const who of ['farmerA', 'processor', 'distributor']) {
    check(`${a[who].role} gọi API quản trị -> 403`, (await call('GET', '/api/users', { token: a[who].token })).status === 403
      && (await call('GET', '/api/audit-logs', { token: a[who].token })).status === 403
      && (await call('POST', '/api/organizations', { token: a[who].token, body: { name: 'x', type: 'FARM' } })).status === 403);
  }

  console.log('\n[Đơn vị]');
  const orgName = `Smoke Admin Farm ${stamp}`;
  const created = await adm('POST', '/api/organizations', { name: orgName, type: 'FARM', address: ' Gia Lai ' });
  check('Admin tạo đơn vị -> 201', created.status === 201 && created.body?.name === orgName && created.body?.address === 'Gia Lai', created);
  const farmOrg = created.body?.organizationId;
  check('Trùng tên và loại -> 409 ORGANIZATION_EXISTS', (await adm('POST', '/api/organizations', { name: orgName, type: 'FARM' })).body?.code === 'ORGANIZATION_EXISTS');
  const distOrg = (await adm('POST', '/api/organizations', { name: `Smoke Admin Dist ${stamp}`, type: 'DISTRIBUTOR' })).body?.organizationId;
  check('Tên rỗng và loại sai -> 400', (await adm('POST', '/api/organizations', { name: '', type: 'SHOP' })).status === 400);
  const list = await adm('GET', `/api/organizations?type=FARM&limit=100`);
  check('Danh sách đơn vị: phân trang và lọc loại', list.status === 200 && list.body?.items?.some((o) => o.organizationId === farmOrg) && list.body.items.every((o) => o.type === 'FARM') && typeof list.body.total === 'number', list.body);
  const renamed = await adm('PATCH', `/api/organizations/${farmOrg}`, { name: `${orgName} (đổi tên)` });
  check('Đổi tên đơn vị -> 200', renamed.status === 200 && renamed.body?.name === `${orgName} (đổi tên)`, renamed);
  check('Body rỗng -> 400', (await adm('PATCH', `/api/organizations/${farmOrg}`, {})).status === 400);
  check('Đơn vị không tồn tại -> 404', (await adm('PATCH', '/api/organizations/999999999', { name: 'x' })).status === 404);

  console.log('\n[Duyệt tài khoản mới]');
  const email = `smoke.new.${stamp}@example.com`;
  const reg = await call('POST', '/api/auth/register', { body: { name: 'Smoke New', email, password: PASSWORD, role: 'FARMER' } });
  const uid = reg.body?.userId;
  check('Đăng ký mới -> PENDING', reg.status === 201 && reg.body?.status === 'PENDING', reg);
  const pendingLogin = await call('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  check('Chưa duyệt thì không đăng nhập được -> 403 ACCOUNT_PENDING', pendingLogin.status === 403 && pendingLogin.body?.code === 'ACCOUNT_PENDING', pendingLogin);
  const pend = await adm('GET', '/api/users?status=PENDING&limit=100');
  check('Admin thấy tài khoản trong danh sách PENDING', pend.body?.items?.some((u) => u.userId === uid && u.organizationId === null), pend.body);
  check('Danh sách không lộ mật khẩu', !JSON.stringify(pend.body).match(/password|hash/i));
  const noOrg = await adm('PATCH', `/api/users/${uid}/status`, { status: 'ACTIVE' });
  check('Duyệt khi chưa có đơn vị -> 409 ORGANIZATION_REQUIRED', noOrg.status === 409 && noOrg.body?.code === 'ORGANIZATION_REQUIRED', noOrg);
  const wrongType = await adm('PATCH', `/api/users/${uid}/organization`, { organizationId: distOrg });
  check('Gán đơn vị sai loại -> 409 ORG_TYPE_MISMATCH', wrongType.status === 409 && wrongType.body?.code === 'ORG_TYPE_MISMATCH', wrongType);
  const assigned = await adm('PATCH', `/api/users/${uid}/organization`, { organizationId: farmOrg });
  check('Gán đúng đơn vị -> 200', assigned.status === 200 && assigned.body?.organizationId === farmOrg && assigned.body?.organizationName === `${orgName} (đổi tên)`, assigned);
  const approved = await adm('PATCH', `/api/users/${uid}/status`, { status: 'ACTIVE' });
  check('Duyệt -> 200 ACTIVE', approved.status === 200 && approved.body?.status === 'ACTIVE', approved);
  const login = await call('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  check('Sau khi duyệt đăng nhập được', login.status === 200 && !!login.body?.token, login);
  const userToken = login.body?.token;
  check('Tài khoản mới dùng được API lô', (await call('GET', '/api/batches', { token: userToken })).status === 200);

  console.log('\n[Đổi vai trò]');
  const mismatch = await adm('PATCH', `/api/users/${uid}/role`, { role: 'DISTRIBUTOR' });
  check('Đổi vai trò lệch loại đơn vị -> 409 ORG_TYPE_MISMATCH', mismatch.status === 409 && mismatch.body?.code === 'ORG_TYPE_MISMATCH', mismatch);
  const changed = await adm('PATCH', `/api/users/${uid}/role`, { role: 'DISTRIBUTOR', organizationId: distOrg });
  check('Đổi vai trò kèm đơn vị phù hợp -> 200', changed.status === 200 && changed.body?.role === 'DISTRIBUTOR' && changed.body?.organizationId === distOrg, changed);
  check('Gán vai trò ADMIN qua API -> 400', (await adm('PATCH', `/api/users/${uid}/role`, { role: 'ADMIN' })).status === 400);
  check('Đổi vai trò của Admin -> 409', (await adm('PATCH', `/api/users/${a.admin.userId}/role`, { role: 'FARMER' })).status === 409);

  console.log('\n[Khóa và mở khóa]');
  check('Admin tự khóa mình -> 409 CANNOT_MODIFY_SELF', (await adm('PATCH', `/api/users/${a.admin.userId}/status`, { status: 'LOCKED' })).body?.code === 'CANNOT_MODIFY_SELF');
  check('status PENDING không đặt được -> 400', (await adm('PATCH', `/api/users/${uid}/status`, { status: 'PENDING' })).status === 400);
  const locked = await adm('PATCH', `/api/users/${uid}/status`, { status: 'LOCKED' });
  check('Khóa tài khoản -> 200 LOCKED', locked.status === 200 && locked.body?.status === 'LOCKED', locked);
  const oldToken = await call('GET', '/api/batches', { token: userToken });
  check('Token cũ bị chặn ngay -> 403 ACCOUNT_LOCKED', oldToken.status === 403 && oldToken.body?.code === 'ACCOUNT_LOCKED', oldToken);
  check('Đăng nhập lại bị chặn -> 403 ACCOUNT_LOCKED', (await call('POST', '/api/auth/login', { body: { email, password: PASSWORD } })).body?.code === 'ACCOUNT_LOCKED');
  check('Mở khóa -> 200 ACTIVE', (await adm('PATCH', `/api/users/${uid}/status`, { status: 'ACTIVE' })).body?.status === 'ACTIVE');
  check('Dùng lại được token cũ sau khi mở khóa', (await call('GET', '/api/batches', { token: userToken })).status === 200);
  check('Tài khoản không tồn tại -> 404', (await adm('PATCH', '/api/users/999999999/status', { status: 'LOCKED' })).status === 404);
  check('userId không phải số -> 400', (await adm('PATCH', '/api/users/abc/status', { status: 'LOCKED' })).status === 400);

  console.log('\n[Đơn vị đã có thành viên]');
  const inUse = await adm('PATCH', `/api/organizations/${distOrg}`, { type: 'PROCESSOR' });
  check('Đổi loại đơn vị đã có thành viên -> 409 ORGANIZATION_IN_USE', inUse.status === 409 && inUse.body?.code === 'ORGANIZATION_IN_USE', inUse);

  console.log('\n[Nhật ký]');
  const logs = await adm('GET', `/api/audit-logs?entityType=USER&entityId=${uid}&limit=100`);
  const actions = (logs.body?.items || []).map((x) => x.action).reverse().join();
  check('Có đủ REGISTER, ASSIGN_ORGANIZATION, APPROVE, CHANGE_ROLE, LOCK, UNLOCK theo thứ tự', actions === 'REGISTER,ASSIGN_ORGANIZATION,APPROVE,CHANGE_ROLE,LOCK,UNLOCK', actions);
  check('Mỗi dòng có người thực hiện và giá trị cũ/mới', (logs.body?.items || []).filter((x) => x.action !== 'REGISTER').every((x) => x.actorId === a.admin.userId && x.actorName && x.newValue), logs.body?.items);
  check('Nhật ký không chứa mật khẩu', !JSON.stringify(logs.body).match(/password|hash/i));
  const byAction = await adm('GET', `/api/audit-logs?action=LOCK&entityType=USER&entityId=${uid}`);
  check('Lọc theo action', byAction.body?.total === 1, byAction.body);
  const page1 = await adm('GET', `/api/audit-logs?entityType=USER&entityId=${uid}&limit=2&page=2`);
  check('Phân trang limit=2 page=2', page1.body?.items?.length === 2 && page1.body?.total === 6, page1.body);
  const future = await adm('GET', `/api/audit-logs?entityId=${uid}&from=2999-01-01`);
  check('Lọc from ở tương lai -> rỗng', future.body?.total === 0, future.body);
  check('Bộ lọc sai -> 400', (await adm('GET', '/api/audit-logs?entityType=X&from=hôm-qua&limit=0')).status === 400);
  check('from sau to -> 400', (await adm('GET', '/api/audit-logs?from=2026-12-01&to=2026-11-01')).status === 400);
  check('Có dòng CREATE ORGANIZATION', (await adm('GET', `/api/audit-logs?entityType=ORGANIZATION&entityId=${farmOrg}&action=CREATE`)).body?.total === 1);
});
