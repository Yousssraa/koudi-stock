import os
from django.core.management.base import BaseCommand

CATALOG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "KOUDI-WOOD-Catalogue.pdf")


class Command(BaseCommand):
    help = "Regenerate the public catalog PDF file (static, served without runtime generation)."

    def handle(self, *args, **options):
        from stock.models import Product
        from stock.pdfs import build_catalog_pdf

        qs = (
            Product.objects.select_related("wood_type")
            .prefetch_related("inventory_set")
            .filter(is_active=True)
            .order_by("name")
        )
        grouped = {}
        for p in qs:
            grouped.setdefault(p.category, []).append(p)

        label = dict(Product.Category.choices)
        groups = [(label.get(k, k), v) for k, v in grouped.items()]

        payload = build_catalog_pdf(list(qs), groups)
        os.makedirs(os.path.dirname(CATALOG_PATH), exist_ok=True)
        with open(CATALOG_PATH, "wb") as f:
            f.write(payload)

        self.stdout.write(self.style.SUCCESS(f"Catalog PDF regenerated: {len(payload)} bytes, {len(list(qs))} products."))