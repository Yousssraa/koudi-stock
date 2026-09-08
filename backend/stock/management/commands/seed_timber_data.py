"""Seed realistic Moroccan timber wholesaler data (KOUDI STOCK, Casablanca).

``python manage.py seed_timber_data`` populates, idempotently (add-only):
  - four flagship products with real market dimensions & volumes, priced in MAD
    (Sapin du Nord Rouge, Pin Sylvestre Cl.4, Chêne Américain Premier and the
    Contreplaqué Okoumé panel);
  - two authentic clients (with ICE identifiers) and one import supplier
    (SIMBONOR — Port de Casablanca);
  - the KOUDI STOCK SARL company profile metadata; and
  - fifteen back-office Bons de Livraison (``BL-2026-09-001 … 015``) spread
    across the realistic statuses (Validé & Chargé / En Attente / Facturé /
    Annulé / Livré).

The strict volume formula is enforced::
    m³ = (Épaisseur_mm × Largeur_mm × Longueur_m × Quantité) / 1_000_000

Existing records are never modified or deleted; anything already present is
left untouched so the command is safe to re-run.
"""
from datetime import date, datetime, time
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from stock.models import (
    Client,
    CompanyProfile,
    DeliveryNote,
    DeliveryNoteItem,
    Product,
    PurchaseOrder,
    ReferencePrice,
    Supplier,
    Warehouse,
    WoodType,
    compute_volume_m3,
)
from stock import services

ZERO = Decimal("0")
CASABLANCA = "Casablanca, Maroc"


def _aw(d, t):
    return timezone.make_aware(datetime.combine(d, t))


