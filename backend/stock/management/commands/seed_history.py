"""Seed historical demo transactions for previous months (June & July 2026).

Uses ``services.create_purchase`` / ``services.create_sale`` with back-dated
``order_date`` / ``moved_at`` so the ledger and order documents land in the
correct months and the monthly Archive can show real history (not only the
current month). Run it, then close each month from the Archive screen (or
POST /api/archive/close/).

Everything created here is TEMPORARY: `python manage.py purge_demo` wipes it.

Run:  python manage.py seed_history
"""
from datetime import date, datetime, time
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from stock import services
from stock.models import Client, Product, Supplier, Warehouse


def _aw(d, t):
    return timezone.make_aware(datetime.combine(d, t))


class Command(BaseCommand):
    help = "Seed history (June & July 2026) so the Archive shows previous months."

    def handle(self, *args, **options):
        self.stdout.write("Seeding historical demo data (June & July 2026)…")

        wh = Warehouse.objects.filter(code="WH-CASABLANCA").first()
        if not wh:
            self.stderr.write("Warehouse WH-CASABLANCA not found. Aborting.")
            return
        if Product.objects.count() == 0:
            self.stderr.write("No products. Run seed_demo first.")
            return
        clients = list(Client.objects.all())
        suppliers = list(Supplier.objects.all())
        if not clients or not suppliers:
            self.stderr.write("No clients/suppliers. Run seed_demo first.")
            return

        products = list(Product.objects.all())

        def find(*names):
            for n in names:
                for p in products:
                    if n.lower() in p.name.lower():
                        return p
            return products[0]

        # --- June 2026: buy lumber, sell lumber -------------------------------
        services.create_purchase(
            supplier=suppliers[0], warehouse=wh,
            order_date=date(2026, 6, 5), moved_at=_aw(date(2026, 6, 6), time(9, 0)),
            po_number="HIST-PO202606",
            items=[
                {"product": find("Chêne Rouge"), "quantity": Decimal("18"),
                 "price_per_m3": find("Chêne Rouge").cost_price},
                {"product": find("Hêtre"), "quantity": Decimal("25"),
                 "price_per_m3": find("Hêtre").cost_price},
            ],
            fees={"freight_cost": Decimal("600"), "customs_cost": Decimal("300")},
        )
        services.create_sale(
            client=clients[1], warehouse=wh,
            order_date=date(2026, 6, 18), moved_at=_aw(date(2026, 6, 20), time(15, 0)),
            so_number="HIST-SO202606",
            items=[
                {"product": find("Chêne Rouge"), "quantity": Decimal("5"),
                 "price_per_m3": find("Chêne Rouge").sale_price},
                {"product": find("Hêtre"), "quantity": Decimal("8"),
                 "price_per_m3": find("Hêtre").sale_price},
            ],
        )

        # --- July 2026: buy panels, sell panels + lumber ----------------------
        services.create_purchase(
            supplier=suppliers[2], warehouse=wh,
            order_date=date(2026, 7, 5), moved_at=_aw(date(2026, 7, 6), time(9, 0)),
            po_number="HIST-PO202607",
            items=[
                {"product": find("MDF"), "quantity": Decimal("30"),
                 "price_per_m3": find("MDF").cost_price},
                {"product": find("Contreplaqué"), "quantity": Decimal("20"),
                 "price_per_m3": find("Contreplaqué").cost_price},
            ],
            fees={"freight_cost": Decimal("700"), "customs_cost": Decimal("250")},
        )
        services.create_sale(
            client=clients[2], warehouse=wh,
            order_date=date(2026, 7, 18), moved_at=_aw(date(2026, 7, 20), time(15, 0)),
            so_number="HIST-SO202607",
            items=[
                {"product": find("MDF"), "quantity": Decimal("9"),
                 "price_per_m3": find("MDF").sale_price},
                {"product": find("Hêtre"), "quantity": Decimal("6"),
                 "price_per_m3": find("Hêtre").sale_price},
            ],
        )

        self.stdout.write(self.style.SUCCESS(
            "Historique juin & juillet 2026 créé. "
            "Clôturez les mois via la page Archives (ou /api/archive/close/)."
        ))
