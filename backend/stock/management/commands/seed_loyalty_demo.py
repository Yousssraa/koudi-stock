"""Seed a small loyalty history for the demo portal client (Ateliers Menais).

Creates four shipped sales orders (invoices) settled on time so the Espace Pro
``Fidélité`` page shows a realistic scorecard: volume d'achats, nombre de
commandes and paiements ponctuels pass; the pre-existing rejected quote leaves
« aucun devis refusé » as the only unmet criterion (a deliberate 3/4 demo).

Idempotent: orders are keyed by explicit ``SO-LOY-…`` numbers and payments are
only created when the order has none yet.

Run:  python manage.py seed_loyalty_demo
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from stock.models import Client, Product, SalesOrder, Warehouse
from stock.services import create_payment, create_sale

DEMO_CLIENT = "Ateliers Menais"

ORDERS = [
    {
        "so_number": "SO-LOY-2026-01",
        "date": "2026-05-12",
        "warehouse": "WH-CASABLANCA",
        "items": [("PR-063-225-4000", 40, "4800")],
    },
    {
        "so_number": "SO-LOY-2026-02",
        "date": "2026-06-15",
        "warehouse": "WH-CASABLANCA",
        "items": [("PR-100-100-4000", 45, "5400")],
    },
    {
        "so_number": "SO-LOY-2026-03",
        "date": "2026-07-22",
        "warehouse": "WH-CASABLANCA",
        "items": [("EPC-063-225-4000", 30, "4800")],
    },
    {
        "so_number": "SO-LOY-2026-04",
        "date": "2026-08-25",
        "warehouse": "WH-CASABLANCA",
        "items": [("PR-063-175-4000", 60, "4400")],
    },
]


class Command(BaseCommand):
    help = "Seed a loyalty order/payment history for the demo portal client."

    def handle(self, *args, **options):
        client = Client.objects.filter(company_name__icontains="Menais").first() or (
            Client.objects.filter(code="CLI-DEMO-Atel").first()
        )
        if client is None:
            self.stderr.write("Client de démonstration (Ateliers Menais) introuvable. Abandon.")
            return

        ones = Warehouse.objects.filter(code="WH-CASABLANCA").first()
        if ones is None:
            self.stderr.write("Dépôt WH-CASABLANCA introuvable. Abandon.")
            return

        for cfg in ORDERS:
            so_number = cfg["so_number"]
            if SalesOrder.objects.filter(so_number=so_number).exists():
                self.stdout.write(f"  {so_number} déjà présent, ignoré.")
                continue

            items = []
            for sku, qty, price in cfg["items"]:
                product = Product.objects.filter(sku=sku, is_active=True).first()
                if product is None:
                    self.stderr.write(f"Produit {sku} introuvable. Abandon.")
                    return
                items.append({"product": product, "quantity": qty, "price_per_m3": price})

            order_date = timezone.datetime.strptime(cfg["date"], "%Y-%m-%d").date()
            so = create_sale(
                client,
                ones,
                items,
                order_date=order_date,
                so_number=so_number,
            )
            create_payment(
                client,
                so.total_amount,
                sales_order=so,
                payment_date=order_date + timedelta(days=20),
                method="Virement",
                reference=f"VIR-{order_date.day:02d}{order_date.month:02d}",
                note="Règlement fidélité (démo)",
            )
            self.stdout.write(f"  {so_number} : {so.total_amount} MAD + paiement à +20 j")
            for p in so.payments.all():
                self.stdout.write(f"    paiement {p.reference} du {p.payment_date} : {p.amount} MAD")

        self.stdout.write(self.style.SUCCESS("Done. Historique fidélité prêt."))