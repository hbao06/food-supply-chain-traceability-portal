-- =============================================================================
-- schema-current.sql – TỰ SINH, KHÔNG SỬA TAY (database/scripts/dump-schema.sh)
-- Toàn bộ schema sau migration 001 → 007 (007_query_indexes.sql), chỉ để ĐỌC / tra cứu.
-- Tạo CSDL thật bằng: cd backend && npm run db:migrate   (không chạy file này)
-- Chỉ có cấu trúc (bảng, ràng buộc, trigger, hàm, view, chỉ mục, quyền); KHÔNG có dữ liệu của
-- bảng tra cứu roles, event_types – dữ liệu đó nằm trong migration 002, 004.
-- =============================================================================

--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';

--
-- Name: audit_chain_append(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_chain_append() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

--
-- Name: audit_row_hash(character, bigint, bigint, bigint, text, text, bigint, jsonb, jsonb, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_row_hash(p_prev character, p_seq bigint, p_audit_id bigint, p_actor_id bigint, p_action text, p_entity_type text, p_entity_id bigint, p_old jsonb, p_new jsonb, p_created_at timestamp with time zone) RETURNS character
    LANGUAGE sql IMMUTABLE
    AS $$
    -- jsonb::text đã được chuẩn hóa (thứ tự khóa cố định), nên cùng nội dung luôn cho cùng chuỗi.
    SELECT sha256_hex(concat_ws('|', p_prev, p_seq, p_audit_id, coalesce(p_actor_id::text, '∅'), p_action,
                                p_entity_type, coalesce(p_entity_id::text, '∅'),
                                coalesce(p_old::text, '∅'), coalesce(p_new::text, '∅'), ts_utc_text(p_created_at)))
$$;

--
-- Name: check_batch_product(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_batch_product() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_product products%ROWTYPE;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id
       AND OLD.current_status <> 'CREATED' THEN
        RAISE EXCEPTION 'Chỉ được đổi sản phẩm khi lô còn CREATED (hiện tại: %)', OLD.current_status
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.product_id IS NOT NULL THEN
        SELECT * INTO v_product FROM products WHERE product_id = NEW.product_id;
        IF v_product.organization_id IS DISTINCT FROM NEW.organization_id THEN
            RAISE EXCEPTION 'Sản phẩm % không thuộc nông trại sở hữu lô', NEW.product_id
                USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.product_name IS NULL THEN
            NEW.product_name := v_product.name;
        END IF;
    END IF;
    RETURN NEW;
END $$;

--
-- Name: check_batch_rules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_batch_rules() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

--
-- Name: check_event_rules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_event_rules() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

--
-- Name: check_organization_type_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_organization_type_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

--
-- Name: check_product_rules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_product_rules() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_type text;
BEGIN
    SELECT type INTO v_type FROM organizations WHERE organization_id = NEW.organization_id;
    IF v_type IS DISTINCT FROM 'FARM' THEN
        RAISE EXCEPTION 'Chỉ nông trại (FARM) mới có sản phẩm, đơn vị % là %', NEW.organization_id, v_type
            USING ERRCODE = 'check_violation';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.organization_id <> OLD.organization_id
       AND EXISTS (SELECT 1 FROM batches WHERE product_id = OLD.product_id) THEN
        RAISE EXCEPTION 'Sản phẩm % đã có lô, không được đổi nông trại', OLD.product_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

--
-- Name: check_user_rules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_rules() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

--
-- Name: event_chain_append(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.event_chain_append() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

--
-- Name: event_row_hash(character, bigint, bigint, bigint, text, timestamp with time zone, text, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.event_row_hash(p_prev character, p_event_id bigint, p_batch_id bigint, p_actor_id bigint, p_event_type text, p_ts timestamp with time zone, p_location text, p_description text, p_created_at timestamp with time zone) RETURNS character
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT sha256_hex(concat_ws('|', p_prev, p_event_id, p_batch_id, p_actor_id, p_event_type, ts_utc_text(p_ts),
                                p_location, coalesce(p_description, '∅'), ts_utc_text(p_created_at)))
$$;

--
-- Name: event_type_position(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.event_type_position(t text) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    SELECT seq_no::int FROM event_types WHERE code = t
$$;

--
-- Name: event_type_role(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.event_type_role(t text) RETURNS text
    LANGUAGE sql STABLE
    AS $$
    SELECT role_code::text FROM event_types WHERE code = t
$$;

--
-- Name: forbid_lookup_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forbid_lookup_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Bảng % là dữ liệu cố định, không được %; thay đổi bằng migration', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege';
END $$;

--
-- Name: forbid_modification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forbid_modification() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Bảng % chỉ cho phép INSERT (append-only); không được %',
        TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'Muốn điều chỉnh thì ghi thêm bản ghi mới.';
END $$;

--
-- Name: forbid_role_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forbid_role_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Bảng roles là dữ liệu cố định, không được %; thêm vai trò mới bằng migration', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END $$;

--
-- Name: genesis_hash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.genesis_hash() RETURNS character
    LANGUAGE sql IMMUTABLE
    AS $$ SELECT repeat('0', 64)::char(64) $$;

--
-- Name: org_type_for_role(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_type_for_role(r text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT CASE r
        WHEN 'FARMER'      THEN 'FARM'
        WHEN 'PROCESSOR'   THEN 'PROCESSOR'
        WHEN 'DISTRIBUTOR' THEN 'DISTRIBUTOR'
    END
$$;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

--
-- Name: sha256_hex(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sha256_hex(t text) RETURNS character
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
    SELECT encode(sha256(convert_to(t, 'UTF8')), 'hex')
$$;

--
-- Name: ts_utc_text(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ts_utc_text(t timestamp with time zone) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT to_char(t AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;

--
-- Name: verify_audit_chain(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_audit_chain() RETURNS TABLE(checked bigint, first_broken_audit_id bigint, reason text)
    LANGUAGE plpgsql STABLE
    AS $$
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

--
-- Name: verify_batch_events(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_batch_events(p_batch_id bigint) RETURNS TABLE(checked bigint, first_broken_event_id bigint, reason text)
    LANGUAGE plpgsql STABLE
    AS $$
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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    audit_id bigint NOT NULL,
    actor_id bigint,
    action character varying(50) NOT NULL,
    entity_type character varying(30) NOT NULL,
    entity_id bigint,
    old_value jsonb,
    new_value jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    chain_seq bigint NOT NULL,
    prev_hash character(64) NOT NULL,
    row_hash character(64) NOT NULL,
    CONSTRAINT chk_audit_action CHECK (((action)::text = ANY ((ARRAY['CREATE'::character varying, 'UPDATE'::character varying, 'REGISTER'::character varying, 'LOGIN_FAILED'::character varying, 'APPROVE'::character varying, 'CHANGE_ROLE'::character varying, 'LOCK'::character varying, 'UNLOCK'::character varying, 'ASSIGN_ORGANIZATION'::character varying])::text[]))),
    CONSTRAINT chk_audit_entity_type CHECK (((entity_type)::text = ANY ((ARRAY['USER'::character varying, 'ORGANIZATION'::character varying, 'BATCH'::character varying, 'EVENT'::character varying, 'QR_CODE'::character varying])::text[]))),
    CONSTRAINT chk_audit_hash_format CHECK (((prev_hash ~ '^[0-9a-f]{64}$'::text) AND (row_hash ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT chk_audit_no_secrets CHECK (((COALESCE((old_value)::text, ''::text) || COALESCE((new_value)::text, ''::text)) !~* '"(password|password_hash|passwordHash|token|jwt|qr_token|qrToken|signature_hmac)"'::text))
);

--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS 'Nhật ký do hệ thống tự ghi trong cùng transaction với thay đổi. Chỉ INSERT.';

--
-- Name: COLUMN audit_logs.actor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.actor_id IS 'NULL khi không xác định được người dùng (ví dụ đăng nhập sai email).';

--
-- Name: COLUMN audit_logs.chain_seq; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.chain_seq IS 'Vị trí trong chuỗi băm (1, 2, 3...). Do trigger cấp, không gửi từ backend.';

--
-- Name: COLUMN audit_logs.row_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.row_hash IS 'sha256(prev_hash | các cột). Kiểm tra bằng verify_audit_chain().';

--
-- Name: audit_logs_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ALTER COLUMN audit_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_logs_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batches (
    batch_id bigint NOT NULL,
    batch_code character varying(30) NOT NULL,
    product_name character varying(150) NOT NULL,
    origin character varying(255) NOT NULL,
    quantity numeric(12,2) NOT NULL,
    creation_date timestamp with time zone DEFAULT now() NOT NULL,
    current_status character varying(20) DEFAULT 'CREATED'::character varying NOT NULL,
    created_by bigint NOT NULL,
    organization_id bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    product_id bigint,
    CONSTRAINT chk_batches_batch_code_format CHECK (((batch_code)::text ~ '^BATCH-[0-9]{4}-[0-9]{4,}$'::text)),
    CONSTRAINT chk_batches_origin_not_blank CHECK ((btrim((origin)::text) <> ''::text)),
    CONSTRAINT chk_batches_product_not_blank CHECK ((btrim((product_name)::text) <> ''::text)),
    CONSTRAINT chk_batches_quantity_positive CHECK ((quantity > (0)::numeric))
);

--
-- Name: TABLE batches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.batches IS 'Lô thực phẩm. Không có DELETE; chỉ sửa khi current_status = CREATED.';

--
-- Name: COLUMN batches.batch_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.batches.batch_code IS 'Mã công khai, dạng BATCH-YYYY-NNNN, in lên QR và nhập tay.';

--
-- Name: COLUMN batches.product_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.batches.product_name IS 'Tên sản phẩm tại thời điểm tạo lô (ảnh chụp). Tự lấy từ products nếu chỉ gửi product_id.';

--
-- Name: COLUMN batches.current_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.batches.current_status IS 'Đồng bộ tự động với sự kiện mới nhất (trigger trên supply_chain_events).';

--
-- Name: COLUMN batches.organization_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.batches.organization_id IS 'Đơn vị sở hữu lô – dùng cho phạm vi đọc/sửa của Farmer.';

--
-- Name: COLUMN batches.product_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.batches.product_id IS 'Sản phẩm trong danh mục (không bắt buộc). Phải thuộc cùng nông trại với lô.';

--
-- Name: batches_batch_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.batches ALTER COLUMN batch_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.batches_batch_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: event_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_types (
    code character varying(20) NOT NULL,
    seq_no smallint NOT NULL,
    role_code character varying(20) NOT NULL,
    name character varying(50) NOT NULL,
    description character varying(255) NOT NULL,
    sendable boolean NOT NULL,
    CONSTRAINT chk_event_types_code_format CHECK (((code)::text ~ '^[A-Z_]{3,20}$'::text)),
    CONSTRAINT chk_event_types_seq_positive CHECK ((seq_no >= 1))
);

--
-- Name: TABLE event_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.event_types IS 'Loại sự kiện / trạng thái lô theo thứ tự. Dữ liệu cố định, chặn sửa/xóa.';

--
-- Name: COLUMN event_types.seq_no; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_types.seq_no IS 'Thứ tự bước: sự kiện mới phải có seq_no = seq_no của trạng thái hiện tại + 1.';

--
-- Name: COLUMN event_types.role_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_types.role_code IS 'Vai trò duy nhất được ghi loại sự kiện này.';

--
-- Name: COLUMN event_types.sendable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_types.sendable IS 'FALSE: hệ thống tự ghi (CREATED), không nhận qua POST /batches/{id}/events.';

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    organization_id bigint NOT NULL,
    name character varying(150) NOT NULL,
    type character varying(20) NOT NULL,
    address character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_organizations_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_organizations_type CHECK (((type)::text = ANY ((ARRAY['FARM'::character varying, 'PROCESSOR'::character varying, 'DISTRIBUTOR'::character varying])::text[])))
);

--
-- Name: TABLE organizations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organizations IS 'Đơn vị trong chuỗi cung ứng. Không có endpoint xóa (US-S03).';

--
-- Name: COLUMN organizations.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.type IS 'FARM | PROCESSOR | DISTRIBUTOR – phải khớp vai trò của thành viên.';

--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    product_id bigint NOT NULL,
    organization_id bigint NOT NULL,
    name character varying(150) NOT NULL,
    category character varying(50) NOT NULL,
    unit character varying(20) DEFAULT 'kg'::character varying NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_products_category_not_blank CHECK ((btrim((category)::text) <> ''::text)),
    CONSTRAINT chk_products_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_products_unit_not_blank CHECK ((btrim((unit)::text) <> ''::text))
);

--
-- Name: TABLE products; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.products IS 'Danh mục sản phẩm của nông trại. Không có DELETE (lô cũ vẫn tham chiếu).';

--
-- Name: COLUMN products.unit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.unit IS 'Đơn vị của batches.quantity: kg, tấn, thùng...';

--
-- Name: farms; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.farms AS
 SELECT organization_id AS farm_id,
    name,
    address,
    created_at,
    ( SELECT count(*) AS count
           FROM public.products p
          WHERE (p.organization_id = o.organization_id)) AS product_count,
    ( SELECT count(*) AS count
           FROM public.batches b
          WHERE (b.organization_id = o.organization_id)) AS batch_count
   FROM public.organizations o
  WHERE ((type)::text = 'FARM'::text);

--
-- Name: VIEW farms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.farms IS 'Nông trại = organizations.type = FARM. Thêm / sửa qua bảng organizations.';

--
-- Name: organizations_organization_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.organizations ALTER COLUMN organization_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.organizations_organization_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: products_product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.products ALTER COLUMN product_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.products_product_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: public_batch_trace; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_batch_trace AS
 SELECT b.batch_code,
    b.product_name,
    b.origin,
    o.name AS organization_name,
    b.current_status
   FROM (public.batches b
     JOIN public.organizations o ON ((o.organization_id = b.organization_id)));

--
-- Name: VIEW public_batch_trace; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.public_batch_trace IS 'Thông tin lô công khai: không có id nội bộ, email hay người tạo.';

--
-- Name: supply_chain_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supply_chain_events (
    event_id bigint NOT NULL,
    batch_id bigint NOT NULL,
    actor_id bigint NOT NULL,
    event_type character varying(20) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    location character varying(255) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    prev_hash character(64) NOT NULL,
    row_hash character(64) NOT NULL,
    CONSTRAINT chk_events_hash_format CHECK (((prev_hash ~ '^[0-9a-f]{64}$'::text) AND (row_hash ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT chk_events_location_not_blank CHECK ((btrim((location)::text) <> ''::text))
);

--
-- Name: TABLE supply_chain_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.supply_chain_events IS 'Lịch sử lô. Chỉ INSERT. INSERT sự kiện tự cập nhật batches.current_status.';

--
-- Name: COLUMN supply_chain_events."timestamp"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.supply_chain_events."timestamp" IS 'Thời điểm sự kiện xảy ra (API: timestamp). created_at là lúc ghi vào hệ thống.';

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id bigint NOT NULL,
    organization_id bigint,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_users_active_has_org CHECK ((((role)::text = 'ADMIN'::text) OR ((status)::text <> 'ACTIVE'::text) OR (organization_id IS NOT NULL))),
    CONSTRAINT chk_users_admin_no_org CHECK ((((role)::text <> 'ADMIN'::text) OR (organization_id IS NULL))),
    CONSTRAINT chk_users_email_format CHECK (((email)::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)),
    CONSTRAINT chk_users_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_users_password_is_bcrypt CHECK (((password_hash)::text ~ '^\$2[aby]\$\d{2}\$.{53}$'::text)),
    CONSTRAINT chk_users_status CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACTIVE'::character varying, 'LOCKED'::character varying])::text[])))
);

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'Tài khoản nội bộ. Đăng ký mới ở PENDING, Admin duyệt và gán đơn vị (US-S01).';

--
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.password_hash IS 'bcrypt hash. Không bao giờ trả ra API.';

--
-- Name: public_event_trace; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_event_trace AS
 SELECT b.batch_code,
    e.event_type,
    e.location,
    e.description,
    o.name AS organization_name,
    e."timestamp"
   FROM (((public.supply_chain_events e
     JOIN public.batches b ON ((b.batch_id = e.batch_id)))
     JOIN public.users u ON ((u.user_id = e.actor_id)))
     LEFT JOIN public.organizations o ON ((o.organization_id = u.organization_id)));

--
-- Name: VIEW public_event_trace; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.public_event_trace IS 'Timeline công khai: không có actor_id, email hay audit.';

--
-- Name: qr_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_codes (
    qr_id bigint NOT NULL,
    batch_id bigint NOT NULL,
    qr_data character varying(512) NOT NULL,
    signature_hmac character varying(128) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_qr_codes_qr_data_contains_signature CHECK ((POSITION((signature_hmac) IN (qr_data)) > 0))
);

--
-- Name: TABLE qr_codes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.qr_codes IS 'QR của lô. qr_data = <traceUrl>/trace/<qrToken>, qrToken = <batch_code>.<signature_hmac> (SRS P1).';

--
-- Name: COLUMN qr_codes.signature_hmac; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.qr_codes.signature_hmac IS 'base64url(HMAC-SHA256(QR_HMAC_SECRET, batch_code)). Khóa bí mật không lưu trong CSDL.';

--
-- Name: qr_codes_qr_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.qr_codes ALTER COLUMN qr_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.qr_codes_qr_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    role_code character varying(20) NOT NULL,
    name character varying(50) NOT NULL,
    description character varying(255) NOT NULL,
    self_register boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_roles_code_format CHECK (((role_code)::text ~ '^[A-Z_]{3,20}$'::text))
);

--
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.roles IS 'Vai trò tài khoản nội bộ (Consumer không có tài khoản nên không có ở đây).';

--
-- Name: COLUMN roles.self_register; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.roles.self_register IS 'TRUE: được chọn khi tự đăng ký (POST /auth/register).';

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(10) NOT NULL,
    name character varying(200) NOT NULL,
    checksum character(64) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: supply_chain_events_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.supply_chain_events ALTER COLUMN event_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.supply_chain_events_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN user_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (audit_id);

--
-- Name: batches batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_pkey PRIMARY KEY (batch_id);

--
-- Name: event_types event_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_types
    ADD CONSTRAINT event_types_pkey PRIMARY KEY (code);

--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (organization_id);

--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (product_id);

--
-- Name: qr_codes qr_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_codes
    ADD CONSTRAINT qr_codes_pkey PRIMARY KEY (qr_id);

--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_code);

--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);

--
-- Name: supply_chain_events supply_chain_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_chain_events
    ADD CONSTRAINT supply_chain_events_pkey PRIMARY KEY (event_id);

--
-- Name: audit_logs uq_audit_chain_seq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT uq_audit_chain_seq UNIQUE (chain_seq);

--
-- Name: batches uq_batches_batch_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT uq_batches_batch_code UNIQUE (batch_code);

--
-- Name: event_types uq_event_types_seq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_types
    ADD CONSTRAINT uq_event_types_seq UNIQUE (seq_no);

--
-- Name: supply_chain_events uq_events_batch_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_chain_events
    ADD CONSTRAINT uq_events_batch_type UNIQUE (batch_id, event_type);

--
-- Name: organizations uq_organizations_name_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT uq_organizations_name_type UNIQUE (name, type);

--
-- Name: products uq_products_org_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT uq_products_org_name UNIQUE (organization_id, name);

--
-- Name: qr_codes uq_qr_codes_batch; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_codes
    ADD CONSTRAINT uq_qr_codes_batch UNIQUE (batch_id);

--
-- Name: qr_codes uq_qr_codes_qr_data; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_codes
    ADD CONSTRAINT uq_qr_codes_qr_data UNIQUE (qr_data);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);

--
-- Name: idx_audit_actor_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_actor_created ON public.audit_logs USING btree (actor_id, created_at DESC, audit_id DESC);

--
-- Name: idx_audit_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_created_desc ON public.audit_logs USING btree (created_at DESC, audit_id DESC);

--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_entity ON public.audit_logs USING btree (entity_type, entity_id);

--
-- Name: idx_audit_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_type_created ON public.audit_logs USING btree (entity_type, created_at DESC, audit_id DESC);

--
-- Name: idx_batches_batch_code_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batches_batch_code_trgm ON public.batches USING gin (batch_code public.gin_trgm_ops);

--
-- Name: idx_batches_code_year_seq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batches_code_year_seq ON public.batches USING btree (((split_part((batch_code)::text, '-'::text, 2))::integer), ((split_part((batch_code)::text, '-'::text, 3))::integer) DESC);

--
-- Name: idx_batches_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batches_created_by ON public.batches USING btree (created_by);

--
-- Name: idx_batches_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batches_created_desc ON public.batches USING btree (creation_date DESC, batch_id DESC);

--
-- Name: idx_batches_org_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batches_org_created_desc ON public.batches USING btree (organization_id, creation_date DESC, batch_id DESC);

--
-- Name: idx_batches_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batches_product ON public.batches USING btree (product_id);

--
-- Name: idx_batches_product_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batches_product_name_trgm ON public.batches USING gin (product_name public.gin_trgm_ops);

--
-- Name: idx_batches_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batches_status_created ON public.batches USING btree (current_status, creation_date DESC, batch_id DESC);

--
-- Name: idx_events_actor_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_actor_batch ON public.supply_chain_events USING btree (actor_id, batch_id);

--
-- Name: idx_events_batch_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_batch_time ON public.supply_chain_events USING btree (batch_id, "timestamp");

--
-- Name: idx_users_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_organization ON public.users USING btree (organization_id);

--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);

--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_status ON public.users USING btree (status);

--
-- Name: uq_products_org_lower_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_products_org_lower_name ON public.products USING btree (organization_id, lower((name)::text));

--
-- Name: uq_users_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_users_email_lower ON public.users USING btree (lower((email)::text));

--
-- Name: audit_logs trg_audit_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_append_only BEFORE DELETE OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.forbid_modification();

--
-- Name: audit_logs trg_audit_chain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_chain BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.audit_chain_append();

--
-- Name: audit_logs trg_audit_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_no_truncate BEFORE TRUNCATE ON public.audit_logs FOR EACH STATEMENT EXECUTE FUNCTION public.forbid_modification();

--
-- Name: batches trg_batches_a_product; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_batches_a_product BEFORE INSERT OR UPDATE OF product_id, product_name ON public.batches FOR EACH ROW EXECUTE FUNCTION public.check_batch_product();

--
-- Name: batches trg_batches_rules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_batches_rules BEFORE INSERT OR UPDATE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.check_batch_rules();

--
-- Name: batches trg_batches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_batches_updated_at BEFORE UPDATE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--
-- Name: event_types trg_event_types_read_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_event_types_read_only BEFORE DELETE OR UPDATE ON public.event_types FOR EACH ROW EXECUTE FUNCTION public.forbid_lookup_change();

--
-- Name: supply_chain_events trg_events_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_events_append_only BEFORE DELETE OR UPDATE ON public.supply_chain_events FOR EACH ROW EXECUTE FUNCTION public.forbid_modification();

--
-- Name: supply_chain_events trg_events_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_events_no_truncate BEFORE TRUNCATE ON public.supply_chain_events FOR EACH STATEMENT EXECUTE FUNCTION public.forbid_modification();

--
-- Name: supply_chain_events trg_events_rules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_events_rules BEFORE INSERT ON public.supply_chain_events FOR EACH ROW EXECUTE FUNCTION public.check_event_rules();

--
-- Name: supply_chain_events trg_events_x_chain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_events_x_chain BEFORE INSERT ON public.supply_chain_events FOR EACH ROW EXECUTE FUNCTION public.event_chain_append();

--
-- Name: organizations trg_organizations_type_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_organizations_type_change BEFORE UPDATE OF type ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.check_organization_type_change();

--
-- Name: organizations trg_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--
-- Name: products trg_products_rules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_products_rules BEFORE INSERT OR UPDATE OF organization_id ON public.products FOR EACH ROW EXECUTE FUNCTION public.check_product_rules();

--
-- Name: products trg_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--
-- Name: roles trg_roles_read_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_roles_read_only BEFORE DELETE OR UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.forbid_role_change();

--
-- Name: users trg_users_rules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_rules BEFORE INSERT OR UPDATE OF organization_id, role, status ON public.users FOR EACH ROW EXECUTE FUNCTION public.check_user_rules();

--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(user_id) ON DELETE RESTRICT;

--
-- Name: batches batches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE RESTRICT;

--
-- Name: batches batches_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON DELETE RESTRICT;

--
-- Name: batches batches_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id) ON DELETE RESTRICT;

--
-- Name: event_types event_types_role_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_types
    ADD CONSTRAINT event_types_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.roles(role_code) ON DELETE RESTRICT;

--
-- Name: batches fk_batches_status; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT fk_batches_status FOREIGN KEY (current_status) REFERENCES public.event_types(code) ON UPDATE RESTRICT ON DELETE RESTRICT;

--
-- Name: supply_chain_events fk_events_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_chain_events
    ADD CONSTRAINT fk_events_type FOREIGN KEY (event_type) REFERENCES public.event_types(code) ON UPDATE RESTRICT ON DELETE RESTRICT;

--
-- Name: users fk_users_role; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_role FOREIGN KEY (role) REFERENCES public.roles(role_code) ON UPDATE RESTRICT ON DELETE RESTRICT;

--
-- Name: products products_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON DELETE RESTRICT;

--
-- Name: qr_codes qr_codes_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_codes
    ADD CONSTRAINT qr_codes_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(batch_id) ON DELETE RESTRICT;

--
-- Name: supply_chain_events supply_chain_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_chain_events
    ADD CONSTRAINT supply_chain_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(user_id) ON DELETE RESTRICT;

--
-- Name: supply_chain_events supply_chain_events_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_chain_events
    ADD CONSTRAINT supply_chain_events_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(batch_id) ON DELETE RESTRICT;

--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON DELETE RESTRICT;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO fsc_app;

--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.audit_logs TO fsc_app;

--
-- Name: SEQUENCE audit_logs_audit_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE ON SEQUENCE public.audit_logs_audit_id_seq TO fsc_app;

--
-- Name: TABLE batches; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.batches TO fsc_app;

--
-- Name: SEQUENCE batches_batch_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE ON SEQUENCE public.batches_batch_id_seq TO fsc_app;

--
-- Name: TABLE event_types; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.event_types TO fsc_app;

--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.organizations TO fsc_app;

--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.products TO fsc_app;

--
-- Name: TABLE farms; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.farms TO fsc_app;

--
-- Name: SEQUENCE organizations_organization_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE ON SEQUENCE public.organizations_organization_id_seq TO fsc_app;

--
-- Name: SEQUENCE products_product_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE ON SEQUENCE public.products_product_id_seq TO fsc_app;

--
-- Name: TABLE public_batch_trace; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.public_batch_trace TO fsc_app;

--
-- Name: TABLE supply_chain_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.supply_chain_events TO fsc_app;

--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.users TO fsc_app;

--
-- Name: TABLE public_event_trace; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.public_event_trace TO fsc_app;

--
-- Name: TABLE qr_codes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.qr_codes TO fsc_app;

--
-- Name: SEQUENCE qr_codes_qr_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE ON SEQUENCE public.qr_codes_qr_id_seq TO fsc_app;

--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.roles TO fsc_app;

--
-- Name: TABLE schema_migrations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.schema_migrations TO fsc_app;

--
-- Name: SEQUENCE supply_chain_events_event_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE ON SEQUENCE public.supply_chain_events_event_id_seq TO fsc_app;

--
-- Name: SEQUENCE users_user_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE ON SEQUENCE public.users_user_id_seq TO fsc_app;

--
-- PostgreSQL database dump complete
--

