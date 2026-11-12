const assert = require("node:assert/strict");
const { once } = require("node:events");
const { before, after, test } = require("node:test");
const app = require("../src/app");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
});

test("GET /api/health returns a healthy API response", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await response.json(), {
    status: "OK",
    message: "Food Traceability API is running",
  });
});

test("unknown API routes return 404", async () => {
  const response = await fetch(`${baseUrl}/api/route-that-does-not-exist`);
  assert.equal(response.status, 404);
});

test("CORS chỉ cho frontend được cấu hình, không cho website lạ (W7-TV3)", async () => {
  const allowed = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
  await allowed.text();

  const other = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(other.status, 200); // máy chủ vẫn trả lời, nhưng trình duyệt không cho trang lạ đọc phản hồi
  assert.equal(other.headers.get("access-control-allow-origin"), null);
  await other.text();
});

test("responses carry security headers and hide the framework (W4-TV3)", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-powered-by"), null);
  await response.text();
});

test("protected profile route still requires a token (requireAuth)", async () => {
  const response = await fetch(`${baseUrl}/api/users/me`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "UNAUTHORIZED");
});
