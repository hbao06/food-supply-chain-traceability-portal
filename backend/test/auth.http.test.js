'use strict';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');
const { createAuthenticate, authorize } = require('../src/middleware/authenticate');
const { errorHandler, notFound } = require('../src/common/errorHandler');
const { createAuthController } = require('../src/modules/auth/auth.controller');
const { createHasher } = require('../src/modules/auth/auth.hasher');
const { createAuthService } = require('../src/modules/auth/auth.service');
const { createTokenService } = require('../src/modules/auth/auth.tokens');

const secret = process.env.JWT_SECRET || 'test-only-secret-at-least-32-characters-long';
const hasher = createHasher({ cost: 4 });
const tokens = createTokenService({ secret });
const expiredTokens = createTokenService({ secret, expiresIn: '-1s' });
const state = { users: [], audits: [], nextId: 1 };
let server;
let baseUrl;

const repo = {
  async findByEmail(_db, email) {
    const row = state.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
    return row ? { ...row } : null;
  },
  async findById(_db, id) {
    const row = state.users.find((user) => Number(user.user_id) === Number(id));
    return row ? { ...row } : null;
  },
  async insertUser(_db, { name, email, passwordHash, role }) {
    if (state.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      const error = new Error('duplicate email');
      error.code = '23505';
      throw error;
    }
    const row = { user_id: String(state.nextId++), name, email, password_hash: passwordHash, role, status: 'PENDING', organization_id: null };
    state.users.push(row);
    return { ...row };
  },
  async updateName(_db, id, name) {
    const row = state.users.find((user) => Number(user.user_id) === Number(id));
    row.name = name;
    return { ...row };
  },
  async insertAudit(_db, audit) { state.audits.push(audit); },
};

const withTransaction = (callback) => callback({});
const service = createAuthService({ db: {}, withTransaction, repo, hasher, tokens });
const controller = createAuthController(service);
const authenticate = createAuthenticate(tokens);
const app = express();
app.use(express.json());
const authRouter = express.Router();
authRouter.post('/register', controller.register);
authRouter.post('/login', controller.login);
const usersRouter = express.Router();
usersRouter.get('/me', authenticate, controller.getMe);
usersRouter.patch('/me', authenticate, controller.updateMe);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.get('/api/admin-only', authenticate, authorize('ADMIN'), (_req, res) => res.json({ ok: true }));
app.use(notFound);
app.use(errorHandler);

async function request(path, { token, ...options } = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

async function register(overrides = {}) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Farmer One', email: `farmer${state.nextId}@example.com`, password: 'StrongPass123', role: 'FARMER', ...overrides }),
  });
}

async function login(email, password = 'StrongPass123') {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
});

test('HTTP đăng ký hợp lệ trả PENDING, chỉ DTO và lưu mật khẩu bcrypt', async () => {
  const response = await register({ email: 'new-farmer@example.com' });
  const user = await response.json();
  const saved = state.users.find((row) => row.email === 'new-farmer@example.com');
  assert.equal(response.status, 201);
  assert.equal(user.status, 'PENDING');
  assert.ok(!('password' in user) && !('password_hash' in user) && !('passwordHash' in user));
  assert.match(saved.password_hash, /^\$2[aby]\$/);
  assert.notEqual(saved.password_hash, 'StrongPass123');
  assert.equal(await hasher.compare('StrongPass123', saved.password_hash), true);
});

test('HTTP đăng ký email trùng trả 409 EMAIL_EXISTS', async () => {
  await register({ email: 'duplicate@example.com' });
  const response = await register({ email: 'DUPLICATE@example.com' });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'EMAIL_EXISTS');
});

test('HTTP đăng ký dữ liệu sai, thiếu hoặc role ADMIN/CONSUMER trả 400 VALIDATION_ERROR', async () => {
  for (const body of [
    { name: '', email: 'invalid', password: 'short', role: 'FARMER' },
    { email: 'missing-name@example.com', password: 'StrongPass123', role: 'FARMER' },
    { name: 'Admin', email: 'admin-self@example.com', password: 'StrongPass123', role: 'ADMIN' },
    { name: 'Consumer', email: 'consumer@example.com', password: 'StrongPass123', role: 'CONSUMER' },
  ]) {
    const response = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'VALIDATION_ERROR');
  }
});

