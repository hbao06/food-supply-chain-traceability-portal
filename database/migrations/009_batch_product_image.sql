-- =============================================================================
-- Migration 009: Bổ sung cột image_url (ảnh sản phẩm) cho bảng batches
-- và đưa image_url vào view public_batch_trace để hiển thị đồng bộ ở trang tra cứu.
-- =============================================================================

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE batches
  DROP CONSTRAINT IF EXISTS chk_batches_image_url_format;

ALTER TABLE batches
  ADD CONSTRAINT chk_batches_image_url_format
  CHECK (
    image_url IS NULL
    OR image_url ~ '^(https?://|/products/|data:image/(jpeg|jpg|png|webp);base64,)'
  );

COMMENT ON COLUMN batches.image_url IS 'Ảnh sản phẩm của lô (URL công khai, đường dẫn /products/... hoặc data URL ảnh nén).';

CREATE OR REPLACE VIEW public_batch_trace AS
SELECT b.batch_code,
       b.product_name,
       b.origin,
       o.name AS organization_name,
       b.current_status,
       b.image_url
FROM batches b
JOIN organizations o ON o.organization_id = b.organization_id;
