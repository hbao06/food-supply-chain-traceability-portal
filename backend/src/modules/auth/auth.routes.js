'use strict';

const express = require('express');
const env = require('../../config/env');
const { pool, withTransaction } = require('../../db/pool');
const asyncHandler = require('../../common/asyncHandler');
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
const authRouter = express.Router();
authRouter.post('/register', asyncHandler(controller.register));
authRouter.post('/login', asyncHandler(controller.login));

const profileRouter = express.Router();
profileRouter.get('/me', authenticate, asyncHandler(controller.getMe));
profileRouter.patch('/me', authenticate, asyncHandler(controller.updateMe));

module.exports = { authRouter, profileRouter, authenticate, tokens };
