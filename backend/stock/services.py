"""Business logic for stock operations.

Inventory itself is maintained automatically by the ``maintain_inventory``
database trigger on ``stock_movements``: ``purchase_in`` / ``sale_return`` /
``transfer_in`` / ``opening`` increase stock, ``sale_out`` / ``purchase_return`` /
``transfer_out`` decrease it. This module creates the correct ledger rows and
the corresponding order documents.
"""
from datetime import datetime, time as dt_time, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import (
    Client,
    DryingBatch,
    Payment,
    PriceTier,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    SalesOrder,
    SalesOrderItem,
    StockMovement,
    compute_volume_m3,
)

ZERO = Decimal("0")

FEE_FIELDS = ("freight_cost", "customs_cost", "handling_cost")


def _line_volume_m3(product, item, qty):
    """Volume m³ from the item's dimensions (falling back to the product catalog)."""
    return compute_volume_m3(
        item.get("thickness_mm") or product.thickness_mm,
        item.get("width_mm") or product.width_mm,
        item.get("length_mm") or product.length_mm,
        qty,
    )


def _next_movement_no():
    return timezone.now().strftime("MV%Y%m%d%H%M%S%f")


def _order_datetime(order_date):
    """Aware datetime at midnight for ``order_date`` (``None`` when absent)."""
    if order_date is None:
        return None
    return timezone.make_aware(datetime.combine(order_date, dt_time.min))


def log_stock_movement(
    product,
    warehouse,
    movement_type,
    quantity,
    unit_price=None,
    lot_number=None,
    reference_type=None,
    reference_id=None,
    note=None,
    moved_at=None,
):
    """Insert a ledger row; the DB trigger updates ``inventory`` automatically.

    ``moved_at`` defaults to ``timezone.now()`` so the returned instance always
    carries a real datetime (resolved in Python, not the lazy ``Now()`` DB
    expression) — this lets callers serialize the movement immediately.
    """
    if moved_at is None:
        moved_at = timezone.now()
    return StockMovement.objects.create(
        movement_no=_next_movement_no(),
        product=product,
        warehouse=warehouse,
        movement_type=movement_type,
        quantity=quantity,
        unit_price=unit_price,
        lot_number=lot_number,
        reference_type=reference_type,
        reference_id=reference_id,
        note=note,
        moved_at=moved_at,
    )


@transaction.atomic
def create_purchase(supplier, warehouse, items, order_date=None, currency="MAD", moved_at=None, po_number=None, fees=None):
    """Register a received purchase order and log purchase_in movements.

    ``order_date`` backdates the document timestamps (seed/historical data);
    ``moved_at`` backdates the ledger rows. Both default to "now".

    ``fees`` is an optional dict of logistics costs (MAD):
    ``{"freight_cost":…, "customs_cost":…, "handling_cost":…}``. Fees are
    allocated to each line proportionally to its volume (m³), which yields the
    true **landed cost per m³** used for margin reporting.
    """
    fees = {k: Decimal(str(fees[k])) for k in FEE_FIELDS if fees and fees.get(k)}
    po = PurchaseOrder.objects.create(
        po_number=po_number or timezone.now().strftime("PO%Y%m%d%H%M%S"),
        supplier=supplier,
        warehouse=warehouse,
        status=PurchaseOrder.Status.RECEIVED,
        currency=currency,
        freight_cost=fees.get("freight_cost", ZERO),
        customs_cost=fees.get("customs_cost", ZERO),
        handling_cost=fees.get("handling_cost", ZERO),
    )

    subtotal = ZERO
    total_volume = ZERO
    lines = []
    for item in items:
        product = item["product"]
        qty = Decimal(str(item["quantity"]))
        # Timber is priced per cubic metre (MAD / m3).
        price_per_m3 = Decimal(str(item.get("price_per_m3", product.cost_price or ZERO)))
        volume_m3 = _line_volume_m3(product, item, qty) or ZERO
        line_total = volume_m3 * price_per_m3
        subtotal += line_total
        total_volume += volume_m3
        lines.append((product, qty, price_per_m3, volume_m3, line_total, item))

    fee_total = sum(fees.values(), ZERO)
    for product, qty, price_per_m3, volume_m3, line_total, item in lines:
        allocated = ZERO
        if total_volume > 0:
            allocated = (fee_total * volume_m3 / total_volume)
        PurchaseOrderItem.objects.create(
            purchase_order=po,
            product=product,
            quantity_ordered=qty,
            quantity_received=qty,
            unit_price=price_per_m3,
            line_total=line_total,
            allocated_fees=allocated.quantize(Decimal("0.01")),
        )

        # purchase_in increases stock (checked by the DB trigger / constraint).
        log_stock_movement(
            product=product,
            warehouse=warehouse,
            movement_type=StockMovement.MovementType.PURCHASE_IN,
            quantity=qty,
            unit_price=price_per_m3,
            lot_number=item.get("lot_number"),
            reference_type="purchase_order",
            reference_id=po.pk,
            note=f"CUBIC METRES: {volume_m3}",
            moved_at=moved_at,
        )

    po.subtotal = subtotal
    po.total_amount = subtotal + po.total_fees
    po.save(update_fields=["subtotal", "total_amount"])
    if order_date is not None:
        dt = _order_datetime(order_date)
        PurchaseOrder.objects.filter(pk=po.pk).update(
            order_date=order_date, created_at=dt, updated_at=dt
        )
    return po


