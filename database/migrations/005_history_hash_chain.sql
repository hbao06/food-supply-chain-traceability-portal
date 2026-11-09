-- =============================================================================
-- Migration 005 – chuỗi băm cho lịch sử chỉ-ghi-thêm (W6-TV3)
--
-- Từ 001, audit_logs và supply_chain_events đã chặn UPDATE / DELETE / TRUNCATE bằng trigger.
-- Nhưng người có quyền quản trị CSDL vẫn tắt được trigger rồi sửa lịch sử mà không để lại dấu vết.
-- Migration này thêm chuỗi băm SHA-256 để PHÁT HIỆN việc đó:
--   row_hash = sha256(prev_hash | các cột của dòng)    prev_hash = row_hash của dòng liền trước
-- Sửa, xóa hoặc chèn một dòng ở giữa làm hỏng chuỗi từ dòng đó trở đi.
--   * audit_logs          : một chuỗi chung, thứ tự theo chain_seq (cấp trong trigger, sau khóa advisory)
--   * supply_chain_events : một chuỗi cho MỖI lô, thứ tự theo bước (event_types.seq_no)
-- Kiểm tra: SELECT * FROM verify_audit_chain();  SELECT * FROM verify_batch_events(<batch_id>);
-- Dòng cũ (trước migration) được tính băm bù theo đúng thứ tự.
-- =============================================================================

-- Băm chuỗi văn bản -> 64 ký tự hex (sha256 có sẵn trong PostgreSQL 11+, không cần pgcrypto).
CREATE FUNCTION sha256_hex(t text) RETURNS char(64)
LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT encode(sha256(convert_to(t, 'UTF8')), 'hex')
$$;

