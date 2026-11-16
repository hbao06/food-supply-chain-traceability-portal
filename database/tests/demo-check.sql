-- =============================================================================
-- Kiểm tra "CSDL sạch" trước khi demo / sau khi khôi phục bản sao lưu (W8-TV3)
--
-- CHỈ ĐỌC: không thêm / sửa / xóa dữ liệu, chạy được trên CSDL dev, demo hoặc bản vừa khôi phục.
--   docker compose cp database/tests/demo-check.sql database:/tmp/demo-check.sql
--   docker compose exec database psql -U postgres -d food_traceability -v ON_ERROR_STOP=1 -f /tmp/demo-check.sql
-- (restore.sh / restore.ps1 tự chạy file này trên CSDL tạm, TRƯỚC khi thay CSDL đang dùng.)
--
-- Kết quả: mỗi mục in PASS / WARN / FAIL. Có FAIL thì lệnh kết thúc bằng lỗi (mã thoát khác 0).
--   FAIL = dữ liệu hoặc quyền sai, phải sửa trước khi demo.
--   WARN = nên xem lại (dữ liệu thử còn sót, email không phải tài khoản demo...), không chặn.
-- =============================================================================

\set QUIET on
SET client_min_messages = notice;
-- Cả file chạy trong một transaction và kết thúc bằng ROLLBACK: hàm tạm pg_temp.report cũng không ở lại.
BEGIN;
DO $$ BEGIN PERFORM set_config('demo_check.fail', '0', false); PERFORM set_config('demo_check.warn', '0', false); END $$;

