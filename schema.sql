-- ============================================================================
--  WOOD SALES & STOCK MANAGEMENT SYSTEM - PostgreSQL Schema
--  Target: Supabase PostgreSQL 17
--  Tables: wood_types, warehouses, products, inventory, stock_movements,
--          suppliers, clients(+crédit), purchase_orders(+items, frais),
--          sales_orders(+items, remises), payments, price_tiers,
--          kilns, drying_batches, monthly_archive, audit_logs
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. CORE REFERENCE TABLES
-- ----------------------------------------------------------------------------

-- Wood species / categories (e.g. Oak, Pine, Mahogany)
CREATE TABLE IF NOT EXISTS wood_types (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    scientific_name TEXT,
    category        TEXT,                        -- Hardwood / Softwood / Exotic
    density_kg_m3   NUMERIC(10,2),               -- air-dry density kg/m3
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Storage locations / warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id          BIGSERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    address     TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products: dimensional lumber, boards, beams, sheets, firewood, etc.
CREATE TABLE IF NOT EXISTS products (
    id               BIGSERIAL PRIMARY KEY,
    sku              TEXT NOT NULL UNIQUE,
    name             TEXT NOT NULL,
    wood_type_id     BIGINT REFERENCES wood_types(id),
    category         TEXT,                       -- Lumber / Board / Beam / Post / Sheet / Veneer / Firewood
    length_mm        NUMERIC(10,2),              -- dimensions in millimetres
    width_mm         NUMERIC(10,2),
    thickness_mm     NUMERIC(10,2),
    grade            TEXT,                       -- Prime / Select / Standard / Construction
    finish           TEXT,                       -- rough-sawn / planed / kiln-dried / sanded
    moisture_content NUMERIC(5,2),               -- %
    volume_cubic_m   NUMERIC(14,6),              -- volume of a single unit piece (m3)
    uom              TEXT NOT NULL DEFAULT 'cbm',-- cbm / piece / m2 / linear_m / ton
    cost_price       NUMERIC(14,4) NOT NULL DEFAULT 0,
    sale_price       NUMERIC(14,4) NOT NULL DEFAULT 0,
    currency         TEXT NOT NULL DEFAULT 'MAD',
    min_stock_qty    NUMERIC(14,4) NOT NULL DEFAULT 0,
    reorder_threshold_m3 NUMERIC(14,4),           -- seuil d'alerte réappro (m³)
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT products_volume_check CHECK (volume_cubic_m IS NULL OR volume_cubic_m >= 0),
    CONSTRAINT products_price_check CHECK (cost_price >= 0 AND sale_price >= 0)
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id            BIGSERIAL PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    company_name  TEXT NOT NULL,
    contact_name  TEXT,
    email         TEXT,
    phone         TEXT,
    address       TEXT,
    tax_id        TEXT,
    payment_terms TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients / customers
CREATE TABLE IF NOT EXISTS clients (
    id            BIGSERIAL PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    company_name  TEXT NOT NULL,
    contact_name  TEXT,
    email         TEXT,
    phone         TEXT,
    address       TEXT,
    tax_id          TEXT,
    payment_terms   TEXT,
    credit_limit    NUMERIC(14,2) NOT NULL DEFAULT 0,
    payment_terms_days INTEGER,                     -- délai de paiement (jours)
    is_blocked      BOOLEAN NOT NULL DEFAULT FALSE,-- ventes refusées si bloqué
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. INVENTORY
-- ----------------------------------------------------------------------------

-- Current on-hand stock per product per warehouse
CREATE TABLE IF NOT EXISTS inventory (
    id           BIGSERIAL PRIMARY KEY,
    product_id   BIGINT NOT NULL REFERENCES products(id),
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    quantity     NUMERIC(14,4) NOT NULL DEFAULT 0,
    reserved_qty NUMERIC(14,4) NOT NULL DEFAULT 0,
    avg_cost     NUMERIC(14,4) NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, warehouse_id),
    CONSTRAINT inventory_quantity_check CHECK (quantity >= 0),
    CONSTRAINT inventory_reserved_check CHECK (reserved_qty >= 0)
);

-- Stock movement ledger (audit trail for every quantity change)
CREATE TABLE IF NOT EXISTS stock_movements (
    id             BIGSERIAL PRIMARY KEY,
    movement_no    TEXT NOT NULL UNIQUE,
    product_id     BIGINT NOT NULL REFERENCES products(id),
    warehouse_id   BIGINT NOT NULL REFERENCES warehouses(id),
    movement_type  TEXT NOT NULL,
    quantity       NUMERIC(14,4) NOT NULL,       -- signed: negative = decrease
    unit_price     NUMERIC(14,4),
    reference_type TEXT,                         -- purchase_order / sales_order / adjustment / transfer / opening
    reference_id   BIGINT,
    note           TEXT,
    moved_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT stock_movements_type_check CHECK (movement_type IN (
        'purchase_in','purchase_return','sale_out','sale_return',
        'adjustment','transfer_in','transfer_out','opening')),
    CONSTRAINT stock_movements_qty_check CHECK (quantity <> 0)
);

-- ----------------------------------------------------------------------------
-- 3. PURCHASES (from suppliers)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS purchase_orders (
    id             BIGSERIAL PRIMARY KEY,
    po_number      TEXT NOT NULL UNIQUE,
    supplier_id    BIGINT NOT NULL REFERENCES suppliers(id),
    warehouse_id   BIGINT NOT NULL REFERENCES warehouses(id),
    order_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date  DATE,
    status         TEXT NOT NULL DEFAULT 'draft',
    subtotal       NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount     NUMERIC(14,4) NOT NULL DEFAULT 0,
    total_amount   NUMERIC(14,4) NOT NULL DEFAULT 0,
    freight_cost   NUMERIC(14,2) NOT NULL DEFAULT 0, -- frais import alloués au m³
    customs_cost   NUMERIC(14,2) NOT NULL DEFAULT 0,
    handling_cost  NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency       TEXT NOT NULL DEFAULT 'MAD',
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT purchase_orders_status_check CHECK (status IN (
        'draft','ordered','partially_received','received','cancelled'))
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id                BIGSERIAL PRIMARY KEY,
    purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id        BIGINT NOT NULL REFERENCES products(id),
    quantity_ordered  NUMERIC(14,4) NOT NULL,
    quantity_received NUMERIC(14,4) NOT NULL DEFAULT 0,
    unit_price        NUMERIC(14,4) NOT NULL DEFAULT 0,
    line_total        NUMERIC(14,4) NOT NULL DEFAULT 0,
    allocated_fees    NUMERIC(14,2) NOT NULL DEFAULT 0, -- part des frais (au m³)
    CONSTRAINT purchase_order_items_qty_check CHECK (quantity_ordered > 0 AND quantity_received >= 0)
);

-- ----------------------------------------------------------------------------
-- 4. SALES (to clients)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_orders (
    id            BIGSERIAL PRIMARY KEY,
    so_number     TEXT NOT NULL UNIQUE,
    client_id     BIGINT NOT NULL REFERENCES clients(id),
    warehouse_id  BIGINT NOT NULL REFERENCES warehouses(id),
    order_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE,
    status        TEXT NOT NULL DEFAULT 'draft',
    subtotal      NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount    NUMERIC(14,4) NOT NULL DEFAULT 0,
    total_amount  NUMERIC(14,4) NOT NULL DEFAULT 0,
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0, -- remise volume (palier)
    discount_amount  NUMERIC(14,4) NOT NULL DEFAULT 0,
    tier_name     TEXT,                          -- nom du palier appliqué
    currency      TEXT NOT NULL DEFAULT 'MAD',
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sales_orders_status_check CHECK (status IN (
        'draft','confirmed','partially_shipped','shipped','delivered','cancelled'))
);

CREATE TABLE IF NOT EXISTS sales_order_items (
    id               BIGSERIAL PRIMARY KEY,
    sales_order_id   BIGINT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id       BIGINT NOT NULL REFERENCES products(id),
    quantity_ordered NUMERIC(14,4) NOT NULL,
    quantity_shipped NUMERIC(14,4) NOT NULL DEFAULT 0,
    unit_price       NUMERIC(14,4) NOT NULL DEFAULT 0,
    line_total       NUMERIC(14,4) NOT NULL DEFAULT 0,
    CONSTRAINT sales_order_items_qty_check CHECK (quantity_ordered > 0 AND quantity_shipped >= 0)
);

-- ----------------------------------------------------------------------------
-- 5. TRIGGERS
-- ----------------------------------------------------------------------------

-- Generic updated_at keeper
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wood_types_updated ON wood_types;
CREATE TRIGGER trg_wood_types_updated
    BEFORE UPDATE ON wood_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_warehouses_updated ON warehouses;
CREATE TRIGGER trg_warehouses_updated
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_updated ON suppliers;
CREATE TRIGGER trg_suppliers_updated
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated ON clients;
CREATE TRIGGER trg_clients_updated
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_orders_updated ON purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_sales_orders_updated ON sales_orders;
CREATE TRIGGER trg_sales_orders_updated
    BEFORE UPDATE ON sales_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Automatically maintain inventory from every stock movement.
-- Increases: purchase_in, sale_return, transfer_in, opening, positive adjustment
-- Decreases: sale_out, purchase_return, transfer_out, negative adjustment
--
-- NOTE: row-level CHECK constraints are evaluated on the *proposed* INSERT row
-- BEFORE the conflict test, so "INSERT ... ON CONFLICT" cannot be used with a
-- `quantity >= 0` check. We therefore lock + read + update explicitly in
-- PL/pgSQL, which also yields clean "Insufficient stock" errors.
CREATE OR REPLACE FUNCTION maintain_inventory() RETURNS trigger AS $$
DECLARE
    delta NUMERIC(14,4);
    current_qty NUMERIC(14,4);
    new_qty NUMERIC(14,4);
BEGIN
    delta := NEW.quantity;
    IF NEW.movement_type IN ('sale_out', 'purchase_return', 'transfer_out') THEN
        delta := -delta;
    END IF;

    SELECT quantity INTO current_qty
    FROM inventory
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id
    FOR UPDATE;

    IF current_qty IS NULL THEN
        IF delta < 0 THEN
            RAISE EXCEPTION 'Insufficient stock: product % has no stock in warehouse % (movement %).',
                NEW.product_id, NEW.warehouse_id, NEW.movement_no
                USING ERRCODE = 'P0001';
        END IF;
        INSERT INTO inventory (product_id, warehouse_id, quantity, reserved_qty, avg_cost, updated_at)
        VALUES (NEW.product_id, NEW.warehouse_id, delta, 0, 0, now());
    ELSE
        new_qty := current_qty + delta;
        IF new_qty < 0 THEN
            RAISE EXCEPTION 'Insufficient stock: product % in warehouse % - available %, required % (movement %).',
                NEW.product_id, NEW.warehouse_id, current_qty, -delta, NEW.movement_no
                USING ERRCODE = 'P0001';
        END IF;
        UPDATE inventory SET quantity = new_qty, updated_at = now()
        WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_movements_maintain_inventory ON stock_movements;
CREATE TRIGGER trg_stock_movements_maintain_inventory
    AFTER INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION maintain_inventory();

-- ----------------------------------------------------------------------------
-- 6. INDEXES
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_products_wood_type        ON products(wood_type_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product         ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse       ON inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product   ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_moved_at  ON stock_movements(moved_at);
CREATE INDEX IF NOT EXISTS idx_po_supplier               ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_items_order            ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_so_client                 ON sales_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_so_items_order            ON sales_order_items(sales_order_id);

-- ----------------------------------------------------------------------------
-- 7. REFERENCE SEED DATA
-- ----------------------------------------------------------------------------

INSERT INTO wood_types (name, scientific_name, category, density_kg_m3, description) VALUES
    ('Oak',             'Quercus robur',        'Hardwood', 720, 'European Oak - furniture & flooring'),
    ('European Beech',  'Fagus sylvatica',      'Hardwood', 700, 'Beech - chairs, worktops, toys'),
    ('Ash',             'Fraxinus excelsior',   'Hardwood', 710, 'Ash - tool handles, sports equipment'),
    ('Spruce',          'Picea abies',          'Softwood', 450, 'Spruce - construction, joinery'),
    ('Pine',            'Pinus sylvestris',     'Softwood', 510, 'Scots Pine - general carpentry'),
    ('Larch',           'Larix decidua',        'Softwood', 590, 'Larch - outdoor cladding, decking'),
    ('Mahogany',        'Swietenia macrophylla','Hardwood', 640, 'Mahogany - premium furniture'),
    ('Walnut',          'Juglans regia',        'Hardwood', 640, 'Walnut - veneers, fine furniture')
ON CONFLICT (name) DO NOTHING;

INSERT INTO warehouses (code, name, address) VALUES
    ('WH-MAIN', 'Main Warehouse', '1 Timber Yard, Industrial Estate'),
    ('WH-OUT',  'Outdoor Storage', '2 Open Yard, Sawmill Road')
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 9. ENTERPRISE MODULES
--    payments · tier pricing · séchoirs/séchage · archives · audit
-- ----------------------------------------------------------------------------

-- Idempotent column catch-up for databases provisioned from an older version
-- of this file (fresh installs already get the columns above).
ALTER TABLE products       ADD COLUMN IF NOT EXISTS reorder_threshold_m3 NUMERIC(14,4);
ALTER TABLE clients        ADD COLUMN IF NOT EXISTS payment_terms_days   INTEGER;
ALTER TABLE clients        ADD COLUMN IF NOT EXISTS is_blocked           BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS freight_cost  NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS customs_cost  NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS handling_cost NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS allocated_fees NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sales_orders   ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2)  NOT NULL DEFAULT 0;
ALTER TABLE sales_orders   ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE sales_orders   ADD COLUMN IF NOT EXISTS tier_name        TEXT;

-- Receipts against client invoices (acompte possible sans facture)
CREATE TABLE IF NOT EXISTS payments (
    id             BIGSERIAL PRIMARY KEY,
    client_id      BIGINT NOT NULL REFERENCES clients(id),
    sales_order_id BIGINT REFERENCES sales_orders(id) ON DELETE SET NULL,
    amount         NUMERIC(14,2) NOT NULL,
    payment_date   DATE NOT NULL,
    method         TEXT,                          -- virement / chèque / espèces…
    reference      TEXT,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_amount_positive CHECK (amount > 0)
);

-- Volume-based discount brackets on total order volume (m³)
CREATE TABLE IF NOT EXISTS price_tiers (
    id               BIGSERIAL PRIMARY KEY,
    name             TEXT NOT NULL,
    min_volume_m3    NUMERIC(14,4) NOT NULL,
    max_volume_m3    NUMERIC(14,4),              -- NULL = pas de borne haute
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT price_tiers_discount_range CHECK (discount_percent >= 0 AND discount_percent <= 90)
);

-- Kiln / séchoir units (capacity in m³, hosted in a warehouse)
CREATE TABLE IF NOT EXISTS kilns (
    id              BIGSERIAL PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    warehouse_id    BIGINT NOT NULL REFERENCES warehouses(id),
    max_capacity_m3 NUMERIC(14,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kiln drying charges — lifecycle: in_progress → completed | cancelled.
-- Completing a cycle stores the final moisture on the product, flags it
-- kiln-dried and raises its unit prices by energy_cost / initial_volume_m3.
-- The moisture *stage* (green ≤18% < air_dried … kd ≤12%) is derived in app.
CREATE TABLE IF NOT EXISTS drying_batches (
    id                BIGSERIAL PRIMARY KEY,
    batch_no          TEXT NOT NULL UNIQUE,
    product_id        BIGINT NOT NULL REFERENCES products(id),
    kiln_id           BIGINT REFERENCES kilns(id) ON DELETE SET NULL,
    warehouse_id      BIGINT NOT NULL REFERENCES warehouses(id),
    status            TEXT NOT NULL DEFAULT 'in_progress',
    quantity          NUMERIC(14,4) NOT NULL DEFAULT 0,
    initial_volume_m3 NUMERIC(14,4) NOT NULL DEFAULT 0, -- m³ figés à la création
    start_moisture    NUMERIC(5,2),
    target_moisture   NUMERIC(5,2),
    current_moisture  NUMERIC(5,2),
    energy_cost       NUMERIC(14,2) NOT NULL DEFAULT 0, -- MAD sur tout le cycle
    estimated_end_date DATE,
    notes             TEXT,
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT drying_batches_status_check CHECK (status IN (
        'in_progress','completed','cancelled'))
);

-- Monthly stock snapshots (clôture + agrégats de mouvements du mois)
CREATE TABLE IF NOT EXISTS monthly_archive (
    id                 BIGSERIAL PRIMARY KEY,
    year               INTEGER NOT NULL,
    month              INTEGER NOT NULL,         -- 1-12
    product_id         BIGINT NOT NULL REFERENCES products(id),
    warehouse_id       BIGINT NOT NULL REFERENCES warehouses(id),
    closing_qty        NUMERIC(14,4) NOT NULL DEFAULT 0,
    closing_value      NUMERIC(18,2) NOT NULL DEFAULT 0,
    purchase_qty       NUMERIC(14,4) NOT NULL DEFAULT 0,
    purchase_value     NUMERIC(18,2) NOT NULL DEFAULT 0,
    sale_qty           NUMERIC(14,4) NOT NULL DEFAULT 0,
    sale_value         NUMERIC(18,2) NOT NULL DEFAULT 0,
    transfer_in_qty    NUMERIC(14,4) NOT NULL DEFAULT 0,
    transfer_out_qty   NUMERIC(14,4) NOT NULL DEFAULT 0,
    adjustment_qty     NUMERIC(14,4) NOT NULL DEFAULT 0,
    opening_qty        NUMERIC(14,4) NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (year, month, product_id, warehouse_id)
);

-- Immutable activity trail. user_id points at Django's auth_user table
-- (created by `manage.py migrate`), so no FK here to keep this script standalone.
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT,
    action      TEXT NOT NULL,                   -- create/update/delete/price_update/login/…
    entity_type TEXT NOT NULL,
    entity_id   BIGINT,
    entity_ref  TEXT,
    details     JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_payments_updated ON payments;
CREATE TRIGGER trg_payments_updated
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_price_tiers_updated ON price_tiers;
CREATE TRIGGER trg_price_tiers_updated
    BEFORE UPDATE ON price_tiers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_kilns_updated ON kilns;
CREATE TRIGGER trg_kilns_updated
    BEFORE UPDATE ON kilns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_drying_batches_updated ON drying_batches;
CREATE TRIGGER trg_drying_batches_updated
    BEFORE UPDATE ON drying_batches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 10. ENTERPRISE INDEXES
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payments_client        ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_price_tiers_min_vol   ON price_tiers(min_volume_m3);
CREATE INDEX IF NOT EXISTS idx_kilns_warehouse       ON kilns(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_drying_product        ON drying_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_drying_kiln           ON drying_batches(kiln_id);
CREATE INDEX IF NOT EXISTS idx_drying_warehouse      ON drying_batches(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_drying_status         ON drying_batches(status);
CREATE INDEX IF NOT EXISTS idx_archive_year_month    ON monthly_archive(year, month);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created    ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);

-- ----------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY NOTES (uncomment when building the API)
-- ----------------------------------------------------------------------------
-- ALTER TABLE wood_types          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE warehouses          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE suppliers           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE clients             ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE inventory           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stock_movements     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE purchase_orders     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sales_orders        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sales_order_items   ENABLE ROW LEVEL SECURITY;
-- Then create appropriate policies for the anon / authenticated roles.

COMMIT;
