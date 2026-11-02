'use strict';

const express = require('express');
const env = require('../../config/env');
const { pool, withTransaction } = require('../../db/pool');
const { createAuthenticate } = require('../../middleware/authenticate');
const { createLoadCurrentUser } = require('../../middleware/currentUser');
const repo = require('./auth.repository');
const { createHasher } = require('./auth.hasher');
const { createTokenService } = require('./auth.tokens');
const { createAuthService } = require('./auth.service');
const { createAuthController } = require('./auth.controller');

const tokens = createTokenService({ secret: env.jwtSecret, expiresIn: env.jwtExpiresIn });
const hasher = createHasher({ cost: env.bcryptCost });
const service = createAuthService({ db: pool, withTransaction, repo, hasher, tokens });
const controller = createAuthController(service);
const authenticate = createAuthenticate(tokens);
// requireAuth (W4-TV3): kiểm tra JWT rồi đọc lại tài khoản từ CSDL ở mỗi yêu cầu, để tài khoản vừa bị
// khóa hoặc đổi vai trò / đơn vị không dùng tiếp quyền cũ trong token. Mọi route nội bộ dùng requireAuth.
const requireAuth = [authenticate, createLoadCurrentUser({ db: pool })];

// Gắn vào app: app.use('/api/auth', authRouter); app.use('/api/users', profileRouter);
// Express 5 tự chuyển lỗi của handler async (Promise bị reject) sang errorHandler nên không cần wrapper.
const authRouter = express.Router();
authRouter.post('/register', controller.register);
authRouter.post('/login', controller.login);

const profileRouter = express.Router();
profileRouter.get('/me', requireAuth, controller.getMe);
profileRouter.patch('/me', requireAuth, controller.updateMe);

module.exports = { authRouter, profileRouter, authenticate, requireAuth, tokens };
