"""Replicate the ``maintain_inventory`` trigger so schema.sql and Django
migrations stay consistent (fresh test databases rely on migrations)."""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("stock", "0004_client_is_blocked_client_payment_terms_days_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
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
""",
            reverse_sql="""
DROP TRIGGER IF EXISTS trg_stock_movements_maintain_inventory ON stock_movements;
DROP FUNCTION IF EXISTS maintain_inventory();
""",
        ),
    ]