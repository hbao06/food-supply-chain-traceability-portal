-- =============================================================================
-- Migration 003 – sản phẩm, nông trại và lô sản phẩm (W5-TV3)
--
-- Kế hoạch tuần 5: "Tạo bảng Product, Farm, ProductBatch; khóa ngoại, unique batch_code".
-- Ánh xạ vào thiết kế đã chốt (ERD v3):
--   * Product      -> bảng MỚI `products`: danh mục sản phẩm của từng nông trại.
--   * Farm         -> `organizations` có type = 'FARM' (đã chốt từ W1/W3, US-S03);
--                     thêm view `farms` để truy vấn nông trại cho rõ nghĩa.
--   * ProductBatch -> `batches` (đã có batch_code UNIQUE, FK tới users / organizations);
--                     thêm `batches.product_id` liên kết tới `products`.
--
-- Tương thích ngược: `batches.product_id` KHÔNG bắt buộc và `batches.product_name` giữ nguyên,
-- nên API /batches hiện tại (W5-TV2, chỉ gửi productName) chạy không cần sửa.
-- Khi có product_id mà không gửi product_name, CSDL tự lấy tên từ danh mục.
-- =============================================================================

CREATE TABLE products (
    product_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id  BIGINT       NOT NULL REFERENCES organizations (organization_id) ON DELETE RESTRICT,
    name             VARCHAR(150) NOT NULL,
    category         VARCHAR(50)  NOT NULL,
    unit             VARCHAR(20)  NOT NULL DEFAULT 'kg',
    description      TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT chk_products_name_not_blank     CHECK (btrim(name) <> ''),
    CONSTRAINT chk_products_category_not_blank CHECK (btrim(category) <> ''),
    CONSTRAINT chk_products_unit_not_blank     CHECK (btrim(unit) <> ''),
    -- Một nông trại không có hai sản phẩm trùng tên (không phân biệt hoa thường: xem chỉ mục bên dưới).
    CONSTRAINT uq_products_org_name UNIQUE (organization_id, name)
);

CREATE UNIQUE INDEX uq_products_org_lower_name ON products (organization_id, lower(name));

COMMENT ON TABLE  products      IS 'Danh mục sản phẩm của nông trại. Không có DELETE (lô cũ vẫn tham chiếu).';
COMMENT ON COLUMN products.unit IS 'Đơn vị của batches.quantity: kg, tấn, thùng...';

-- Chỉ đơn vị loại FARM mới có sản phẩm; không đổi chủ sở hữu của sản phẩm đã có lô.
CREATE FUNCTION check_product_rules() RETURNS trigger
LANGUAGE plpgsql AS $$
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

CREATE TRIGGER trg_products_rules
    BEFORE INSERT OR UPDATE OF organization_id ON products
    FOR EACH ROW EXECUTE FUNCTION check_product_rules();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- batches.product_id
-- -----------------------------------------------------------------------------
ALTER TABLE batches
    ADD COLUMN product_id BIGINT REFERENCES products (product_id) ON DELETE RESTRICT;

CREATE INDEX idx_batches_product ON batches (product_id);

COMMENT ON COLUMN batches.product_id   IS 'Sản phẩm trong danh mục (không bắt buộc). Phải thuộc cùng nông trại với lô.';
COMMENT ON COLUMN batches.product_name IS 'Tên sản phẩm tại thời điểm tạo lô (ảnh chụp). Tự lấy từ products nếu chỉ gửi product_id.';

-- Sản phẩm của lô phải thuộc đúng nông trại sở hữu lô; chỉ đổi khi lô còn CREATED.
-- Chạy TRƯỚC trg_batches_rules (tên trigger theo thứ tự chữ cái) để điền product_name trước khi kiểm tra.
CREATE FUNCTION check_batch_product() RETURNS trigger
LANGUAGE plpgsql AS $$
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

CREATE TRIGGER trg_batches_a_product
    BEFORE INSERT OR UPDATE OF product_id, product_name ON batches
    FOR EACH ROW EXECUTE FUNCTION check_batch_product();

-- -----------------------------------------------------------------------------
-- View farms – nông trại là đơn vị loại FARM (chỉ đọc)
-- -----------------------------------------------------------------------------
CREATE VIEW farms AS
SELECT o.organization_id AS farm_id,
       o.name,
       o.address,
       o.created_at,
       (SELECT count(*) FROM products p WHERE p.organization_id = o.organization_id) AS product_count,
       (SELECT count(*) FROM batches  b WHERE b.organization_id = o.organization_id) AS batch_count
FROM organizations o
WHERE o.type = 'FARM';

COMMENT ON VIEW farms IS 'Nông trại = organizations.type = FARM. Thêm / sửa qua bảng organizations.';
