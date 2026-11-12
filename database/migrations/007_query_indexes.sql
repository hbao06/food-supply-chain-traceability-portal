-- =============================================================================
-- Migration 007 – chỉ mục cho batch_code và các truy vấn danh sách (W7-TV3)
--
-- Kế hoạch tuần 7: "Rà soát ... chỉ mục batch_code. Bàn giao: Security checklist và tối ưu truy vấn".
-- Số đo trước/sau (60 000 lô, 143 000 sự kiện, 60 000 audit) xem docs/security/query-optimization.md.
--
--   1. Cấp mã lô (nextBatchCode): trước đây quét toàn bảng bằng LIKE 'BATCH-2026-%' (collation en_US
--      của PostgreSQL trong Docker / Windows không dùng được btree thường cho LIKE) trong khi đang giữ
--      khóa advisory -> mọi lần tạo lô phải chờ nhau lâu dần theo số lô. Chỉ mục biểu thức (năm, số thứ tự)
--      cho phép lấy số lớn nhất bằng một lần đọc chỉ mục.
--   2. Tìm kiếm q (ILIKE '%...%' trên product_name, batch_code): btree không dùng được cho '%...%',
--      dùng chỉ mục trigram (pg_trgm, extension có sẵn trong PostgreSQL, "trusted" từ bản 13).
--   3. Danh sách lô / audit sắp xếp theo (thời gian DESC, id DESC): chỉ mục đúng thứ tự đó để LIMIT 20
--      dừng sau 20 dòng thay vì sắp xếp cả bảng. Chỉ mục mới bắt đầu bằng cùng cột với chỉ mục cũ
--      nên thay luôn chỉ mục cũ (vẫn phục vụ kiểm tra khóa ngoại và lọc theo cột đó).
-- Tra cứu đúng một mã lô (QR, /trace/code) đã dùng chỉ mục của ràng buộc uq_batches_batch_code.
-- =============================================================================

-- 1. Cấp mã lô BATCH-<năm>-<số>. split_part và ép kiểu int là IMMUTABLE nên dùng được trong chỉ mục.
--    CHECK chk_batches_batch_code_format bảo đảm mọi mã đều tách được thành số.
CREATE INDEX idx_batches_code_year_seq
    ON batches ((split_part(batch_code, '-', 2)::int), (split_part(batch_code, '-', 3)::int) DESC);

-- 2. Tìm kiếm chứa chuỗi (không phân biệt hoa thường).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_batches_product_name_trgm ON batches USING gin (product_name gin_trgm_ops);
CREATE INDEX idx_batches_batch_code_trgm   ON batches USING gin (batch_code gin_trgm_ops);

-- 3a. Danh sách lô: Admin (mọi lô), Farmer (theo đơn vị), lọc theo trạng thái.
CREATE INDEX idx_batches_created_desc     ON batches (creation_date DESC, batch_id DESC);
CREATE INDEX idx_batches_org_created_desc ON batches (organization_id, creation_date DESC, batch_id DESC);
CREATE INDEX idx_batches_status_created   ON batches (current_status, creation_date DESC, batch_id DESC);
DROP INDEX idx_batches_organization;
DROP INDEX idx_batches_status;

-- 3b. Nhật ký audit: GET /audit-logs sắp xếp created_at DESC, audit_id DESC.
CREATE INDEX idx_audit_created_desc ON audit_logs (created_at DESC, audit_id DESC);
CREATE INDEX idx_audit_type_created ON audit_logs (entity_type, created_at DESC, audit_id DESC);
CREATE INDEX idx_audit_actor_created ON audit_logs (actor_id, created_at DESC, audit_id DESC);
DROP INDEX idx_audit_created_at;
DROP INDEX idx_audit_actor;
-- idx_audit_entity (entity_type, entity_id) giữ nguyên: lọc theo một đối tượng chỉ ra vài dòng.

-- 3c. Phạm vi Processor / Distributor (EXISTS sự kiện do đơn vị mình ghi): tìm sự kiện theo người ghi,
--     lấy batch_id ngay trong chỉ mục (index-only), thay idx_events_actor.
CREATE INDEX idx_events_actor_batch ON supply_chain_events (actor_id, batch_id);
DROP INDEX idx_events_actor;
