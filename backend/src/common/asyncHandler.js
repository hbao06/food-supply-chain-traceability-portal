'use strict';

// Chuyển lỗi của handler async sang errorHandler (Express 4 không tự bắt).
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
