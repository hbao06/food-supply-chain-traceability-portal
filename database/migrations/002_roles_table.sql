-- =============================================================================
-- Migration 002 – bảng roles (W4-TV3)
--
-- Tách vai trò ra bảng tra cứu `roles` thay cho CHECK chk_users_role:
--   * users.role là khóa ngoại tới roles.role_code (giá trị vẫn là FARMER, PROCESSOR,
--     DISTRIBUTOR, ADMIN – không đổi gì với backend và OpenAPI);
--   * roles.self_register cho biết vai trò nào được tự chọn khi đăng ký (Admin thì không).
-- Danh sách quyền theo vai trò nằm trong backend/src/middleware/rbac.js (theo docs/permission-matrix.md).
--
-- roles là dữ liệu cố định: trigger trên các bảng khác và middleware RBAC dựa vào mã vai trò,
-- nên chặn UPDATE / DELETE. Thêm vai trò mới phải qua migration mới.
-- =============================================================================

CREATE TABLE roles (
    role_code      VARCHAR(20)  PRIMARY KEY,
    name           VARCHAR(50)  NOT NULL,
    description    VARCHAR(255) NOT NULL,
    self_register  BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT chk_roles_code_format CHECK (role_code ~ '^[A-Z_]{3,20}$')
);

COMMENT ON TABLE  roles               IS 'Vai trò tài khoản nội bộ (Consumer không có tài khoản nên không có ở đây).';
COMMENT ON COLUMN roles.self_register IS 'TRUE: được chọn khi tự đăng ký (POST /auth/register).';

INSERT INTO roles (role_code, name, description, self_register) VALUES
    ('ADMIN',       'Quản trị viên',  'Duyệt tài khoản, quản lý đơn vị, xem audit log', FALSE),
    ('FARMER',      'Nhà sản xuất',   'Tạo và cập nhật lô của đơn vị mình',              TRUE),
    ('PROCESSOR',   'Nhà chế biến',   'Ghi sự kiện PROCESSED, PACKAGED',                 TRUE),
    ('DISTRIBUTOR', 'Nhà phân phối',  'Ghi sự kiện TRANSPORTED, RECEIVED, SHIPPED',      TRUE);

ALTER TABLE users DROP CONSTRAINT chk_users_role;

ALTER TABLE users
    ADD CONSTRAINT fk_users_role FOREIGN KEY (role)
        REFERENCES roles (role_code) ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE INDEX idx_users_role ON users (role);

CREATE FUNCTION forbid_role_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Bảng roles là dữ liệu cố định, không được %; thêm vai trò mới bằng migration', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER trg_roles_read_only
    BEFORE UPDATE OR DELETE ON roles
    FOR EACH ROW EXECUTE FUNCTION forbid_role_change();
