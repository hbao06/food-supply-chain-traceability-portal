# =============================================================================
# Sao lưu CSDL PostgreSQL chạy trong Docker Compose (W8-TV3) – bản PowerShell của backup.sh.
#   powershell -ExecutionPolicy Bypass -File database\scripts\backup.ps1
#   powershell -ExecutionPolicy Bypass -File database\scripts\backup.ps1 -OutDir D:\sao-luu
# Chạy ở thư mục gốc repo, khi service database đang chạy (docker compose up -d database).
#
# File được tạo TRONG container rồi chép ra bằng `docker compose cp`: không dùng `>` vì PowerShell
# đổi mã hóa và làm hỏng dữ liệu nhị phân của bản sao lưu.
# CẢNH BÁO: bản sao lưu chứa hash mật khẩu, email, họ tên. Thư mục backups\ nằm trong .gitignore;
# không commit, không gửi lên nhóm chat / Drive công khai.
# =============================================================================
param(
    [string]$OutDir = 'backups',
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { 'food_traceability' }),
    [string]$Service = $(if ($env:DB_SERVICE) { $env:DB_SERVICE } else { 'database' })
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw "Lệnh thất bại (mã $LASTEXITCODE): docker $($args -join ' ')" }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$tmp = "/tmp/fsc-backup-$stamp.dump"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$file = Join-Path $OutDir "fsc-$DbName-$stamp.dump"

Write-Host "Sao lưu CSDL $DbName (service $Service)..."
Invoke-Docker compose exec -T $Service pg_dump -U postgres -d $DbName --format=custom --no-owner "--file=$tmp"
Invoke-Docker compose cp "${Service}:$tmp" $file
Invoke-Docker compose exec -T $Service rm -f $tmp

$summary = "SELECT 'Nội dung: ' || (SELECT count(*) FROM batches) || ' lô, ' || (SELECT count(*) FROM supply_chain_events) || ' sự kiện, ' || (SELECT count(*) FROM users) || ' tài khoản, ' || (SELECT count(*) FROM audit_logs) || ' dòng audit'"
Invoke-Docker compose exec -T $Service psql -U postgres -d $DbName -At -c $summary
$size = [math]::Round((Get-Item $file).Length / 1KB)
Write-Host "Đã sao lưu: $file ($size KB)"
Write-Host 'Lưu ý: file chứa hash mật khẩu và dữ liệu người dùng – không commit, không chia sẻ công khai.'
