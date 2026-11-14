'use strict';

const express = require('express');
const { pool } = require('../../db/pool');

// GET /api/health (đã có trong app.js) chỉ cho biết tiến trình còn chạy.
// GET /api/health/ready kiểm tra thêm kết nối CSDL: dùng cho healthcheck của Docker/triển khai.
// Gắn vào app:  app.use('/api/health', healthRouter);
const healthRouter = express.Router();
healthRouter.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', database: 'OK' });
  } catch (err) {
    console.error('[health] không kết nối được CSDL:', err.message);
    res.status(503).json({ code: 'DATABASE_UNAVAILABLE', message: 'Không kết nối được cơ sở dữ liệu' });
  }
});

module.exports = { healthRouter };
