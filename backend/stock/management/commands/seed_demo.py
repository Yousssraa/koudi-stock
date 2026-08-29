"""Seed a realistic temporary demo dataset (timber & panels, MAD/m³).

Data mirrors the Moroccan timber range (Comarbois-style): construction lumber
(pin sylvestre, sapin), autoclave-treated wood, feuillus & nobles (chêne, hêtre
étuvé, iroko, eucalyptus) and panneaux (plywood filmé 1.22 × 2.44 m), sold and
invoiced per cubic metre (length in metres per the m³ formula).

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

        # --- Wood species (essences) ------------------------------------------
        # name, scientific_name, category, density_kg_m3
        species = [
            ("Pin Sylvestre (Bois Rouge)", "Pinus sylvestris", "Bois de Construction", 520),
            ("Sapin du Nord (Bois Blanc)", "Abies alba", "Bois de Construction", 450),
            ("Chêne", "Quercus robur", "Bois Feuillus & Nobles", 740),
            ("Hêtre Étuvé", "Fagus sylvatica", "Bois Feuillus & Nobles", 700),
            ("Iroko", "Milicia excelsa", "Bois Feuillus & Nobles", 660),
            ("Eucalyptus", "Eucalyptus globulus", "Bois Traité Autoclave", 640),
        ]
        species_ids = {}
        for name, sci, cat, dens in species:
            wt, _ = WoodType.objects.get_or_create(
                name=name,
                defaults={"scientific_name": sci, "category": cat, "density_kg_m3": dens},
            )
            species_ids[name] = wt.id

        # --- Products: solid lumber + panels ----------------------------------
        # name, species, length_m, width_mm, thickness_mm, piece_type, treatment,
        # category, grade, cost/m3, sale/m3, mc, colis
        product_specs = [
            ("Madrier Pin Sylvestre 63×225", "Pin Sylvestre (Bois Rouge)", 4.5, 225, 63,
             "Madrier", "Séché KD (Kiln Dried)", "Bois de Construction", "Standard", 2600, 3900, 14, "COLIS-01"),
            ("Basting Sapin 63×175", "Sapin du Nord (Bois Blanc)", 4.0, 175, 63,
             "Basting", "Aucun", "Bois de Construction", "Standard", 2350, 3500, 16, "COLIS-02"),
            ("Chevron Sapin 45×70", "Sapin du Nord (Bois Blanc)", 3.0, 70, 45,
             "Chevron", "Autoclave Cl.3 Vert", "Bois Traité Autoclave", "Standard", 2800, 4100, 15, "COLIS-03"),
            ("Poteau Carré Eucalyptus 100×100", "Eucalyptus", 3.0, 100, 100,
             "Poteau Carré", "Autoclave Cl.4 Marron", "Bois Traité Autoclave", "Construction", 3200, 4700, 15, "COLIS-04"),
            ("Lame de Terrasse Pin Autoclave 27×145", "Pin Sylvestre (Bois Rouge)", 3.0, 145, 27,
             "Lame de Terrasse", "Autoclave Cl.4 Marron", "Bois Traité Autoclave", "Select", 3600, 5200, 13, "COLIS-05"),
            ("Volige Sapin 22×100", "Sapin du Nord (Bois Blanc)", 2.5, 100, 22,
             "Volige", "Aucun", "Bois de Construction", "Standard", 1900, 2900, 16, "COLIS-06"),
            ("Plateau Chêne 32×180", "Chêne", 2.5, 180, 32,
             "Madrier", "Séché KD (Kiln Dried)", "Bois Feuillus & Nobles", "FAS", 6800, 10200, 10, "COLIS-07"),
            ("Plateau Hêtre Étuvé 40×200", "Hêtre Étuvé", 2.5, 200, 40,
             "Madrier", "Séché KD (Kiln Dried)", "Bois Feuillus & Nobles", "FAS", 5200, 7900, 10, "COLIS-08"),
            ("Plateau Iroko 34×190", "Iroko", 2.4, 190, 34,
             "Madrier", "Séché KD (Kiln Dried)", "Bois Feuillus & Nobles", "FAS", 8900, 13300, 9, "COLIS-09"),
            ("Plywood Filmé 18 mm 1220×2440", "Pin Sylvestre (Bois Rouge)", 2.44, 1220, 18,
             "Plywood Filmé", "Aucun", "Panneaux & Dérivés", "Select", 2350, 3800, 12, "COLIS-10"),
            ("Rondin Sapin 180", "Sapin du Nord (Bois Blanc)", 4.0, 180, 180,
             "Rondin", "Aucun", "Bois de Construction", "Standard", 1750, 2700, 16, "COLIS-11"),
        ]
        product_ids = {}
        for row in product_specs:
            (name, sp, l, w, t, piece_type, treatment, cat,
             grade, cost, sale, mc, colis) = row
            sku = "KW-" + "".join(ch for ch in name if ch.isalnum())[:16].upper()
            prod, _ = Product.objects.get_or_create(
                sku=sku,
                defaults=dict(
                    name=name,
                    wood_type_id=species_ids[sp],
                    category=cat,
                    piece_type=piece_type,
                    treatment=treatment,
                    colis_number=colis,
                    length_m=l,
                    width_mm=w,
                    thickness_mm=t,
                    grade=grade,
                    finish="planed",
                    moisture_content=mc,
                    uom="cbm",
                    cost_price=Decimal(str(cost)),
                    sale_price=Decimal(str(sale)),
                    currency="MAD",
                    reorder_threshold_m3=Decimal("5"),
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
                    ("Madrier Pin Sylvestre 63×225", 30, 2600, "LOT-A1"),
                    ("Basting Sapin 63×175", 22, 2350, "LOT-A1"),
                ],
                "fees": {"freight_cost": 1200, "customs_cost": 600, "handling_cost": 180},
            },
            {
                "supplier": suppliers[2][0], "warehouse": wh_tanger,
                "items": [
                    ("Plywood Filmé 18 mm 1220×2440", 40, 2350, "LOT-P2"),
                    ("Rondin Sapin 180", 25, 1750, "LOT-P2"),
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
                "items": [("Madrier Pin Sylvestre 63×225", 4, 3900), ("Basting Sapin 63×175", 6, 3500)],
            },
            {
                "client": clients[2][0], "warehouse": wh_tanger,
                "items": [("Plywood Filmé 18 mm 1220×2440", 8, 3800), ("Rondin Sapin 180", 6, 2700)],
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