@transaction.atomic
def create_sale(client, warehouse, items, order_date=None, currency="MAD", moved_at=None, so_number=None, discount_percent=ZERO, tier_name=None):
    """Register a shipped sales order and log sale_out movements.

    ``order_date`` backdates the document timestamps (seed/historical data);
    ``moved_at`` backdates the ledger rows. Both default to "now".

    ``discount_percent`` applies a volume-tier discount at the order header
    level (lines keep their list price; the discount is deducted from the
    subtotal). ``tier_name`` documents which bracket was applied.
    """
    discount_percent = Decimal(str(discount_percent or ZERO))
    so = SalesOrder.objects.create(
        so_number=so_number or timezone.now().strftime("SO%Y%m%d%H%M%S"),
        client=client,
        warehouse=warehouse,
        status=SalesOrder.Status.SHIPPED,
        currency=currency,
        discount_percent=discount_percent,
        tier_name=tier_name,
    )

    subtotal = ZERO
    for item in items:
        product = item["product"]
        qty = Decimal(str(item["quantity"]))
        # Timber is priced per cubic metre (MAD / m3).
        price_per_m3 = Decimal(str(item.get("price_per_m3", product.sale_price or ZERO)))
        volume_m3 = _line_volume_m3(product, item, qty) or ZERO
        line_total = volume_m3 * price_per_m3
        subtotal += line_total

        SalesOrderItem.objects.create(
            sales_order=so,
            product=product,
            quantity_ordered=qty,
            quantity_shipped=qty,
            unit_price=price_per_m3,
            line_total=line_total,
        )

        # sale_out is logged as a POSITIVE quantity; the DB trigger
        # ``maintain_inventory`` negates it so stock decreases.
        log_stock_movement(
            product=product,
            warehouse=warehouse,
            movement_type=StockMovement.MovementType.SALE_OUT,
            quantity=qty,
            unit_price=price_per_m3,
            lot_number=item.get("lot_number"),
            reference_type="sales_order",
            reference_id=so.pk,
            note=f"CUBIC METRES: {volume_m3}",
            moved_at=moved_at,
        )

    discount_amount = (subtotal * discount_percent / Decimal("100")).quantize(Decimal("0.0001"))
    so.subtotal = subtotal
    so.discount_amount = discount_amount
    so.total_amount = subtotal - discount_amount
    so.save(update_fields=["subtotal", "discount_amount", "total_amount"])
    if order_date is not None:
        dt = _order_datetime(order_date)
        SalesOrder.objects.filter(pk=so.pk).update(
            order_date=order_date, created_at=dt, updated_at=dt
        )
    return so


@transaction.atomic
def create_reorder(supplier, warehouse, items):
    """Create a DRAFT purchase order (procurement reorder, no stock movement).

    Used by the stock-alert "Generate Purchase Reorder" action: quantities are
    suggestions until the buyer confirms the PO is received.
    """
    po = PurchaseOrder.objects.create(
        po_number=timezone.now().strftime("RO%Y%m%d%H%M%S"),
        supplier=supplier,
        warehouse=warehouse,
        status=PurchaseOrder.Status.DRAFT,
    )

    subtotal = ZERO
    for item in items:
        product = item["product"]
        qty = Decimal(str(item["quantity"]))
        price_per_m3 = product.cost_price or ZERO
        volume_m3 = _line_volume_m3(product, item, qty) or ZERO
        line_total = volume_m3 * price_per_m3
        subtotal += line_total
        PurchaseOrderItem.objects.create(
            purchase_order=po,
            product=product,
            quantity_ordered=qty,
            quantity_received=ZERO,
            unit_price=price_per_m3,
            line_total=line_total,
        )

    po.subtotal = subtotal
    po.total_amount = subtotal
    po.notes = "Réapprovisionnement auto depuis les alertes de stock (draft)."
    po.save(update_fields=["subtotal", "total_amount", "notes"])
    return po


