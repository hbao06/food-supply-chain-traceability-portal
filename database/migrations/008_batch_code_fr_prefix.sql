-- =============================================================================
-- Migration 008: Đổi chuẩn mã lô từ BATCH-YYYY-NNNN sang FR-YYYY-NNNN
-- Giữ nguyên cấu trúc 3 phần ngăn cách bởi dấu '-' để tương thích chỉ mục
-- idx_batches_code_year_seq (split_part(batch_code, '-', 2)::int, ...3::int).
-- =============================================================================

ALTER TABLE batches
  DROP CONSTRAINT IF EXISTS chk_batches_batch_code_format;

ALTER TABLE batches
  ADD CONSTRAINT chk_batches_batch_code_format
  CHECK (batch_code ~ '^FR-[0-9]{4}-[0-9]{4,}$');

COMMENT ON COLUMN batches.batch_code IS 'Mã công khai, dạng FR-YYYY-NNNN, in lên QR và nhập tay.';