test('HTTP đăng nhập đúng trả token và user, không lộ mật khẩu', async () => {
  await register({ email: 'login-ok@example.com' });
  state.users.find((user) => user.email === 'login-ok@example.com').status = 'ACTIVE';
  const response = await login('login-ok@example.com');
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(typeof body.token, 'string');
  assert.equal(body.user.email, 'login-ok@example.com');
  assert.ok(!('password' in body.user) && !('password_hash' in body.user));
});

test('HTTP sai email và mật khẩu đều trả 401 INVALID_CREDENTIALS', async () => {
  await register({ email: 'login-fail@example.com' });
  state.users.find((user) => user.email === 'login-fail@example.com').status = 'ACTIVE';
  const wrongPassword = await login('login-fail@example.com', 'WrongPass123');
  const wrongEmail = await login('absent@example.com');
  for (const response of [wrongPassword, wrongEmail]) {
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'INVALID_CREDENTIALS');
  }
});

test('HTTP tài khoản PENDING/LOCKED đúng mật khẩu trả 403 với mã riêng', async () => {
  await register({ email: 'pending@example.com' });
  const pending = await login('pending@example.com');
  assert.equal(pending.status, 403);
  assert.equal((await pending.json()).code, 'ACCOUNT_PENDING');
  await register({ email: 'locked@example.com' });
  state.users.find((user) => user.email === 'locked@example.com').status = 'LOCKED';
  const locked = await login('locked@example.com');
  assert.equal(locked.status, 403);
  assert.equal((await locked.json()).code, 'ACCOUNT_LOCKED');
});

test('HTTP GET /api/users/me phân biệt thiếu, sai, hết hạn và token hợp lệ', async () => {
  await register({ email: 'profile-get@example.com' });
  const row = state.users.find((user) => user.email === 'profile-get@example.com');
  row.status = 'ACTIVE';
  const missing = await request('/api/users/me');
  assert.equal(missing.status, 401);
  assert.equal((await missing.json()).code, 'UNAUTHORIZED');
  const invalid = await request('/api/users/me', { token: 'not-a-jwt' });
  assert.equal(invalid.status, 401);
  assert.equal((await invalid.json()).code, 'INVALID_TOKEN');
  const expired = await request('/api/users/me', {
    token: expiredTokens.sign({ userId: row.user_id, role: row.role, organizationId: null }),
  });
  assert.equal(expired.status, 401);
  assert.equal((await expired.json()).code, 'TOKEN_EXPIRED');
  const valid = await request('/api/users/me', {
    token: tokens.sign({ userId: row.user_id, role: row.role, organizationId: null }),
  });
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).email, 'profile-get@example.com');
});

test('HTTP PATCH /api/users/me chỉ cho đổi name và từ chối field khác', async () => {
  await register({ email: 'profile-patch@example.com' });
  const row = state.users.find((user) => user.email === 'profile-patch@example.com');
  row.status = 'ACTIVE';
  const token = tokens.sign({ userId: row.user_id, role: row.role, organizationId: null });
  const updated = await request('/api/users/me', {
    token, method: 'PATCH', body: JSON.stringify({ name: 'Updated Name' }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).name, 'Updated Name');
  for (const field of ['role', 'email', 'status', 'organizationId']) {
    const rejected = await request('/api/users/me', {
      token, method: 'PATCH', body: JSON.stringify({ name: 'Another Name', [field]: 'changed' }),
    });
    assert.equal(rejected.status, 400, `${field} must be immutable`);
    assert.equal((await rejected.json()).code, 'VALIDATION_ERROR');
  }
});

test('HTTP route chỉ ADMIN trả 403 cho FARMER và 401 khi thiếu token', async () => {
  await register({ email: 'rbac-farmer@example.com' });
  const row = state.users.find((user) => user.email === 'rbac-farmer@example.com');
  const forbidden = await request('/api/admin-only', {
    token: tokens.sign({ userId: row.user_id, role: 'FARMER', organizationId: null }),
  });
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).code, 'FORBIDDEN');
  const unauthorized = await request('/api/admin-only');
  assert.equal(unauthorized.status, 401);
  assert.equal((await unauthorized.json()).code, 'UNAUTHORIZED');
});
