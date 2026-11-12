-- =============================================================================
-- Kiểm tra ràng buộc CSDL (W3-TV3; W4 roles; W5 products, farms; W6 event_types, chuỗi băm, vai trò fsc_app;
--                        W7 chỉ mục batch_code / danh sách)
-- Chạy trên CSDL trống SAU KHI đã chạy migration (cd backend && npm run db:migrate):
--   psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 -f database/tests/schema-check.sql
-- Mọi dữ liệu thử được ROLLBACK ở cuối, CSDL giữ nguyên.
-- Kết quả mong đợi: mỗi dòng in ra "PASS ..." và dòng cuối "ALL CHECKS PASSED".
-- =============================================================================

BEGIN;

-- expect_fail: chạy câu lệnh, PASS nếu bị CSDL từ chối, FAIL (dừng) nếu chạy được.
CREATE FUNCTION pg_temp.expect_fail(label text, stmt text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE stmt;
    EXCEPTION WHEN OTHERS THEN
        -- Lỗi cú pháp / sai tên cột không được tính là "bị từ chối đúng".
        IF SQLSTATE IN ('42601','42703','42P01','42883') THEN
            RAISE EXCEPTION 'FAIL  % – câu lệnh kiểm thử sai: %', label, SQLERRM;
        END IF;
        RAISE NOTICE 'PASS  %  (%)', label, SQLERRM;
        RETURN;
    END;
    RAISE EXCEPTION 'FAIL  % – câu lệnh lẽ ra phải bị từ chối: %', label, stmt;
END $$;

CREATE FUNCTION pg_temp.expect_ok(label text, stmt text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE stmt;
    RAISE NOTICE 'PASS  %', label;
END $$;

-- bcrypt hash mẫu (chỉ dùng cho kiểm thử)
CREATE FUNCTION pg_temp.h() RETURNS text LANGUAGE sql IMMUTABLE
AS $f$ SELECT '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.Xh8gN1H0r1b8O4l6m3bS4qv0r1yW' $f$;

-- Chỉ chạy trên CSDL trống; đặt lại bộ đếm IDENTITY về 1 (được ROLLBACK cùng transaction).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM organizations) OR EXISTS (SELECT 1 FROM batches)
       OR EXISTS (SELECT 1 FROM products) THEN
        RAISE EXCEPTION 'CSDL đã có dữ liệu – hãy chạy kiểm thử trên CSDL mới tạo từ schema.sql';
    END IF;
END $$;
ALTER TABLE organizations       ALTER COLUMN organization_id RESTART WITH 1;
ALTER TABLE users               ALTER COLUMN user_id         RESTART WITH 1;
ALTER TABLE batches             ALTER COLUMN batch_id        RESTART WITH 1;
ALTER TABLE qr_codes            ALTER COLUMN qr_id           RESTART WITH 1;
ALTER TABLE supply_chain_events ALTER COLUMN event_id        RESTART WITH 1;
ALTER TABLE audit_logs          ALTER COLUMN audit_id        RESTART WITH 1;
ALTER TABLE products            ALTER COLUMN product_id      RESTART WITH 1;

-- ---------- Dữ liệu nền ----------
INSERT INTO organizations (name, type) VALUES
    ('Nông trại Đắk Lắk', 'FARM'),
    ('Chế biến Sài Gòn',  'PROCESSOR'),
    ('Phân phối Miền Nam','DISTRIBUTOR'),
    ('Nông trại Lâm Đồng','FARM');

INSERT INTO users (name, email, password_hash, role, status, organization_id) VALUES
    ('Admin',        'admin@example.com',  pg_temp.h(), 'ADMIN',       'ACTIVE', NULL),
    ('Farmer A',     'farmer@example.com', pg_temp.h(), 'FARMER',      'ACTIVE', 1),
    ('Processor P',  'proc@example.com',   pg_temp.h(), 'PROCESSOR',   'ACTIVE', 2),
    ('Distributor D','dist@example.com',   pg_temp.h(), 'DISTRIBUTOR', 'ACTIVE', 3),
    ('Farmer B',     'farmerb@example.com',pg_temp.h(), 'FARMER',      'ACTIVE', 4),
    ('Pending',      'pending@example.com',pg_temp.h(), 'FARMER',      'PENDING', NULL);

-- ---------- users (US-S01, US-S04) ----------
SELECT pg_temp.expect_fail('Mật khẩu thô bị chặn',
  $$INSERT INTO users (name,email,password_hash,role) VALUES ('X','x@example.com','password123','FARMER')$$);
SELECT pg_temp.expect_fail('Email trùng (khác hoa thường)',
  $$INSERT INTO users (name,email,password_hash,role) VALUES ('X','FARMER@example.com',pg_temp.h(),'FARMER')$$);
SELECT pg_temp.expect_fail('Vai trò CONSUMER không lưu trong users',
  $$INSERT INTO users (name,email,password_hash,role) VALUES ('X','c@example.com',pg_temp.h(),'CONSUMER')$$);
SELECT pg_temp.expect_fail('Kích hoạt khi chưa có đơn vị',
  $$UPDATE users SET status='ACTIVE' WHERE email='pending@example.com'$$);
SELECT pg_temp.expect_fail('Vai trò không khớp loại đơn vị (FARMER -> PROCESSOR)',
  $$UPDATE users SET organization_id=2 WHERE email='pending@example.com'$$);
SELECT pg_temp.expect_fail('Admin không thuộc đơn vị',
  $$UPDATE users SET organization_id=1 WHERE email='admin@example.com'$$);
SELECT pg_temp.expect_fail('Không khóa Admin ACTIVE cuối cùng',
  $$UPDATE users SET status='LOCKED' WHERE email='admin@example.com'$$);
SELECT pg_temp.expect_ok('Duyệt tài khoản: gán đơn vị rồi ACTIVE',
  $$UPDATE users SET organization_id=1, status='ACTIVE' WHERE email='pending@example.com'$$);

-- ---------- roles (migration 002) ----------
SELECT pg_temp.expect_fail('Vai trò không có trong bảng roles',
  $$INSERT INTO users (name,email,password_hash,role) VALUES ('X','r@example.com',pg_temp.h(),'RETAILER')$$);
SELECT pg_temp.expect_fail('Không sửa mã vai trò', $$UPDATE roles SET role_code='FARM_X' WHERE role_code='FARMER'$$);
SELECT pg_temp.expect_fail('Không xóa vai trò',    $$DELETE FROM roles WHERE role_code='PROCESSOR'$$);
DO $$
BEGIN
    IF (SELECT string_agg(role_code, ',' ORDER BY role_code) FROM roles WHERE self_register) <> 'DISTRIBUTOR,FARMER,PROCESSOR' THEN
        RAISE EXCEPTION 'FAIL  roles.self_register sai';
    END IF;
    RAISE NOTICE 'PASS  Chỉ FARMER, PROCESSOR, DISTRIBUTOR được tự đăng ký';
END $$;

-- ---------- organizations (US-S03) ----------
SELECT pg_temp.expect_fail('Đơn vị trùng tên và loại',
  $$INSERT INTO organizations (name,type) VALUES ('Nông trại Đắk Lắk','FARM')$$);
SELECT pg_temp.expect_fail('Loại đơn vị không hợp lệ',
  $$INSERT INTO organizations (name,type) VALUES ('Siêu thị','RETAILER')$$);
SELECT pg_temp.expect_fail('Đổi loại đơn vị đã có thành viên',
  $$UPDATE organizations SET type='DISTRIBUTOR' WHERE organization_id=1$$);
SELECT pg_temp.expect_fail('Xóa đơn vị đang có dữ liệu',
  $$DELETE FROM organizations WHERE organization_id=1$$);

-- ---------- Luồng tạo lô hợp lệ (US-B01): batch + QR + CREATED trong một transaction ----------
INSERT INTO batches (batch_code, product_name, origin, quantity, created_by, organization_id)
VALUES ('BATCH-2026-0001', 'Cà phê hữu cơ', 'Đắk Lắk', 500, 2, 1);
INSERT INTO qr_codes (batch_id, qr_data, signature_hmac)
VALUES (1, 'https://example.com/trace/BATCH-2026-0001.sigAAA', 'sigAAA');
INSERT INTO supply_chain_events (batch_id, actor_id, event_type, location)
VALUES (1, 2, 'CREATED', 'Đắk Lắk');
SELECT pg_temp.expect_ok('Tạo lô + QR + CREATED', 'SELECT 1');

-- ---------- products, view farms (migration 003) ----------
INSERT INTO products (organization_id, name, category, unit) VALUES (1, 'Cà phê Arabica', 'Cà phê', 'kg');
SELECT pg_temp.expect_fail('Sản phẩm của đơn vị không phải FARM',
  $$INSERT INTO products (organization_id,name,category) VALUES (2,'Gói chế biến','Khác')$$);
SELECT pg_temp.expect_fail('Trùng tên sản phẩm trong cùng nông trại (khác hoa thường)',
  $$INSERT INTO products (organization_id,name,category) VALUES (1,'CÀ PHÊ ARABICA','Cà phê')$$);
SELECT pg_temp.expect_ok('Nông trại khác được trùng tên sản phẩm',
  $$INSERT INTO products (organization_id,name,category) VALUES (4,'Cà phê Arabica','Cà phê')$$);
SELECT pg_temp.expect_fail('Tên sản phẩm rỗng',
  $$INSERT INTO products (organization_id,name,category) VALUES (1,'  ','Cà phê')$$);
SELECT pg_temp.expect_ok('Lô chỉ gửi product_id: tự lấy product_name từ danh mục',
  $$INSERT INTO batches (batch_code,origin,quantity,created_by,organization_id,product_id)
    VALUES ('BATCH-2026-0050','Đà Lạt',10,2,1,1)$$);
DO $$
BEGIN
    IF (SELECT product_name FROM batches WHERE batch_code = 'BATCH-2026-0050') <> 'Cà phê Arabica' THEN
        RAISE EXCEPTION 'FAIL  product_name không được điền từ products';
    END IF;
    RAISE NOTICE 'PASS  product_name lấy đúng từ products';
END $$;
SELECT pg_temp.expect_fail('Lô dùng sản phẩm của nông trại khác',
  $$INSERT INTO batches (batch_code,product_name,origin,quantity,created_by,organization_id,product_id)
    VALUES ('BATCH-2026-0051','X','Y',1,2,1,2)$$);
SELECT pg_temp.expect_fail('Đổi nông trại của sản phẩm đã có lô',
  $$UPDATE products SET organization_id = 4 WHERE product_id = 1$$);
SELECT pg_temp.expect_fail('Xóa sản phẩm đã có lô', $$DELETE FROM products WHERE product_id = 1$$);
DO $$
BEGIN
    IF (SELECT string_agg(farm_id::text || ':' || product_count || '/' || batch_count, ',' ORDER BY farm_id) FROM farms) <> '1:1/2,4:1/0' THEN -- nông trại 1: BATCH-2026-0001 (tạo ở trên) + 0050
        RAISE EXCEPTION 'FAIL  view farms sai: %', (SELECT string_agg(farm_id::text || ':' || product_count || '/' || batch_count, ',') FROM farms);
    END IF;
    RAISE NOTICE 'PASS  view farms chỉ gồm đơn vị FARM, đếm đúng sản phẩm và lô';
END $$;

-- ---------- batches ----------
SELECT pg_temp.expect_fail('Mã lô trùng',
  $$INSERT INTO batches (batch_code,product_name,origin,quantity,created_by,organization_id) VALUES ('BATCH-2026-0001','X','Y',1,2,1)$$);
SELECT pg_temp.expect_fail('Số lượng <= 0',
  $$INSERT INTO batches (batch_code,product_name,origin,quantity,created_by,organization_id) VALUES ('BATCH-2026-0002','X','Y',0,2,1)$$);
SELECT pg_temp.expect_fail('Distributor tạo lô',
  $$INSERT INTO batches (batch_code,product_name,origin,quantity,created_by,organization_id) VALUES ('BATCH-2026-0003','X','Y',1,4,3)$$);
SELECT pg_temp.expect_fail('Farmer tạo lô cho đơn vị khác',
  $$INSERT INTO batches (batch_code,product_name,origin,quantity,created_by,organization_id) VALUES ('BATCH-2026-0004','X','Y',1,2,4)$$);
SELECT pg_temp.expect_fail('Sai định dạng mã lô',
  $$INSERT INTO batches (batch_code,product_name,origin,quantity,created_by,organization_id) VALUES ('abc','X','Y',1,2,1)$$);
SELECT pg_temp.expect_ok('Sửa lô khi còn CREATED',
  $$UPDATE batches SET quantity=480 WHERE batch_id=1$$);
SELECT pg_temp.expect_fail('Đổi batch_code',
  $$UPDATE batches SET batch_code='BATCH-2026-9999' WHERE batch_id=1$$);
SELECT pg_temp.expect_fail('Nhảy trạng thái trực tiếp',
  $$UPDATE batches SET current_status='PACKAGED' WHERE batch_id=1$$);
SELECT pg_temp.expect_fail('QR thứ hai cho cùng lô',
  $$INSERT INTO qr_codes (batch_id,qr_data,signature_hmac) VALUES (1,'https://example.com/trace/BATCH-2026-0001.sigB','sigB')$$);

-- ---------- supply_chain_events: vai trò và thứ tự ----------
SELECT pg_temp.expect_fail('Processor ghi TRANSPORTED',
  $$INSERT INTO supply_chain_events (batch_id,actor_id,event_type,location) VALUES (1,3,'TRANSPORTED','HCM')$$);
SELECT pg_temp.expect_fail('Nhảy cóc CREATED -> RECEIVED',
  $$INSERT INTO supply_chain_events (batch_id,actor_id,event_type,location) VALUES (1,4,'RECEIVED','HCM')$$);
SELECT pg_temp.expect_ok('Distributor ghi TRANSPORTED',
  $$INSERT INTO supply_chain_events (batch_id,actor_id,event_type,location) VALUES (1,4,'TRANSPORTED','QL14')$$);
SELECT pg_temp.expect_fail('Sự kiện trùng TRANSPORTED',
  $$INSERT INTO supply_chain_events (batch_id,actor_id,event_type,location) VALUES (1,4,'TRANSPORTED','QL14')$$);
SELECT pg_temp.expect_ok('Đủ chuỗi RECEIVED -> PROCESSED -> PACKAGED -> SHIPPED',
  $$INSERT INTO supply_chain_events (batch_id,actor_id,event_type,location) VALUES
      (1,4,'RECEIVED','Kho HCM'),(1,3,'PROCESSED','Xưởng'),(1,3,'PACKAGED','Xưởng'),(1,4,'SHIPPED','Siêu thị')$$);

DO $$
BEGIN
    IF (SELECT current_status FROM batches WHERE batch_id = 1) <> 'SHIPPED' THEN
        RAISE EXCEPTION 'FAIL  current_status không được đồng bộ';
    END IF;
    RAISE NOTICE 'PASS  current_status tự đồng bộ = SHIPPED';
END $$;

SELECT pg_temp.expect_fail('Sửa lô khi đã rời CREATED',
  $$UPDATE batches SET quantity=1 WHERE batch_id=1$$);
SELECT pg_temp.expect_fail('Không ghi tiếp sau SHIPPED',
  $$INSERT INTO supply_chain_events (batch_id,actor_id,event_type,location) VALUES (1,2,'CREATED','X')$$);

-- ---------- Append-only (US-S05, US-S06) ----------
INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_value)
VALUES (2, 'CREATE', 'BATCH', 1, '{"batchCode":"BATCH-2026-0001"}');
SELECT pg_temp.expect_fail('UPDATE sự kiện',  $$UPDATE supply_chain_events SET location='X'$$);
SELECT pg_temp.expect_fail('DELETE sự kiện',  $$DELETE FROM supply_chain_events$$);
SELECT pg_temp.expect_fail('TRUNCATE sự kiện',$$TRUNCATE supply_chain_events$$);
SELECT pg_temp.expect_fail('UPDATE audit',    $$UPDATE audit_logs SET action='UPDATE'$$);
SELECT pg_temp.expect_fail('DELETE audit',    $$DELETE FROM audit_logs$$);
SELECT pg_temp.expect_fail('Audit chứa mật khẩu',
  $$INSERT INTO audit_logs (action,entity_type,new_value) VALUES ('REGISTER','USER','{"password":"x"}')$$);
