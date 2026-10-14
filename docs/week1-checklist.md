## Mốc bàn giao cuối Tuần 1
- [ ] Repository có **README** giới thiệu đề tài
- [ ] Có **đủ 4 thành viên** trong repository (Settings → Collaborators; mọi lời mời đã được chấp nhận)
- [ ] **Mỗi thành viên có ≥ 1 Issue** được gán
- [ ] **Phạm vi và công nghệ** được nhóm thống nhất (đã ghi trong README)

## Công việc chi tiết
- [ ] Tạo repository
- [ ] Tạo GitHub Project (board: Todo / In Progress / In Review / Done)
- [ ] Tạo **nhãn Issue** (`.github/labels.json`)
- [ ] Tạo **milestone 8 tuần** (Tuần 1 … Tuần 8, có hạn theo ngày bắt đầu)
- [ ] Quy tắc **branch** (CONTRIBUTING.md) + branch protection `main`: cần 1 approval + CI xanh
- [ ] PR template & Issue template
- [ ] Workflow CI (status check tên `CI`)

## Minh chứng nên chụp / lưu link
1. Trang chủ repo (README hiển thị)
2. Settings → Collaborators (4 thành viên)
3. Project board có thẻ của cả 4 người
4. Trang Labels và Milestones
5. Settings → Branches (rule bảo vệ `main`)
6. 1 PR đã được review chéo + CI xanh

## Quy trình nộp việc của chính TV4
1. Nhánh `chore/w1-tv4-repo-setup`, mở PR vào `main`, `Closes #<issue W1-TV4>`.
2. Gán TV3 review → Approve + CI xanh → Squash and merge.
3. Kéo thẻ W1-TV4 sang **Done**.