def transfer_stock(product, from_warehouse, to_warehouse, quantity, lot_number=None, moved_at=None):
    """Move stock between warehouses using two ledger rows."""
    with transaction.atomic():
        # transfer_out is logged as POSITIVE; the trigger negates it so the
        # source warehouse stock decreases.
        transfer_out = log_stock_movement(
            product=product,
            warehouse=from_warehouse,
            movement_type=StockMovement.MovementType.TRANSFER_OUT,
            quantity=abs(Decimal(str(quantity))),
            lot_number=lot_number,
            reference_type="transfer",
            note=f"Transfer OUT to {to_warehouse.code}",
            moved_at=moved_at,
        )
        transfer_in = log_stock_movement(
            product=product,
            warehouse=to_warehouse,
            movement_type=StockMovement.MovementType.TRANSFER_IN,
            quantity=abs(Decimal(str(quantity))),
            lot_number=lot_number,
            reference_type="transfer",
            note=f"Transfer IN from {from_warehouse.code}",
            moved_at=moved_at,
        )
        return transfer_out, transfer_in


# ---------------------------------------------------------------------------
# Landed cost (true cost per m³ incl. allocated logistics fees)
# ---------------------------------------------------------------------------
def landed_cost_per_m3(product):
    """Weighted average landed cost per m³ for a product.

    ``(Σ line_total + Σ allocated_fees) / Σ volume_m³`` over all received
    purchase order lines. Returns ``Decimal`` or ``None`` when there is no
    received volume on record.
    """
    total_cost = ZERO
    total_fees = ZERO
    total_volume = ZERO
    for poi in PurchaseOrderItem.objects.filter(product=product):
        volume = compute_volume_m3(
            product.thickness_mm, product.width_mm, product.length_mm, poi.quantity_ordered
        ) or ZERO
        if volume <= 0:
            continue
        total_cost += poi.line_total
        total_fees += poi.allocated_fees
        total_volume += volume
    if total_volume <= 0:
        return None
    return ((total_cost + total_fees) / total_volume).quantize(Decimal("0.01"))


# ---------------------------------------------------------------------------
# Client credit / receivables
# ---------------------------------------------------------------------------
_SHIPPED_STATUSES = (
    SalesOrder.Status.CONFIRMED,
    SalesOrder.Status.PARTIALLY_SHIPPED,
    SalesOrder.Status.SHIPPED,
    SalesOrder.Status.DELIVERED,
)


def _so_due_date(so, client):
    base = so.order_date or (so.created_at.date() if so.created_at else timezone.localdate())
    return base + timedelta(days=client.payment_terms_days_effective)


def client_credit_summary(client, today=None):
    """Outstanding / overdue / available credit for a client.

    Outstanding = sum of shipped(-ish) order balances (total − paid per SO).
    Overdue = the part of outstanding whose due date (order_date + terms) is
    in the past. All figures are MAD.
    """
    today = today or timezone.localdate()
    sos = list(SalesOrder.objects.filter(client=client, status__in=_SHIPPED_STATUSES))
    outstanding = ZERO
    overdue = ZERO
    for so in sos:
        balance = so.balance_due
        if balance <= 0:
            continue
        outstanding += balance
        if _so_due_date(so, client) < today:
            overdue += balance

    limit = client.credit_limit or ZERO
    available = limit - outstanding
    return {
        "client_id": client.pk,
        "credit_limit": Decimal(str(limit)),
        "outstanding": outstanding,
        "overdue": overdue,
        "available_credit": max(available, ZERO),
        "over_limit": outstanding > limit,
        "credit_used_pct": round(float(outstanding / limit * 100), 1) if limit > 0 else None,
        "is_blocked": client.is_blocked,
        "payment_terms_days": client.payment_terms_days_effective,
    }


def check_sale_credit(client, order_total, today=None):
    """Credit guard for a new sale.

    :returns: tuple ``(blocked, summary)`` where ``blocked`` is ``True`` only
              when the client is explicitly ``is_blocked`` (warnings are
              returned, not enforced).
    """
    summary = client_credit_summary(client, today=today)
    summary["projected_outstanding"] = summary["outstanding"] + order_total
    summary["projected_over_limit"] = summary["projected_outstanding"] > summary["credit_limit"]
    return (client.is_blocked, summary)


@transaction.atomic
def create_payment(client, amount, sales_order=None, payment_date=None, method=None, reference=None, note=None):
    """Record a receipt against a client (optionally on a specific invoice)."""
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError("Le montant du paiement doit être strictement positif.")
    return Payment.objects.create(
        client=client,
        sales_order=sales_order,
        amount=amount,
        payment_date=payment_date or timezone.localdate(),
        method=method or "",
        reference=reference or "",
        note=note or "",
    )


