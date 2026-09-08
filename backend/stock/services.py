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
    ClientPriceDiscount,
    CreditNote,
    DeliveryNote,
    DeliveryNoteItem,
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

# Payments are recorded to the centime (2 decimals) while invoice totals keep
# 4-decimal precision; a residual of a few centimes after a chèque/traite covers
# an invoice is a rounding artifact, not an outstanding balance.
PAYMENT_EPSILON = Decimal("0.01")


def invoice_effectively_settled(so):
    """True when a SalesOrder's balance is settled within the centime."""
    return (so.balance_due or ZERO) <= PAYMENT_EPSILON

FEE_FIELDS = ("freight_cost", "customs_cost", "handling_cost")


def notify_client(client, kind, title, message=None, link=None, user=None):
    """Drop a notification in a client's Espace Pro inbox."""
    from .models import ClientNotification

    return ClientNotification.objects.create(
        client=client,
        user=user,
        kind=kind,
        title=title,
        message=message,
        link=link,
    )


def _line_volume_m3(product, item, qty):
    """Volume m³ from the item's dimensions (falling back to the product catalog)."""
    return compute_volume_m3(
        item.get("thickness_mm") or product.thickness_mm,
        item.get("width_mm") or product.width_mm,
        item.get("length_m") or product.length_m,
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
    so.total_amount = (subtotal - discount_amount).quantize(Decimal("0.0001"))
    so.save(update_fields=["subtotal", "discount_amount", "total_amount"])
    if order_date is not None:
        dt = _order_datetime(order_date)
        SalesOrder.objects.filter(pk=so.pk).update(
            order_date=order_date, created_at=dt, updated_at=dt
        )
    # B2B loyalty: 1 m³ acheté = 50 Points Pro (idempotent per sales order).
    award_loyalty_points(client, so)
    return so


@transaction.atomic
def convert_quote_to_sale(quote, warehouse):
    """Turn an accepted/sent client quote into a real sales order.

    Lines keep their negotiated prices (MAD per m³); the standard volume-tier
    discount is applied at the order header the same way as a manual sale, and
    ``create_sale`` posts the ``sale_out`` ledger rows (stock decreases).
    """
    items = [
        {"product": item.product, "quantity": item.quantity, "price_per_m3": item.unit_price}
        for item in quote.items.select_related("product")
    ]
    if not items:
        raise ValueError("Ce devis ne contient aucune ligne exploitable.")

    order_volume = ZERO
    for item in items:
        order_volume += _line_volume_m3(item["product"], item, item["quantity"]) or ZERO
    tier = resolve_tier(order_volume)
    discount_percent = tier.discount_percent if tier else ZERO
    tier_name = tier.name if tier else None

    so = create_sale(
        quote.client,
        warehouse,
        items,
        discount_percent=discount_percent,
        tier_name=tier_name,
    )
    return so, discount_percent, tier_name


def next_bl_number():
    """Next Bon de Livraison number in the ``BL-YYYY-MM-NNN`` series.

    The sequence is scoped to the current month and matched by prefix so it is
    idempotent and survives parallel creates: the highest existing ``BL-…-NNN``
    for ``YYYY-MM`` is incremented (e.g. ``BL-2026-09-001``).
    """
    prefix = timezone.localtime().strftime("BL-%Y-%m")
    last = (
        DeliveryNote.objects.filter(bl_number__startswith=prefix + "-")
        .order_by("-bl_number")
        .values_list("bl_number", flat=True)
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"{prefix}-{seq:03d}"


@transaction.atomic
def create_delivery_note(client, warehouse, items, driver_name=None, truck_plate=None,
                         notes=None, bl_number=None, moved_at=None):
    """Create a Bon de Livraison and log a ``sale_out`` movement per line.

    The delivery note ships timber to a client: each line is priced per cubic
    metre (MAD/m³) and the ``sale_out`` ledger rows decrement the warehouse
    inventory via the ``maintain_inventory`` trigger, so the shipping history
    doubles as the transport/archive audit trail.

    :arg items: list of ``{"product", "quantity", "price_per_m3"?}`` dicts.
    :returns: the saved ``DeliveryNote`` (with items).
    """
    moved_at = moved_at or timezone.now()
    bl = DeliveryNote.objects.create(
        bl_number=bl_number or next_bl_number(),
        client=client,
        warehouse=warehouse,
        driver_name=(driver_name or "").strip(),
        truck_plate=(truck_plate or "").strip(),
        notes=(notes or "").strip(),
        status=DeliveryNote.Status.PREPARATION,
    )

    for item in items:
        product = item["product"]
        qty = Decimal(str(item["quantity"]))
        price_per_m3 = Decimal(str(item.get("price_per_m3", product.sale_price or ZERO)))
        volume_m3 = _line_volume_m3(product, item, qty) or ZERO
        line_total = volume_m3 * price_per_m3

        DeliveryNoteItem.objects.create(
            delivery_note=bl,
            product=product,
            quantity=qty,
            unit_price=price_per_m3,
            line_total=line_total,
        )

        log_stock_movement(
            product=product,
            warehouse=warehouse,
            movement_type=StockMovement.MovementType.SALE_OUT,
            quantity=qty,
            unit_price=price_per_m3,
            lot_number=item.get("lot_number"),
            reference_type="delivery_note",
            reference_id=bl.pk,
            note=f"CUBIC METRES: {volume_m3} · BL {bl.bl_number}",
            moved_at=moved_at,
        )
    return bl


@transaction.atomic
def advance_delivery_note(bl, new_status):
    """Move a Bon de Livraison along its lifecycle and stamp the timestamps.

    Both lifecycle chains are supported:
      - classic / shipping flow: ``preparation → in_transit → delivered``
      - back-office flow: ``waiting → validated → invoiced`` (also allows a
        BL to move between the two chains at the marked steps).

    Backward or no-op transitions are rejected. Returns the updated note.
    """
    valid = {
        DeliveryNote.Status.PREPARATION,
        DeliveryNote.Status.IN_TRANSIT,
        DeliveryNote.Status.DELIVERED,
        DeliveryNote.Status.WAITING,
        DeliveryNote.Status.VALIDATED,
        DeliveryNote.Status.INVOICED,
        DeliveryNote.Status.CANCELLED,
    }
    if new_status not in valid:
        raise ValueError(f"Statut de livraison invalide : {new_status!r}")

    if new_status == DeliveryNote.Status.CANCELLED:
        bl.status = DeliveryNote.Status.CANCELLED
        bl.save(update_fields=["status", "updated_at"])
        return bl

    order = [
        DeliveryNote.Status.PREPARATION,
        DeliveryNote.Status.IN_TRANSIT,
        DeliveryNote.Status.DELIVERED,
        DeliveryNote.Status.WAITING,
        DeliveryNote.Status.VALIDATED,
        DeliveryNote.Status.INVOICED,
    ]
    if bl.status in order and new_status in order:
        current_idx = order.index(bl.status)
        next_idx = order.index(new_status)
        if next_idx != current_idx + 1:
            raise ValueError(
                f"Transition de statut non autorisée : {bl.status!r} → {new_status!r}. "
                "Progression d'un seul pas (préparation → en cours → livré "
                "ou en attente → validé → facturé)."
            )

    bl.status = new_status
    if new_status == DeliveryNote.Status.IN_TRANSIT and bl.shipped_at is None:
        bl.shipped_at = timezone.now()
    if new_status == DeliveryNote.Status.DELIVERED and bl.delivered_at is None:
        bl.delivered_at = timezone.now()
    if new_status == DeliveryNote.Status.VALIDATED and bl.shipped_at is None:
        bl.shipped_at = timezone.now()
    bl.save(update_fields=["status", "shipped_at", "delivered_at", "updated_at"])
    return bl


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
            product.thickness_mm, product.width_mm, product.length_m, poi.quantity_ordered
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

    Outstanding = sum of shipped(-ish) order balances (total − paid per SO,
    minus the credit notes already applied) that remains above zero, less the
    on-account credit (avoirs not tied to a specific invoice). Overdue is the
    part of outstanding whose due date (order_date + terms) is in the past.
    All figures are MAD.
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

    # Avoirs non affectés à une facture précise (ou part non appliquée) :
    # crédit en compte qui réduit l'encours global du client.
    on_account = ZERO
    for cn in client.credit_notes.all():
        on_account += (cn.amount or ZERO) - (cn.applied_amount or ZERO)
    outstanding = max(outstanding - on_account, ZERO)
    overdue = max(overdue - on_account, ZERO)

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
def create_payment(client, amount, sales_order=None, payment_date=None, method=None,
                   reference=None, note=None, method_key=None, bank_name=None, due_date=None):
    """Record a receipt against a client (optionally on a specific invoice).

    ``method_key`` is the formalised Payment instrument (cheque / traite_30 /
    virement / especes…); ``bank_name`` the collecting bank and ``due_date`` the
    expected encaissement date (échéance) — mostly for chèques and traites.
    """
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError("Le montant du paiement doit être strictement positif.")
    key = method_key or Payment.Method.AUTRE
    label = dict(Payment.Method.choices).get(key, key)
    return Payment.objects.create(
        client=client,
        sales_order=sales_order,
        amount=amount,
        payment_date=payment_date or timezone.localdate(),
        method=method or label,
        method_key=key,
        bank_name=bank_name or "",
        reference=reference or "",
        due_date=due_date,
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
        product.thickness_mm, product.width_mm, product.length_m, quantity
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
            product.thickness_mm, product.width_mm, product.length_m, batch.quantity
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


# ---------------------------------------------------------------------------
# Espace Pro — B2B client pricing, loyalty & statement
# ---------------------------------------------------------------------------
def client_price_discount(client, product):
    """Best matching client-specific discount for a product.

    Returns ``(discount_percent, label)`` — the most specific active rule
    wins (wood_type > category > all). All amounts are percentages (MAD).
    """
    if client is None or product is None:
        return ZERO, None
    rules = list(
        client.price_discounts.filter(is_active=True).select_related("wood_type")
    )
    best_dp = ZERO
    best_label = None
    best_rank = 0
    for rule in rules:
        dp = rule.discount_percent or ZERO
        if dp <= 0:
            continue
        if rule.scope == ClientPriceDiscount.Scope.WOOD_TYPE:
            matched = product.wood_type_id is not None and rule.wood_type_id == product.wood_type_id
            rank = 3
        elif rule.scope == ClientPriceDiscount.Scope.CATEGORY:
            matched = rule.category and rule.category == product.category
            rank = 2
        else:
            matched = True
            rank = 1
        if matched and rank > best_rank:
            best_rank = rank
            best_dp = dp
            best_label = rule.label
    return best_dp, best_label


def net_client_price(client, product):
    """Client net price per m³: list sale price minus the client discount."""
    dp, _label = client_price_discount(client, product)
    price = product.sale_price or ZERO
    if dp > 0:
        price = (price * (Decimal("100") - dp) / Decimal("100")).quantize(Decimal("0.01"))
    return price, dp, _label


PRO_POINTS_PER_M3 = 50  # 1 m³ acheté = 50 Points Pro

# Tier thresholds (cumulative invoiced volume in m³) and their perks.
TIER_THRESHOLDS = [
    # (min_volume_m3, key, label, perks)
    (Decimal("75"), "platine", "Platine",
     ["Livraison camion OFFERTE sur tout le Maroc", "Ristourne annuelle 2 % supplémentaire",
      "Points Pro ×2", "Priorité d'approvisionnement"]),
    (Decimal("30"), "or", "Or",
     ["Livraison OFFERTE à Casablanca (≤ 25 km)", "Ristourne annuelle 1,5 %",
      "Points Pro ×1,5", "Séchoir prioritaire"]),
    (Decimal("10"), "argent", "Argent",
     ["Tarifs professionnels négociés", "Accès au programme Points Pro",
      "5 % de ristourne annuelle dès 10 m³"]),
]


def client_loyalty_tier(total_volume_m3):
    """Return the loyalty tier dict for a cumulative volume (Argent/Or/Platine)."""
    total_volume_m3 = Decimal(str(total_volume_m3 or ZERO))
    for threshold, key, label, perks in TIER_THRESHOLDS:
        if total_volume_m3 >= threshold:
            return {"key": key, "label": label, "perks": perks, "min_volume_m3": threshold}
    return {"key": None, "label": "—", "perks": [], "min_volume_m3": None}


def _invoiced_volume(client):
    """Total volume (m³) of the client's shipped/invoiced sales orders."""
    volume = ZERO
    for so in SalesOrder.objects.filter(client=client, status__in=_SHIPPED_STATUSES):
        for item in so.items.select_related("product"):
            v = compute_volume_m3(
                item.product.thickness_mm, item.product.width_mm, item.product.length_m,
                item.quantity_ordered,
            )
            if v is not None:
                volume += v
    return volume


def award_loyalty_points(client, so, volume_m3=None, commit=True):
    """Earn Points Pro on a shipped invoice: 1 m³ = 50 points (rounded down).

    Called automatically by :func:`create_sale` (so seed data and manual sales
    both feed the ledger). Kept idempotent per sales order.
    """
    from .models import LoyaltyLedger

    if volume_m3 is None:
        volume_m3 = ZERO
        for item in so.items.select_related("product"):
            v = compute_volume_m3(
                item.product.thickness_mm, item.product.width_mm, item.product.length_m,
                item.quantity_ordered,
            )
            if v is not None:
                volume_m3 += v
    volume_m3 = Decimal(str(volume_m3 or ZERO))
    points = int(volume_m3 * PRO_POINTS_PER_M3)

    existing = LoyaltyLedger.objects.filter(client=client, sales_order=so).exists()
    if existing or points <= 0:
        return None
    entry = LoyaltyLedger(
        client=client, sales_order=so, reason=LoyaltyLedger.Reason.VOLUME,
        points=points, volume_m3=volume_m3,
        note=f"{PRO_POINTS_PER_M3} pts / m³ — {so.so_number}",
    )
    if commit:
        entry.save()
    return entry


def client_loyalty_summary(client):
    """Points balance, volume & tier for the Fidélité page."""
    from .models import LoyaltyLedger

    total_volume = _invoiced_volume(client)
    volume_entries = LoyaltyLedger.objects.filter(
        client=client, reason=LoyaltyLedger.Reason.VOLUME
    )
    total_points = sum((e.points or 0 for e in volume_entries), 0)
    tier = client_loyalty_tier(total_volume)
    return {
        "points_balance": total_points,
        "invoiced_volume_m3": round(float(total_volume), 2),
        "tier": tier,
        "history": list(volume_entries.order_by("-created_at")[:50]),
    }


def credit_upcoming(client, horizons=(30, 60), today=None):
    """Invoices grouped by payment horizon (due within 30 / 60 days).

    Each row carries a computed status used by the UI:
      - "retard"   : due date passed (échue)
      - "urgent"   : due within the shorter horizon
      - "proche"   : due within the longer horizon
      - "reglee"   : invoice fully paid
    """
    today = today or timezone.localdate()
    shipped = SalesOrder.objects.filter(
        client=client, status__in=_SHIPPED_STATUSES
    ).order_by("order_date")
    buckets = []
    for so in shipped:
        due = _so_due_date(so, client)
        balance = so.balance_due
        row = {
            "so_number": so.so_number,
            "order_date": so.order_date.isoformat() if so.order_date else None,
            "due_date": due.isoformat(),
            "total_amount": float(so.total_amount),
            "balance": float(balance),
            "paid": float(so.paid_amount),
            "days_left": (due - today).days,
        }
        if balance <= 0:
            row["status"] = "reglee"
        elif due < today:
            row["status"] = "retard"
        elif (due - today).days <= min(horizons):
            row["status"] = "urgent"
        else:
            row["status"] = "proche"
        buckets.append(row)
    return buckets


def statement_rows(client, from_date=None, to_date=None, today=None):
    """Chronological Debit/Credit account rows for a client date range.

    A Débit is an invoice (facture) the client owes; a Crédit is a payment
    (encaissement) the client has made. Rows carry a cumulative running
    balance so the Relevé de Compte reads like a bank statement.
    """
    today = today or timezone.localdate()
    events = []

    invoices = SalesOrder.objects.filter(
        client=client, status__in=_SHIPPED_STATUSES, order_date__lte=today
    )
    if from_date:
        invoices = invoices.filter(order_date__gte=from_date)
    if to_date:
        invoices = invoices.filter(order_date__lte=to_date)
    for so in invoices.order_by("order_date"):
        events.append({
            "date": so.order_date,
            "sort": 2,
            "kind": "debit",
            "label": "Facture",
            "reference": so.so_number,
            "amount": float(so.total_amount),
        })

    payments = Payment.objects.filter(client=client, payment_date__lte=today)
    if from_date:
        payments = payments.filter(payment_date__gte=from_date)
    if to_date:
        payments = payments.filter(payment_date__lte=to_date)
    for p in payments.order_by("payment_date"):
        events.append({
            "date": p.payment_date,
            "sort": 1,
            "kind": "credit",
            "label": "Encaissement",
            "reference": p.reference or f"PAY-{p.pk}",
            "amount": float(p.amount),
        })

    avoirs = CreditNote.objects.filter(client=client, created_date__lte=today)
    if from_date:
        avoirs = avoirs.filter(created_date__gte=from_date)
    if to_date:
        avoirs = avoirs.filter(created_date__lte=to_date)
    for cn in avoirs.order_by("created_date"):
        events.append({
            "date": cn.created_date,
            "sort": 1,
            "kind": "credit",
            "label": "Avoir",
            "reference": cn.credit_note_number,
            "amount": float(cn.amount),
        })

    events.sort(key=lambda e: (str(e["date"]), e["sort"]))
    balance = Decimal("0")
    rows = []
    for e in events:
        if e["kind"] == "debit":
            balance += Decimal(str(e["amount"]))
        else:
            balance -= Decimal(str(e["amount"]))
        rows.append({
            "date": e["date"].isoformat(),
            "kind": e["kind"],
            "label": e["label"],
            "reference": e["reference"],
            "amount": round(float(e["amount"]), 2),
            "balance": round(float(balance), 2),
        })
    return rows, balance


# ---------------------------------------------------------------------------
# Facturation — règlements, statut de paiement, regroupement, avoirs & exports
# ---------------------------------------------------------------------------
def invoice_payment_status(so, client, today=None):
    """Settlement badge for an invoice (Moroccan wholesale tracking).

    :returns: ``{"key": ..., "label": ...}`` with
      - ``paid``     → Réglée (green)
      - ``awaited``  → En attente d'échéance (blue) — chèques/traites en cours
      - ``partial``  → Partiellement réglée (amber)
      - ``pending``  → Non réglée (amber/neutral, échéance future)
      - ``overdue``  → En retard (red)
    """
    today = today or timezone.localdate()
    total = so.total_amount or ZERO
    balance = so.balance_due
    if invoice_effectively_settled(so):
        for p in so.payments.all():
            if p.due_date and p.due_date > today and (p.amount or ZERO) > 0:
                return {"key": "awaited", "label": "En attente d'échéance"}
        return {"key": "paid", "label": "Réglée"}
    if _so_due_date(so, client) < today:
        return {"key": "overdue", "label": "En retard"}
    if balance < total:
        return {"key": "partial", "label": "Partiellement réglée"}
    return {"key": "pending", "label": "Non réglée"}


def next_invoice_number(prefix="FC"):
    """New consolidated invoice number, e.g. FC20260906143012."""
    return timezone.now().strftime(f"{prefix}%Y%m%d%H%M%S")


@transaction.atomic
def create_grouped_invoice(client, warehouse, bl_ids, order_date=None, notes=None,
                           discount_percent=ZERO, so_number=None):
    """Consolidate un-invoiced delivery notes into a single monthly Facture.

    Selected BLs must belong to the client and be un-invoiced. Stock was already
    decremented when each BL was created (``sale_out`` movement), so no movement
    is re-logged here. Returns the ``SalesOrder`` invoice (HT amounts — the 20 %
    TVA is computed at print time like every other invoice).
    """
    bl_ids = [int(i) for i in bl_ids]
    if not bl_ids:
        raise ValueError("Sélectionnez au moins un bon de livraison à facturer.")

    bls = list(
        DeliveryNote.objects.filter(pk__in=bl_ids, client=client)
        .select_related("warehouse")
        .prefetch_related("items__product")
    )
    if len(bls) != len(set(bl_ids)):
        raise ValueError("Certains bons de livraison sont introuvables pour ce client.")
    already = [
        b.bl_number for b in bls
        if b.invoice_id is not None or b.status == DeliveryNote.Status.INVOICED
    ]
    if already:
        raise ValueError(f"BL déjà facturés : {', '.join(already)}.")

    discount_percent = Decimal(str(discount_percent or ZERO))
    so = SalesOrder.objects.create(
        so_number=so_number or next_invoice_number(),
        client=client,
        warehouse=warehouse,
        status=SalesOrder.Status.SHIPPED,
        notes=notes or f"Facture de regroupement mensuelle ({len(bls)} BL)",
        discount_percent=discount_percent,
        tier_name="Regroupement BL",
    )

    subtotal = ZERO
    for bl in bls:
        for item in bl.items.select_related("product"):
            line_total = item.line_total or ZERO
            subtotal += line_total
            SalesOrderItem.objects.create(
                sales_order=so,
                product=item.product,
                quantity_ordered=item.quantity,
                quantity_shipped=item.quantity,
                unit_price=item.unit_price,
                line_total=line_total,
            )

    discount_amount = (subtotal * discount_percent / Decimal("100")).quantize(Decimal("0.0001"))
    so.subtotal = subtotal
    so.discount_amount = discount_amount
    so.total_amount = (subtotal - discount_amount).quantize(Decimal("0.0001"))
    so.save(update_fields=["subtotal", "discount_amount", "total_amount"])
    if order_date is not None:
        dt = _order_datetime(order_date)
        SalesOrder.objects.filter(pk=so.pk).update(
            order_date=order_date, created_at=dt, updated_at=dt
        )

    for bl in bls:
        bl.invoice = so
        bl.status = DeliveryNote.Status.INVOICED
        bl.save(update_fields=["invoice", "status", "updated_at"])

    award_loyalty_points(client, so)
    return so


def create_credit_note(client, *, sales_order=None, delivery_note=None, reason="return",
                       amount=ZERO, volume_m3=None, notes=None, created_by=None,
                       credit_note_number=None):
    """Emit a Facture d'Avoir (credit note).

    The part applied to the linked invoice is capped at its current balance; the
    remainder acts as an on-account credit that reduces the client's encours.
    """
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError("Le montant de l'avoir doit être strictement positif.")
    if sales_order is not None and sales_order.client_id != client.pk:
        raise ValueError("La facture d'origine doit appartenir au même client.")

    applied = ZERO
    if sales_order is not None:
        applied = min(amount, max(sales_order.balance_due, ZERO))

    cn = CreditNote.objects.create(
        credit_note_number=credit_note_number or timezone.now().strftime("AV%Y%m%d%H%M%S"),
        client=client,
        sales_order=sales_order,
        delivery_note=delivery_note,
        reason=reason,
        volume_m3=volume_m3,
        amount=amount,
        applied_amount=applied,
        notes=notes,
        created_by=created_by,
    )
    if sales_order is not None:
        notify_client(
            client, "invoice", "Facture d'avoir émise",
            f"L'avoir {cn.credit_note_number} a réduit le solde de la facture "
            f"{sales_order.so_number} ({cn.reason_label}).",
            link="/pro/factures",
        )
    return cn


def _client_unapplied_avoirs(client):
    """Total avoir credit not yet reflected in any invoice balance (MAD)."""
    total = ZERO
    for cn in client.credit_notes.all():
        total += (cn.amount or ZERO) - (cn.applied_amount or ZERO)
    return total


def build_whatsapp_reminder_url(client, so, today=None):
    """URL-encoded WhatsApp Web deep link for a payment reminder."""
    today = today or timezone.localdate()
    import urllib.parse
    from .models import CompanyProfile

    comp = CompanyProfile.current()
    total_ht = so.total_amount or ZERO
    ttc = (total_ht * Decimal("1.20")).quantize(Decimal("0.01"))
    due = _so_due_date(so, client)
    balance = max(so.balance_due, ZERO)
    balance_ttc = (balance * Decimal("1.20")).quantize(Decimal("0.01"))

    def _fmt(v):
        return f"{Decimal(str(v)):,.2f} MAD".replace(",", " ")

    msg = (
        f"Bonjour {client.company_name},\n\n"
        f"Nous revenons vers vous au sujet de la facture {so.so_number} "
        f"du {so.order_date:%d/%m/%Y} (échéance {due:%d/%m/%Y}).\n"
        f"Total TTC : {_fmt(ttc)}\n"
        f"Reste à régler : {_fmt(balance_ttc)}\n"
    )
    if comp.bank_rib:
        msg += (
            f"\nModalités de règlement\n"
            f"Banque : {comp.bank_name or '—'}\n"
            f"RIB : {comp.bank_rib}\n"
        )
    msg += "\nMerci de votre confiance — KOUDI WOOD"

    phone = (client.phone or "").strip().replace(" ", "").replace("-", "").replace(".", "")
    if phone.startswith("+212"):
        wa = phone[1:]
    elif phone.startswith("212") and len(phone) > 10:
        wa = phone
    elif phone.startswith("0") and len(phone) >= 10:
        wa = "212" + phone[1:]
    else:
        wa = phone or "212600000000"
    return f"https://wa.me/{wa}?text={urllib.parse.quote(msg)}"


def send_payment_reminder_email(client, so, today=None):
    """E-mail a payment reminder to the client via Django SMTP.

    Returns ``{"sent": bool, "detail": str}`` — never raises: no SMTP
    configured falls back to the console backend without breaking the UI.
    """
    today = today or timezone.localdate()
    from django.conf import settings
    from django.core.mail import send_mail
    from .models import CompanyProfile

    comp = CompanyProfile.current()
    total_ht = so.total_amount or ZERO
    ttc = (total_ht * Decimal("1.20")).quantize(Decimal("0.01"))
    due = _so_due_date(so, client)
    balance = max(so.balance_due, ZERO)
    balance_ttc = (balance * Decimal("1.20")).quantize(Decimal("0.01"))

    def _fmt(v):
        return f"{Decimal(str(v)):,.2f} MAD".replace(",", " ")

    subject = f"Relance paiement — Facture {so.so_number}"
    lines = [
        f"Bonjour {client.contact_name or client.company_name},",
        "",
        f"Nous vous rappelons la facture {so.so_number} du "
        f"{so.order_date:%d/%m/%Y}, échéance le {due:%d/%m/%Y}.",
        "",
        f"Montant TTC : {_fmt(ttc)}",
        f"Reste à régler : {_fmt(balance_ttc)}",
        "",
    ]
    if comp.bank_rib:
        lines += [
            "Modalités de règlement (virement bancaire) :",
            f"  Banque : {comp.bank_name or '—'}",
            f"  RIB : {comp.bank_rib}",
            "",
        ]
    lines += ["Cordialement,", comp.name or "KOUDI WOOD"]

    if not client.email:
        return {"sent": False, "detail": "Ce client n'a pas d'adresse e-mail renseignée."}
    try:
        sent = send_mail(
            subject=subject,
            message="\n".join(lines),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[client.email],
            fail_silently=False,
        )
    except Exception as exc:  # SMTP / settings errors must never crash the page
        return {"sent": False, "detail": f"Échec de l'envoi : {exc}"}
    return {
        "sent": bool(sent),
        "detail": f"E-mail de relance envoyé à {client.email}.",
    }


def export_invoices_csv(client=None, payment_status=None, start=None, end=None, today=None):
    """Comptable export (SAGE/Ciel compatible CSV, ';' separated) of the invoice
    register filtered by date range / payment status.

    Returns ``(content: str, filename: str)``.
    """
    today = today or timezone.localdate()
    qs = (
        SalesOrder.objects.filter(client=client, status__in=_SHIPPED_STATUSES)
        if client is not None
        else SalesOrder.objects.filter(status__in=_SHIPPED_STATUSES)
    )
    qs = qs.select_related("client", "warehouse").prefetch_related(
        "delivery_notes", "payments", "credit_notes"
    )
    if start:
        qs = qs.filter(order_date__gte=start)
    if end:
        qs = qs.filter(order_date__lte=end)

    def _txt(value):
        return str(value).replace(";", ",").replace("\n", " ").replace("\r", " ")

    header = [
        "N° Facture", "Date", "N° BL", "Client", "ICE Client",
        "Total HT", "TVA 20%", "Total TTC", "Réglé", "Reste",
        "Statut paiement", "Échéance",
    ]
    rows = []
    for so in qs.order_by("order_date"):
        ht = so.total_amount or ZERO
        vat = (ht * Decimal("0.20")).quantize(Decimal("0.01"))
        ttc = ht + vat
        paid = so.paid_amount
        status_ = invoice_payment_status(so, so.client, today=today)["label"]
        bls = ", ".join(d.bl_number for d in so.delivery_notes.all())
        rows.append([
            so.so_number, so.order_date.isoformat(), bls,
            so.client.company_name, so.client.tax_id or "",
            _fr_export(ht), _fr_export(vat), _fr_export(ttc),
            _fr_export(paid), _fr_export(so.balance_due),
            status_, _so_due_date(so, so.client).isoformat(),
        ])

    content = "\ufeff" + "sep=;\n"  # Excel-friendly BOM + separator hint
    content += ";".join(header) + "\n"
    for r in rows:
        content += ";".join(_txt(c) for c in r) + "\n"
    filename = f"export_comptable_{today:%Y%m%d}.csv"
    return content, filename


def _fr_export(value):
    """Decimal → French CSV number (comma decimal separator, no grouping)."""
    return f"{Decimal(str(value)):,.2f}".replace(",", " ").replace(" ", "").replace(".", ",")