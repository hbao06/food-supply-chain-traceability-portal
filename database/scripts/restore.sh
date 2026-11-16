#!/usr/bin/env bash
# =============================================================================
# Khôi phục CSDL từ bản sao lưu của backup.sh (W8-TV3).
#   bash database/scripts/restore.sh backups/fsc-food_traceability-20261116-140000.dump --yes
# Chạy ở thư mục gốc repo. Windows PowerShell: database\scripts\restore.ps1.
#
# Các bước (CSDL hiện tại chỉ bị thay khi bản sao lưu đã khôi phục thành công):
#   1. Kiểm tra file sao lưu đọc được.
#   2. Tạo vai trò fsc_app nếu chưa có (vai trò là của cả máy chủ PostgreSQL, pg_dump không chứa;
#      thiếu thì các lệnh GRANT trong bản sao lưu lỗi).
#   3. Khôi phục vào CSDL tạm <DB_NAME>_restore.
#   4. Dừng backend, xóa CSDL cũ, đổi tên CSDL tạm thành <DB_NAME>, bật lại backend.
#   5. Chạy database/tests/demo-check.sql (chuỗi băm, QR, quyền, bộ đếm id...).
# Mật khẩu đăng nhập của fsc_app (nếu đã bật) không nằm trong bản sao lưu: khôi phục sang máy mới thì
# đặt lại theo docs/deployment.md.
# =============================================================================
set -euo pipefail

DB_NAME="${DB_NAME:-food_traceability}"
SERVICE="${DB_SERVICE:-database}"
TMP_DB="${DB_NAME}_restore"
FILE="${1:-}"

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Cách dùng: bash database/scripts/restore.sh <file .dump> --yes" >&2
  exit 2
fi
if [ "${2:-}" != "--yes" ]; then
  echo "Khôi phục sẽ THAY TOÀN BỘ CSDL $DB_NAME bằng nội dung của $FILE." >&2
  echo "Nếu chắc chắn, chạy lại với --yes ở cuối lệnh." >&2
  exit 2
fi

exec_db() { docker compose exec -T "$SERVICE" "$@"; }
psql_admin() { exec_db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "$1"; }

echo "1/5 Kiểm tra file sao lưu"
docker compose cp "$FILE" "$SERVICE:/tmp/fsc-restore.dump"
docker compose cp database/tests/demo-check.sql "$SERVICE:/tmp/demo-check.sql"
exec_db pg_restore --list /tmp/fsc-restore.dump > /dev/null

echo "2/5 Vai trò fsc_app"
psql_admin "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fsc_app') THEN CREATE ROLE fsc_app NOLOGIN; END IF; END \$\$;"

echo "3/5 Khôi phục vào CSDL tạm $TMP_DB"
exec_db dropdb -U postgres --if-exists "$TMP_DB"
exec_db createdb -U postgres "$TMP_DB"
if ! exec_db pg_restore -U postgres -d "$TMP_DB" --no-owner --exit-on-error /tmp/fsc-restore.dump; then
  exec_db dropdb -U postgres --if-exists "$TMP_DB"
  echo "LỖI: khôi phục thất bại, CSDL $DB_NAME giữ nguyên." >&2
  exit 1
fi

echo "4/5 Thay CSDL $DB_NAME"
docker compose stop backend > /dev/null 2>&1 || true
exec_db dropdb -U postgres --if-exists --force "$DB_NAME"
psql_admin "ALTER DATABASE \"$TMP_DB\" RENAME TO \"$DB_NAME\";"
docker compose start backend > /dev/null 2>&1 || true

echo "5/5 Kiểm tra CSDL sau khôi phục"
status=0
exec_db psql -U postgres -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -f /tmp/demo-check.sql || status=$?
exec_db rm -f /tmp/fsc-restore.dump /tmp/demo-check.sql
if [ "$status" -ne 0 ]; then
  echo "Đã khôi phục, nhưng demo-check báo FAIL ở trên – xem và sửa trước khi demo." >&2
  exit "$status"
fi
echo "Khôi phục xong: $DB_NAME"