# ---------------------------------------------------------------------------
# Kiln drying workflow (batch lifecycle: in_progress → completed | cancelled)
# ---------------------------------------------------------------------------
def next_batch_no():
    return timezone.now().strftime("KD%Y%m%d%H%M%S%f")


def create_drying_batch(product, quantity, kiln=None, warehouse=None,
                        start_moisture=None, target_moisture=None,
                        estimated_end_date=None, energy_cost=ZERO, notes=None, batch_no=None):
    """Open an in-progress drying batch on a kiln / séchoir unit.

    The batch volume (m³) is frozen at creation from the product dimensions ×
    quantity, and the warehouse snapshot defaults to the kiln's warehouse.
    """
    if kiln is not None and warehouse is None:
        warehouse = kiln.warehouse
    if warehouse is None:
        raise ValueError("Un séchoir (kiln) ou un dépôt (warehouse) est requis pour ouvrir un lot.")

    volume = compute_volume_m3(
        product.thickness_mm, product.width_mm, product.length_mm, quantity
    ) or ZERO

    return DryingBatch.objects.create(
        batch_no=batch_no or next_batch_no(),
        product=product,
        kiln=kiln,
        warehouse=warehouse,
        status=DryingBatch.Status.IN_PROGRESS,
        quantity=quantity,
        initial_volume_m3=volume.quantize(Decimal("0.0001")),
        start_moisture=start_moisture,
        target_moisture=target_moisture or Decimal("10"),
        current_moisture=start_moisture,
        energy_cost=Decimal(str(energy_cost or ZERO)),
        estimated_end_date=estimated_end_date,
        notes=notes,
        started_at=timezone.now(),
    )


@transaction.atomic
def complete_drying_batch(batch, current_moisture=None):
    """Mark a batch completed and apply the drying results to the product:
    finish → kiln-dried, moisture → current (or target), unit prices raised by
    the batch energy cost per m³.
    """
    if batch.status != DryingBatch.Status.IN_PROGRESS:
        raise ValueError(
            f"Impossible de terminer : le lot « {batch.batch_no} » est « {batch.get_status_display()} »."
        )

    if current_moisture is not None:
        batch.current_moisture = current_moisture
    elif batch.current_moisture is None:
        batch.current_moisture = batch.target_moisture
    mc = batch.current_moisture

    batch.status = DryingBatch.Status.COMPLETED
    batch.completed_at = timezone.now()
    batch.save()

    product = batch.product
    Product.objects.filter(pk=product.pk).update(moisture_content=mc)
    if product.finish != "kiln-dried":
        product.finish = "kiln-dried"
        product.save(update_fields=["finish"])

    # Energy cost incurred by this cycle, spread per m³ → unit prices rise.
    vol = batch.initial_volume_m3 or ZERO
    if vol <= 0:
        vol = compute_volume_m3(
            product.thickness_mm, product.width_mm, product.length_mm, batch.quantity
        ) or ZERO
    if vol > 0 and (batch.energy_cost or ZERO) > 0:
        bump = (batch.energy_cost / vol).quantize(Decimal("0.01"))
        product.cost_price = (product.cost_price or ZERO) + bump
        product.sale_price = (product.sale_price or ZERO) + bump
        product.save(update_fields=["cost_price", "sale_price"])

    return batch


@transaction.atomic
def cancel_drying_batch(batch):
    """Cancel an in-progress batch (no effect on the product prices)."""
    if batch.status != DryingBatch.Status.IN_PROGRESS:
        raise ValueError(
            f"Impossible d'annuler : le lot « {batch.batch_no} » est « {batch.get_status_display()} »."
        )
    batch.status = DryingBatch.Status.CANCELLED
    batch.save()
    return batch


# ---------------------------------------------------------------------------
# Volume-based tier pricing
# ---------------------------------------------------------------------------
def resolve_tier(total_volume_m3):
    """Best active price tier for a given order volume (m³), or ``None``."""
    if total_volume_m3 is None or total_volume_m3 <= 0:
        return None
    best = None
    for tier in PriceTier.objects.filter(is_active=True):
        if tier.matches(total_volume_m3) and (best is None or tier.min_volume_m3 > best.min_volume_m3):
            best = tier
    return best


def apply_tier_discount(subtotal, discount_percent):
    """Amount to deduct from a subtotal given a tier discount in %."""
    discount_percent = Decimal(str(discount_percent or ZERO))
    if discount_percent <= 0:
        return ZERO
    return (subtotal * discount_percent / Decimal("100")).quantize(Decimal("0.0001"))