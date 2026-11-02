-- =============================================================================
-- Food Supply Chain Traceability & Provenance Portal – Nhóm 13
-- schema.sql v1 (W3-TV3)            PostgreSQL 16
--
-- Người phụ trách: Đặng Vĩnh Quang (TV3 - Database / Auth / Security)
-- Người review   : Chung Nguyễn Minh Trí (TV2 - Backend / API)
--
-- Nguồn:  docs/ERD/Readme.md (ERD v3), docs/UML/class-diagram.dot,
--         docs/openapi-spec.yaml, docs/permission-matrix.md,
--         docs/SRS/user-stories-security-data.md, docs/SRS/user-stories-batch.md
--
-- Quy ước đặt tên: bảng số nhiều, cột snake_case. Backend ánh xạ sang camelCase
-- của OpenAPI (batch_code <-> batchCode, current_status <-> currentStatus, ...).
--
-- Chạy:  psql -U postgres -d food_traceability -f database/schema.sql
-- Toàn bộ file chạy trong một transaction: lỗi ở đâu thì không tạo gì cả.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Hàm dùng chung
-- -----------------------------------------------------------------------------

-- Tự cập nhật cột updated_at khi UPDATE.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

-- Chặn UPDATE / DELETE / TRUNCATE trên bảng chỉ-ghi-thêm (append-only).
-- Áp dụng cả với superuser vì trigger luôn chạy (trừ khi bị tắt thủ công).
CREATE FUNCTION forbid_modification() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Bảng % chỉ cho phép INSERT (append-only); không được %',
        TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'Muốn điều chỉnh thì ghi thêm bản ghi mới.';
END $$;

-- Thứ tự trạng thái lô / loại sự kiện (EventType trong OpenAPI).
-- Trả về vị trí 1..6, NULL nếu không hợp lệ.
CREATE FUNCTION event_type_position(t text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
    SELECT array_position(
        ARRAY['CREATED','TRANSPORTED','RECEIVED','PROCESSED','PACKAGED','SHIPPED'], t)
$$;

-- Vai trò được ghi từng loại sự kiện (theo openapi-spec.yaml, POST /batches/{id}/events).
CREATE FUNCTION event_type_role(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE t
        WHEN 'CREATED'     THEN 'FARMER'
        WHEN 'TRANSPORTED' THEN 'DISTRIBUTOR'
        WHEN 'RECEIVED'    THEN 'DISTRIBUTOR'
        WHEN 'SHIPPED'     THEN 'DISTRIBUTOR'
        WHEN 'PROCESSED'   THEN 'PROCESSOR'
        WHEN 'PACKAGED'    THEN 'PROCESSOR'
    END
$$;

-- Loại đơn vị tương ứng với vai trò (US-S01).
CREATE FUNCTION org_type_for_role(r text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE r
        WHEN 'FARMER'      THEN 'FARM'
        WHEN 'PROCESSOR'   THEN 'PROCESSOR'
        WHEN 'DISTRIBUTOR' THEN 'DISTRIBUTOR'
    END
$$;

-- -----------------------------------------------------------------------------
-- 1. organizations – đơn vị tham gia chuỗi cung ứng (US-S03)
-- -----------------------------------------------------------------------------
CREATE TABLE organizations (
    organization_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name             VARCHAR(150) NOT NULL,
    type             VARCHAR(20)  NOT NULL,
    address          VARCHAR(255),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT chk_organizations_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT chk_organizations_type CHECK (type IN ('FARM','PROCESSOR','DISTRIBUTOR')),
    CONSTRAINT uq_organizations_name_type UNIQUE (name, type)
);

COMMENT ON TABLE  organizations      IS 'Đơn vị trong chuỗi cung ứng. Không có endpoint xóa (US-S03).';
COMMENT ON COLUMN organizations.type IS 'FARM | PROCESSOR | DISTRIBUTOR – phải khớp vai trò của thành viên.';

-- -----------------------------------------------------------------------------
-- 2. users – tài khoản nội bộ (Consumer không có tài khoản)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    user_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id  BIGINT REFERENCES organizations (organization_id) ON DELETE RESTRICT,
    name             VARCHAR(100) NOT NULL,
    email            VARCHAR(255) NOT NULL,
    password_hash    VARCHAR(255) NOT NULL,
    role             VARCHAR(20)  NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT chk_users_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT chk_users_email_format   CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    -- bcrypt hash luôn bắt đầu bằng $2a$ / $2b$ / $2y$ và dài 60 ký tự:
    -- chặn việc lỡ lưu mật khẩu dạng văn bản thuần.
    CONSTRAINT chk_users_password_is_bcrypt CHECK (password_hash ~ '^\$2[aby]\$\d{2}\$.{53}$'),
    CONSTRAINT chk_users_role   CHECK (role   IN ('FARMER','PROCESSOR','DISTRIBUTOR','ADMIN')),
    CONSTRAINT chk_users_status CHECK (status IN ('PENDING','ACTIVE','LOCKED')),
    -- Admin không thuộc đơn vị nào.
    CONSTRAINT chk_users_admin_no_org CHECK (role <> 'ADMIN' OR organization_id IS NULL),
    -- Tài khoản nghiệp vụ phải có đơn vị trước khi được kích hoạt (US-S01 AC02).
    CONSTRAINT chk_users_active_has_org
        CHECK (role = 'ADMIN' OR status <> 'ACTIVE' OR organization_id IS NOT NULL)
);

-- Email duy nhất, không phân biệt hoa thường.
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));
CREATE INDEX idx_users_organization ON users (organization_id);
CREATE INDEX idx_users_status       ON users (status);