SELECT pg_temp.expect_fail('Xóa lô đã có sự kiện', $$DELETE FROM batches WHERE batch_id=1$$);

-- ---------- Khóa tài khoản: không ghi được sự kiện nữa (US-S04) ----------
INSERT INTO batches (batch_code, product_name, origin, quantity, created_by, organization_id)
VALUES ('BATCH-2026-0002', 'Sầu riêng', 'Đắk Lắk', 100, 2, 1);
INSERT INTO supply_chain_events (batch_id, actor_id, event_type, location)
SELECT batch_id, 2, 'CREATED', 'Đắk Lắk' FROM batches WHERE batch_code = 'BATCH-2026-0002';
UPDATE users SET status = 'LOCKED' WHERE user_id = 4;
SELECT pg_temp.expect_fail('Tài khoản LOCKED ghi sự kiện',
  $$INSERT INTO supply_chain_events (batch_id,actor_id,event_type,location)
    SELECT batch_id,4,'TRANSPORTED','QL14' FROM batches WHERE batch_code='BATCH-2026-0002'$$);

-- ---------- View công khai không lộ cột nội bộ ----------
DO $$
DECLARE bad text;
BEGIN
    SELECT string_agg(table_name || '.' || column_name, ', ') INTO bad
    FROM information_schema.columns
    WHERE table_name IN ('public_batch_trace','public_event_trace')
      AND column_name ~ '(_id$|email|password|created_by|actor)';
    IF bad IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL  view công khai lộ cột: %', bad;
    END IF;
    RAISE NOTICE 'PASS  view công khai chỉ có cột được phép';
