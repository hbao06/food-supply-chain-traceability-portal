-- =============================================================================
-- Migration 004 – bảng event_types (W6-TV3)
--
-- Kế hoạch tuần 6: "Tạo SupplyChainEvent, EventType, AuditLog; quy tắc chỉ thêm lịch sử và phân quyền theo vai trò".
-- supply_chain_events và audit_logs đã có từ 001. Migration này tách EventType ra bảng tra cứu:
--   * thứ tự các bước (seq_no) và vai trò được ghi từng bước (role_code) nằm trong DỮ LIỆU,
--     thay cho danh sách viết cứng trong hàm event_type_position / event_type_role;
--   * batches.current_status và supply_chain_events.event_type thành khóa ngoại tới event_types;
--   * sendable = FALSE với CREATED (do hệ thống ghi khi tạo lô, không gửi qua API).
-- Giá trị mã không đổi (CREATED → SHIPPED), nên backend, OpenAPI và dữ liệu cũ không phải sửa.
-- =============================================================================

CREATE TABLE event_types (
    code         VARCHAR(20)  PRIMARY KEY,
    seq_no       SMALLINT     NOT NULL,
    role_code    VARCHAR(20)  NOT NULL REFERENCES roles (role_code) ON DELETE RESTRICT,
    name         VARCHAR(50)  NOT NULL,
    description  VARCHAR(255) NOT NULL,
    sendable     BOOLEAN      NOT NULL,

    CONSTRAINT chk_event_types_code_format CHECK (code ~ '^[A-Z_]{3,20}$'),
    CONSTRAINT chk_event_types_seq_positive CHECK (seq_no >= 1),
    CONSTRAINT uq_event_types_seq UNIQUE (seq_no)
);

COMMENT ON TABLE  event_types           IS 'Loại sự kiện / trạng thái lô theo thứ tự. Dữ liệu cố định, chặn sửa/xóa.';
COMMENT ON COLUMN event_types.seq_no    IS 'Thứ tự bước: sự kiện mới phải có seq_no = seq_no của trạng thái hiện tại + 1.';
COMMENT ON COLUMN event_types.role_code IS 'Vai trò duy nhất được ghi loại sự kiện này.';
COMMENT ON COLUMN event_types.sendable  IS 'FALSE: hệ thống tự ghi (CREATED), không nhận qua POST /batches/{id}/events.';

INSERT INTO event_types (code, seq_no, role_code, name, description, sendable) VALUES
    ('CREATED',     1, 'FARMER',      'Khởi tạo',       'Nông trại tạo lô (hệ thống tự ghi)',         FALSE),
    ('TRANSPORTED', 2, 'DISTRIBUTOR', 'Vận chuyển',     'Lô rời nông trại, đang vận chuyển',           TRUE),
    ('RECEIVED',    3, 'DISTRIBUTOR', 'Nhận hàng',      'Lô đã tới kho / điểm nhận',                   TRUE),
    ('PROCESSED',   4, 'PROCESSOR',   'Chế biến',       'Lô đã qua chế biến',                          TRUE),
    ('PACKAGED',    5, 'PROCESSOR',   'Đóng gói',       'Lô đã đóng gói thành phẩm',                   TRUE),
    ('SHIPPED',     6, 'DISTRIBUTOR', 'Giao bán',       'Lô đã giao tới điểm bán',                     TRUE);

-- Dữ liệu tra cứu cố định: chặn sửa / xóa (thêm loại mới bằng migration mới).
CREATE FUNCTION forbid_lookup_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Bảng % là dữ liệu cố định, không được %; thay đổi bằng migration', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER trg_event_types_read_only
    BEFORE UPDATE OR DELETE ON event_types
    FOR EACH ROW EXECUTE FUNCTION forbid_lookup_change();

-- CHECK theo danh sách viết cứng -> khóa ngoại tới event_types.
ALTER TABLE batches DROP CONSTRAINT chk_batches_status;
ALTER TABLE batches
    ADD CONSTRAINT fk_batches_status FOREIGN KEY (current_status)
        REFERENCES event_types (code) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE supply_chain_events DROP CONSTRAINT chk_events_type;
ALTER TABLE supply_chain_events
    ADD CONSTRAINT fk_events_type FOREIGN KEY (event_type)
        REFERENCES event_types (code) ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Hai hàm trigger check_event_rules / check_batch_rules đang dùng: giữ nguyên tên và kiểu trả về,
-- đổi sang đọc từ bảng (STABLE thay cho IMMUTABLE vì phụ thuộc dữ liệu).
CREATE OR REPLACE FUNCTION event_type_position(t text) RETURNS int
LANGUAGE sql STABLE AS $$
    SELECT seq_no::int FROM event_types WHERE code = t
$$;

CREATE OR REPLACE FUNCTION event_type_role(t text) RETURNS text
LANGUAGE sql STABLE AS $$
    SELECT role_code::text FROM event_types WHERE code = t
$$;