class Command(BaseCommand):
    help = "Seed realistic KOUDI STOCK timber data (products, clients, supplier, 15 Bons de Livraison)."

    def handle(self, *args, **options):
        self.stdout.write("Seeding realistic timber data (KOUDI STOCK)…")

        wh = Warehouse.objects.filter(code="WH-CASABLANCA").first()
        if not wh:
            self.stderr.write("Warehouse WH-CASABLANCA not found. Run seed_demo first.")
            return

        # ------------------------------------------------------------------
        # 1. Wood essences (essences) — reuse existing, create if missing
        # ------------------------------------------------------------------
        def essence(name, scientific_name=None, category=None, density=None, provenances=None):
            wt, created = WoodType.objects.get_or_create(
                name=name,
                defaults=dict(
                    scientific_name=scientific_name,
                    category=category,
                    density_kg_m3=density,
                    provenances=provenances,
                ),
            )
            return wt

        sapin = essence("Sapin du Nord Rouge", "Abies alba", "Softwood", 450, "Scandinavie, Nord de l'Europe")
        pin = essence("Pin Sylvestre", "Pinus sylvestris", "Softwood", 520, "Russie, Scandinavie")
        chene = essence("Chêne Américain", "Quercus rubra", "Hardwood", 750, "Amérique du Nord")
        okoume = essence("Okoumé", "Aucoumea klaineana", "Exotic", 440, "Gabon, Afrique Centrale")

        # ------------------------------------------------------------------
        # 2. Products (idempotent by SKU)
        # ------------------------------------------------------------------
        # (sku, name, essence, dims t/w/l, piece, treatment, category, grade,
        #  cost_per_m3, sale_per_m3, uom, colis)
        specs = [
            (
                "KS-SAPIN-27x150x4000", "Sapin du Nord Rouge 27x150x4000",
                sapin, 27, 150, 4.0, "Volige", "Aucun",
                "Bois de Construction", "Standard", 2450, 3400, "cbm", "COLIS-S1",
            ),
            (
                "KS-PIN-CL4-45x225x5000", "Pin Sylvestre Cl.4 45x225x5000",
                pin, 45, 225, 5.0, "Madrier", "Autoclave Cl.4 Marron",
                "Bois Traité Autoclave", "Select", 2950, 4100, "cbm", "COLIS-S2",
            ),
            (
                "KS-CHENE-50x200x3000", "Chêne Américain Premier 50x200x3000",
                chene, 50, 200, 3.0, "Madrier", "Séché KD (Kiln Dried)",
                "Bois Feuillus & Nobles", "FAS", 8200, 11500, "cbm", "COLIS-S3",
            ),
            (
                "KS-OKOUME-18-1220x2440", "Contreplaqué Okoumé 18mm 1220x2440",
                None, 18, 1220, 2.44, "Plywood Filmé", "Aucun",
                "Panneaux & Dérivés", "Select", 280, 380, "piece", "COLIS-S4",
            ),
        ]
        products = {}
        for (sku, name, wt, t, w, l, piece, treat, cat, grade, cost, sale, uom, colis) in specs:
            prod, created = Product.objects.get_or_create(
                sku=sku,
                defaults=dict(
                    name=name,
                    wood_type=wt,
                    category=cat,
                    piece_type=piece,
                    treatment=treat,
                    colis_number=colis,
                    length_m=Decimal(str(l)),
                    width_mm=Decimal(str(w)),
                    thickness_mm=Decimal(str(t)),
                    grade=grade,
                    finish="planed",
                    moisture_content=Decimal("14"),
                    uom=uom,
                    cost_price=Decimal(str(cost)),
                    sale_price=Decimal(str(sale)),
                    currency="MAD",
                    reorder_threshold_m3=Decimal("5"),
                ),
            )
            products[sku] = prod
            if created:
                self.stdout.write(f"  + produit {name} — {compute_volume_m3(t, w, l, 1)} m³/unité")
            else:
                self.stdout.write(f"  = produit existant {name}")

        # ------------------------------------------------------------------
        # 3. Clients (legal ICE) & supplier
        # ------------------------------------------------------------------
        clients, _ = Client.objects.get_or_create(
            code="CLI-BRAHIM",
            defaults=dict(
                company_name="Menuiserie Mâalem Brahim SARL",
                contact_name="Mâalem Brahim",
                email="contact@men-brahim.ma",
                phone="0661-234589",
                address="Quartier Sidi Moumen, Casablanca, Maroc",
                tax_id="001892341000089",
                payment_terms="Paiement à 30 jours",
                payment_terms_days=30,
                credit_limit=Decimal("500000"),
            ),
        )
        clients2, _ = Client.objects.get_or_create(
            code="CLI-ATLAS",
            defaults=dict(
                company_name="Chantiers de l'Atlas SA",
                contact_name="M. Karim Benali",
                email="direction@chantiers-atlas.ma",
                phone="0677-812345",
                address="Zone Industrielle Takadoum, Rabat, Maroc",
                tax_id="002341982000045",
                payment_terms="Paiement à 60 jours",
                payment_terms_days=60,
                credit_limit=Decimal("800000"),
            ),
        )

        supplier, _ = Supplier.objects.get_or_create(
            code="SUP-SIMBONOR",
            defaults=dict(
                company_name="Société d'Importation du Bois du Nord - SIMBONOR",
                contact_name="M. Fouad Laaziri",
                email="import@simbonor.ma",
                phone="0522-310456",
                address="Port de Casablanca, Boulevard de la Résistance, Casablanca",
                tax_id="003498120000056",
                payment_terms="Paiement à la livraison",
            ),
        )

        # ------------------------------------------------------------------
        # 4. Stock targets (final on-hand after the BL series) & price per m³
        # ------------------------------------------------------------------
        # (product, target_stock, price_per_m3)
        lumber = [
            (products["KS-SAPIN-27x150x4000"], Decimal("1000"), Decimal("3400")),
            (products["KS-PIN-CL4-45x225x5000"], Decimal("450"), Decimal("4100")),
            (products["KS-CHENE-50x200x3000"], Decimal("80"), Decimal("11500")),
        ]

        # On-hand target for the panel (kept as stock; no BLs, priced per unit).
        panel_target = Decimal("350")

        # ------------------------------------------------------------------
        # 5. The fifteen Bons de Livraison (BL-2026-09-001 … 015)
        #    statuses: delivered / invoiced / validated / waiting / cancelled
        # ------------------------------------------------------------------
        # (bl_number, client, date, status, [(product_key_or_None, qty_pcs)])
        BL = "BL-2026-09-"
        bl_specs = [
            (BL + "001", clients, date(2026, 9, 1), DeliveryNote.Status.DELIVERED, [("sapin", 30)]),
            (BL + "002", clients2, date(2026, 9, 1), DeliveryNote.Status.DELIVERED, [("pin", 25)]),
            (BL + "003", clients, date(2026, 9, 2), DeliveryNote.Status.INVOICED,
             [("sapin", 20), ("chene", 3)]),
            (BL + "004", clients2, date(2026, 9, 2), DeliveryNote.Status.INVOICED, [("pin", 18)]),
            (BL + "005", clients, date(2026, 9, 3), DeliveryNote.Status.VALIDATED, [("chene", 5)]),
            (BL + "006", clients2, date(2026, 9, 3), DeliveryNote.Status.VALIDATED, [("sapin", 40)]),
            (BL + "007", clients, date(2026, 9, 3), DeliveryNote.Status.VALIDATED, [("pin", 22)]),
            (BL + "008", clients2, date(2026, 9, 3), DeliveryNote.Status.WAITING,
             [("sapin", 25), ("chene", 2)]),
            (BL + "009", clients, date(2026, 9, 3), DeliveryNote.Status.WAITING, [("pin", 16)]),
            (BL + "010", clients2, date(2026, 9, 3), DeliveryNote.Status.WAITING, [("sapin", 35)]),
            (BL + "011", clients, date(2026, 9, 3), DeliveryNote.Status.WAITING, [("chene", 4)]),
            (BL + "012", clients2, date(2026, 9, 3), DeliveryNote.Status.CANCELLED, [("pin", 30)]),
            (BL + "013", clients, date(2026, 9, 3), DeliveryNote.Status.DELIVERED, [("sapin", 15)]),
            (BL + "014", clients2, date(2026, 9, 3), DeliveryNote.Status.INVOICED, [("chene", 6)]),
            (BL + "015", clients, date(2026, 9, 3), DeliveryNote.Status.WAITING, [("pin", 12)]),
        ]

        # Total shipped per product (excludes cancelled BL-…-012).
        shipped = {"sapin": ZERO, "pin": ZERO, "chene": ZERO}
        for _, __, ___, status, lines in bl_specs:
            if status == DeliveryNote.Status.CANCELLED:
                continue
            for key, qty in lines:
                shipped[key] += Decimal(str(qty))

        # ------------------------------------------------------------------
        # 6. Seed on-hand stock = target + shipped, via received purchases
        # ------------------------------------------------------------------
        shipped_by_product = {
            products["KS-SAPIN-27x150x4000"]: shipped["sapin"],
            products["KS-PIN-CL4-45x225x5000"]: shipped["pin"],
            products["KS-CHENE-50x200x3000"]: shipped["chene"],
        }

        def ensure_stock(product, qty, price_per_m3, lot):
            po_number = f"SEED-TIMBER-{lot}"
            if PurchaseOrder.objects.filter(po_number=po_number).exists():
                on_hand = sum(i.quantity for i in product.inventory_set.all())
                self.stdout.write(f"  = stock déjà seed, PO {po_number} existante (on-hand {on_hand})")
                return
            on_hand = sum(i.quantity for i in product.inventory_set.all()) if product.pk else ZERO
            need = qty - on_hand
            if need <= 0:
                self.stdout.write(f"  = stock suffisant pour {product.sku} ({on_hand})")
                return
            services.create_purchase(
                supplier=supplier,
                warehouse=wh,
                items=[{"product": product, "quantity": need,
                        "price_per_m3": price_per_m3, "lot_number": lot}],
                order_date=date(2026, 9, 1),
                moved_at=_aw(date(2026, 9, 1), time(8, 0)),
                po_number=po_number,
                fees={"freight_cost": Decimal("400"), "customs_cost": Decimal("150")},
            )
            self.stdout.write(f"  + stock {product.sku}: +{need} -> {qty}")

        for product, target, price in lumber:
            ensure_stock(product, target + shipped_by_product[product], price,
                         product.colis_number or "LOT")

        panel = products["KS-OKOUME-18-1220x2440"]
        panel_po = "SEED-TIMBER-OKOUME"
        if not PurchaseOrder.objects.filter(po_number=panel_po).exists():
            on_hand_panel = sum(i.quantity for i in panel.inventory_set.all()) if panel.pk else ZERO
            if on_hand_panel < panel_target:
                services.create_purchase(
                    supplier=supplier,
                    warehouse=wh,
                    items=[{"product": panel, "quantity": panel_target - on_hand_panel,
                            "price_per_m3": Decimal("280"), "lot_number": "LOT-OKOUME"}],
                    order_date=date(2026, 9, 1),
                    moved_at=_aw(date(2026, 9, 1), time(8, 30)),
                    po_number=panel_po,
                    fees={"freight_cost": Decimal("250"), "customs_cost": Decimal("100")},
                )
                self.stdout.write(f"  + stock {panel.sku}: -> {panel_target}")

        # ------------------------------------------------------------------
        # 7. Create the delivery notes (deducts stock -> final target on-hand)
        # ------------------------------------------------------------------
        name_to_product = {
            "sapin": products["KS-SAPIN-27x150x4000"],
            "pin": products["KS-PIN-CL4-45x225x5000"],
            "chene": products["KS-CHENE-50x200x3000"],
        }
        price_map = {
            "sapin": Decimal("3400"),
            "pin": Decimal("4100"),
            "chene": Decimal("11500"),
        }

        created_bls = 0
        for bl_number, client, bl_date, status, lines in bl_specs:
            if DeliveryNote.objects.filter(bl_number=bl_number).exists():
                self.stdout.write(f"  = BL existant {bl_number}")
                continue

            items = [
                {"product": name_to_product[key], "quantity": Decimal(str(qty)),
                 "price_per_m3": price_map[key]}
                for key, qty in lines
            ]

            if status == DeliveryNote.Status.CANCELLED:
                # A cancelled BL is recorded but never moves stock.
                moved_at = _aw(bl_date, time(10, 30))
                bl = DeliveryNote.objects.create(
                    bl_number=bl_number,
                    client=client,
                    warehouse=wh,
                    driver_name="—",
                    truck_plate="",
                    notes="Commande annulée par le client.",
                    status=DeliveryNote.Status.CANCELLED,
                    order_date=bl_date,
                )
                for item in items:
                    prod = item["product"]
                    qty = item["quantity"]
                    vol = compute_volume_m3(prod.thickness_mm, prod.width_mm,
                                            prod.length_m, qty) or ZERO
                    DeliveryNoteItem.objects.create(
                        delivery_note=bl,
                        product=prod,
                        quantity=qty,
                        unit_price=item["price_per_m3"],
                        line_total=vol * item["price_per_m3"],
                    )
            else:
                bl = services.create_delivery_note(
                    client=client,
                    warehouse=wh,
                    items=items,
                    driver_name="Hamid El Mansouri" if client == clients else "Driss Taoufik",
                    truck_plate="",
                    notes="BL émis par le back-office.",
                    bl_number=bl_number,
                    moved_at=_aw(bl_date, time(9, 30)),
                )
                bl.order_date = bl_date
                bl.status = status
                if status == DeliveryNote.Status.DELIVERED:
                    bl.shipped_at = _aw(bl_date, time(9, 30))
                    bl.delivered_at = _aw(bl_date, time(15, 0))
                elif status == DeliveryNote.Status.VALIDATED:
                    bl.shipped_at = _aw(bl_date, time(9, 30))
                bl.save()

            created_bls += 1
            self.stdout.write(f"  + BL {bl_number} [{status}]")

        # ------------------------------------------------------------------
        # 8. KOUDI STOCK SARL company metadata
        # ------------------------------------------------------------------
        p = CompanyProfile.current()
        p.name = "KOUDI STOCK SARL"
        p.tagline = "Négoce & Importation de Bois — Casablanca"
        p.address = "Zone Industrielle Lissasba, Rue des Bois, Casablanca"
        p.phone = "0677-580205"
        p.email = "contact@koudistock.ma"
        p.ice = "003124567000012"
        p.registre_commerce = "489201 Casablanca"
        p.identifiant_fiscal = "52891034"
        p.patente = "34109823"
        p.save()
        self.stdout.write("  + CompanyProfile -> KOUDI STOCK SARL")

        # ------------------------------------------------------------------
        # 9. Grille de prix de référence (Tarifs & Prix)
        #    idempotent : une ligne par (essence, catégorie, pièce, traitement)
        # ------------------------------------------------------------------
        def ref_price(wt, category, piece_type, treatment, target, price):
            price = Decimal(str(price))
            rp, created = ReferencePrice.objects.get_or_create(
                wood_type=wt,
                category=category,
                piece_type=piece_type or "",
                treatment=treatment or "",
                target=target,
                defaults=dict(unit_price_mad=price, is_active=True),
            )
            if created:
                self.stdout.write(f"  + tarif {wt.name} — {category} — {piece_type or 'toutes pièces'} : {price} MAD/{'unité' if target == 'panel' else 'm³'}")
            else:
                if rp.unit_price_mad != price:
                    rp.unit_price_mad = price
                    rp.save(update_fields=["unit_price_mad", "updated_at"])
                    self.stdout.write(f"  ~ tarif {wt.name} — {category} : {price} MAD/{'unité' if target == 'panel' else 'm³'}")
                else:
                    self.stdout.write(f"  = tarif existant {wt.name} — {category} — {piece_type or 'toutes pièces'}")
            return rp

        ref_price(sapin, "Bois de Construction", "Volige", "Aucun", ReferencePrice.Target.TIMBER, 3400)
        ref_price(pin, "Bois Traité Autoclave", "Madrier", "Autoclave Cl.4 Marron", ReferencePrice.Target.TIMBER, 4600)
        ref_price(chene, "Bois Feuillus & Nobles", "Madrier", "Séché KD (Kiln Dried)", ReferencePrice.Target.TIMBER, 11500)
        ref_price(okoume, "Panneaux & Dérivés", "Plywood Filmé", "Aucun", ReferencePrice.Target.PANEL, 380)

        self.stdout.write(self.style.SUCCESS(
            f"Terminé : {created_bls} bons de livraison créés, produits/clients/fournisseur/tarifs prêts."
        ))