COMMENT ON TABLE  users               IS 'Tài khoản nội bộ. Đăng ký mới ở PENDING, Admin duyệt và gán đơn vị (US-S01).';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash. Không bao giờ trả ra API.';

-- Ràng buộc liên bảng cho users (US-S01, US-S04).
CREATE FUNCTION check_user_rules() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_org_type text;
BEGIN
    -- Vai trò phải khớp loại đơn vị.
    IF NEW.organization_id IS NOT NULL THEN
        SELECT type INTO v_org_type FROM organizations WHERE organization_id = NEW.organization_id;
        IF v_org_type IS DISTINCT FROM org_type_for_role(NEW.role) THEN
            RAISE EXCEPTION 'Vai trò % không khớp loại đơn vị %', NEW.role, v_org_type
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    -- Không để hệ thống mất Admin ACTIVE cuối cùng.
    IF TG_OP = 'UPDATE'
       AND OLD.role = 'ADMIN' AND OLD.status = 'ACTIVE'
       AND (NEW.role <> 'ADMIN' OR NEW.status <> 'ACTIVE')
       AND NOT EXISTS (SELECT 1 FROM users
                       WHERE role = 'ADMIN' AND status = 'ACTIVE' AND user_id <> OLD.user_id)
    THEN
        RAISE EXCEPTION 'Không thể hạ quyền hoặc khóa Admin ACTIVE cuối cùng'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END $$;

CREATE TRIGGER trg_users_rules
    BEFORE INSERT OR UPDATE OF organization_id, role, status ON users
    FOR EACH ROW EXECUTE FUNCTION check_user_rules();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Không đổi loại đơn vị khi đã có thành viên hoặc lô (US-S03 AC03).
CREATE FUNCTION check_organization_type_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.type <> OLD.type AND (
           EXISTS (SELECT 1 FROM users   WHERE organization_id = OLD.organization_id)
        OR EXISTS (SELECT 1 FROM batches WHERE organization_id = OLD.organization_id))
    THEN
        RAISE EXCEPTION 'Đơn vị % đã có thành viên hoặc lô, không được đổi loại', OLD.organization_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

-- (trigger cho organizations được tạo sau khi có bảng batches – xem mục 3)

