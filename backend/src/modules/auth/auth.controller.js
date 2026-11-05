'use strict';

const { validateRegister, validateLogin, validateProfileUpdate } = require('../../common/validators');

// Controller mỏng: kiểm tra đầu vào -> gọi service -> trả JSON. Lỗi do errorHandler xử lý.
function createAuthController(service) {
  return {
    async register(req, res) {
      const user = await service.register(validateRegister(req.body));
      res.status(201).json(user);
    },
    async login(req, res) {
      res.json(await service.login(validateLogin(req.body)));
    },
    async getMe(req, res) {
      res.json(await service.getProfile(req.auth.userId));
    },
    async updateMe(req, res) {
      res.json(await service.updateProfile(req.auth.userId, validateProfileUpdate(req.body)));
    },
  };
}

module.exports = { createAuthController };
