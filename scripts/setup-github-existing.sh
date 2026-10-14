#!/usr/bin/env bash
# Bổ sung phần còn thiếu cho repo ĐÃ CÓ SẴN. Chạy lại nhiều lần vẫn an toàn (bỏ qua cái đã tồn tại).
# Yêu cầu: gh, jq; đã `gh auth login` và `gh auth refresh -s project`.
#
#   export OWNER="hbao06" REPO="food-supply-chain-traceability-portal"
#   export START_DATE="2026-09-14"                 # ngày bắt đầu Tuần 1 (thứ Hai)
#   export TV1="..." TV2="..." TV3="..." TV4="..." # username GitHub
#   bash scripts/setup-github-existing.sh labels milestones issues project
#   bash scripts/setup-github-existing.sh protect  # chạy SAU KHI ci.yml đã merge vào main
set -uo pipefail
: "${OWNER:?}" "${REPO:?}" "${START_DATE:?}" "${TV1:?}" "${TV2:?}" "${TV3:?}" "${TV4:?}"
FULL="$OWNER/$REPO"
STEPS=("$@"); [ ${#STEPS[@]} -eq 0 ] && STEPS=(labels milestones issues project)
has() { for s in "${STEPS[@]}"; do [ "$s" = "$1" ] && return 0; done; return 1; }

if has labels; then
  echo "==> Labels"
  jq -c '.[]' .github/labels.json | while read -r l; do
    gh label create "$(jq -r .name <<<"$l")" --color "$(jq -r .color <<<"$l")" \
      --description "$(jq -r .description <<<"$l")" --repo "$FULL" --force >/dev/null && echo "  ok: $(jq -r .name <<<"$l")"
  done
fi

if has milestones; then
  echo "==> Milestones (Tuần 1-8)"
  TITLES=("KHỞI TẠO VÀ PHÂN TÍCH PHẠM VI" "USER STORY, SRS VÀ ACCEPTANCE CRITERIA" "THIẾT KẾ HỆ THỐNG" \
  "TÀI KHOẢN, XÁC THỰC VÀ PHÂN QUYỀN" "QUẢN LÝ LÔ SẢN PHẨM" "SỰ KIỆN CHUỖI CUNG ỨNG VÀ TIMELINE" \
  "MÃ QR VÀ TRUY XUẤT CÔNG KHAI" "HOÀN THIỆN, TRIỂN KHAI VÀ BẢO VỆ")
  EXIST=$(gh api "repos/$FULL/milestones?state=all&per_page=100" --jq '.[].title')
  for i in 0 1 2 3 4 5 6 7; do
    t="Tuần $((i+1))"
    if grep -qx "$t" <<<"$EXIST"; then echo "  có sẵn: $t"; continue; fi
    due=$(date -u -d "$START_DATE + $((i*7+6)) days" +%Y-%m-%dT23:59:59Z)
    gh api -X POST "repos/$FULL/milestones" -f title="$t" -f description="${TITLES[$i]}" -f due_on="$due" >/dev/null && echo "  tạo: $t (hạn $due)"
  done
fi

if has issues; then
  echo "==> Issue Tuần 1 (bỏ qua nếu đã có Issue cùng mã W1-TVx)"
  mk() { # code title assignee labels body
    if gh issue list --repo "$FULL" --state all --search "$1 in:title" --json number -q '.[0].number' | grep -q .; then
      echo "  có sẵn: $1"; return; fi
    gh issue create --repo "$FULL" --title "$2" --assignee "$3" --label "$4" --milestone "Tuần 1" --body "$5" | tail -1
  }
  mk "W1-TV1" "[W1-TV1] Danh sách màn hình và wireframe ban đầu" "$TV1" "type: task,area: frontend,week-1" \
"**Bàn giao:** Danh sách màn hình và wireframe ban đầu. **Review:** TV4
(Đã có docs/ui-screen-list.md và docs/wireframes — đối chiếu và đóng Issue khi PR merge.)"
  mk "W1-TV2" "[W1-TV2] Danh sách endpoint dự kiến" "$TV2" "type: task,area: backend,week-1" \
"**Bàn giao:** Danh sách endpoint dự kiến. **Review:** TV1
(Đã có docs/api-endpoints-draft.md.)"
  mk "W1-TV3" "[W1-TV3] Bản nháp ERD và ma trận quyền" "$TV3" "type: task,area: database,area: auth-security,week-1" \
"**Bàn giao:** Bản nháp ERD và ma trận quyền. **Review:** TV2
(Đã có docs/ERD; kiểm tra đã có ma trận quyền chưa.)"
  mk "W1-TV4" "[W1-TV4] Repository và Project board hoạt động" "$TV4" "type: task,area: devops,week-1" \
"**Bàn giao:** Repository và Project board hoạt động. **Review:** TV3
- [ ] README giới thiệu đề tài
- [ ] Đủ 4 thành viên trong repo
- [ ] Labels + 8 milestone
- [ ] CONTRIBUTING.md (quy tắc branch) + branch protection
- [ ] CI (.github/workflows/ci.yml)
- [ ] Project board có Issue của cả 4 thành viên"
fi

if has project; then
  echo "==> Project board"
  PNUM=$(gh project list --owner "$OWNER" --format json -q '.projects[] | select(.title|test("Kế hoạch|Food|Supply";"i")) | .number' | head -1)
  if [ -z "$PNUM" ]; then
    PNUM=$(gh project create --owner "$OWNER" --title "$REPO - Kế hoạch 8 tuần" --format json | jq -r .number)
    echo "  đã tạo Project #$PNUM"
  else echo "  dùng Project #$PNUM có sẵn"; fi
  gh project link "$PNUM" --owner "$OWNER" --repo "$FULL" 2>/dev/null || true
  for url in $(gh issue list --repo "$FULL" --state all --limit 200 --json url -q '.[].url'); do
    gh project item-add "$PNUM" --owner "$OWNER" --url "$url" >/dev/null 2>&1
  done
  echo "  THỦ CÔNG: Project > Settings > Status: thêm cột 'In Review'; tạo view Board + Table (nhóm theo Milestone)."
fi

if has protect; then
  echo "==> Branch protection cho main (cần quyền admin + workflow 'CI' đã có trên main)"
  gh api -X PUT "repos/$FULL/branches/main/protection" --input - <<JSON || echo "  ! Thất bại: cần quyền admin, hoặc repo private gói Free."
{
  "required_status_checks": {"strict": true, "contexts": ["CI"]},
  "enforce_admins": false,
  "required_pull_request_reviews": {"required_approving_review_count": 1, "dismiss_stale_reviews": true},
  "restrictions": null,
  "required_conversation_resolution": true
}
JSON
  gh repo edit "$FULL" --delete-branch-on-merge >/dev/null 2>&1 || true
fi
echo "XONG."