-- -----------------------------------------------------------------------------
-- 3. batches – lô thực phẩm (US-B01..B05)
-- -----------------------------------------------------------------------------
CREATE TABLE batches (
    batch_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_code       VARCHAR(30)   NOT NULL,
    product_name     VARCHAR(150)  NOT NULL,
    origin           VARCHAR(255)  NOT NULL,
    quantity         NUMERIC(12,2) NOT NULL,
    creation_date    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    current_status   VARCHAR(20)   NOT NULL DEFAULT 'CREATED',
    created_by       BIGINT        NOT NULL REFERENCES users (user_id)                 ON DELETE RESTRICT,
    organization_id  BIGINT        NOT NULL REFERENCES organizations (organization_id) ON DELETE RESTRICT,
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_batches_batch_code UNIQUE (batch_code),
    CONSTRAINT chk_batches_batch_code_format CHECK (batch_code ~ '^BATCH-[0-9]{4}-[0-9]{4,}$'),
    CONSTRAINT chk_batches_product_not_blank CHECK (btrim(product_name) <> ''),
    CONSTRAINT chk_batches_origin_not_blank  CHECK (btrim(origin) <> ''),
    CONSTRAINT chk_batches_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_batches_status CHECK (event_type_position(current_status) IS NOT NULL)
);

-- uq_batches_batch_code đã tạo chỉ mục cho batch_code (tra cứu công khai /trace/code/{batchCode}).
CREATE INDEX idx_batches_organization ON batches (organization_id);
CREATE INDEX idx_batches_created_by   ON batches (created_by);
CREATE INDEX idx_batches_status       ON batches (current_status);

COMMENT ON TABLE  batches                IS 'Lô thực phẩm. Không có DELETE; chỉ sửa khi current_status = CREATED.';
COMMENT ON COLUMN batches.batch_code     IS 'Mã công khai, dạng BATCH-YYYY-NNNN, in lên QR và nhập tay.';
COMMENT ON COLUMN batches.current_status IS 'Đồng bộ tự động với sự kiện mới nhất (trigger trên supply_chain_events).';
COMMENT ON COLUMN batches.organization_id IS 'Đơn vị sở hữu lô – dùng cho phạm vi đọc/sửa của Farmer.';

-- Quy tắc ghi cho batches.
CREATE FUNCTION check_batch_rules() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_user users%ROWTYPE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Chỉ Farmer ACTIVE tạo lô cho chính đơn vị của mình (US-B01).
        SELECT * INTO v_user FROM users WHERE user_id = NEW.created_by;
        IF v_user.role IS DISTINCT FROM 'FARMER' OR v_user.status IS DISTINCT FROM 'ACTIVE'
           OR v_user.organization_id IS DISTINCT FROM NEW.organization_id THEN
            RAISE EXCEPTION 'Chỉ Farmer ACTIVE được tạo lô cho đơn vị của mình'
                USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.current_status <> 'CREATED' THEN
            RAISE EXCEPTION 'Lô mới phải ở trạng thái CREATED' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE: các trường định danh không bao giờ đổi.
    IF NEW.batch_code      <> OLD.batch_code
       OR NEW.created_by      <> OLD.created_by
       OR NEW.organization_id <> OLD.organization_id
       OR NEW.creation_date   <> OLD.creation_date THEN
        RAISE EXCEPTION 'Không được sửa batch_code, created_by, organization_id, creation_date'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Thông tin mô tả chỉ sửa được khi lô còn CREATED (US-B02).
    IF (NEW.product_name, NEW.origin, NEW.quantity) IS DISTINCT FROM
       (OLD.product_name, OLD.origin, OLD.quantity)
       AND OLD.current_status <> 'CREATED' THEN
        RAISE EXCEPTION 'Chỉ được sửa lô ở trạng thái CREATED (hiện tại: %)', OLD.current_status
            USING ERRCODE = 'check_violation';
    END IF;

    -- Trạng thái chỉ được tiến đúng một bước (thực tế do trigger của sự kiện cập nhật).
    IF NEW.current_status <> OLD.current_status
       AND event_type_position(NEW.current_status) <> event_type_position(OLD.current_status) + 1 THEN
        RAISE EXCEPTION 'Không được chuyển trạng thái từ % sang %', OLD.current_status, NEW.current_status
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END $$;

CREATE TRIGGER trg_batches_rules
    BEFORE INSERT OR UPDATE ON batches
    FOR EACH ROW EXECUTE FUNCTION check_batch_rules();

CREATE TRIGGER trg_batches_updated_at
    BEFORE UPDATE ON batches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_organizations_type_change
    BEFORE UPDATE OF type ON organizations
    FOR EACH ROW EXECUTE FUNCTION check_organization_type_change();

CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. qr_codes – mỗi lô đúng một QR, tạo cùng transaction với lô (FR-QR-01)
-- -----------------------------------------------------------------------------
CREATE TABLE qr_codes (
    qr_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id         BIGINT       NOT NULL REFERENCES batches (batch_id) ON DELETE RESTRICT,
    qr_data          VARCHAR(512) NOT NULL,
    signature_hmac   VARCHAR(128) NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_qr_codes_batch   UNIQUE (batch_id),
    CONSTRAINT uq_qr_codes_qr_data UNIQUE (qr_data),
    CONSTRAINT chk_qr_codes_qr_data_contains_signature CHECK (position(signature_hmac IN qr_data) > 0)
);

COMMENT ON TABLE  qr_codes                IS 'QR của lô. qr_data = <traceUrl>/trace/<qrToken>, qrToken = <batch_code>.<signature_hmac> (SRS P1).';
COMMENT ON COLUMN qr_codes.signature_hmac IS 'base64url(HMAC-SHA256(QR_HMAC_SECRET, batch_code)). Khóa bí mật không lưu trong CSDL.';

-- -----------------------------------------------------------------------------
-- 5. supply_chain_events – sự kiện chuỗi cung ứng (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE supply_chain_events (
    event_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id         BIGINT       NOT NULL REFERENCES batches (batch_id) ON DELETE RESTRICT,
    actor_id         BIGINT       NOT NULL REFERENCES users (user_id)    ON DELETE RESTRICT,
    event_type       VARCHAR(20)  NOT NULL,
    "timestamp"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    location         VARCHAR(255) NOT NULL,
    description      TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT chk_events_type CHECK (event_type_position(event_type) IS NOT NULL),
    CONSTRAINT chk_events_location_not_blank CHECK (btrim(location) <> ''),
    -- Chuỗi trạng thái tuyến tính: mỗi loại sự kiện xuất hiện tối đa một lần trong một lô.
    CONSTRAINT uq_events_batch_type UNIQUE (batch_id, event_type)
);

CREATE INDEX idx_events_batch_time ON supply_chain_events (batch_id, "timestamp");
CREATE INDEX idx_events_actor      ON supply_chain_events (actor_id);

COMMENT ON TABLE  supply_chain_events             IS 'Lịch sử lô. Chỉ INSERT. INSERT sự kiện tự cập nhật batches.current_status.';
COMMENT ON COLUMN supply_chain_events."timestamp" IS 'Thời điểm sự kiện xảy ra (API: timestamp). created_at là lúc ghi vào hệ thống.';

-- Kiểm tra vai trò, thứ tự và đồng bộ batches.current_status.
CREATE FUNCTION check_event_rules() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_batch batches%ROWTYPE;
    v_actor users%ROWTYPE;
BEGIN
    -- Khóa dòng lô để hai sự kiện đồng thời không cùng vượt qua kiểm tra thứ tự.
    SELECT * INTO v_batch FROM batches WHERE batch_id = NEW.batch_id FOR UPDATE;
    SELECT * INTO v_actor FROM users   WHERE user_id  = NEW.actor_id;

    IF v_actor.status IS DISTINCT FROM 'ACTIVE' THEN
        RAISE EXCEPTION 'Người ghi sự kiện phải ở trạng thái ACTIVE' USING ERRCODE = 'check_violation';
    END IF;

    IF v_actor.role IS DISTINCT FROM event_type_role(NEW.event_type) THEN
        RAISE EXCEPTION 'Vai trò % không được ghi sự kiện %', v_actor.role, NEW.event_type
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.event_type = 'CREATED' THEN
        -- Sự kiện khởi tạo: do Farmer của đơn vị sở hữu ghi, lô chưa có sự kiện nào.
        IF v_actor.organization_id IS DISTINCT FROM v_batch.organization_id
           OR EXISTS (SELECT 1 FROM supply_chain_events WHERE batch_id = NEW.batch_id) THEN
            RAISE EXCEPTION 'Sự kiện CREATED không hợp lệ cho lô %', NEW.batch_id
                USING ERRCODE = 'check_violation';
        END IF;
    ELSIF event_type_position(NEW.event_type) <> event_type_position(v_batch.current_status) + 1 THEN
        RAISE EXCEPTION 'Sự kiện % không hợp lệ sau trạng thái %', NEW.event_type, v_batch.current_status
            USING ERRCODE = 'check_violation';
    ELSE
        -- Hợp lệ: đồng bộ trạng thái lô ngay (cùng transaction với INSERT sự kiện).
        -- Làm ở BEFORE để INSERT nhiều sự kiện trong một câu lệnh vẫn thấy trạng thái mới.
        UPDATE batches SET current_status = NEW.event_type WHERE batch_id = NEW.batch_id;
    END IF;

    RETURN NEW;
END $$;

CREATE TRIGGER trg_events_rules
    BEFORE INSERT ON supply_chain_events
    FOR EACH ROW EXECUTE FUNCTION check_event_rules();

CREATE TRIGGER trg_events_append_only
    BEFORE UPDATE OR DELETE ON supply_chain_events
    FOR EACH ROW EXECUTE FUNCTION forbid_modification();

CREATE TRIGGER trg_events_no_truncate
    BEFORE TRUNCATE ON supply_chain_events
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_modification();

-- -----------------------------------------------------------------------------
-- 6. audit_logs – nhật ký thay đổi (append-only, US-S05, US-S06)
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    audit_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id         BIGINT      REFERENCES users (user_id) ON DELETE RESTRICT,
    action           VARCHAR(50) NOT NULL,
    entity_type      VARCHAR(30) NOT NULL,
    entity_id        BIGINT,
    old_value        JSONB,
    new_value        JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_audit_action CHECK (action IN (
        'CREATE','UPDATE','REGISTER','LOGIN_FAILED',
        'APPROVE','CHANGE_ROLE','LOCK','UNLOCK','ASSIGN_ORGANIZATION')),
    CONSTRAINT chk_audit_entity_type CHECK (entity_type IN (
        'USER','ORGANIZATION','BATCH','EVENT','QR_CODE')),
    -- Không được lưu mật khẩu, hash, JWT hay token QR vào nhật ký (US-S05 AC03).
    CONSTRAINT chk_audit_no_secrets CHECK (
        coalesce(old_value::text, '') || coalesce(new_value::text, '')
        !~* '"(password|password_hash|passwordHash|token|jwt|qr_token|qrToken|signature_hmac)"')
);