CREATE FUNCTION pg_temp.report(level text, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF level IN ('FAIL', 'WARN') THEN
        PERFORM set_config('demo_check.' || lower(level),
                           (current_setting('demo_check.' || lower(level))::int + 1)::text, false);
    END IF;
    RAISE NOTICE '% %', rpad(level, 5), msg;
END $$;

-- 1. Migration -----------------------------------------------------------------
DO $$
DECLARE v text; n int;
BEGIN
    IF to_regclass('public.schema_migrations') IS NULL THEN
        PERFORM pg_temp.report('WARN', 'Không có bảng schema_migrations (CSDL không tạo bằng npm run db:migrate)');
        RETURN;
    END IF;
    SELECT max(version), count(*) INTO v, n FROM schema_migrations;
    IF n <> v::int THEN
        PERFORM pg_temp.report('FAIL', format('schema_migrations thiếu bản: có %s dòng nhưng bản mới nhất là %s', n, v));
    ELSE
        PERFORM pg_temp.report('PASS', format('Đã chạy đủ migration 001 → %s', v));
    END IF;
END $$;

-- 2. Chuỗi băm lịch sử ------------------------------------------------------------
DO $$
DECLARE r record; broken int;
BEGIN
    SELECT * INTO r FROM verify_audit_chain();
    IF r.first_broken_audit_id IS NULL THEN
        PERFORM pg_temp.report('PASS', format('Chuỗi băm audit hợp lệ (%s dòng)', r.checked));
    ELSE
        PERFORM pg_temp.report('FAIL', format('Chuỗi băm audit hỏng tại audit_id %s: %s', r.first_broken_audit_id, r.reason));
    END IF;

    SELECT count(*) INTO broken FROM batches b, LATERAL verify_batch_events(b.batch_id) v
    WHERE v.first_broken_event_id IS NOT NULL;
    IF broken = 0 THEN
        PERFORM pg_temp.report('PASS', format('Chuỗi băm sự kiện hợp lệ ở cả %s lô', (SELECT count(*) FROM batches)));
    ELSE
        PERFORM pg_temp.report('FAIL', format('%s lô có lịch sử sự kiện bị sửa', broken));
    END IF;
END $$;

-- 3. Lô: QR, sự kiện CREATED, trạng thái khớp sự kiện cuối --------------------------
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM batches b
    WHERE (SELECT count(*) FROM qr_codes q WHERE q.batch_id = b.batch_id) <> 1;
    IF n = 0 THEN PERFORM pg_temp.report('PASS', 'Mỗi lô có đúng một QR');
    ELSE PERFORM pg_temp.report('FAIL', format('%s lô không có hoặc có nhiều hơn một QR', n)); END IF;

    SELECT count(*) INTO n FROM qr_codes q JOIN batches b USING (batch_id)
    WHERE q.qr_data NOT LIKE '%/trace/' || b.batch_code || '.' || q.signature_hmac
       OR q.signature_hmac !~ '^[A-Za-z0-9_-]{43}$';
    IF n = 0 THEN PERFORM pg_temp.report('PASS', 'QR có dạng <TRACE_BASE_URL>/trace/<mã lô>.<chữ ký HMAC>');
    ELSE PERFORM pg_temp.report('FAIL', format('%s QR sai định dạng (thiếu chữ ký hoặc không khớp mã lô)', n)); END IF;

    SELECT count(*) INTO n FROM batches b
    WHERE NOT EXISTS (SELECT 1 FROM supply_chain_events e
                      WHERE e.batch_id = b.batch_id AND e.event_type = 'CREATED' AND e.actor_id = b.created_by)
       OR b.current_status <> (SELECT e.event_type FROM supply_chain_events e JOIN event_types t ON t.code = e.event_type
                               WHERE e.batch_id = b.batch_id ORDER BY t.seq_no DESC LIMIT 1);
    IF n = 0 THEN PERFORM pg_temp.report('PASS', 'Mỗi lô có sự kiện CREATED của người tạo; trạng thái = sự kiện cuối');
    ELSE PERFORM pg_temp.report('FAIL', format('%s lô có trạng thái không khớp lịch sử sự kiện', n)); END IF;
END $$;

DO $$
DECLARE base text; n int;
BEGIN
    SELECT count(DISTINCT split_part(qr_data, '/trace/', 1)), min(split_part(qr_data, '/trace/', 1))
    INTO n, base FROM qr_codes;
    IF n = 0 THEN
        PERFORM pg_temp.report('WARN', 'Chưa có lô / QR nào (chưa nạp dữ liệu demo: npm run db:seed:demo)');
    ELSIF n > 1 THEN
        PERFORM pg_temp.report('WARN', format('QR dùng %s địa chỉ TRACE_BASE_URL khác nhau – kiểm tra lại trước khi in QR', n));
    ELSE
        PERFORM pg_temp.report('PASS', format('Mọi QR trỏ tới %s (đổi TRACE_BASE_URL rồi nạp lại demo nếu demo từ máy khác)', base));
    END IF;
END $$;

-- 4. Tài khoản ------------------------------------------------------------------
DO $$
DECLARE missing text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE') THEN
        PERFORM pg_temp.report('FAIL', 'Không có tài khoản ADMIN đang hoạt động (chạy npm run db:seed:admin)');
    ELSE
        PERFORM pg_temp.report('PASS', 'Có tài khoản ADMIN đang hoạt động');
    END IF;
    SELECT string_agg(r, ', ') INTO missing FROM unnest(ARRAY['FARMER', 'PROCESSOR', 'DISTRIBUTOR']) r
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = r AND status = 'ACTIVE');
    IF missing IS NULL THEN PERFORM pg_temp.report('PASS', 'Có tài khoản ACTIVE cho đủ 4 vai trò để demo');
    ELSE PERFORM pg_temp.report('WARN', format('Chưa có tài khoản ACTIVE cho vai trò: %s', missing)); END IF;
END $$;

-- 5. Dữ liệu thử còn sót / dữ liệu cá nhân ----------------------------------------------
DO $$
DECLARE n int; m int;
BEGIN
    -- perf.local: database/tests/perf/seed-volume.sql; "Farm 1", "Distributor 1"...: cùng file đó.
    SELECT count(*) INTO n FROM users WHERE email ILIKE '%@perf.local' OR email ILIKE '%@example.%';
    SELECT count(*) INTO m FROM organizations WHERE name ~ '^(Farm|Processor|Distributor) [0-9]+$';
    IF n + m = 0 THEN PERFORM pg_temp.report('PASS', 'Không còn dữ liệu đo hiệu năng / dữ liệu thử');
    ELSE PERFORM pg_temp.report('WARN', format('Còn %s tài khoản và %s đơn vị của dữ liệu thử – nên tạo lại CSDL demo', n, m)); END IF;

    SELECT count(*) INTO n FROM users WHERE email NOT ILIKE '%@demo.local' AND role <> 'ADMIN';
    IF n = 0 THEN PERFORM pg_temp.report('PASS', 'Tài khoản không phải Admin đều là tài khoản demo (@demo.local)');
    ELSE PERFORM pg_temp.report('WARN', format('%s tài khoản dùng email ngoài @demo.local – kiểm tra không phải dữ liệu cá nhân thật', n)); END IF;

    SELECT count(*) INTO n FROM supply_chain_events
    WHERE coalesce(description, '') || ' ' || location ~ '(\m0[0-9]{9}\M|\m[0-9]{2}[A-Z]-?[0-9]{3}\.?[0-9]{2}\M|@)';
    IF n = 0 THEN PERFORM pg_temp.report('PASS', 'Mô tả / địa điểm sự kiện không có số điện thoại, biển số, email');
    ELSE PERFORM pg_temp.report('WARN', format('%s sự kiện có chuỗi giống số điện thoại / biển số / email trong mô tả', n)); END IF;
