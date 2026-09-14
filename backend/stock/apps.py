import logging
from django.apps import AppConfig

log = logging.getLogger(__name__)

# Module-level cache for the pre-generated catalog PDF.
_catalog_pdf = None


def catalog_pdf_bytes():
    """Return the pre-generated catalog PDF bytes, or ``None`` if not ready yet."""
    return _catalog_pdf


class StockConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "stock"

    def ready(self):
        from . import signals  # noqa: F401
        self._prebuild_catalog()

    def _prebuild_catalog(self):
        global _catalog_pdf
        try:
            from .models import Product
            from .pdfs import build_catalog_pdf

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

            _catalog_pdf = build_catalog_pdf(list(qs), groups)
            log.info("Catalog PDF pre-built (%d bytes, %d products).", len(_catalog_pdf), qs.count())
        except Exception:
            log.exception("Failed to pre-build catalog PDF — endpoint will return 503.")
