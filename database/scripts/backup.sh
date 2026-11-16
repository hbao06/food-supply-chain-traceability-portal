#!/usr/bin/env bash
# =============================================================================
# Sao lưu CSDL PostgreSQL chạy trong Docker Compose (W8-TV3).
#   bash database/scripts/backup.sh            # -> backups/fsc-food_traceability-YYYYMMDD-HHMMSS.dump
#   bash database/scripts/backup.sh D:/sao-luu # thư mục khác
# Chạy ở thư mục gốc repo, khi service database đang chạy (docker compose up -d database).
# Windows PowerShell: database\scripts\backup.ps1 (cùng chức năng).
#
# Định dạng custom của pg_dump (-Fc): nén, khôi phục bằng restore.sh / pg_restore.
# File được tạo TRONG container rồi chép ra bằng `docker compose cp` (không chuyển hướng stdout,
# vì PowerShell sẽ làm hỏng dữ liệu nhị phân).
#
# CẢNH BÁO: bản sao lưu chứa hash mật khẩu, email, họ tên. Thư mục backups/ đã nằm trong .gitignore;
# không commit, không gửi lên nhóm chat / Drive công khai.
# =============================================================================
set -euo pipefail

DB_NAME="${DB_NAME:-food_traceability}"
SERVICE="${DB_SERVICE:-database}"
OUT_DIR="${1:-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT_DIR/fsc-$DB_NAME-$STAMP.dump"
TMP="/tmp/fsc-backup-$STAMP.dump"

mkdir -p "$OUT_DIR"
echo "Sao lưu CSDL $DB_NAME (service $SERVICE)..."
docker compose exec -T "$SERVICE" pg_dump -U postgres -d "$DB_NAME" --format=custom --no-owner --file="$TMP"
docker compose cp "$SERVICE:$TMP" "$FILE"
docker compose exec -T "$SERVICE" rm -f "$TMP"

# Tóm tắt nội dung để đối chiếu khi khôi phục
docker compose exec -T "$SERVICE" psql -U postgres -d "$DB_NAME" -At -c \
  "SELECT 'Nội dung: ' || (SELECT count(*) FROM batches) || ' lô, ' || (SELECT count(*) FROM supply_chain_events)
          || ' sự kiện, ' || (SELECT count(*) FROM users) || ' tài khoản, ' || (SELECT count(*) FROM audit_logs) || ' dòng audit'"
echo "Đã sao lưu: $FILE ($(du -h "$FILE" | cut -f1))"
echo "Lưu ý: file chứa hash mật khẩu và dữ liệu người dùng – không commit, không chia sẻ công khai."
