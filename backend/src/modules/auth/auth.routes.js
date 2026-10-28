'use strict';

const express = require('express');
const env = require('../../config/env');
const { pool, withTransaction } = require('../../db/pool');
const { createAuthenticate } = require('../../middleware/authenticate');
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

// Gắn vào app: app.use('/api/auth', authRouter); app.use('/api/users', profileRouter);
// Express 5 tự chuyển lỗi của handler async (Promise bị reject) sang errorHandler nên không cần wrapper.
const authRouter = express.Router();
authRouter.post('/register', controller.register);
authRouter.post('/login', controller.login);

const profileRouter = express.Router();
profileRouter.get('/me', authenticate, controller.getMe);
profileRouter.patch('/me', authenticate, controller.updateMe);

module.exports = { authRouter, profileRouter, authenticate, tokens };
