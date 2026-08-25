"""Automatic audit logging via Django signals.

Every create / update / delete of the core business entities (products,
stock movements, sales orders, purchase orders) is recorded. Price changes
(cost or sale, per m³) are logged separately as ``price_update`` so the
price history is visible in the trail.
"""
import threading

from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .audit import audit, current_user
from .models import Product, PurchaseOrder, SalesOrder, StockMovement

_PRE = threading.local()


def _entity_ref(obj):
    """Human-readable reference for an instance (order/PO/movement/product)."""
    for field in ("so_number", "po_number", "movement_no", "sku", "name"):
        value = getattr(obj, field, None)
        if value:
            return str(value)
    return None


# ---------------------------------------------------------------------------
# Product: create / update / price update / delete
# ---------------------------------------------------------------------------
@receiver(pre_save, sender=Product)
def _capture_old_prices(sender, instance, **kwargs):
    if instance.pk:
        try:
            old = Product.objects.get(pk=instance.pk)
            _PRE.prices = (old.cost_price, old.sale_price)
        except Product.DoesNotExist:
            _PRE.prices = None
    else:
        _PRE.prices = None


@receiver(post_save, sender=Product)
def _audit_product(sender, instance, created, **kwargs):
    if current_user() is None:
        return
    old = getattr(_PRE, "prices", None)
    new = (instance.cost_price, instance.sale_price)
    _PRE.prices = None
    if created:
        audit("create", "product", instance.pk, _entity_ref(instance), {
            "sku": instance.sku, "category": instance.category,
        })
    elif old is not None and old != new:
        audit("price_update", "product", instance.pk, _entity_ref(instance), {
            "old_cost_per_m3": str(old[0]), "new_cost_per_m3": str(new[0]),
            "old_sale_per_m3": str(old[1]), "new_sale_per_m3": str(new[1]),
        })
    else:
        audit("update", "product", instance.pk, _entity_ref(instance))


@receiver(post_delete, sender=Product)
def _audit_product_delete(sender, instance, **kwargs):
    audit("delete", "product", instance.pk, _entity_ref(instance), {"sku": instance.sku})


# ---------------------------------------------------------------------------
# Stock movements (entries / sales / transfers / adjustments)
# ---------------------------------------------------------------------------
@receiver(post_save, sender=StockMovement)
def _audit_movement(sender, instance, created, **kwargs):
    if current_user() is None:
        return
    audit("create", "stock_movement", instance.pk, instance.movement_no, {
        "movement_type": instance.movement_type,
        "quantity": str(instance.quantity),
        "product_sku": instance.product.sku,
        "warehouse": instance.warehouse.code,
        "lot": instance.lot_number,
    })


@receiver(post_delete, sender=StockMovement)
def _audit_movement_delete(sender, instance, **kwargs):
    audit("delete", "stock_movement", instance.pk, instance.movement_no, {
        "movement_type": instance.movement_type,
    })


# ---------------------------------------------------------------------------
# Sales / purchase orders
# ---------------------------------------------------------------------------
def _audit_order(instance, created, kind):
    action = "create" if created else "update"
    audit(action, kind, instance.pk, _entity_ref(instance), {
        "status": instance.status,
        "total_amount": str(instance.total_amount),
        "currency": instance.currency,
    })


@receiver(post_save, sender=SalesOrder)
def _audit_sales_order(sender, instance, created, **kwargs):
    if current_user() is None:
        return
    _audit_order(instance, created, "sales_order")


@receiver(post_save, sender=PurchaseOrder)
def _audit_purchase_order(sender, instance, created, **kwargs):
    if current_user() is None:
        return
    _audit_order(instance, created, "purchase_order")
