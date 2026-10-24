-- =============================================================================
-- Kiểm tra nhanh schema.sql v1 (W3-TV3)
-- Chạy trên CSDL vừa tạo từ schema.sql (các bảng còn trống):
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
    IF EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM organizations) OR EXISTS (SELECT 1 FROM batches) THEN
        RAISE EXCEPTION 'CSDL đã có dữ liệu – hãy chạy kiểm thử trên CSDL mới tạo từ schema.sql';
    END IF;
END $$;
ALTER TABLE organizations       ALTER COLUMN organization_id RESTART WITH 1;
ALTER TABLE users               ALTER COLUMN user_id         RESTART WITH 1;
ALTER TABLE batches             ALTER COLUMN batch_id        RESTART WITH 1;
ALTER TABLE qr_codes            ALTER COLUMN qr_id           RESTART WITH 1;
ALTER TABLE supply_chain_events ALTER COLUMN event_id        RESTART WITH 1;
ALTER TABLE audit_logs          ALTER COLUMN audit_id        RESTART WITH 1;

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

SELECT 'ALL CHECKS PASSED' AS result;

ROLLBACK;
