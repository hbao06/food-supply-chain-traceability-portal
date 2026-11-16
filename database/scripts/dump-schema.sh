#!/usr/bin/env bash
# =============================================================================
# Sinh lại database/schema-current.sql: toàn bộ schema SAU KHI chạy mọi migration (W8-TV3).
#   bash database/scripts/dump-schema.sh
# Chạy ở thư mục gốc repo, trên CSDL vừa `npm run db:migrate` (nên là CSDL trống, ví dụ sau docker compose down -v).
# Chạy lại mỗi khi thêm migration mới; test backend/test/migrator.test.js báo lỗi nếu quên.
# =============================================================================
set -euo pipefail
DB_NAME="${DB_NAME:-food_traceability}"
SERVICE="${DB_SERVICE:-database}"
OUT=database/schema-current.sql
LATEST="$(ls database/migrations | grep -E '^[0-9]{3}_.*\.sql$' | sort | tail -1)"

{
  echo "-- ============================================================================="
  echo "-- schema-current.sql – TỰ SINH, KHÔNG SỬA TAY (database/scripts/dump-schema.sh)"
  echo "-- Toàn bộ schema sau migration 001 → ${LATEST%%_*} (${LATEST}), chỉ để ĐỌC / tra cứu."
  echo "-- Tạo CSDL thật bằng: cd backend && npm run db:migrate   (không chạy file này)"
  echo "-- Chỉ có cấu trúc (bảng, ràng buộc, trigger, hàm, view, chỉ mục, quyền); KHÔNG có dữ liệu của"
  echo "-- bảng tra cứu roles, event_types – dữ liệu đó nằm trong migration 002, 004."
  echo "-- ============================================================================="
  echo
  docker compose exec -T "$SERVICE" pg_dump -U postgres -d "$DB_NAME" --schema-only --no-owner \
    | grep -vE '^(\\(un)?restrict |-- Dumped (from|by) )' \
    | cat -s
} > "$OUT"
echo "Đã ghi $OUT ($(wc -l < "$OUT") dòng)"
