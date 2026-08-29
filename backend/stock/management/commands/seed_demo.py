"""Seed a realistic temporary demo dataset (timber & panels, MAD/m³).

Data mirrors the public activity of KOUDI WOOD (Casablanca): solid lumber
(hêtre, acajou, chêne, noyer) plus derived panels (latté, contreplaqué, MDF,
Stratidecor), sold and invoiced per cubic metre.

Creates wood species, products, clients and suppliers, then records several
purchases and sales through the real transactional endpoints so the invoice /
quotation / purchase-order PDFs and the whole workflow can be validated
end-to-end.

Everything created here is TEMPORARY test data: run ``python manage.py
purge_demo`` to wipe it all the moment you have real information.

Run:  python manage.py seed_demo
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.test import Client as TestClient

from stock.models import (
    Client,
    Product,
    PurchaseOrder,
    SalesOrder,
    Supplier,
    Warehouse,
    WoodType,
)


class Command(BaseCommand):
    help = "Seed realistic temporary data (KOUDI WOOD range + sample clients/suppliers/orders)."

    def handle(self, *args, **options):
        self.stdout.write("Seeding temporary demo data (KOUDI WOOD range)…")

        wh_casa = Warehouse.objects.filter(code="WH-CASABLANCA").first()
        wh_tanger = Warehouse.objects.filter(code="WH-TANGER").first()
        if not wh_casa or not wh_tanger:
            self.stderr.write("Warehouses WH-CASABLANCA / WH-TANGER not found. Aborting.")
            return

        # --- Wood species -----------------------------------------------------
        species = [
            ("Hêtre", "Fagus sylvatica", "Bois blanc", 700),
            ("Acajou", "Swietenia macrophylla", "Bois exotique", 590),
            ("Chêne", "Quercus robur", "Bois noble", 740),
            ("Noyer", "Juglans regia", "Bois noble", 640),
            ("Plaqué bois (dérivés)", "Composite", "Panneaux", 680),
        ]
        species_ids = {}
        for name, sci, cat, dens in species:
            wt, _ = WoodType.objects.get_or_create(
                name=name,
                defaults={"scientific_name": sci, "category": cat, "density_kg_m3": dens},
            )
            species_ids[name] = wt.id

        # --- Products: solid lumber + panels (L x W x T mm -> m³) -------------
        # name, species, L, W, T (mm), grade, cost/m3, sale/m3, mc
        product_specs = [
            ("Plateau Hêtre", "Hêtre", 2500, 200, 40, "FAS", 5200, 7900, 10),
            ("Plateau Chêne Rouge", "Chêne", 2500, 180, 32, "FAS", 6800, 10200, 10),
            ("Plateau Chêne Clair", "Chêne", 2500, 150, 28, "Select", 6100, 9200, 11),
            ("Plateau Acajou", "Acajou", 2400, 190, 34, "FAS", 8900, 13300, 9),
            ("Plateau Noyer", "Noyer", 2600, 190, 34, "FAS", 8400, 12500, 9),
            ("Latté 19 mm", "Plaqué bois (dérivés)", 2500, 1220, 19, "Standard", 2050, 3300, 12),
            ("Contreplaqué 18 mm", "Plaqué bois (dérivés)", 2500, 1220, 18, "Select", 2350, 3800, 12),
            ("MDF 18 mm", "Plaqué bois (dérivés)", 2440, 1220, 18, "Standard", 1750, 2900, 11),
            ("Stratidecor 10 mm", "Plaqué bois (dérivés)", 2440, 1220, 10, "Select", 3100, 4800, 10),
        ]
        product_ids = {}
        for name, sp, l, w, t, grade, cost, sale, mc in product_specs:
            sku = "KW-" + "".join(ch for ch in name if ch.isalnum())[:16].upper()
            prod, _ = Product.objects.get_or_create(
                sku=sku,
                defaults=dict(
                    name=name,
                    wood_type_id=species_ids[sp],
                    category=WoodType.objects.get(pk=species_ids[sp]).category,
                    length_mm=l,
                    width_mm=w,
                    thickness_mm=t,
                    grade=grade,
                    finish="planed",
                    moisture_content=mc,
                    uom="cbm",
                    cost_price=Decimal(str(cost)),
                    sale_price=Decimal(str(sale)),
                    currency="MAD",
                ),
            )
            product_ids[name] = prod.id

        # --- Clients ----------------------------------------------------------
        clients = [
            ("Ateliers Menais", "M. Omar", "menais@example.ma", "0612-345678"),
            ("Menuiserie El Farah", "Mme Salma", "elfarah@example.ma", "0633-111222"),
            ("Confort Habitat SARL", "M. Youssef", "confort@example.ma", "0644-555777"),
        ]
        client_ids = {}
        for cn, contact, email, phone in clients:
            cl, _ = Client.objects.get_or_create(
                code=f"CLI-DEMO-{cn[:4]}",
                defaults=dict(
                    company_name=cn, contact_name=contact, email=email, phone=phone,
                    address="Casablanca, Maroc", payment_terms="Paiement à 30 jours",
                    payment_terms_days=30, credit_limit=Decimal("200000"),
                ),
            )
            client_ids[cn] = cl.id

        # --- Suppliers --------------------------------------------------------
        suppliers = [
            ("Scierie Atlas du Rif", "scierie.atlas@example.ma", "0655-999000"),
            ("Bois Import Tanger", "import.tanger@example.ma", "0666-555444"),
            ("Panneaux & Dérivés SA", "panneaux@example.ma", "0677-123456"),
        ]
        supplier_ids = {}
        for sn, email, phone in suppliers:
            su, _ = Supplier.objects.get_or_create(
                code=f"SUP-DEMO-{sn[:4]}",
                defaults=dict(
                    company_name=sn, contact_name="Responsable", email=email, phone=phone,
                    address="Région du Rif, Maroc", payment_terms="Paiement comptant",
                ),
            )
            supplier_ids[sn] = su.id

        # --- Login ------------------------------------------------------------
        tc = TestClient()
        r = tc.post("/api/auth/login/", {"username": "demo", "password": "demo2026"}, content_type="application/json")
        token = r.json().get("token")
        if not token:
            self.stderr.write("Login demo failed. Aborting.")
            return
        tc.defaults["HTTP_AUTHORIZATION"] = f"Token {token}"

        # --- Purchases (feed stock + enable PO PDFs) --------------------------
        purchases = [
            {
                "supplier": suppliers[0][0], "warehouse": wh_casa,
                "items": [
                    ("Plateau Hêtre", 30, 5200, "LOT-A1"),
                    ("Plateau Chêne Rouge", 22, 6800, "LOT-A1"),
                ],
                "fees": {"freight_cost": 1200, "customs_cost": 600, "handling_cost": 180},
            },
            {
                "supplier": suppliers[2][0], "warehouse": wh_tanger,
                "items": [
                    ("MDF 18 mm", 40, 1750, "LOT-P2"),
                    ("Contreplaqué 18 mm", 25, 2350, "LOT-P2"),
                ],
                "fees": {"freight_cost": 900, "customs_cost": 300, "handling_cost": 150},
            },
        ]
        for p in purchases:
            payload = {
                "supplier_id": supplier_ids[p["supplier"]],
                "warehouse_id": p["warehouse"].id,
                "items": [
                    {"product_id": product_ids[name], "quantity": qty,
                     "price_per_m3": price, "lot_number": lot}
                    for name, qty, price, lot in p["items"]
                ],
                "fees": p["fees"],
            }
            pr = tc.post("/api/purchases/", payload, content_type="application/json")
            print("  purchase:", pr.status_code, pr.json() if pr.status_code >= 400 else "OK")

        # --- Sales (enable invoice/quotation PDFs) ----------------------------
        sales = [
            {
                "client": clients[1][0], "warehouse": wh_casa,
                "items": [("Plateau Chêne Rouge", 4, 10200), ("Plateau Hêtre", 6, 7900)],
            },
            {
                "client": clients[2][0], "warehouse": wh_tanger,
                "items": [("MDF 18 mm", 8, 2900), ("Contreplaqué 18 mm", 6, 3800)],
            },
        ]
        for s in sales:
            payload = {
                "client_id": client_ids[s["client"]],
                "warehouse_id": s["warehouse"].id,
                "items": [
                    {"product_id": product_ids[name], "quantity": qty, "price_per_m3": price}
                    for name, qty, price in s["items"]
                ],
            }
            sr = tc.post("/api/sales/", payload, content_type="application/json")
            print("  sale:", sr.status_code, sr.json() if sr.status_code >= 400 else "OK")

        self.stdout.write(self.style.SUCCESS(
            "Done. Démo temporaire prête. "
            "Pour nettoyer avant vos vraies données :  python manage.py purge_demo"
        ))
        self.stdout.write("Crée :")
        for m, label in [(WoodType, "essences"), (Product, "produits"), (Client, "clients"),
                         (Supplier, "fournisseurs"), (PurchaseOrder, "bons d'achat"),
                         (SalesOrder, "ventes")]:
            self.stdout.write(f"  {m.objects.count():>3}  {label}")