END $$;

-- ---------- event_types (migration 004) ----------
DO $$
BEGIN
    IF (SELECT string_agg(code || ':' || role_code || ':' || sendable, ',' ORDER BY seq_no) FROM event_types)
       <> 'CREATED:FARMER:false,TRANSPORTED:DISTRIBUTOR:true,RECEIVED:DISTRIBUTOR:true,PROCESSED:PROCESSOR:true,PACKAGED:PROCESSOR:true,SHIPPED:DISTRIBUTOR:true' THEN
        RAISE EXCEPTION 'FAIL  event_types sai thứ tự / vai trò';
    END IF;
    RAISE NOTICE 'PASS  event_types: 6 bước đúng thứ tự, vai trò; chỉ CREATED không gửi qua API';
END $$;
SELECT pg_temp.expect_fail('Không sửa event_types', $$UPDATE event_types SET role_code='PROCESSOR' WHERE code='SHIPPED'$$);
SELECT pg_temp.expect_fail('Không xóa event_types', $$DELETE FROM event_types WHERE code='PACKAGED'$$);
DO $$
BEGIN
    UPDATE batches SET current_status = 'LOST' WHERE batch_code = 'BATCH-2026-0050';
    RAISE EXCEPTION 'FAIL  trạng thái không có trong event_types vẫn lưu được';
EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'PASS  Trạng thái lô không có trong event_types bị khóa ngoại chặn (%)', SQLERRM;
END $$;

-- ---------- Chuỗi băm lịch sử (migration 005) ----------
DO $$
DECLARE v record;
BEGIN
    SELECT * INTO v FROM verify_audit_chain();
    IF v.first_broken_audit_id IS NOT NULL OR v.checked <> (SELECT count(*) FROM audit_logs) THEN
        RAISE EXCEPTION 'FAIL  chuỗi audit báo hỏng: %', v.reason;
    END IF;
    SELECT * INTO v FROM verify_batch_events(1);
    IF v.first_broken_event_id IS NOT NULL OR v.checked <> 6 THEN
        RAISE EXCEPTION 'FAIL  chuỗi sự kiện lô 1: % / %', v.checked, v.reason;
    END IF;
    IF EXISTS (SELECT 1 FROM audit_logs a JOIN audit_logs b ON b.chain_seq = a.chain_seq + 1 WHERE b.prev_hash <> a.row_hash) THEN
        RAISE EXCEPTION 'FAIL  prev_hash không nối với dòng trước';
    END IF;
    RAISE NOTICE 'PASS  Chuỗi băm audit và sự kiện toàn vẹn sau các thao tác hợp lệ';
