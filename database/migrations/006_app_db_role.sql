-- =============================================================================
-- Migration 006 – vai trò CSDL quyền tối thiểu cho backend (W6-TV3)
--
-- Phân quyền theo vai trò ở mức CSDL: backend nên kết nối bằng `fsc_app` thay vì superuser `postgres`.
--   * audit_logs, supply_chain_events, qr_codes : chỉ SELECT + INSERT (không UPDATE / DELETE / TRUNCATE)
--   * roles, event_types, schema_migrations      : chỉ SELECT
--   * organizations, users, products, batches    : SELECT, INSERT, UPDATE (không DELETE)
-- Như vậy kể cả khi backend có lỗi hoặc bị chiếm quyền, câu lệnh sửa/xóa lịch sử bị chính PostgreSQL từ chối
-- (lớp chặn thứ hai, ngoài trigger append-only và chuỗi băm).
--
-- Vai trò được tạo ở dạng NOLOGIN. Bật đăng nhập (một lần, ngoài migration, không commit mật khẩu):
--   ALTER ROLE fsc_app LOGIN PASSWORD '<mật khẩu>';
-- rồi đặt DB_USER=fsc_app, DB_PASSWORD=<mật khẩu> cho backend. Migration vẫn chạy bằng tài khoản quản trị.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fsc_app') THEN
        CREATE ROLE fsc_app NOLOGIN;
    END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM fsc_app;
GRANT USAGE ON SCHEMA public TO fsc_app;

GRANT SELECT, INSERT, UPDATE ON organizations, users, products, batches TO fsc_app;
GRANT SELECT, INSERT         ON audit_logs, supply_chain_events, qr_codes TO fsc_app;
GRANT SELECT                 ON roles, event_types TO fsc_app;
GRANT SELECT                 ON public_batch_trace, public_event_trace, farms TO fsc_app;

DO $$
BEGIN
    IF to_regclass('public.schema_migrations') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT ON schema_migrations TO fsc_app';
    END IF;
END $$;

-- Cột IDENTITY cần quyền dùng sequence khi INSERT.
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO fsc_app;

-- Không cho tạo bảng / hàm mới trong schema public.
REVOKE CREATE ON SCHEMA public FROM fsc_app;
