# Quy tắc làm việc nhóm

## 1. Nguyên tắc chung
- Mọi công việc phải có **Issue** (gán người, label, milestone) trước khi code/viết tài liệu.
- **Không push trực tiếp vào `main`.** Mọi thay đổi đi qua Pull Request (PR).
- **Chỉ merge khi:** (1) có ít nhất **1 review được Approve** và (2) **CI thành công**.
- Mỗi người tự quản lý Issue, branch, commit, PR của mình và tham gia review.

## 2. Branch
Nhánh chính: `main` (luôn ở trạng thái chạy được / tài liệu hợp lệ, được bảo vệ).

Đặt tên nhánh: `<loại>/<tuần>-<tv>-<mô-tả-ngắn>` (chữ thường, gạch ngang)

| Loại | Dùng cho | Ví dụ |
|---|---|---|
| `feature/` | chức năng mới | `feature/w5-tv2-batch-crud` |
| `fix/` | sửa lỗi | `fix/w4-tv3-jwt-expired` |
| `docs/` | tài liệu (SRS, UML, ERD…) | `docs/w1-tv3-erd-draft` |
| `test/` | viết test | `test/w4-tv4-auth-tests` |
| `chore/` | cấu hình, CI, Docker | `chore/w1-tv4-repo-setup` |

Nhánh sống ngắn, xoá sau khi merge. Nên rebase/merge `main` về nhánh trước khi mở PR.

## 3. Commit (Conventional Commits)
```
<type>(<scope>): <mô tả ngắn, thì hiện tại>
```
`type`: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `ci`
`scope` (tuỳ chọn): `frontend`, `backend`, `db`, `auth`, `qr`, `ci`…

Ví dụ: `docs(erd): add draft ERD for batch and event`, `feat(backend): add POST /batches`.

## 4. Pull Request
1. Mở PR vào `main`, dùng template có sẵn, liên kết Issue bằng `Closes #<số>`.
2. Gán **reviewer theo vòng review chéo** và gắn label tuần.
3. Tác giả không tự approve PR của mình.
4. Xử lý hết comment → reviewer Approve → CI xanh → **Squash and merge**.

### Review chéo
| Người viết | Người review |
|---|---|
| TV1 | TV4 |
| TV2 | TV1 |
| TV3 | TV2 |
| TV4 | TV3 |

## 5. Issue & Label
- Loại: `type: user-story`, `type: task`, `type: bug`, `type: docs`, `type: test`
- Mảng: `area: frontend`, `area: backend`, `area: database`, `area: auth-security`, `area: qa`, `area: devops`, `area: qr`
- Ưu tiên: `priority: high | medium | low`
- Tuần: `week-1` … `week-8`
- Trạng thái đặc biệt: `blocked`, `needs-review`

Mỗi Issue có tiêu chí hoàn thành (Definition of Done) rõ ràng; User Story theo mẫu *As a / I want / So that* + kịch bản Given-When-Then.

## 6. Project board
Cột: **Todo → In Progress → In Review → Done**. Kéo thẻ khi trạng thái thay đổi; PR merge sẽ tự đóng Issue.
