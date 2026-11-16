# =============================================================================
# Khôi phục CSDL từ bản sao lưu của backup.ps1 / backup.sh (W8-TV3) – bản PowerShell của restore.sh.
#   powershell -ExecutionPolicy Bypass -File database\scripts\restore.ps1 -File backups\fsc-food_traceability-20261116-140000.dump -Yes [-SkipCheck]
# Chạy ở thư mục gốc repo.
#
# CSDL hiện tại CHỈ bị thay khi bản sao lưu đã khôi phục thành công vào CSDL tạm VÀ qua kiểm tra toàn vẹn:
#   1. kiểm tra file; 2. tạo vai trò fsc_app nếu chưa có (pg_dump không chứa vai trò);
#   3. khôi phục vào <DbName>_restore; 4. chạy database/tests/demo-check.sql TRÊN CSDL TẠM – có FAIL thì xóa
#   CSDL tạm và dừng, CSDL hiện tại giữ nguyên (-SkipCheck: bỏ qua, chỉ khi biết rõ bản sao lưu hợp lệ);
#   5. dừng backend, xóa CSDL cũ, đổi tên CSDL tạm, bật lại backend.
# Mật khẩu đăng nhập của fsc_app không nằm trong bản sao lưu: sang máy mới thì đặt lại (docs/deployment.md).
# =============================================================================
param(
    [Parameter(Mandatory = $true)][string]$File,
    [switch]$Yes,
    [switch]$SkipCheck,
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { 'food_traceability' }),
    [string]$Service = $(if ($env:DB_SERVICE) { $env:DB_SERVICE } else { 'database' })
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw "Lệnh thất bại (mã $LASTEXITCODE): docker $($args -join ' ')" }
}
# docker compose in tiến trình ra stderr; khi có chuyển hướng 2>$null, PowerShell 5.1 với
# ErrorActionPreference=Stop sẽ coi đó là lỗi, nên các lệnh "không bắt buộc" chạy với Continue.
function Invoke-Optional {
    $ErrorActionPreference = 'Continue'
    & docker @args 2>$null | Out-Null
}
function Invoke-AdminSql([string]$Sql) {
    Invoke-Docker compose exec -T $Service psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c $Sql
}

if (-not (Test-Path -LiteralPath $File -PathType Leaf)) { Write-Host "Không thấy file $File" -ForegroundColor Red; exit 2 }
if (-not $Yes) {
    Write-Host "Khôi phục sẽ THAY TOÀN BỘ CSDL $DbName bằng nội dung của $File."
    Write-Host 'Nếu chắc chắn, chạy lại với -Yes ở cuối lệnh.'
    exit 2
}
$tmpDb = "${DbName}_restore"

Write-Host '1/5 Kiểm tra file sao lưu'
Invoke-Docker compose cp $File "${Service}:/tmp/fsc-restore.dump"
Invoke-Docker compose cp 'database/tests/demo-check.sql' "${Service}:/tmp/demo-check.sql"
Invoke-Docker compose exec -T $Service pg_restore --list /tmp/fsc-restore.dump | Out-Null

Write-Host '2/5 Vai trò fsc_app'
Invoke-AdminSql 'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ''fsc_app'') THEN CREATE ROLE fsc_app NOLOGIN; END IF; END $$;'

Write-Host "3/5 Khôi phục vào CSDL tạm $tmpDb"
Invoke-Docker compose exec -T $Service dropdb -U postgres --if-exists $tmpDb
Invoke-Docker compose exec -T $Service createdb -U postgres $tmpDb
& docker compose exec -T $Service pg_restore -U postgres -d $tmpDb --no-owner --exit-on-error /tmp/fsc-restore.dump
if ($LASTEXITCODE -ne 0) {
    Invoke-Optional compose exec -T $Service dropdb -U postgres --if-exists $tmpDb
    Write-Host "LỖI: khôi phục thất bại, CSDL $DbName giữ nguyên." -ForegroundColor Red
    exit 1
}

Write-Host "4/5 Kiểm tra toàn vẹn trên CSDL tạm $tmpDb"
if ($SkipCheck) {
    Write-Host '    Bỏ qua (-SkipCheck).'
} else {
    & docker compose exec -T $Service psql -U postgres -d $tmpDb -v ON_ERROR_STOP=1 -q -f /tmp/demo-check.sql
    if ($LASTEXITCODE -ne 0) {
        Invoke-Optional compose exec -T $Service dropdb -U postgres --if-exists $tmpDb
        Invoke-Optional compose exec -T $Service rm -f /tmp/fsc-restore.dump /tmp/demo-check.sql
        Write-Host "LỖI: bản sao lưu không qua kiểm tra (FAIL ở trên). CSDL $DbName giữ nguyên, CSDL tạm đã xóa." -ForegroundColor Red
        Write-Host '     Nếu chắc chắn muốn dùng bản này, chạy lại với -Yes -SkipCheck.'
        exit 1
    }
}

Write-Host "5/5 Thay CSDL $DbName"
Invoke-Optional compose stop backend
Invoke-Docker compose exec -T $Service dropdb -U postgres --if-exists --force $DbName
Invoke-AdminSql "ALTER DATABASE $tmpDb RENAME TO $DbName;"  # không dùng dấu " (PowerShell 5.1 truyền sai cho lệnh ngoài)
Invoke-Optional compose start backend
Invoke-Optional compose exec -T $Service rm -f /tmp/fsc-restore.dump /tmp/demo-check.sql
Write-Host "Khôi phục xong: $DbName"
