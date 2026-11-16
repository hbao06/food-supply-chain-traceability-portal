'use strict';

// Đối chiếu hợp đồng API: mọi endpoint ghi trong docs/openapi-spec.yaml phải có thật trên backend đang chạy.
//   cd backend && npm run check:openapi        (API_URL=... để đổi địa chỉ; PowerShell: $env:API_URL="...")
//
// Cách làm: gọi từng endpoint KHÔNG kèm token. Endpoint có thật trả 401/403/400/404 nghiệp vụ/200...;
// endpoint chưa làm hoặc sai đường dẫn rơi vào notFound của app.js và trả 404 "Không tìm thấy đường dẫn".
// Script không ghi dữ liệu (yêu cầu bị chặn ở bước xác thực hoặc kiểm tra đầu vào). Không phát hiện được
// endpoint có trong code nhưng chưa ghi vào OpenAPI: phần này xem xét bằng mắt khi review.
const fs = require('fs');
const path = require('path');

const SPEC_PATH = path.resolve(__dirname, '../../docs/openapi-spec.yaml');
const ROUTE_NOT_FOUND = 'Không tìm thấy đường dẫn'; // thông báo của notFound trong common/errorHandler.js
const SAMPLE = { qrToken: 'x', batchCode: 'BATCH-2026-0001' };
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// Đọc danh sách (method, path) từ phần `paths:` bằng cách quét dòng, không cần thư viện YAML.
function parseOperations(yamlText) {
  const ops = [];
  let inPaths = false;
  let current = null;
  for (const line of yamlText.split(/\r?\n/)) {
    if (/^paths:\s*$/.test(line)) { inPaths = true; continue; }
    if (inPaths && /^\S/.test(line)) break; // khóa cấp cao tiếp theo (components:)
    if (!inPaths) continue;
    let m = /^ {2}(\/[^\s:]*):\s*$/.exec(line);
    if (m) { current = m[1]; continue; }
    m = /^ {4}(get|post|put|patch|delete):\s*$/.exec(line);
    if (m && current) ops.push({ method: m[1].toUpperCase(), path: current });
  }
  return ops;
}

const fill = (p) => p.replace(/\{(\w+)\}/g, (_, name) => SAMPLE[name] ?? '1');

async function main() {
  const API = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
  const ops = parseOperations(fs.readFileSync(SPEC_PATH, 'utf8'));
  if (ops.length === 0) { console.error(`Không đọc được endpoint nào từ ${SPEC_PATH}`); process.exit(1); }
  console.log(`API: ${API}   OpenAPI: ${path.relative(process.cwd(), SPEC_PATH)}   (${ops.length} endpoint)\n`);

  const missing = []; const warn = [];
  for (const op of ops) {
    const hasBody = op.method === 'POST' || op.method === 'PATCH' || op.method === 'PUT';
    let res; let body = null;
    try {
      res = await fetch(`${API}/api${fill(op.path)}`, { method: op.method, headers: hasBody ? { 'Content-Type': 'application/json' } : {}, body: hasBody ? '{}' : undefined });
      try { body = await res.json(); } catch (_) { /* không có JSON */ }
    } catch (err) {
      console.error(`Không kết nối được tới ${API}: ${err.message}\nHãy chạy backend trước (npm run dev), hoặc đặt API_URL cho đúng.`);
      process.exit(1);
    }
    let tag = 'OK     ';
    if (res.status === 404 && body && body.message === ROUTE_NOT_FOUND) { tag = 'THIẾU  '; missing.push(op); }
    else if (res.status >= 500) { tag = 'CẢNH BÁO'; warn.push(op); }
    console.log(`  ${tag} ${op.method.padEnd(6)} /api${op.path.padEnd(34)} -> ${res.status}`);
  }

  console.log(`\n${ops.length - missing.length}/${ops.length} endpoint có trên backend.`);
  if (warn.length) console.log(`${warn.length} endpoint trả lỗi 5xx (có route nhưng lỗi, ví dụ CSDL chưa chạy): xem terminal của backend.`);
  if (missing.length) {
    console.log(`\nCÓ ${missing.length} ENDPOINT GHI TRONG OPENAPI NHƯNG CHƯA CÓ TRÊN BACKEND:`);
    for (const op of missing) console.log(`  - ${op.method} /api${op.path}`);
    console.log('Hãy gắn router còn thiếu vào app.js, hoặc sửa lại OpenAPI cho đúng thực tế.');
    process.exit(1);
  }
  console.log('Hợp đồng OpenAPI khớp với backend.');
}

module.exports = { parseOperations, fill, METHODS };
if (require.main === module) main().catch((err) => { console.error(err); process.exit(1); });
