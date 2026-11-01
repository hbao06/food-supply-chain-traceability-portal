const path = require("path");
const express = require("express");
const cors = require("cors");

// Nạp .env: ưu tiên backend/.env, sau đó .env ở thư mục gốc repo (dotenv không ghi đè biến đã có).
// Phải đặt TRƯỚC khi require các module đọc process.env (auth.routes, db/pool).
// Trong Docker không có .env ở thư mục gốc: lệnh thứ hai bỏ qua, biến lấy từ docker-compose.yml.
require("dotenv").config();
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { notFound, errorHandler } = require("./common/errorHandler");
const { authRouter, profileRouter } = require("./modules/auth/auth.routes");
const { securityHeaders } = require("./middleware/securityHeaders");
const { createRateLimiter } = require("./middleware/rateLimit");

const app = express();

// Bảo mật chung (W4-TV3): không lộ "X-Powered-By: Express", thêm header bảo mật, giới hạn body 100 KB.
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// Giới hạn tần suất đăng nhập / đăng ký theo IP (chống dò mật khẩu và dò email – SRS P6). Đổi bằng .env.
const minutes = (name, def) => (Number(process.env[name]) || def) * 60 * 1000;
const loginLimiter = createRateLimiter({
  windowMs: minutes("RATE_LIMIT_WINDOW_MINUTES", 15),
  max: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 20,
  message: "Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút",
});
const registerLimiter = createRateLimiter({
  windowMs: minutes("RATE_LIMIT_WINDOW_MINUTES", 15),
  max: Number(process.env.RATE_LIMIT_REGISTER_MAX) || 10,
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Food Traceability API is running",
  });
});

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth", authRouter);
app.use("/api/users", profileRouter);

// Router của các module khác (batches, events, trace) đặt TRƯỚC notFound.
app.use(notFound); // đường dẫn không tồn tại -> 404 { code, message }
app.use(errorHandler); // phải là middleware cuối cùng

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
