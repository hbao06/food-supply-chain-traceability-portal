const path = require("path");
const express = require("express");
const cors = require("cors");

// Nạp .env: ưu tiên backend/.env, sau đó .env ở thư mục gốc repo (dotenv không ghi đè biến đã có).
// Phải đặt TRƯỚC khi require các module đọc process.env (auth.routes, db/pool).
// Trong Docker không có .env ở thư mục gốc: lệnh thứ hai bỏ qua, biến lấy từ docker-compose.yml.
require("dotenv").config();
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { notFound, errorHandler } = require("./common/errorHandler");
const { eventsRouter, timelineRouter } = require("./modules/events/events.routes");
const { authRouter, profileRouter } = require("./modules/auth/auth.routes");
const { batchesRouter } = require("./modules/batches/batches.routes");
const { auditRouter } = require("./modules/audit/audit.routes");
const { securityHeaders } = require("./middleware/securityHeaders");
const { buildCorsOptions } = require("./middleware/corsOptions");
const { createRateLimiter, rateLimitEnabled, passThrough, clientIp } = require("./middleware/rateLimit");
const { traceRouter } = require("./modules/trace/trace.routes");

const app = express();

// Bảo mật chung (W4-TV3): không lộ "X-Powered-By: Express", thêm header bảo mật, giới hạn body 100 KB.
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(cors(buildCorsOptions())); // W7-TV3: chỉ nguồn trong CORS_ORIGIN (mặc định frontend localhost:5173)
app.use(express.json({ limit: "100kb" }));

// Giới hạn tần suất (W4-TV3, SRS P6). Cấu hình bằng .env; tắt khi NODE_ENV=test hoặc RATE_LIMIT_DISABLED=true.
//  - Đăng nhập: chỉ đếm lần SAI, theo IP + email -> chống dò mật khẩu một tài khoản, nhưng cả lớp
//    dùng chung một IP (Wi-Fi trường) vẫn đăng nhập bình thường.
//  - Đăng ký: theo IP, đếm mọi lần (chống tạo tài khoản rác / dò email đã dùng).
const minutes = (name, def) => (Number(process.env[name]) || def) * 60 * 1000;
const rateLimitOn = rateLimitEnabled();
const loginLimiter = rateLimitOn
  ? createRateLimiter({
      windowMs: minutes("RATE_LIMIT_WINDOW_MINUTES", 15),
      max: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 10,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => `${clientIp(req)}|${String((req.body && req.body.email) || "").trim().toLowerCase().slice(0, 255)}`,
      message: "Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút",
    })
  : passThrough;
const registerLimiter = rateLimitOn
  ? createRateLimiter({
      windowMs: minutes("RATE_LIMIT_WINDOW_MINUTES", 15),
      max: Number(process.env.RATE_LIMIT_REGISTER_MAX) || 30,
    })
  : passThrough;

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
app.use("/api/batches", batchesRouter);
app.use("/api/trace", traceRouter);
app.use("/api/batches/:batchId/events", eventsRouter);
app.use("/api/batches/:batchId/timeline", timelineRouter);
app.use("/api/audit-logs", auditRouter);


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
