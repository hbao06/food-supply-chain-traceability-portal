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

test("health endpoint allows browser cross-origin requests", async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  await response.text();
});