END $$;

-- 6. Quyền của vai trò backend fsc_app --------------------------------------------
DO $$
DECLARE bad text; login boolean;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fsc_app') THEN
        PERFORM pg_temp.report('FAIL', 'Thiếu vai trò fsc_app (migration 006)');
        RETURN;
    END IF;
    SELECT string_agg(t || ':' || p, ', ') INTO bad
    FROM unnest(ARRAY['audit_logs', 'supply_chain_events', 'qr_codes', 'roles', 'event_types']) t,
         unnest(ARRAY['UPDATE', 'DELETE', 'TRUNCATE']) p
    WHERE has_table_privilege('fsc_app', t, p);
    SELECT coalesce(bad || ', ', '') || coalesce(string_agg(c.relname || ':DELETE', ', '), '') INTO bad
    FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      AND has_table_privilege('fsc_app', c.oid, 'DELETE');
    IF bad = '' OR bad IS NULL THEN
        PERFORM pg_temp.report('PASS', 'fsc_app không sửa / xóa được lịch sử, không xóa được bảng nào');
    ELSE
        PERFORM pg_temp.report('FAIL', format('fsc_app có quyền thừa: %s', bad));
    END IF;
    SELECT rolcanlogin INTO login FROM pg_roles WHERE rolname = 'fsc_app';
    PERFORM pg_temp.report(CASE WHEN login THEN 'PASS' ELSE 'WARN' END,
        CASE WHEN login THEN 'fsc_app đăng nhập được (backend có thể dùng DB_USER=fsc_app)'
             ELSE 'fsc_app chưa bật đăng nhập – backend đang dùng tài khoản quản trị (xem docs/deployment.md)' END);
END $$;

-- 7. Bộ đếm IDENTITY không thấp hơn id lớn nhất (sau khi khôi phục / chèn tay) ----------
DO $$
DECLARE r record; nextv bigint; maxv bigint; bad text := '';
BEGIN
    FOR r IN
        SELECT c.relname AS tbl, a.attname AS col, pg_get_serial_sequence(c.relname, a.attname) AS seq
        FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
        WHERE c.relnamespace = 'public'::regnamespace AND a.attidentity <> '' AND c.relkind = 'r'
    LOOP
        EXECUTE format('SELECT coalesce(max(%I), 0) FROM %I', r.col, r.tbl) INTO maxv;
        EXECUTE format('SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM %s', r.seq) INTO nextv;
        IF nextv <= maxv THEN bad := bad || format('%s.%s (tiếp theo %s ≤ lớn nhất %s) ', r.tbl, r.col, nextv, maxv); END IF;
    END LOOP;
    IF bad = '' THEN PERFORM pg_temp.report('PASS', 'Bộ đếm id của mọi bảng đều lớn hơn id đang có');
    ELSE PERFORM pg_temp.report('FAIL', 'Bộ đếm id thấp hơn dữ liệu (thêm mới sẽ trùng khóa): ' || bad); END IF;
END $$;

-- 8. Tổng hợp ---------------------------------------------------------------------
DO $$
DECLARE f int := current_setting('demo_check.fail')::int; w int := current_setting('demo_check.warn')::int;
BEGIN
    RAISE NOTICE '---- % lô, % sự kiện, % tài khoản, % dòng audit',
        (SELECT count(*) FROM batches), (SELECT count(*) FROM supply_chain_events),
        (SELECT count(*) FROM users), (SELECT count(*) FROM audit_logs);
    IF f > 0 THEN
        RAISE EXCEPTION 'CSDL CHƯA SẠCH: % mục FAIL, % mục WARN', f, w;
    END IF;
    RAISE NOTICE 'CSDL SẠCH: 0 FAIL, % WARN', w;
END $$;

ROLLBACK;