END $$;
DO $$
DECLARE r audit_logs%ROWTYPE; v_max bigint := (SELECT max(chain_seq) FROM audit_logs);
BEGIN
    -- Backend gửi giá trị giả cho các cột chuỗi băm: trigger phải bỏ qua và tự cấp giá trị đúng.
    INSERT INTO audit_logs (action, entity_type, chain_seq, prev_hash, row_hash)
    VALUES ('CREATE', 'USER', 1, repeat('a', 64), repeat('b', 64)) RETURNING * INTO r;
    IF r.chain_seq <> v_max + 1 OR r.row_hash = repeat('b', 64)
       OR r.prev_hash <> (SELECT row_hash FROM audit_logs WHERE chain_seq = v_max) THEN
        RAISE EXCEPTION 'FAIL  trigger không tự cấp chain_seq / hash';
    END IF;
    RAISE NOTICE 'PASS  Cột chuỗi băm do trigger cấp, giá trị gửi từ ngoài bị bỏ qua';
END $$;

-- Mô phỏng quản trị viên tắt trigger rồi sửa / xóa lịch sử: chuỗi băm phải phát hiện (dữ liệu được ROLLBACK cuối file).
ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_append_only;
UPDATE audit_logs SET new_value = '{"batchCode":"BATCH-2026-9999"}' WHERE audit_id = (SELECT min(audit_id) FROM audit_logs);
DO $$
DECLARE v record;
BEGIN
    SELECT * INTO v FROM verify_audit_chain();
    IF v.first_broken_audit_id IS DISTINCT FROM (SELECT min(audit_id) FROM audit_logs) OR v.reason NOT LIKE '%bị sửa%' THEN
        RAISE EXCEPTION 'FAIL  sửa audit không bị phát hiện (%, %)', v.first_broken_audit_id, v.reason;
    END IF;
    RAISE NOTICE 'PASS  Sửa nội dung audit bị phát hiện ở đúng dòng';
