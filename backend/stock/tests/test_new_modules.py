"""Permanent regression tests for the four enterprise modules:

- landed cost & true margin (purchase fees + item allocation)
- client credit limits, payments & overdue
- kiln drying workflow (batch lifecycle: in_progress -> completed | cancelled)
- volume-based tier pricing

Isolated fixtures: every test creates its own data against a fresh test
database (the ``maintain_inventory`` trigger is available because migration
``0005_maintain_inventory_trigger`` installs it).
"""
import base64
import re
import zlib
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from stock import services
from stock.models import (
    Client,
    DeliveryNote,
    DryingBatch,
    Inventory,
    Kiln,
    PriceTier,
    Product,
    SalesOrder,
    StockMovement,
    Supplier,
    Warehouse,
    compute_volume_m3,
)

User = get_user_model()

PANEL = {"thickness_mm": 18, "width_mm": 2500, "length_mm": 1220, "category": "Panneaux"}
SMALL = {"thickness_mm": 27, "width_mm": 40, "length_mm": 3000, "category": "Bois rouge"}


class BaseModulesTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create(username="tester", password="pass")
        cls.token = Token.objects.create(user=cls.user)
        cls.wh = Warehouse.objects.create(code="WH-TEST", name="Dépôt test")
        cls.sup = Supplier.objects.create(code="SUP-TEST", company_name="Fournisseur test")
        PriceTier.objects.create(name="Tarif détail", min_volume_m3=0, max_volume_m3=10, discount_percent=0)
        PriceTier.objects.create(name="Tarif semi-gros", min_volume_m3=10, max_volume_m3=25, discount_percent=3)
        PriceTier.objects.create(name="Tarif gros", min_volume_m3=25, max_volume_m3=50, discount_percent=5)
        PriceTier.objects.create(name="Tarif industriel", min_volume_m3=50, max_volume_m3=None, discount_percent=8)

    def setUp(self):
        self.api = APIClient()
        self.api.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def make_product(self, sku, name, dims=PANEL, cost="3500", sale="4200"):
        return Product.objects.create(
            sku=sku, name=name, cost_price=Decimal(cost), sale_price=Decimal(sale), **dims
        )

    def make_client(self, code, credit_limit="100000", terms=30, blocked=False):
        return Client.objects.create(
            code=code, company_name=code, credit_limit=Decimal(credit_limit),
            payment_terms_days=terms, is_blocked=blocked,
        )

    def buy(self, product, qty, price=None):
        return services.create_purchase(
            self.sup, self.wh,
            [{"product": product, "quantity": qty, "price_per_m3": price or product.cost_price}],
        )

    def buy_panel_stock(self, qty=600):
        product = self.make_product("SKU-SALE-PANEL", "Panneau MDF", dims=PANEL, cost="3500", sale="4200")
        self.buy(product, qty, price="3500")
        return product


