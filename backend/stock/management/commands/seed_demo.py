"""Seed a realistic temporary demo dataset (timber, MAD/m³).

Creates wood species, products, clients, suppliers plus one purchase and one
sale (through the real transactional endpoints) so the invoice / purchase-order
PDFs and the whole workflow can be validated end-to-end.

Everything created here is test data: run ``python manage.py purge_demo`` to
wipe it all the moment you have real information.

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
    help = "Seed realistic temporary demo data (wood species, products, clients, suppliers + 1 sale & 1 purchase)."

    def handle(self, *args, **options):
        self.stdout.write("Seeding temporary demo data…")

        wh_casa = Warehouse.objects.filter(code="WH-CASABLANCA").first()
        wh_tanger = Warehouse.objects.filter(code="WH-TANGER").first()
        if not wh_casa or not wh_tanger:
            self.stderr.write("Warehouses WH-CASABLANCA / WH-TANGER not found. Aborting.")
            return

        # --- Wood species -----------------------------------------------------
        species = [
            ("Chêne", "Quercus robur", "Bois noble", 740),
            ("Merisier", "Prunus avium", "Bois noble", 620),
            ("Hêtre", "Fagus sylvatica", "Bois blanc", 700),
            ("Frêne", "Fraxinus excelsior", "Bois blanc", 690),
            ("Noyer", "Juglans regia", "Bois noble", 640),
            ("Iroko", "Milicia excelsa", "Bois exotique", 660),
        ]
        species_ids = {}
        for name, sci, cat, dens in species:
            wt, _ = WoodType.objects.get_or_create(
                name=name,
                defaults={"scientific_name": sci, "category": cat, "density_kg_m3": dens},
            )
            species_ids[name] = wt.id

        # --- Products (dimensions in mm -> m³ volume) -------------------------
        product_specs = [
            # name, species, L, W, T (mm), grade, cost/m3, sale/m3, mc
            ("Plateau Chêne A", "Chêne", 2500, 180, 30, "FAS", 6500, 9800, 10),
            ("Plateau Chêne B", "Chêne", 2500, 150, 28, "Select", 5800, 8600, 11),
            ("Plateau Merisier", "Merisier", 2200, 200, 32, "FAS", 7200, 10900, 10),
            ("Planche Hêtre", "Hêtre", 2000, 120, 25, "Standard", 3100, 4900, 12),
            ("Plateau Noyer", "Noyer", 2600, 190, 34, "FAS", 8400, 12500, 9),
            ("Planche Iroko", "Iroko", 2200, 140, 26, "Select", 3800, 5800, 13),
        ]
        product_ids = {}
        for name, sp, l, w, t, grade, cost, sale, mc in product_specs:
            sku = "DEMO-" + "".join(ch for ch in name if ch.isalnum()).replace(" ", "")[:12].upper()
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
            ("Société Menuiserie Moderna", "CLI modern furniture", "contact@moderna.ma", "0612-345678"),
            ("Ateliers du Bois Doukkala", "M. Karim", "contact@doukkala-bois.ma", "0633-111222"),
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
            ("Scierie Atlas du Rif", "scierie.atlas@rif.ma", "0655-999000"),
            ("Bois Import Tanger", "import@tanger-bois.ma", "0666-555444"),
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

        # --- One purchase (feeds stock + enables PO PDF) ----------------------
        sup_name = suppliers[0][0]
        purchase_payload = {
            "supplier_id": supplier_ids[sup_name],
            "warehouse_id": wh_casa.id,
            "items": [
                {"product_id": product_ids["Plateau Chêne A"], "quantity": 20,
                 "price_per_m3": 6500, "lot_number": "LOT-DEMO-001"},
                {"product_id": product_ids["Planche Hêtre"], "quantity": 35,
                 "price_per_m3": 3100, "lot_number": "LOT-DEMO-001"},
            ],
            "fees": {"freight_cost": 800, "customs_cost": 450, "handling_cost": 120},
        }
        pr = tc.post("/api/purchases/", purchase_payload, content_type="application/json")
        print("  purchase:", pr.status_code, pr.json() if pr.status_code >= 400 else "OK")

        # --- One sale (enables invoice/quotation PDF) -------------------------
        cl_name = clients[0][0]
        sale_payload = {
            "client_id": client_ids[cl_name],
            "warehouse_id": wh_casa.id,
            "items": [
                {"product_id": product_ids["Plateau Chêne A"], "quantity": 6, "price_per_m3": 9800},
                {"product_id": product_ids["Planche Hêtre"], "quantity": 10, "price_per_m3": 4900},
            ],
        }
        sr = tc.post("/api/sales/", sale_payload, content_type="application/json")
        print("  sale:", sr.status_code, sr.json() if sr.status_code >= 400 else "OK")

        self.stdout.write(self.style.SUCCESS(
            "Done. Démo temporaire prête. "
            "Pour nettoyer avant vos vraies données :  python manage.py purge_demo"
        ))
        self.stdout.write("Crée :")
        for m, label in [(WoodType, "essences"), (Product, "produits"), (Client, "clients"),
                        (Supplier, "fournisseurs"), (PurchaseOrder, "bons d'achat"), (SalesOrder, "ventes")]:
            self.stdout.write(f"  {m.objects.count():>3}  {label}")