END $$;
ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_append_only;

ALTER TABLE supply_chain_events DISABLE TRIGGER trg_events_append_only;
DELETE FROM supply_chain_events WHERE batch_id = 1 AND event_type = 'RECEIVED';
UPDATE supply_chain_events SET location = 'Đổi địa điểm' WHERE batch_id = 1 AND event_type = 'TRANSPORTED';
DO $$
DECLARE v record;
BEGIN
    SELECT * INTO v FROM verify_batch_events(1);
    IF v.first_broken_event_id IS NULL OR v.checked <> 1 THEN
        RAISE EXCEPTION 'FAIL  sửa/xóa sự kiện không bị phát hiện (%, %)', v.checked, v.reason;
    END IF;
    RAISE NOTICE 'PASS  Sửa / xóa sự kiện bị phát hiện (%)', v.reason;
END $$;
ALTER TABLE supply_chain_events ENABLE TRIGGER trg_events_append_only;

-- ---------- Chỉ mục batch_code và truy vấn danh sách (migration 007, W7) ----------
DO $$
DECLARE missing text;
BEGIN
    SELECT string_agg(i, ', ') INTO missing
    FROM unnest(ARRAY['idx_batches_code_year_seq','idx_batches_product_name_trgm','idx_batches_batch_code_trgm',
                      'idx_batches_created_desc','idx_batches_org_created_desc','idx_batches_status_created',
                      'idx_audit_created_desc','idx_audit_type_created','idx_audit_actor_created',
                      'idx_events_actor_batch','uq_batches_batch_code']) AS i
    WHERE to_regclass(i) IS NULL;
    IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL  thiếu chỉ mục: %', missing; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        RAISE EXCEPTION 'FAIL  chưa cài extension pg_trgm';
    END IF;
    IF to_regclass('idx_batches_organization') IS NOT NULL OR to_regclass('idx_audit_created_at') IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL  chỉ mục cũ trùng chức năng chưa được xóa';
    END IF;
    RAISE NOTICE 'PASS  đủ chỉ mục của migration 007 và pg_trgm';
