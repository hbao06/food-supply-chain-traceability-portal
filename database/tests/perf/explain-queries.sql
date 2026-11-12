-- =============================================================================
-- Đo kế hoạch / thời gian các truy vấn chính của backend (W7-TV3). Chạy sau seed-volume.sql:
--   psql -U postgres -d fsc_perf -f database/tests/perf/explain-queries.sql
-- So sánh trước / sau migration 007: tạo một CSDL chỉ chạy migration 001–006, seed, chạy file này;
-- rồi chạy 007 và chạy lại. Kết quả của nhóm: docs/security/query-optimization.md.
-- Câu SQL giống câu trong backend/src (tham số đã thay bằng giá trị mẫu).
-- =============================================================================

\echo '== Q1 Cấp mã lô (nextBatchCode) – câu cũ LIKE'
EXPLAIN (ANALYZE, COSTS OFF) SELECT COALESCE(MAX((substring(batch_code FROM '^BATCH-[0-9]{4}-([0-9]+)$'))::int), 0) FROM batches WHERE batch_code LIKE 'BATCH-' || EXTRACT(YEAR FROM now())::int::text || '-%';

\echo '== Q1 Cấp mã lô (nextBatchCode) – câu mới'
EXPLAIN (ANALYZE, COSTS OFF) SELECT COALESCE((SELECT split_part(batch_code, '-', 3)::int FROM batches WHERE split_part(batch_code, '-', 2)::int = EXTRACT(YEAR FROM now())::int ORDER BY split_part(batch_code, '-', 3)::int DESC LIMIT 1), 0);

\echo '== Q2 Tra cứu đúng một mã lô (QR / trace)'
EXPLAIN (ANALYZE, COSTS OFF) SELECT * FROM public_event_trace WHERE batch_code = 'BATCH-2026-0420' ORDER BY "timestamp";

\echo '== Q3 Tìm kiếm q (Admin, đếm)'
EXPLAIN (ANALYZE, COSTS OFF) SELECT count(*) FROM batches b WHERE (b.product_name ILIKE '%ST25 lô 1234%' OR b.batch_code ILIKE '%ST25 lô 1234%');

\echo '== Q3 Tìm kiếm q theo mã (trang 1)'
EXPLAIN (ANALYZE, COSTS OFF) SELECT b.batch_id FROM batches b WHERE (b.product_name ILIKE '%2026-0420%' OR b.batch_code ILIKE '%2026-0420%') ORDER BY b.creation_date DESC, b.batch_id DESC LIMIT 20;

\echo '== Q4 Danh sách lô Admin (trang 1)'
EXPLAIN (ANALYZE, COSTS OFF) SELECT b.batch_id FROM batches b ORDER BY b.creation_date DESC, b.batch_id DESC LIMIT 20;

\echo '== Q4 Danh sách lô Farmer (trang 1)'
EXPLAIN (ANALYZE, COSTS OFF) SELECT b.batch_id FROM batches b WHERE b.organization_id = (SELECT organization_id FROM organizations WHERE name = 'Farm 1') ORDER BY b.creation_date DESC, b.batch_id DESC LIMIT 20;

\echo '== Q4 Lọc trạng thái CREATED (trang 1)'
EXPLAIN (ANALYZE, COSTS OFF) SELECT b.batch_id FROM batches b WHERE b.current_status = 'CREATED' ORDER BY b.creation_date DESC, b.batch_id DESC LIMIT 20;

\echo '== Q5 Danh sách lô Distributor (trang 1)'
EXPLAIN (ANALYZE, COSTS OFF) SELECT b.batch_id FROM batches b WHERE EXISTS (SELECT 1 FROM supply_chain_events scope_e JOIN users scope_u ON scope_u.user_id = scope_e.actor_id WHERE scope_e.batch_id = b.batch_id AND scope_u.organization_id = (SELECT organization_id FROM organizations WHERE name = 'Distributor 1')) ORDER BY b.creation_date DESC, b.batch_id DESC LIMIT 20;

\echo '== Q5 Đếm lô Distributor'
EXPLAIN (ANALYZE, COSTS OFF) SELECT count(*) FROM batches b WHERE EXISTS (SELECT 1 FROM supply_chain_events scope_e JOIN users scope_u ON scope_u.user_id = scope_e.actor_id WHERE scope_e.batch_id = b.batch_id AND scope_u.organization_id = (SELECT organization_id FROM organizations WHERE name = 'Distributor 1'));

\echo '== Q6 Audit mới nhất (trang 1)'
EXPLAIN (ANALYZE, COSTS OFF) SELECT a.audit_id FROM audit_logs a LEFT JOIN users u ON u.user_id = a.actor_id ORDER BY a.created_at DESC, a.audit_id DESC LIMIT 20;

\echo '== Q6 Audit lọc entityType=BATCH'
EXPLAIN (ANALYZE, COSTS OFF) SELECT a.audit_id FROM audit_logs a WHERE a.entity_type='BATCH' ORDER BY a.created_at DESC, a.audit_id DESC LIMIT 20;

\echo '== Q6 Audit lọc actorId'
EXPLAIN (ANALYZE, COSTS OFF) SELECT a.audit_id FROM audit_logs a WHERE a.actor_id = (SELECT min(user_id) FROM users) ORDER BY a.created_at DESC, a.audit_id DESC LIMIT 20;
