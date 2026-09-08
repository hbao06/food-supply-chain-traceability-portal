# Food Supply Chain Traceability & Provenance Portal

Đồ án môn Công nghệ Phần mềm (502045) — Nhóm 13, Đề tài 19.

Hệ thống ghi nhận lịch sử một lô hàng thực phẩm (batch) qua các giai đoạn của chuỗi cung ứng — sản xuất, vận chuyển, chế biến, đóng gói, phân phối — và cho phép người tiêu dùng quét QR để xem lại nguồn gốc.

File này là tài liệu vận hành cho cả nhóm: cách setup, quy trình Git, và những việc không được làm khi làm việc chung trên repo. Đọc hết một lượt trước khi bắt đầu code, đừng chỉ lướt qua rồi hỏi lại những thứ đã viết ở đây.

## Mục lục

- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Phân công](#phân-công)
- [Setup môi trường](#setup-môi-trường)
- [Quy trình Git](#quy-trình-git)
- [Branch và commit](#branch-và-commit)
- [Pull Request và review](#pull-request-và-review)
- [Những việc không được làm](#những-việc-không-được-làm)
- [Bắt đầu task theo từng phần](#bắt-đầu-task-theo-từng-phần)
- [Xử lý sự cố thường gặp](#xử-lý-sự-cố-thường-gặp)
- [Khi nào một task được coi là xong](#khi-nào-một-task-được-coi-là-xong)

## Kiến trúc hệ thống

3 lớp, giao tiếp qua REST API. Frontend không đụng trực tiếp vào database, mọi thứ đi qua backend.

```
Frontend (React/Next.js)
        |
        | REST/HTTP, JWT
        v
Backend (Node.js + Express/NestJS)
    - auth & RBAC
    - batch management
    - audit trail (append-only)
    - timeline aggregation
    - QR engine
        |
        v
Database (PostgreSQL)
```

Stack ở trên là cái nhóm đang nhắm tới. Nếu có thay đổi (đổi framework, đổi DB...) thì sửa lại đoạn này, đừng để README nói một đằng code một nẻo — mất công người khác đọc rồi làm sai.

Vài điểm cần nhớ khi thiết kế:

- Audit trail chỉ INSERT, không UPDATE/DELETE. Có sai thì ghi thêm event điều chỉnh, không sửa event cũ.
- Thứ tự event trong một batch phải hợp lệ (production → transport → processing → packaging → distribution). Việc validate thứ tự này nằm ở backend, không tin dữ liệu từ frontend gửi lên.
- Endpoint nào ghi dữ liệu đều phải qua middleware kiểm tra role.

## Cấu trúc thư mục

```
food-supply-chain-traceability-portal/
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
├── frontend/
├── backend/
│   └── src/
│       ├── auth/
│       ├── batch/
│       ├── event/
│       ├── audit/
│       └── qr/
├── database/
├── tests/
├── docs/
│   ├── SRS/
│   ├── UML/
│   ├── ERD/
│   └── openapi-spec.yaml
└── .github/
    ├── PULL_REQUEST_TEMPLATE.md
    └── workflows/ci.yml
```

## Phân công

| | Thành viên | Phụ trách |
|---|---|---|
| M1 | Trương Huỳnh Hoài Bảo | Frontend/UI — login, tạo batch, QR scanner, timeline, tích hợp API |
| M2 | Chung Nguyễn Minh Trí | Backend — batch API, event API, audit API, QR engine, timeline API |
| M3 | Lê Bá Khánh Bình | Database/Auth — schema, migration, authentication, RBAC |
| M4 | Đặng Vĩnh Quang | QA/DevOps — test plan, integration test, sequence integrity test, CI/CD |

Việc của ai người đó chủ động làm. Đụng qua phần người khác thì nói trước trong nhóm chat hoặc comment trong Issue, đừng tự sửa rồi push.

## Setup môi trường

Cần có sẵn: Git, Node.js (LTS), Docker + Docker Compose.

```bash
git clone <REPOSITORY_URL>
cd food-supply-chain-traceability-portal
git checkout main
git pull origin main
```

Tạo file env từ mẫu:

```bash
cp .env.example .env
```

Điền giá trị thật vào `.env` (DATABASE_URL, JWT_SECRET...). File này không commit — đã có trong `.gitignore`, đừng đụng vào.

Cài dependency và chạy thử:

```bash
cd frontend && npm install && npm run dev
```

```bash
cd backend && npm install && npm run dev
```

Hoặc nếu docker-compose đã cấu hình xong:

```bash
docker compose up --build
```

Mở app lên xem frontend gọi được backend không. Chạy được rồi thì báo trong nhóm, đừng im lặng rồi hai tuần sau mới nói "em chưa chạy được".

## Quy trình Git

Không code trực tiếp trên `main`. Mọi thay đổi đều qua một branch riêng.

```
Issue → tạo branch → code → commit → push → Pull Request → review → sửa (nếu cần) → approve → merge → xoá branch
```

Trước khi bắt đầu task mới, luôn cập nhật main:

```bash
git checkout main
git pull origin main
git checkout -b feature/<ten-task>
```

Trong lúc làm:

```bash
git status
git add .
git commit -m "feat: mo ta thay doi"
git push -u origin feature/<ten-task>
```

Nếu main có commit mới trong lúc bạn đang làm task, merge vào branch của mình trước khi push tiếp:

```bash
git checkout main
git pull origin main
git checkout feature/<ten-task>
git merge main
```

Có conflict thì mở file, sửa tay, test lại cho chạy đúng rồi mới add/commit/push. Đừng resolve conflict theo kiểu chọn đại một bên cho xong.

Sau khi PR merge, dọn branch local:

```bash
git checkout main
git pull origin main
git branch -d feature/<ten-task>
```

## Branch và commit

Branch:

```
feature/<ten-task>   feature/batch-creation-api
fix/<ten-loi>        fix/qr-scan-error
test/<ten-task>       test/sequence-integrity
docs/<ten-task>       docs/api-spec
chore/<ten-task>      chore/setup-eslint
```

Tên branch viết thường, nối bằng dấu gạch ngang, không dấu, không khoảng trắng.

Commit message: `<loại>: mô tả ngắn`. Ví dụ:

```
feat: them chuc nang tao batch
fix: sua loi validate trang thai batch
test: them test sequence integrity
docs: cap nhat openapi spec
refactor: tach lai batch service
```

Tránh mấy kiểu này: `update`, `fix loi`, `sua`, `final`, `final2`. Nhìn log commit sau này không ai biết đã đổi gì.

## Pull Request và review

Push branch xong thì tạo PR trên GitHub, tiêu đề rõ ràng kiểu commit message, mô tả có link Issue (`Closes #15`), nói ngắn gọn đã test cái gì, còn thiếu gì thì ghi luôn để reviewer biết.

Người review đọc code, đối chiếu với yêu cầu Issue, xem logic có đúng không, test đủ chưa. Approve hoặc request changes, không im lặng không phản hồi quá lâu — task người khác đang chờ.

Người tạo PR không tự approve PR của mình. Luân phiên người review, đừng để một người ôm hết việc review của cả nhóm.

## Những việc không được làm

Không push thẳng lên `main`:

```bash
git push origin main   # không dùng lệnh này để phát triển tính năng
```

Không code trực tiếp trên `main` — luôn có branch riêng trước khi viết dòng code đầu tiên.

Không commit `.env`, mật khẩu, API key, JWT secret, thông tin kết nối database, hay bất kỳ token cá nhân nào. Kiểm tra `git status` trước khi `add .`, đừng add ẩu.

Không tự approve PR của chính mình.

Không đặt tên branch tùy tiện kiểu `test1`, `abc`, `sua-cuoi-cung` — theo đúng convention ở trên.

Không tự đổi API contract (request/response giữa frontend-backend) mà không báo người liên quan. Backend đổi response format mà frontend không biết thì cả hai bên đều mất thời gian debug.

Không force-push lên branch chung, không sửa trực tiếp code người khác đang làm mà không trao đổi trước.

Không UPDATE/DELETE dữ liệu audit trail, kể cả lúc test thủ công trên DB — nếu cần sửa, tạo event mới.

Không dùng `git reset --hard` khi chưa chắc chắn — mất code chưa commit là mất luôn, không lấy lại được. `git status` trước.

Không merge PR khi CI đang fail hoặc chưa ai approve.

## Bắt đầu task theo từng phần

M1 (Frontend):

```bash
git checkout -b feature/login-ui
cd frontend && npm run dev
# code UI
git add . && git commit -m "feat: xay dung giao dien login"
git push -u origin feature/login-ui
```

M2 (Backend):

```bash
git checkout -b feature/batch-api
cd backend && npm run dev
# code API tạo batch
git add . && git commit -m "feat: them api tao batch"
git push -u origin feature/batch-api
```

M3 (Database/Auth):

```bash
git checkout -b feature/database-schema
cd database
# viết migration, cập nhật ERD trong docs/
git add . && git commit -m "feat: thiet ke schema ban dau"
git push -u origin feature/database-schema
```

M4 (QA/DevOps):

```bash
git checkout -b test/api-contract
cd tests && npm install
# viết test theo openapi-spec.yaml
git add . && git commit -m "test: them test api contract"
git push -u origin test/api-contract
```

## Xử lý sự cố thường gặp

Branch lệch so với main:

```bash
git checkout main
git pull origin main
git checkout feature/<ten-task>
git merge main
```

Chưa chắc trạng thái thay đổi hiện tại, kiểm tra trước khi làm gì tiếp:

```bash
git status
```

PR không merge được: xem lại CI có pass không, đã được review/approve chưa, có conflict với main không, có rule nào trên repo đang chặn không.

## Khi nào một task được coi là xong

- Có Issue, đã assign đúng người
- Có branch đúng convention
- Code chạy được, đã tự test ở local
- Commit message rõ nghĩa
- Đã tạo PR, link đúng Issue
- Có người khác review và approve
- Đã xử lý hết comment của reviewer
- Đã merge vào main

Thiếu bước nào thì chưa tính là xong, kể cả khi code đã chạy đúng.

---

Nhóm 13 — Food Supply Chain Traceability & Provenance Portal — Công nghệ Phần mềm 502045