-- Thời điểm dạng UTC cố định, không phụ thuộc cấu hình timezone của phiên kết nối.
CREATE FUNCTION ts_utc_text(t timestamptz) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT to_char(t AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;

CREATE FUNCTION audit_row_hash(
    p_prev char(64), p_seq bigint, p_audit_id bigint, p_actor_id bigint, p_action text,
    p_entity_type text, p_entity_id bigint, p_old jsonb, p_new jsonb, p_created_at timestamptz
) RETURNS char(64)
LANGUAGE sql IMMUTABLE AS $$
    -- jsonb::text đã được chuẩn hóa (thứ tự khóa cố định), nên cùng nội dung luôn cho cùng chuỗi.
    SELECT sha256_hex(concat_ws('|', p_prev, p_seq, p_audit_id, coalesce(p_actor_id::text, '∅'), p_action,
                                p_entity_type, coalesce(p_entity_id::text, '∅'),
                                coalesce(p_old::text, '∅'), coalesce(p_new::text, '∅'), ts_utc_text(p_created_at)))
$$;

CREATE FUNCTION event_row_hash(
    p_prev char(64), p_event_id bigint, p_batch_id bigint, p_actor_id bigint, p_event_type text,
    p_ts timestamptz, p_location text, p_description text, p_created_at timestamptz
) RETURNS char(64)
LANGUAGE sql IMMUTABLE AS $$
    SELECT sha256_hex(concat_ws('|', p_prev, p_event_id, p_batch_id, p_actor_id, p_event_type, ts_utc_text(p_ts),
                                p_location, coalesce(p_description, '∅'), ts_utc_text(p_created_at)))
$$;

-- Giá trị "dòng trước" cho dòng đầu tiên của chuỗi.
CREATE FUNCTION genesis_hash() RETURNS char(64)
LANGUAGE sql IMMUTABLE AS $$ SELECT repeat('0', 64)::char(64) $$;

-- -----------------------------------------------------------------------------
-- audit_logs
-- -----------------------------------------------------------------------------
ALTER TABLE audit_logs
    ADD COLUMN chain_seq  BIGINT,
    ADD COLUMN prev_hash  CHAR(64),
    ADD COLUMN row_hash   CHAR(64);

-- Tính băm bù cho dòng cũ (tạm tắt trigger append-only; chỉ trong migration này).
ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_append_only;
DO $$
DECLARE
    r audit_logs%ROWTYPE;
    v_prev char(64) := genesis_hash();
    v_seq bigint := 0;
BEGIN
    FOR r IN SELECT * FROM audit_logs ORDER BY audit_id LOOP
        v_seq := v_seq + 1;
        UPDATE audit_logs
           SET chain_seq = v_seq,
               prev_hash = v_prev,
               row_hash  = audit_row_hash(v_prev, v_seq, r.audit_id, r.actor_id, r.action, r.entity_type,
                                          r.entity_id, r.old_value, r.new_value, r.created_at)
         WHERE audit_id = r.audit_id
        RETURNING row_hash INTO v_prev;
    END LOOP;
END $$;
ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_append_only;

ALTER TABLE audit_logs
    ALTER COLUMN chain_seq SET NOT NULL,
    ALTER COLUMN prev_hash SET NOT NULL,
    ALTER COLUMN row_hash  SET NOT NULL,
    ADD CONSTRAINT uq_audit_chain_seq UNIQUE (chain_seq),
    ADD CONSTRAINT chk_audit_hash_format CHECK (prev_hash ~ '^[0-9a-f]{64}$' AND row_hash ~ '^[0-9a-f]{64}$');

COMMENT ON COLUMN audit_logs.chain_seq IS 'Vị trí trong chuỗi băm (1, 2, 3...). Do trigger cấp, không gửi từ backend.';
COMMENT ON COLUMN audit_logs.row_hash  IS 'sha256(prev_hash | các cột). Kiểm tra bằng verify_audit_chain().';

-- Khóa advisory giữ đến hết transaction: các transaction ghi audit nối vào chuỗi lần lượt.
-- Hàm plpgsql VOLATILE lấy snapshot mới cho mỗi câu lệnh, nên sau khi có khóa sẽ thấy dòng vừa commit.
CREATE FUNCTION audit_chain_append() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_last audit_logs%ROWTYPE;
BEGIN
    PERFORM pg_advisory_xact_lock(2026_0601);
    SELECT * INTO v_last FROM audit_logs ORDER BY chain_seq DESC LIMIT 1;
    NEW.chain_seq := coalesce(v_last.chain_seq, 0) + 1;
    NEW.prev_hash := coalesce(v_last.row_hash, genesis_hash());
    NEW.row_hash  := audit_row_hash(NEW.prev_hash, NEW.chain_seq, NEW.audit_id, NEW.actor_id, NEW.action,
                                    NEW.entity_type, NEW.entity_id, NEW.old_value, NEW.new_value, NEW.created_at);
    RETURN NEW;
END $$;

CREATE TRIGGER trg_audit_chain
    BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_chain_append();

-- Kết quả: số dòng đã kiểm tra, dòng hỏng đầu tiên (NULL nếu toàn vẹn) và lý do.
CREATE FUNCTION verify_audit_chain()
RETURNS TABLE (checked bigint, first_broken_audit_id bigint, reason text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    r audit_logs%ROWTYPE;
    v_prev char(64) := genesis_hash();
    v_expected_seq bigint := 0;
BEGIN
    checked := 0;
    FOR r IN SELECT * FROM audit_logs ORDER BY chain_seq LOOP
        v_expected_seq := v_expected_seq + 1;
        IF r.chain_seq <> v_expected_seq THEN
            first_broken_audit_id := r.audit_id; reason := 'Thiếu dòng trong chuỗi (chain_seq ' || v_expected_seq || ')';
            RETURN NEXT; RETURN;
        END IF;
        IF r.prev_hash <> v_prev THEN
            first_broken_audit_id := r.audit_id; reason := 'prev_hash không khớp dòng trước';
            RETURN NEXT; RETURN;
        END IF;
        IF r.row_hash <> audit_row_hash(r.prev_hash, r.chain_seq, r.audit_id, r.actor_id, r.action, r.entity_type,
                                        r.entity_id, r.old_value, r.new_value, r.created_at) THEN
            first_broken_audit_id := r.audit_id; reason := 'Nội dung dòng đã bị sửa';
            RETURN NEXT; RETURN;
        END IF;
        v_prev := r.row_hash;
        checked := checked + 1;
    END LOOP;
    RETURN NEXT;
END $$;

-- -----------------------------------------------------------------------------
-- supply_chain_events – chuỗi theo từng lô
-- -----------------------------------------------------------------------------
ALTER TABLE supply_chain_events
    ADD COLUMN prev_hash CHAR(64),
    ADD COLUMN row_hash  CHAR(64);

ALTER TABLE supply_chain_events DISABLE TRIGGER trg_events_append_only;
DO $$
DECLARE
    r record;
    v_prev char(64);
    v_batch bigint := NULL;
BEGIN
    FOR r IN SELECT e.* FROM supply_chain_events e JOIN event_types t ON t.code = e.event_type
             ORDER BY e.batch_id, t.seq_no LOOP
        IF v_batch IS DISTINCT FROM r.batch_id THEN
            v_batch := r.batch_id;
            v_prev := genesis_hash();
        END IF;
        UPDATE supply_chain_events
           SET prev_hash = v_prev,
               row_hash  = event_row_hash(v_prev, r.event_id, r.batch_id, r.actor_id, r.event_type,
                                          r."timestamp", r.location, r.description, r.created_at)
         WHERE event_id = r.event_id
        RETURNING row_hash INTO v_prev;
    END LOOP;
END $$;
ALTER TABLE supply_chain_events ENABLE TRIGGER trg_events_append_only;

ALTER TABLE supply_chain_events
    ALTER COLUMN prev_hash SET NOT NULL,
    ALTER COLUMN row_hash  SET NOT NULL,
    ADD CONSTRAINT chk_events_hash_format CHECK (prev_hash ~ '^[0-9a-f]{64}$' AND row_hash ~ '^[0-9a-f]{64}$');

-- Chạy SAU trg_events_rules (tên theo thứ tự chữ cái): lúc đó dòng lô đã bị khóa FOR UPDATE và thứ tự đã đúng,
-- nên sự kiện liền trước của lô là duy nhất.
CREATE FUNCTION event_chain_append() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_prev char(64);
BEGIN
    SELECT e.row_hash INTO v_prev
      FROM supply_chain_events e JOIN event_types t ON t.code = e.event_type
     WHERE e.batch_id = NEW.batch_id
     ORDER BY t.seq_no DESC LIMIT 1;
    NEW.prev_hash := coalesce(v_prev, genesis_hash());
    NEW.row_hash  := event_row_hash(NEW.prev_hash, NEW.event_id, NEW.batch_id, NEW.actor_id, NEW.event_type,
                                    NEW."timestamp", NEW.location, NEW.description, NEW.created_at);
    RETURN NEW;
END $$;

CREATE TRIGGER trg_events_x_chain
    BEFORE INSERT ON supply_chain_events
    FOR EACH ROW EXECUTE FUNCTION event_chain_append();

CREATE FUNCTION verify_batch_events(p_batch_id bigint)
RETURNS TABLE (checked bigint, first_broken_event_id bigint, reason text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    r record;
    v_prev char(64) := genesis_hash();
    v_expected_seq int := 0;
BEGIN
    checked := 0;
    FOR r IN SELECT e.*, t.seq_no FROM supply_chain_events e JOIN event_types t ON t.code = e.event_type
             WHERE e.batch_id = p_batch_id ORDER BY t.seq_no LOOP
        v_expected_seq := v_expected_seq + 1;
        IF r.seq_no <> v_expected_seq THEN
            first_broken_event_id := r.event_id; reason := 'Thiếu bước trong chuỗi sự kiện';
            RETURN NEXT; RETURN;
        END IF;
        IF r.prev_hash <> v_prev THEN
            first_broken_event_id := r.event_id; reason := 'prev_hash không khớp sự kiện trước';
            RETURN NEXT; RETURN;
        END IF;
        IF r.row_hash <> event_row_hash(r.prev_hash, r.event_id, r.batch_id, r.actor_id, r.event_type,
                                        r."timestamp", r.location, r.description, r.created_at) THEN
            first_broken_event_id := r.event_id; reason := 'Nội dung sự kiện đã bị sửa';
            RETURN NEXT; RETURN;
        END IF;
        v_prev := r.row_hash;
        checked := checked + 1;
    END LOOP;
    RETURN NEXT;
END $$;