CREATE INDEX idx_audit_entity     ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_actor      ON audit_logs (actor_id);
CREATE INDEX idx_audit_created_at ON audit_logs (created_at DESC);

COMMENT ON TABLE  audit_logs          IS 'Nhật ký do hệ thống tự ghi trong cùng transaction với thay đổi. Chỉ INSERT.';
COMMENT ON COLUMN audit_logs.actor_id IS 'NULL khi không xác định được người dùng (ví dụ đăng nhập sai email).';

CREATE TRIGGER trg_audit_append_only
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION forbid_modification();

CREATE TRIGGER trg_audit_no_truncate
    BEFORE TRUNCATE ON audit_logs
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_modification();

-- -----------------------------------------------------------------------------
-- 7. View công khai – chỉ các trường được phép trả cho Consumer (FR-QR-06)
--    Backend dùng view này cho /trace/{qrToken} và /trace/code/{batchCode}.
-- -----------------------------------------------------------------------------
CREATE VIEW public_batch_trace AS
SELECT b.batch_code,
       b.product_name,
       b.origin,
       o.name AS organization_name,
       b.current_status
FROM batches b
JOIN organizations o ON o.organization_id = b.organization_id;

CREATE VIEW public_event_trace AS
SELECT b.batch_code,
       e.event_type,
       e.location,
       e.description,
       o.name AS organization_name,
       e."timestamp"
FROM supply_chain_events e
JOIN batches       b ON b.batch_id        = e.batch_id
JOIN users         u ON u.user_id         = e.actor_id
LEFT JOIN organizations o ON o.organization_id = u.organization_id;

COMMENT ON VIEW public_batch_trace IS 'Thông tin lô công khai: không có id nội bộ, email hay người tạo.';
COMMENT ON VIEW public_event_trace IS 'Timeline công khai: không có actor_id, email hay audit.';

COMMIT;
