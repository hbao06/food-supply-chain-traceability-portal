-- =============================================================================
-- Dữ liệu khối lượng lớn để đo truy vấn (W7-TV3) – CHỈ dùng cho CSDL thử, KHÔNG chạy trên CSDL dev/demo.
-- 16 đơn vị, 80 người dùng, 60 000 lô (2025 + 2026), ~143 000 sự kiện, 60 000 audit. Mất khoảng 30 giây.
--
--   createdb -U postgres fsc_perf
--   (chạy migration vào fsc_perf: DB_NAME=fsc_perf npm run db:migrate)
--   psql -U postgres -d fsc_perf -1 -v ON_ERROR_STOP=1 -f database/tests/perf/seed-volume.sql
--   psql -U postgres -d fsc_perf -f database/tests/perf/explain-queries.sql
--
-- Mọi dòng đi qua đủ trigger / ràng buộc như dữ liệu thật (vai trò, thứ tự sự kiện, chuỗi băm).
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM batches) OR EXISTS (SELECT 1 FROM users) THEN
        RAISE EXCEPTION 'CSDL đã có dữ liệu – chỉ chạy trên CSDL thử trống';
    END IF;
END $$;

INSERT INTO organizations (name, type)
SELECT 'Farm '||g, 'FARM' FROM generate_series(1,10) g
UNION ALL SELECT 'Processor '||g, 'PROCESSOR' FROM generate_series(1,3) g
UNION ALL SELECT 'Distributor '||g, 'DISTRIBUTOR' FROM generate_series(1,3) g;

INSERT INTO users (organization_id, name, email, password_hash, role, status)
SELECT o.organization_id, o.name||' user '||g, lower(replace(o.name,' ',''))||g||'@perf.local',
       '$2b$10$' || repeat('a',53),
       CASE o.type WHEN 'FARM' THEN 'FARMER' ELSE o.type END, 'ACTIVE'
FROM organizations o CROSS JOIN generate_series(1,5) g;

-- 60 000 lô: 2025 và 2026, mỗi năm 30 000
INSERT INTO batches (batch_code, product_name, origin, quantity, creation_date, created_by, organization_id)
SELECT format('BATCH-%s-%s', y, lpad(n::text, greatest(4, length(n::text)), '0')),
       (ARRAY['Cà phê Robusta','Gạo ST25','Hồ tiêu','Sầu riêng Ri6','Thanh long','Chè Shan tuyết','Điều','Xoài cát'])[1 + (n % 8)] || ' lô ' || n,
       'Đắk Lắk', 100 + n % 500,
       make_timestamptz(y, 1, 1, 0, 0, 0) + (n || ' minutes')::interval * 15,
       u.user_id, u.organization_id
FROM generate_series(2025, 2026) y
CROSS JOIN generate_series(1, 30000) n
JOIN LATERAL (SELECT user_id, organization_id FROM users WHERE role='FARMER'
              ORDER BY user_id OFFSET (n % 50) LIMIT 1) u ON TRUE;

-- Sự kiện: mọi lô có CREATED; tiến độ giảm dần theo bước; đơn vị Processor/Distributor xoay vòng theo batch_id
INSERT INTO supply_chain_events (batch_id, actor_id, event_type, location, "timestamp")
SELECT batch_id, created_by, 'CREATED', origin, creation_date FROM batches ORDER BY batch_id;

CREATE TEMP TABLE step(code text, pct int, role text);
INSERT INTO step VALUES ('TRANSPORTED',50,'DISTRIBUTOR'),('RECEIVED',35,'DISTRIBUTOR'),
  ('PROCESSED',25,'PROCESSOR'),('PACKAGED',18,'PROCESSOR'),('SHIPPED',10,'DISTRIBUTOR');
DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT * FROM step ORDER BY (SELECT seq_no FROM event_types WHERE code = step.code) LOOP
    INSERT INTO supply_chain_events (batch_id, actor_id, event_type, location, "timestamp")
    SELECT b.batch_id,
           (SELECT u.user_id FROM users u JOIN organizations o USING (organization_id)
             WHERE u.role = s.role ORDER BY u.user_id OFFSET (b.batch_id % 15) LIMIT 1),
           s.code, 'Kho ' || s.code, b.creation_date + interval '1 hour' * (SELECT seq_no FROM event_types WHERE code = s.code)
    FROM batches b WHERE b.batch_id % 100 < s.pct ORDER BY b.batch_id;
  END LOOP;
END $$;

INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_value)
SELECT created_by, 'CREATE', 'BATCH', batch_id, jsonb_build_object('batchCode', batch_code) FROM batches ORDER BY batch_id;
ANALYZE;
