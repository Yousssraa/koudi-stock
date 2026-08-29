"""Wipe all demo/business data to start operating with real information.

Kept: warehouses (system locations), auth users/tokens, company profile.
Wiped: audit trail, payments, sales & purchases, stock ledger, inventory,
drying batches, kilns, monthly archives, price tiers, products, wood types,
clients, suppliers.

Run:  python manage.py purge_demo             (apply)
      python manage.py purge_demo --dry-run   (counts only)
"""
from django.core.management.base import BaseCommand

from stock.models import (
    AuditLog,
    Client,
    DeliveryNote,
    DeliveryNoteItem,
    DryingBatch,
    Inventory,
    Kiln,
    MonthlyArchive,
    Payment,
    PriceTier,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    SalesOrder,
    SalesOrderItem,
    StockMovement,
    Supplier,
    WoodType,
)

MODELS = [
    AuditLog,
    Payment,
    SalesOrderItem,
    SalesOrder,
    PurchaseOrderItem,
    PurchaseOrder,
    DeliveryNoteItem,
    DeliveryNote,
    StockMovement,
    Inventory,
    DryingBatch,
    Kiln,
    MonthlyArchive,
    PriceTier,
    Product,
    WoodType,
    Client,
    Supplier,
]


class Command(BaseCommand):
    help = (
        "Delete every business row so the site starts empty for real data. "
        "Warehouses, users and the company profile are preserved."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true", help="Show counts without deleting anything."
        )

    def handle(self, *args, **options):
        self.stdout.write("Rows per table:")
        total = 0
        for model in MODELS:
            count = model.objects.count()
            total += count
            self.stdout.write(f"  {model.__name__:<18} {count:>8}")
            if not options["dry_run"]:
                model.objects.all().delete()
        verb = "would be deleted" if options["dry_run"] else "rows deleted"
        self.stdout.write("")
        if options["dry_run"]:
            self.stdout.write(self.style.WARNING(f"{total} rows {verb} (dry run — nothing touched)."))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"{total} {verb}. Depôts, utilisateurs et profil société conservés."
            ))
