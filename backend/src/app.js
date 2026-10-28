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

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Food Traceability API is running",
  });
});

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
