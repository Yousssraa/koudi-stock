"""Django models mapped 1:1 onto the existing Supabase timber tables.

The public schema was created by ``schema.sql``:
  wood_types, warehouses, products, inventory, stock_movements,
  suppliers, clients, purchase_orders, purchase_order_items,
  sales_orders, sales_order_items.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

# Volume (m3) = (Thickness_mm * Width_mm * Length_mm * Quantity) / 1_000_000_000
BILLION = Decimal("1000000000")


def compute_volume_m3(thickness_mm, width_mm, length_mm, quantity=1):
    """Return volume in cubic metres or ``None`` when dimensions are missing."""
    dims = (thickness_mm, width_mm, length_mm)
    if not all(d is not None and d != "" for d in dims):
        return None
    try:
        t, w, l, q = (Decimal(str(x)) for x in (*dims, quantity))
    except (TypeError, ValueError, ArithmeticError):
        return None
    if q <= 0:
        return Decimal("0")
    return (t * w * l * q) / BILLION


# ---------------------------------------------------------------------------
# Reference tables
# ---------------------------------------------------------------------------
class WoodType(models.Model):
    """Volume: species / essence (Oak, Beech, Ash, Pine, Mahogany, Teak...)."""

    class Category(models.TextChoices):
        HARDWOOD = "Hardwood"
        SOFTWOOD = "Softwood"
        EXOTIC = "Exotic"

    name = models.TextField(unique=True)
    scientific_name = models.TextField(blank=True, null=True)
    category = models.TextField(
        blank=True, null=True, choices=Category.choices, db_index=True
    )
    density_kg_m3 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wood_types"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Warehouse(models.Model):
    """Volume: stock location / dépôt."""

    code = models.TextField(unique=True)
    name = models.TextField()
    address = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "warehouses"
        ordering = ["name"]

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# Products (dimensional timber)
# ---------------------------------------------------------------------------
class Product(models.Model):
    class Category(models.TextChoices):
        REDWOOD = "Bois rouge"        # bois rouges (pin des pays nordiques)
        WHITEWOOD = "Bois blanc"      # bois blancs (épicéa)
        EXOTIC = "Bois exotique"      # sapelli, kossipo, dabema, dibétou, iroko…
        NOBLE = "Bois noble"          # chêne, noyer…
        PANEL = "Panneaux"            # MDF, OSB, latté, CP, stratifié…
        FORMWORK = "Coffrage"         # panneaux de coffrage, bakélisé, poutrelle H20

    class Grade(models.TextChoices):
        FAS = "FAS"                    # Firsts & Seconds
        CABINET = "Cabinet grade"
        SELECT = "Select"
        STANDARD = "Standard"
        CONSTRUCTION = "Construction"

    class Finish(models.TextChoices):
        ROUGH_SAWN = "rough-sawn"
        PLANED = "planed"
        POUTRE = "poutre"
        KILN_DRIED = "kiln-dried"
        SANDED = "sanded"

    class UOM(models.TextChoices):
        CBM = "cbm"
        PIECE = "piece"
        M2 = "m2"
        LINEAR_M = "linear_m"
        TON = "ton"

    sku = models.TextField(unique=True)
    name = models.TextField()
    wood_type = models.ForeignKey(
        WoodType, on_delete=models.PROTECT, null=True, blank=True, db_index=True
    )
    category = models.TextField(blank=True, null=True, choices=Category.choices, db_index=True)
    length_mm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    width_mm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    thickness_mm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    grade = models.TextField(blank=True, null=True, choices=Grade.choices, db_index=True)
    finish = models.TextField(blank=True, null=True, choices=Finish.choices)
    moisture_content = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True, db_index=True
    )
    volume_cubic_m = models.DecimalField(
        max_digits=14, decimal_places=6, null=True, blank=True
    )
    uom = models.TextField(default="cbm", choices=UOM.choices)
    cost_price = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    sale_price = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    currency = models.TextField(default="MAD")
    min_stock_qty = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    reorder_threshold_m3 = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True, db_index=True,
        help_text="Seuil d'alerte de réapprovisionnement en m³. Stock en dessous → alerte.",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "products"
        ordering = ["name"]
        indexes = [models.Index(fields=["wood_type", "is_active"])]

    def __str__(self):
        return f"{self.name} ({self.sku})"

    def save(self, *args, **kwargs):
        # Automatically compute the per-unit volume whenever dimensions change.
        computed = compute_volume_m3(self.thickness_mm, self.width_mm, self.length_mm)
        self.volume_cubic_m = computed if computed is not None else self.volume_cubic_m
        super().save(*args, **kwargs)

    @property
    def dimensions_display(self):
        if all(x is not None for x in (self.length_mm, self.width_mm, self.thickness_mm)):
            return f"{self.thickness_mm:g} x {self.width_mm:g} x {self.length_mm:g} mm"
        return "—"

    @property
    def total_stock_qty(self):
        # Uses the prefetched inventory cache when available (list views),
        # otherwise queries per product.
        return sum((i.quantity for i in self.inventory_set.all()), Decimal("0"))

    @property
    def total_stock_volume_m3(self):
        if self.volume_cubic_m is None:
            return None
        return self.volume_cubic_m * self.total_stock_qty

    @property
    def stock_status(self):
        if self.total_stock_qty <= 0:
            return "out_of_stock"
        if self.min_stock_qty and self.total_stock_qty < self.min_stock_qty:
            return "low"
        return "in_stock"

    @property
    def stock_volume_m3(self):
        return self.total_stock_volume_m3 if self.total_stock_volume_m3 is not None else Decimal("0")

    @property
    def below_reorder(self):
        """True when a reorder threshold (m³) is set and current stock volume is under it."""
        threshold = self.reorder_threshold_m3
        if threshold is None or threshold <= 0:
            return False
        return self.stock_volume_m3 < threshold


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------
class Inventory(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_index=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, db_index=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    reserved_qty = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    avg_cost = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inventory"
        constraints = [
            models.UniqueConstraint(fields=["product", "warehouse"], name="inventory_product_warehouse_key"),
            models.CheckConstraint(
                check=models.Q(quantity__gte=0), name="inventory_quantity_check"
            ),
            models.CheckConstraint(
                check=models.Q(reserved_qty__gte=0), name="inventory_reserved_check"
            ),
        ]

    def __str__(self):
        return f"{self.product} @ {self.warehouse}: {self.quantity}"


# ---------------------------------------------------------------------------
# Stock movements (ledger)
# ---------------------------------------------------------------------------
class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        PURCHASE_IN = "purchase_in"
        PURCHASE_RETURN = "purchase_return"
        SALE_OUT = "sale_out"
        SALE_RETURN = "sale_return"
        ADJUSTMENT = "adjustment"
        TRANSFER_IN = "transfer_in"
        TRANSFER_OUT = "transfer_out"
        OPENING = "opening"

    movement_no = models.TextField(unique=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_index=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, db_index=True)
    movement_type = models.TextField(choices=MovementType.choices, db_index=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=4)  # signed
    unit_price = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    lot_number = models.TextField(blank=True, null=True, db_index=True)
    reference_type = models.TextField(blank=True, null=True)
    reference_id = models.BigIntegerField(null=True, blank=True)
    note = models.TextField(blank=True, null=True)
    moved_at = models.DateTimeField(default=models.functions.Now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "stock_movements"
        ordering = ["-moved_at"]

    def __str__(self):
        return f"{self.movement_no} {self.movement_type} {self.quantity}"

    @property
    def volume_m3(self):
        return compute_volume_m3(
            self.product.thickness_mm,
            self.product.width_mm,
            self.product.length_mm,
            abs(self.quantity),
        )


# ---------------------------------------------------------------------------
# Suppliers / Clients
# ---------------------------------------------------------------------------
class Supplier(models.Model):
    code = models.TextField(unique=True)
    company_name = models.TextField()
    contact_name = models.TextField(blank=True, null=True)
    email = models.TextField(blank=True, null=True)
    phone = models.TextField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    tax_id = models.TextField(blank=True, null=True)
    payment_terms = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "suppliers"
        ordering = ["company_name"]

    def __str__(self):
        return self.company_name


class Client(models.Model):
    code = models.TextField(unique=True)
    company_name = models.TextField()
    contact_name = models.TextField(blank=True, null=True)
    email = models.TextField(blank=True, null=True)
    phone = models.TextField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    tax_id = models.TextField(blank=True, null=True)
    payment_terms = models.TextField(blank=True, null=True)
    payment_terms_days = models.IntegerField(
        null=True, blank=True,
        help_text="Délai de paiement en jours (calcul des impayés / retards).",
    )
    credit_limit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    is_blocked = models.BooleanField(
        default=False,
        help_text="Client bloqué : les ventes sont refusées tant qu'il est bloqué.",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "clients"
        ordering = ["company_name"]

    @property
    def payment_terms_days_effective(self):
        """Effective payment term in days (falls back to 30)."""
        v = self.payment_terms_days
        return v if v and v > 0 else 30


class Payment(models.Model):
    """Payment ledger: receipts against client invoices.

    ``sales_order`` is optional (deposit / acompte on a client account). The
    outstanding balance of a client is the sum of its shipped/delivered sales
    orders minus the payments recorded here.
    """

    client = models.ForeignKey(Client, on_delete=models.CASCADE, db_index=True)
    sales_order = models.ForeignKey(
        "SalesOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_index=True,
        related_name="payments",
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    payment_date = models.DateField(db_index=True)
    method = models.TextField(blank=True, null=True)  # virement / chèque / espèces…
    reference = models.TextField(blank=True, null=True)
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payments"
        ordering = ["-payment_date", "-id"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(amount__gt=0), name="payment_amount_positive"
            ),
        ]

    def __str__(self):
        return f"PAY-{self.pk} {self.client.code} {self.amount} MAD"

    def __str__(self):
        return self.company_name


# ---------------------------------------------------------------------------
# Purchases
# ---------------------------------------------------------------------------
class PurchaseOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft"
        ORDERED = "ordered"
        PARTIALLY_RECEIVED = "partially_received"
        RECEIVED = "received"
        CANCELLED = "cancelled"

    po_number = models.TextField(unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, db_index=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, db_index=True)
    order_date = models.DateField(auto_now_add=True)
    expected_date = models.DateField(null=True, blank=True)
    status = models.TextField(default=Status.DRAFT, choices=Status.choices, db_index=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    # Import / logistics fees (MAD) — allocated to lines by volume to compute
    # the true "landed cost" per m³ (cost price + friction, per cubic metre).
    freight_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    customs_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    handling_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    currency = models.TextField(default="MAD")
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "purchase_orders"
        ordering = ["-order_date"]

    @property
    def total_fees(self):
        return self.freight_cost + self.customs_cost + self.handling_cost

    @property
    def landed_total(self):
        """Subtotal + logistics fees = true cost of the received goods."""
        return self.subtotal + self.total_fees

    def __str__(self):
        return self.po_number


class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.CASCADE, related_name="items", db_index=True
    )
    product = models.ForeignKey(Product, on_delete=models.PROTECT, db_index=True)
    quantity_ordered = models.DecimalField(max_digits=14, decimal_places=4)
    quantity_received = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    unit_price = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    allocated_fees = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"),
        help_text="Part des frais hors sous-total allouée à cette ligne (au m³).",
    )

    class Meta:
        db_table = "purchase_order_items"

    def __str__(self):
        return f"{self.purchase_order} - {self.product}"


# ---------------------------------------------------------------------------
# Sales
# ---------------------------------------------------------------------------
class SalesOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft"
        CONFIRMED = "confirmed"
        PARTIALLY_SHIPPED = "partially_shipped"
        SHIPPED = "shipped"
        DELIVERED = "delivered"
        CANCELLED = "cancelled"

    so_number = models.TextField(unique=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, db_index=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, db_index=True)
    order_date = models.DateField(auto_now_add=True)
    delivery_date = models.DateField(null=True, blank=True)
    status = models.TextField(default=Status.DRAFT, choices=Status.choices, db_index=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    # Volume-based tier discount applied at the order header level.
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    discount_amount = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    tier_name = models.TextField(blank=True, null=True)
    currency = models.TextField(default="MAD")
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sales_orders"
        ordering = ["-order_date"]

    def __str__(self):
        return self.so_number

    @property
    def paid_amount(self):
        total = Decimal("0")
        for p in self.payments.all():
            total += p.amount
        return total

    @property
    def balance_due(self):
        return self.total_amount - self.paid_amount


class SalesOrderItem(models.Model):
    sales_order = models.ForeignKey(
        SalesOrder, on_delete=models.CASCADE, related_name="items", db_index=True
    )
    product = models.ForeignKey(Product, on_delete=models.PROTECT, db_index=True)
    quantity_ordered = models.DecimalField(max_digits=14, decimal_places=4)
    quantity_shipped = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    unit_price = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))

    class Meta:
        db_table = "sales_order_items"

    def __str__(self):
        return f"{self.sales_order} - {self.product}"


# ---------------------------------------------------------------------------
# Monthly archive (snapshots of stock at end of month)
# ---------------------------------------------------------------------------
class MonthlyArchive(models.Model):
    """One row per product per warehouse per month.

    Stores the closing stock balance and monthly aggregates so that historical
    months can be browsed without replaying the full movement ledger.
    """

    year = models.IntegerField(db_index=True)
    month = models.IntegerField(db_index=True)  # 1-12

    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_index=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, db_index=True)

    # Closing balance at end of month
    closing_qty = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    closing_value = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    # Movement aggregates for the month
    purchase_qty = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    purchase_value = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    sale_qty = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    sale_value = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    transfer_in_qty = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    transfer_out_qty = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    adjustment_qty = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    opening_qty = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "monthly_archive"
        constraints = [
            models.UniqueConstraint(
                fields=["year", "month", "product", "warehouse"],
                name="archive_product_warehouse_month_key",
            ),
        ]
        ordering = ["-year", "-month", "product__sku"]

    def __str__(self):
        return f"{self.year}-{self.month:02d} {self.product.sku} @ {self.warehouse.code}: {self.closing_qty}"


# ---------------------------------------------------------------------------
# Audit trail (user activity log)
# ---------------------------------------------------------------------------
class AuditLog(models.Model):
    """Immutable log of every significant user action on the business data.

    Stock entries, orders, transfers, price updates, login/logout and PDF
    document downloads are recorded here, linked to the requesting user
    (``None`` = system action, e.g. seeding). Admin users can browse it via
    ``GET /api/audit/``.
    """

    class Action(models.TextChoices):
        CREATE = "create"
        UPDATE = "update"
        DELETE = "delete"
        PRICE_UPDATE = "price_update"
        LOGIN = "login"
        LOGOUT = "logout"
        DOWNLOAD = "download"
        REORDER = "reorder"
        TRANSFER = "transfer"
        CLOSE_MONTH = "close_month"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_index=True,
    )
    action = models.TextField(choices=Action.choices, db_index=True)
    entity_type = models.TextField(db_index=True)
    entity_id = models.BigIntegerField(null=True, blank=True)
    entity_ref = models.TextField(blank=True, null=True)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.user} {self.action} {self.entity_type}"


# ---------------------------------------------------------------------------
# Kiln drying (Séchoir units + batch lifecycle)
# A batch runs in_progress → completed | cancelled. Completing a batch marks
# the product as kiln-dried, stores its moisture, and raises the unit price by
# the drying energy cost per m³. The moisture *stage* (green / air_dried / kd)
# is derived from current moisture for the UI progress bar.
# ---------------------------------------------------------------------------
class Kiln(models.Model):
    """A kiln / séchoir unit (capacity in m³) housed in a warehouse."""

    code = models.TextField(unique=True)
    name = models.TextField()
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, db_index=True)
    max_capacity_m3 = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"),
        help_text="Capacité maximale du séchoir en m³.",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "kilns"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.name}"

    @property
    def active_batches(self):
        return self.batches.filter(status=DryingBatch.Status.IN_PROGRESS)

    @property
    def occupied_m3(self):
        """Total volume (m³) currently drying on this kiln."""
        total = Decimal("0")
        for b in self.active_batches:
            total += b.initial_volume_m3
        return total

    @property
    def available_m3(self):
        return max((self.max_capacity_m3 or Decimal("0")) - self.occupied_m3, Decimal("0"))


class DryingBatch(models.Model):
    """A charge of timber put through a specific kiln / séchoir unit."""

    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress"      # En cours
        COMPLETED = "completed"          # Terminé
        CANCELLED = "cancelled"          # Annulé

    batch_no = models.TextField(unique=True)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, db_index=True)
    kiln = models.ForeignKey(
        Kiln, on_delete=models.SET_NULL, null=True, blank=True,
        db_index=True, related_name="batches",
    )
    # Location is kept as a snapshot (the kiln's warehouse at creation) so the
    # warehouse ledger / filters keep working even if the kiln moves later.
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, db_index=True)
    status = models.TextField(default=Status.IN_PROGRESS, choices=Status.choices, db_index=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    initial_volume_m3 = models.DecimalField(
        max_digits=14, decimal_places=4, default=Decimal("0"),
        help_text="Volume de bois chargé (m³), figé à la création.",
    )
    start_moisture = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    target_moisture = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    current_moisture = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    energy_cost = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"),
        help_text="Coût énergétique / exploitation du cycle (MAD).",
    )
    estimated_end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "drying_batches"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.batch_no} {self.product.sku} [{self.status}]"

    @property
    def energy_cost_per_m3(self):
        """Energy cost spread over the batch volume (MAD / m³)."""
        vol = self.initial_volume_m3 or Decimal("0")
        if vol <= 0:
            return Decimal("0")
        return (self.energy_cost / vol).quantize(Decimal("0.01"))

    @property
    def stage(self):
        """Moisture stage derived from the current moisture (UI badge)."""
        mc = self.current_moisture
        if mc is None:
            return "green"
        if mc <= Decimal("12"):
            return "kd"
        if mc <= Decimal("18"):
            return "air_dried"
        return "green"

    @property
    def progress_pct(self):
        """Moisture-reduction progress 0..100 (start → current → target)."""
        start = self.start_moisture
        target = self.target_moisture
        current = self.current_moisture
        if start is None or target is None:
            return None
        if start == target:
            return 100
        if current is None:
            return 0
        pct = (start - current) / (start - target) * Decimal("100")
        return max(Decimal("0"), min(Decimal("100"), pct)).quantize(Decimal("0"))


# ---------------------------------------------------------------------------
# Volume-based tier pricing (discount by total order volume in m³)
# ---------------------------------------------------------------------------
class PriceTier(models.Model):
    """Discount bracket applied to the whole order volume (m³).

    A sale whose total volume falls in ``[min_volume_m3, max_volume_m3)`` gets
    ``discount_percent`` off every line. ``min_volume_m3`` is the sort key and
    the highest matching bracket wins.
    """

    name = models.TextField()
    min_volume_m3 = models.DecimalField(max_digits=14, decimal_places=4, db_index=True)
    max_volume_m3 = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "price_tiers"
        ordering = ["min_volume_m3"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(discount_percent__gte=0, discount_percent__lte=90),
                name="price_tiers_discount_range",
            ),
        ]

    def __str__(self):
        return f"{self.name} (≥{self.min_volume_m3} m³, -{self.discount_percent}%)"

    def matches(self, volume_m3):
        if volume_m3 < self.min_volume_m3:
            return False
        if self.max_volume_m3 is not None and volume_m3 >= self.max_volume_m3:
            return False
        return True


# ---------------------------------------------------------------------------
# Company identity — printed on invoices / quotations, edited in the admin
# ---------------------------------------------------------------------------
class CompanyProfile(models.Model):
    """Singleton holding the real company identity (KOUDI) used by PDF docs."""

    name = models.TextField(default="KOUDI STOCK")
    tagline = models.TextField(default="Vente & Gestion de Stock du Bois")
    address = models.TextField(blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    email = models.CharField(max_length=120, blank=True, default="")
    ice = models.CharField("ICE", max_length=60, blank=True, default="")
    registre_commerce = models.CharField("Registre de commerce", max_length=80, blank=True, default="")
    identifiant_fiscal = models.CharField("Identifiant fiscal", max_length=60, blank=True, default="")
    patente = models.CharField("Patente", max_length=60, blank=True, default="")
    cnss = models.CharField("CNSS", max_length=60, blank=True, default="")
    bank_name = models.CharField("Banque", max_length=120, blank=True, default="")
    bank_rib = models.CharField("RIB / IBAN", max_length=60, blank=True, default="")

    class Meta:
        db_table = "company_profile"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def current(cls):
        profile, _ = cls.objects.get_or_create(pk=1)
        return profile


# ---------------------------------------------------------------------------
# Transport & Logistique — Bon de Livraison (Delivery Note)
# ---------------------------------------------------------------------------
class DeliveryNote(models.Model):
    """A delivery note (Bon de Livraison) tracking a shipment to a client.

    A shipment deducts stock by logging one ``sale_out`` ledger row per line
    (the ``maintain_inventory`` trigger decrements the warehouse inventory).
    The same ledger rows feed the transport/archive audit trail, so a BL is
    always traceable back to a dated, signed mechanical movement.
    """

    class Status(models.TextChoices):
        PREPARATION = "preparation"   # En préparation
        IN_TRANSIT = "in_transit"     # En cours
        DELIVERED = "delivered"       # Livré

    bl_number = models.TextField(unique=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, db_index=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, db_index=True)
    driver_name = models.TextField(blank=True, null=True)
    truck_plate = models.TextField(blank=True, null=True)
    status = models.TextField(
        default=Status.PREPARATION, choices=Status.choices, db_index=True
    )
    order_date = models.DateField(auto_now_add=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "delivery_notes"
        ordering = ["-order_date", "-id"]

    def __str__(self):
        return self.bl_number

    @property
    def total_volume_m3(self):
        total = Decimal("0")
        for item in self.items.all():
            v = item.volume_m3
            if v is not None:
                total += v
        return total

    @property
    def total_amount(self):
        total = Decimal("0")
        for item in self.items.all():
            total += item.line_total
        return total


class DeliveryNoteItem(models.Model):
    """One line of a Bon de Livraison: a product, its shipped quantity and the
    line value (volume m³ × unit price per m³)."""

    delivery_note = models.ForeignKey(
        DeliveryNote, on_delete=models.CASCADE, related_name="items", db_index=True
    )
    product = models.ForeignKey(Product, on_delete=models.PROTECT, db_index=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    unit_price = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))

    class Meta:
        db_table = "delivery_note_items"

    def __str__(self):
        return f"{self.delivery_note} - {self.product}"

    @property
    def volume_m3(self):
        return compute_volume_m3(
            self.product.thickness_mm,
            self.product.width_mm,
            self.product.length_mm,
            self.quantity,
        )


# ---------------------------------------------------------------------------
# Public vitrine — Devis / Contact lead captures
# ---------------------------------------------------------------------------
class Lead(models.Model):
    """A request submitted through the public website (quote or contact).

    Quote requests (``type="devis"``) are the natural entry point for new
    business: the visitor fills their details plus the products/quantities they
    are interested in. Contact messages (``type="contact"``) are general
    enquiries. Both are stored so the team can follow up from the app.
    """

    class Kind(models.TextChoices):
        DEVIS = "devis"        # Demande de devis
        CONTACT = "contact"    # Message de contact

    kind = models.TextField(choices=Kind.choices, default=Kind.DEVIS, db_index=True)
    name = models.TextField()
    company = models.TextField(blank=True, null=True)
    email = models.TextField()
    phone = models.TextField(blank=True, null=True)
    city = models.TextField(blank=True, null=True)
    subject = models.TextField(blank=True, null=True)
    message = models.TextField(blank=True, null=True)
    # Free-form "product | quantity" lines from the devis form (JSON).
    requested_lines = models.JSONField(default=list, blank=True)
    status = models.TextField(default="new", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "leads"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.kind} — {self.name} ({self.email})"