class PriceTierTests(BaseModulesTest):
    def test_pricing_lookup_endpoint(self):
        r = self.api.get("/api/pricing/lookup/", {"volume_m3": "3"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["tier_name"], "Tarif détail")
        self.assertEqual(r.data["discount_percent"], 0.0)

        r = self.api.get("/api/pricing/lookup/", {"volume_m3": "30"})
        self.assertEqual(r.data["tier_name"], "Tarif gros")
        self.assertEqual(r.data["discount_percent"], 5.0)

        r = self.api.get("/api/pricing/lookup/", {"volume_m3": "55"})
        self.assertEqual(r.data["tier_name"], "Tarif industriel")
        self.assertEqual(r.data["discount_percent"], 8.0)

    def test_resolve_tier_picks_highest_match(self):
        self.assertIsNone(services.resolve_tier(Decimal("0")))
        self.assertEqual(services.resolve_tier(Decimal("24")).name, "Tarif semi-gros")
        self.assertEqual(services.resolve_tier(Decimal("25")).name, "Tarif gros")
        self.assertEqual(services.resolve_tier(Decimal("49.9")).name, "Tarif gros")
        self.assertEqual(services.resolve_tier(Decimal("50")).name, "Tarif industriel")

    def test_price_tiers_list_endpoint(self):
        r = self.api.get("/api/price-tiers/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 4)


class ClientCreditTests(BaseModulesTest):
    def test_credit_summary_outstanding_and_overdue(self):
        client = self.make_client("CLI-CREDIT-1", credit_limit="500000")
        product = self.make_product("SKU-CREDIT-1", "Planche test")
        self.buy(product, 600, price="3500")
        so = services.create_sale(
            client, self.wh,
            [{"product": product, "quantity": 546, "price_per_m3": product.sale_price}],
            order_date=timezone.localdate() - timedelta(days=60),
        )
        summary = services.client_credit_summary(client)
        self.assertEqual(summary["outstanding"], so.total_amount)
        self.assertEqual(summary["overdue"], so.total_amount)
        self.assertFalse(summary["over_limit"])

    def test_payment_reduces_balance_and_outstanding(self):
        client = self.make_client("CLI-CREDIT-2")
        product = self.make_product("SKU-CREDIT-2", "Planche test")
        self.buy(product, 600, price="3500")
        so = services.create_sale(
            client, self.wh, [{"product": product, "quantity": 546, "price_per_m3": product.sale_price}]
        )
        before = services.client_credit_summary(client)

        r = self.api.post("/api/payments/", {
            "client_id": client.pk,
            "sales_order_id": so.pk,
            "amount": "2500.00",
            "method": "Virement",
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(float(r.data["amount"]), 2500.0)

        after = services.client_credit_summary(client)
        self.assertLess(after["outstanding"], before["outstanding"])
        self.assertEqual(so.paid_amount, Decimal("2500.00"))

    def test_credit_endpoint(self):
        client = self.make_client("CLI-CREDIT-3")
        product = self.make_product("SKU-CREDIT-3", "Planche test")
        self.buy(product, 600, price="3500")
        services.create_sale(
            client, self.wh, [{"product": product, "quantity": 546, "price_per_m3": product.sale_price}]
        )
        r = self.api.get(f"/api/clients/{client.pk}/credit/")
        self.assertEqual(r.status_code, 200)
        for field in ("credit_limit", "outstanding", "overdue", "available_credit", "over_limit"):
            self.assertIn(field, r.data)

    def test_blocked_client_sale_refused(self):
        blocked = self.make_client("CLI-BLOCK-1", blocked=True)
        product = self.make_product("SKU-BLOCK-1", "Planche test", dims=SMALL)
        r = self.api.post("/api/sales/", {
            "client_id": blocked.pk,
            "warehouse_id": self.wh.pk,
            "items": [{"product_id": product.pk, "quantity": "10",
                       "price_per_m3": "4000", **SMALL}],
        }, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Client bloqué", r.data["detail"])

    def test_client_serializer_exposes_credit_fields(self):
        self.make_client("CLI-LIST-1")
        r = self.api.get("/api/clients/")
        self.assertEqual(r.status_code, 200)
        results = r.data["results"]
        self.assertIn("payment_terms_days", results[0])
        self.assertIn("credit_limit", results[0])


class DryingBatchTests(BaseModulesTest):
    def setUp(self):
        super().setUp()
        self.product = self.make_product("SKU-DRY-1", "Bois à sécher", dims=SMALL)
        self.kiln = Kiln.objects.create(
            code="SEC-X", name="Séchoir test", warehouse=self.wh,
            max_capacity_m3=Decimal("10"),
        )

    def _volume_m3(self, qty):
        return compute_volume_m3(
            SMALL["thickness_mm"], SMALL["width_mm"], SMALL["length_mm"], Decimal(qty)
        )

    def _batch(self, qty=100, energy=Decimal("324")):
        """200 pieces × 0.00324 m³ = 0.324 m³ per batch (`self.kiln`, SEC-X)."""
        return services.create_drying_batch(
            self.product, Decimal(qty), kiln=self.kiln,
            start_moisture=Decimal("18"), target_moisture=Decimal("9"),
            energy_cost=energy,
        )

    def test_create_batch_via_api(self):
        r = self.api.post("/api/drying-batches/", {
            "product_id": self.product.pk, "kiln_id": self.kiln.pk,
            "quantity": "5", "start_moisture": "20", "target_moisture": "9",
            "energy_cost": "1200",
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "in_progress")
        self.assertTrue(r.data["batch_no"].startswith("KD"))
        self.assertEqual(r.data["kiln_code"], "SEC-X")
        # the warehouse snapshot defaults to the kiln's warehouse
        self.assertEqual(r.data["warehouse_id"], self.wh.pk)
        self.assertEqual(float(r.data["initial_volume_m3"]), float(self._volume_m3(5)))
        # stage + progress derived from the current moisture (start = 20 → green, 0%)
        self.assertEqual(r.data["stage"], "green")
        self.assertEqual(r.data["progress_pct"], 0.0)

    def test_create_rejects_over_capacity(self):
        r = self.api.post("/api/drying-batches/", {
            "product_id": self.product.pk, "kiln_id": self.kiln.pk,
            "quantity": "4000", "start_moisture": "20",
        }, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Capacité insuffisante", str(r.data))
        self.assertFalse(DryingBatch.objects.exists())

    def test_create_up_to_capacity_is_allowed(self):
        qty = int(Decimal("10") / Decimal("0.00324"))  # ≈ full 10 m³ charge
        r = self.api.post("/api/drying-batches/", {
            "product_id": self.product.pk, "kiln_id": self.kiln.pk,
            "quantity": str(qty), "start_moisture": "20",
        }, format="json")
        self.assertEqual(r.status_code, 201)

    def test_complete_applies_moisture_and_price_bump(self):
        batch = self._batch(energy=Decimal("324"))  # 0.324 m³ → 324/0.324 = 1 000 MAD/m³
        cost_before = self.product.cost_price
        sale_before = self.product.sale_price

        r = self.api.post(f"/api/drying-batches/{batch.pk}/complete/",
                          {"current_moisture": "8.5"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "completed")
        self.assertEqual(r.data["stage"], "kd")
        self.assertEqual(Decimal(str(r.data["current_moisture"])), Decimal("8.50"))
        self.assertEqual(float(r.data["energy_cost_per_m3"]), 1000.0)

        self.product.refresh_from_db()
        self.assertEqual(self.product.moisture_content, Decimal("8.50"))
        self.assertEqual(self.product.finish, "kiln-dried")
        bump = Decimal("1000.00")
        self.assertEqual(self.product.cost_price, cost_before + bump)
        self.assertEqual(self.product.sale_price, sale_before + bump)

    def test_completed_batch_cannot_be_completed_again(self):
        batch = self._batch()
        self.api.post(f"/api/drying-batches/{batch.pk}/complete/",
                      {"current_moisture": "9"}, format="json")
        r = self.api.post(f"/api/drying-batches/{batch.pk}/complete/",
                          {"current_moisture": "8"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_cancel_batch_leaves_product_untouched(self):
        batch = self._batch()
        r = self.api.post(f"/api/drying-batches/{batch.pk}/cancel/", {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "cancelled")

        self.product.refresh_from_db()
        self.assertIsNone(self.product.finish)
        self.assertIsNone(self.product.moisture_content)
        self.assertEqual(self.product.cost_price, Decimal("3500"))
        self.assertEqual(self.product.sale_price, Decimal("4200"))

    def test_cancelled_batch_cannot_be_completed(self):
        batch = self._batch()
        self.api.post(f"/api/drying-batches/{batch.pk}/cancel/", {}, format="json")
        r = self.api.post(f"/api/drying-batches/{batch.pk}/complete/",
                          {"current_moisture": "9"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_kiln_occupancy_and_dashboard(self):
        self._batch(qty=100, energy=Decimal("324"))
        self._batch(qty=100, energy=Decimal("100"))

        r = self.api.get("/api/kilns/")
        self.assertEqual(r.status_code, 200)
        kiln = next(k for k in r.data if k["id"] == self.kiln.pk)
        self.assertEqual(float(kiln["occupied_m3"]), 0.648)
        self.assertEqual(float(kiln["available_m3"]), 9.352)
        self.assertEqual(kiln["active_batch_count"], 2)

        dash = self.api.get("/api/kilns/dashboard/").data
        self.assertEqual(dash["operating_kilns"], 1)
        self.assertEqual(dash["total_kilns"], 1)
        self.assertEqual(float(dash["total_capacity_m3"]), 10.0)
        self.assertEqual(float(dash["occupied_m3"]), 0.648)
        self.assertEqual(float(dash["utilization_pct"]), 6.5)
        self.assertEqual(dash["batches_in_progress"], 2)
        self.assertEqual(float(dash["total_energy_cost"]), 424.0)
        self.assertIsNone(dash["avg_drying_days"])
        self.assertEqual(len(dash["kilns"]), 1)

    def test_kiln_batches_history(self):
        self._batch()
        self._batch()
        r = self.api.get(f"/api/kilns/{self.kiln.pk}/batches/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 2)
        self.assertTrue(all(b["kiln_code"] == "SEC-X" for b in r.data))
        self.assertIn("progress_pct", r.data[0])


class PaymentTests(BaseModulesTest):
    def test_payments_list_filter_and_create(self):
        client = self.make_client("CLI-PAY-1")
        product = self.make_product("SKU-PAY-1", "Planche test")
        self.buy(product, 600, price="3500")
        so = services.create_sale(
            client, self.wh, [{"product": product, "quantity": 546, "price_per_m3": product.sale_price}]
        )

        r = self.api.post("/api/payments/", {
            "client_id": client.pk, "sales_order_id": so.pk,
            "amount": "1234.56", "method": "Chèque", "note": "test",
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(float(r.data["amount"]), 1234.56)

        r = self.api.get("/api/payments/", {"client": client.pk})
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.data), 1)
        self.assertTrue(all(p["client_id"] == client.pk for p in r.data))

    def test_sale_serializer_exposes_balance(self):
        client = self.make_client("CLI-PAY-2")
        product = self.make_product("SKU-PAY-2", "Planche test")
        self.buy(product, 600, price="3500")
        so = services.create_sale(
            client, self.wh, [{"product": product, "quantity": 546, "price_per_m3": product.sale_price}]
        )
        r = self.api.get("/api/sales-orders/", {"page_size": "50"})
        found = next(s for s in r.data["results"] if s["id"] == so.pk)
        for field in ("balance_due", "paid_amount", "due_date"):
            self.assertIn(field, found)
        self.assertEqual(found["paid_amount"], 0.0)
        self.assertGreater(found["balance_due"], 0)


class LandedCostAndSaleTests(BaseModulesTest):
    def test_purchase_fees_landed_cost_per_m3(self):
        product = self.make_product("SKU-FEES-1", "Planche import", dims=SMALL, cost="8600", sale="9800")
        r = self.api.post("/api/purchases/", {
            "supplier_id": self.sup.pk, "warehouse_id": self.wh.pk,
            "items": [{"product_id": product.pk, "quantity": "1000",
                       "price_per_m3": "8600", **SMALL}],
            "fees": {"freight_cost": "900", "customs_cost": "100", "handling_cost": "50"},
        }, format="json")
        self.assertEqual(r.status_code, 201)
        po = r.data
        self.assertEqual(float(po["total_fees"]), 1050.0)
        self.assertEqual(float(po["subtotal"]) + 1050.0, float(po["landed_total"]))

        item = po["items"][0]
        self.assertEqual(float(item["allocated_fees"]), 1050.0)
        self.assertGreater(float(item["landed_cost_per_m3"]), 8600.0)

        prod_r = self.api.get(f"/api/products/{product.pk}/")
        self.assertIsNotNone(prod_r.data.get("landed_cost_per_m3"))

    def test_sale_tier_discount_and_margins(self):
        client = self.make_client("CLI-SALE-1")
        product = self.buy_panel_stock()  # 600 * 0.0549 m³
        qty = 546  # ~ 29.97 m³ -> Tarif gros (-5%)
        r = self.api.post("/api/sales/", {
            "client_id": client.pk, "warehouse_id": self.wh.pk,
            "items": [{"product_id": product.pk, "quantity": str(qty),
                       "price_per_m3": "4200", **PANEL}],
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        so = r.data
        self.assertEqual(so["tier_name"], "Tarif gros")
        self.assertEqual(float(so["discount_percent"]), 5.0)

        subtotal = Decimal(str(so["subtotal"]))
        expected_discount = (subtotal * Decimal("5") / Decimal("100")).quantize(Decimal("0.0001"))
        self.assertEqual(Decimal(str(so["discount_amount"])), expected_discount)
        self.assertEqual(Decimal(str(so["total_amount"])), subtotal - expected_discount)

        for field in ("landed_subtotal", "margin_mad", "margin_pct"):
            self.assertIsNotNone(so.get(field))
        self.assertGreater(so["margin_pct"], 0)
        item = so["items"][0]
        for field in ("unit_margin", "line_margin"):
            self.assertIsNotNone(item.get(field))
        self.assertGreater(item["line_margin"], 0)

    def test_sale_without_discount_below_big_tiers(self):
        client = self.make_client("CLI-SALE-2")
        product = self.make_product("SKU-SALE-SMALL", "Petite planche", dims=SMALL, cost="4000", sale="4600")
        self.buy(product, 3000, price="4000")  # 3000 * 0.00324 = 9.72 m³
        r = self.api.post("/api/sales/", {
            "client_id": client.pk, "warehouse_id": self.wh.pk,
            "items": [{"product_id": product.pk, "quantity": "2400",
                       "price_per_m3": "4600", **SMALL}],
        }, format="json")
        self.assertEqual(r.status_code, 201)
        so = r.data
        self.assertEqual(so["tier_name"], "Tarif détail")
        self.assertEqual(float(so["discount_percent"]), 0.0)
        self.assertEqual(float(so["discount_amount"]), 0.0)
        self.assertEqual(float(so["total_amount"]), float(so["subtotal"]))

    def test_invoice_pdf_builds_with_discount_line(self):
        from stock.pdfs import build_invoice_pdf

        client = self.make_client("CLI-INVOICE-1")
        product = self.buy_panel_stock()
        so = services.create_sale(
            client, self.wh,
            [{"product": product, "quantity": 546, "price_per_m3": product.sale_price}],
            discount_percent=Decimal("5"), tier_name="Tarif gros",
        )
        pdf = build_invoice_pdf(so)
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertGreater(so.discount_amount, 0)

        # The content stream is ASCII85-encoded then zlib-compressed: decode
        # it back to text so we can assert the discount line is really there.
        stream = re.search(rb"stream\r?\n(.+?)endstream", pdf, re.DOTALL).group(1)
        data = stream[: stream.rfind(b"~>")]
        text = zlib.decompress(base64.a85decode(data))
        self.assertIn("REMISE", text.decode("latin-1"))
        self.assertIn("TOTAL TTC", text.decode("latin-1"))


class StockAdjustmentTests(BaseModulesTest):
    def _stock(self, product):
        return Inventory.objects.get(product=product, warehouse=self.wh).quantity

    def test_positive_adjustment_increases_stock(self):
        product = self.make_product("SKU-ADJ-1", "Planche à corriger", dims=SMALL, cost="4000", sale="4600")
        self.buy(product, 100)  # seed some stock first
        before = self._stock(product)

        r = self.api.post("/api/stock-adjustments/", {
            "product_id": product.pk, "warehouse_id": self.wh.pk,
            "quantity": "25", "reason": "Inventaire — surplus constaté",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["movement_type"], "adjustment")
        self.assertEqual(float(r.data["quantity"]), 25.0)
        self.assertEqual(Inventory.objects.get(product=product).quantity, before + Decimal("25"))

    def test_negative_adjustment_decreases_stock(self):
        product = self.make_product("SKU-ADJ-2", "Planche décomptée", dims=SMALL, cost="4000", sale="4600")
        self.buy(product, 100)
        before = self._stock(product)

        r = self.api.post("/api/stock-adjustments/", {
            "product_id": product.pk, "warehouse_id": self.wh.pk,
            "quantity": "-15", "reason": "Retrait — casse constatée",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(float(r.data["quantity"]), -15.0)
        self.assertEqual(Inventory.objects.get(product=product).quantity, before - Decimal("15"))

    def test_negative_adjustment_below_zero_is_rejected(self):
        product = self.make_product("SKU-ADJ-3", "Planche nul", dims=SMALL, cost="4000", sale="4600")
        self.buy(product, 5)
        r = self.api.post("/api/stock-adjustments/", {
            "product_id": product.pk, "warehouse_id": self.wh.pk, "quantity": "-999",
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_zero_quantity_rejected(self):
        product = self.make_product("SKU-ADJ-4", "Planche zéro", dims=SMALL)
        r = self.api.post("/api/stock-adjustments/", {
            "product_id": product.pk, "warehouse_id": self.wh.pk, "quantity": "0",
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_movement_appears_in_ledger(self):
        product = self.make_product("SKU-ADJ-5", "Planche trace", dims=SMALL, cost="4000", sale="4600")
        self.buy(product, 100)
        self.api.post("/api/stock-adjustments/", {
            "product_id": product.pk, "warehouse_id": self.wh.pk, "quantity": "10",
        }, format="json")
        self.api.post("/api/stock-adjustments/", {
            "product_id": product.pk, "warehouse_id": self.wh.pk, "quantity": "-4",
        }, format="json")

        r = self.api.get("/api/stock-movements/", {"movement_type": "adjustment"})
        self.assertEqual(r.status_code, 200)
        rows = r.data["results"] if isinstance(r.data, dict) else r.data
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(m["movement_type"] == "adjustment" for m in rows))
        qty = {float(m["quantity"]): m for m in rows}
        self.assertIn(10.0, qty)
        self.assertIn(-4.0, qty)


class DeliveryNoteTests(BaseModulesTest):
    """Bon de livraison (Transport & Logistique) lifecycle.

    Covers creation (decrements stock via the sales ledger), the strictly
    forward status flow preparation → in_transit → delivered, rejection of
    backward/invalid transitions, and the printable PDF.
    """

    def _stock(self, product):
        return Inventory.objects.get(product=product, warehouse=self.wh).quantity

    def _create_delivery(self, product, qty="10", price="4200"):
        client = self.make_client("CLI-BL-1")
        r = self.api.post("/api/delivery-notes/create/", {
            "client_id": client.pk,
            "warehouse_id": self.wh.pk,
            "driver_name": "Yassine Alaoui",
            "truck_plate": "12345-A-6",
            "notes": "Livraison test",
            "items": [{"product_id": product.pk, "quantity": qty, "price_per_m3": price}],
        }, format="json")
        return r

    def test_create_decrements_stock_and_logs_sale_out(self):
        product = self.make_product("SKU-BL-1", "Panneau BL", dims=PANEL, cost="3400", sale="4200")
        self.buy(product, 200)
        before = self._stock(product)

        qty = "18"
        r = self._create_delivery(product, qty)
        self.assertEqual(r.status_code, 201, r.data)
        so = r.data
        self.assertEqual(so["status"], "preparation")
        self.assertTrue(so["bl_number"].startswith("BL"))
        # 18 * PANEL volume (compute_volume_m3(18,2500,1220,1) = 0.0549)
        self.assertGreater(float(so["total_volume_m3"]), 0)

        # stock decremented by the sale_out trigger
        self.assertEqual(self._stock(product), before - Decimal(qty))

        # one sale_out ledger row referencing the delivery note
        moves = StockMovement.objects.filter(
            movement_type=StockMovement.MovementType.SALE_OUT,
            reference_type="delivery_note",
            reference_id=so["id"],
        )
        self.assertEqual(moves.count(), 1)
        self.assertEqual(moves[0].quantity, Decimal(qty))

    def test_forward_status_flow(self):
        product = self.buy_panel_stock()
        r = self._create_delivery(product, "5")
        self.assertEqual(r.status_code, 201, r.data)
        so_id = r.data["id"]

        r = self.api.post(f"/api/delivery-notes/{so_id}/status/", {"status": "in_transit"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "in_transit")
        self.assertIsNotNone(r.data["shipped_at"])

        r = self.api.post(f"/api/delivery-notes/{so_id}/status/", {"status": "delivered"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "delivered")
        self.assertIsNotNone(r.data["delivered_at"])

    def test_backward_transition_rejected(self):
        product = self.buy_panel_stock()
        r = self._create_delivery(product, "5")
        so_id = r.data["id"]

        # delivered is NOT an arc from preparation (skips in_transit)
        r = self.api.post(f"/api/delivery-notes/{so_id}/status/", {"status": "delivered"}, format="json")
        self.assertEqual(r.status_code, 400)

        # move forward then try to go back
        self.api.post(f"/api/delivery-notes/{so_id}/status/", {"status": "in_transit"}, format="json")
        r = self.api.post(f"/api/delivery-notes/{so_id}/status/", {"status": "preparation"}, format="json")
        self.assertEqual(r.status_code, 400)

        # no-op transition is rejected too
        r = self.api.post(f"/api/delivery-notes/{so_id}/status/", {"status": "in_transit"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_invalid_status_rejected(self):
        product = self.buy_panel_stock()
        r = self._create_delivery(product, "5")
        so_id = r.data["id"]
        r = self.api.post(f"/api/delivery-notes/{so_id}/status/", {"status": "bogus"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_delivery_note_pdf_builds(self):
        from stock.pdfs import build_delivery_note_pdf

        product = self.buy_panel_stock()
        r = self._create_delivery(product, "5")
        self.assertEqual(r.status_code, 201, r.data)
        bl = DeliveryNote.objects.get(pk=r.data["id"])
        pdf = build_delivery_note_pdf(bl)
        self.assertTrue(pdf.startswith(b"%PDF"))

    def test_list_filter_by_month(self):
        product = self.buy_panel_stock()
        self._create_delivery(product, "5")
        now = timezone.localtime()
        year, month = now.year, now.month
        r = self.api.get("/api/delivery-notes/", {"year": year, "month": month})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 1)
        r2 = self.api.get("/api/delivery-notes/", {"year": year, "month": (month % 12) + 1})
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data["count"], 0)