END $$;

-- Cấp mã lô theo SỐ, không theo chuỗi: ...-9999 < ...-10000 (câu SQL giống nextBatchCode trong batches.repository.js)
INSERT INTO batches (batch_code, product_name, origin, quantity, created_by, organization_id)
SELECT format('BATCH-%s-%s', EXTRACT(YEAR FROM now())::int, n), 'Gạo', 'Sóc Trăng', 1, 2, 1
FROM unnest(ARRAY['9999','10000']) AS n;
DO $$
DECLARE max_seq int;
BEGIN
    SELECT COALESCE((SELECT split_part(batch_code, '-', 3)::int FROM batches
                     WHERE split_part(batch_code, '-', 2)::int = EXTRACT(YEAR FROM now())::int
                     ORDER BY split_part(batch_code, '-', 3)::int DESC LIMIT 1), 0) INTO max_seq;
    IF max_seq <> 10000 THEN RAISE EXCEPTION 'FAIL  số thứ tự lớn nhất phải là 10000, nhận %', max_seq; END IF;
    RAISE NOTICE 'PASS  cấp mã lô lấy số lớn nhất theo giá trị số (10000 > 9999)';
END $$;

-- Kế hoạch truy vấn: tắt quét tuần tự để chắc chắn PostgreSQL DÙNG ĐƯỢC chỉ mục với đúng biểu thức của backend
-- (bảng thử nhỏ nên bình thường planner vẫn chọn quét tuần tự; số đo thật xem docs/security/query-optimization.md).
CREATE FUNCTION pg_temp.expect_index(label text, query text, idx text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE line text; plan text := '';
BEGIN
    FOR line IN EXECUTE 'EXPLAIN (COSTS OFF) ' || query LOOP plan := plan || line || E'\n'; END LOOP;
    IF position(idx IN plan) = 0 THEN
        RAISE EXCEPTION 'FAIL  % – không dùng chỉ mục %:%', label, idx, E'\n' || plan;
    END IF;
    RAISE NOTICE 'PASS  % dùng %', label, idx;
END $$;
SET LOCAL enable_seqscan = off;
SELECT pg_temp.expect_index('cấp mã lô (nextBatchCode)',
  $$SELECT split_part(batch_code, '-', 3)::int FROM batches
    WHERE split_part(batch_code, '-', 2)::int = 2026 ORDER BY split_part(batch_code, '-', 3)::int DESC LIMIT 1$$,
  'idx_batches_code_year_seq');
SELECT pg_temp.expect_index('tra cứu đúng một mã lô (QR)',
  $$SELECT * FROM batches WHERE batch_code = 'BATCH-2026-0001'$$, 'uq_batches_batch_code');
SELECT pg_temp.expect_index('tìm kiếm q trong mã lô',
  $$SELECT batch_id FROM batches b WHERE b.batch_code ILIKE '%2026-00%'$$, 'idx_batches_batch_code_trgm');
SELECT pg_temp.expect_index('tìm kiếm q trong tên sản phẩm',
  $$SELECT batch_id FROM batches b WHERE b.product_name ILIKE '%cà phê%'$$, 'idx_batches_product_name_trgm');
SELECT pg_temp.expect_index('danh sách lô của Farmer',
  $$SELECT batch_id FROM batches b WHERE b.organization_id = 1 ORDER BY b.creation_date DESC, b.batch_id DESC LIMIT 20$$,
  'idx_batches_org_created_desc');
SELECT pg_temp.expect_index('danh sách audit mới nhất',
  $$SELECT audit_id FROM audit_logs a ORDER BY a.created_at DESC, a.audit_id DESC LIMIT 20$$, 'idx_audit_created_desc');
SET LOCAL enable_seqscan = on;

-- ---------- Vai trò CSDL fsc_app (migration 006) ----------
CREATE FUNCTION pg_temp.as_app(label text, stmt text, should_fail boolean) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE 'SET LOCAL ROLE fsc_app';
        EXECUTE stmt;
        EXECUTE 'RESET ROLE';
    EXCEPTION WHEN OTHERS THEN
        IF should_fail AND SQLSTATE = '42501' THEN RAISE NOTICE 'PASS  fsc_app: %  (%)', label, SQLERRM; RETURN; END IF;
        RAISE EXCEPTION 'FAIL  fsc_app: % – % (%)', label, SQLERRM, SQLSTATE;
    END;
    IF should_fail THEN RAISE EXCEPTION 'FAIL  fsc_app: % – lẽ ra bị từ chối', label; END IF;
    RAISE NOTICE 'PASS  fsc_app: %', label;
END $$;
SELECT pg_temp.as_app('đọc lô và timeline công khai', $$SELECT count(*) FROM batches, public_event_trace$$, false);
SELECT pg_temp.as_app('ghi audit (chuỗi băm vẫn chạy)',
  $$INSERT INTO audit_logs (actor_id,action,entity_type,entity_id) VALUES (1,'UPDATE','USER',1)$$, false);
SELECT pg_temp.as_app('UPDATE audit_logs bị từ chối',   $$UPDATE audit_logs SET action='LOCK'$$, true);
SELECT pg_temp.as_app('DELETE audit_logs bị từ chối',   $$DELETE FROM audit_logs$$, true);
SELECT pg_temp.as_app('UPDATE sự kiện bị từ chối',      $$UPDATE supply_chain_events SET location='X'$$, true);
SELECT pg_temp.as_app('TRUNCATE sự kiện bị từ chối',    $$TRUNCATE supply_chain_events$$, true);
SELECT pg_temp.as_app('DELETE lô bị từ chối',           $$DELETE FROM batches$$, true);
SELECT pg_temp.as_app('sửa event_types bị từ chối',     $$UPDATE event_types SET name='X'$$, true);
SELECT pg_temp.as_app('tắt trigger bị từ chối',         $$ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_append_only$$, true);

SELECT 'ALL CHECKS PASSED' AS result;

ROLLBACK;
