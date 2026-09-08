"""Django models mapped 1:1 onto the existing Supabase timber tables.

The public schema was created by ``schema.sql``:
  wood_types, warehouses, products, inventory, stock_movements,
  suppliers, clients, purchase_orders, purchase_order_items,
  sales_orders, sales_order_items.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

# Volume (m³) = (Thickness_mm * Width_mm * Length_m * Quantity) / 1_000_000
#   - Thickness & width in millimetres, length in **metres**.
# Surface (m²) for panneaux (plywood) = 1.22 * 2.44 * Quantity (2.9768 m²/plate).
MILLION = Decimal("1000000")
PANEL_WIDTH_M = Decimal("1.22")
PANEL_LENGTH_M = Decimal("2.44")
PANEL_SURFACE_M2 = PANEL_WIDTH_M * PANEL_LENGTH_M


def compute_volume_m3(thickness_mm, width_mm, length_m, quantity=1):
    """Return volume in cubic metres or ``None`` when dimensions are missing.

    ``length`` is expressed in **metres** (spec: /1_000_000 with mm for
    thickness/width). For panel products the caller should instead use
    :func:`compute_surface_m2`.
    """
    dims = (thickness_mm, width_mm, length_m)
    if not all(d is not None and d != "" for d in dims):
        return None
    try:
        t, w, l, q = (Decimal(str(x)) for x in (*dims, quantity))
    except (TypeError, ValueError, ArithmeticError):
        return None
    if q <= 0:
        return Decimal("0")
    return (t * w * l * q) / MILLION


def compute_surface_m2(quantity=1):
    """Surface in square metres of standard plywood panels (1.22 × 2.44 m)."""
    if quantity is None or quantity == "":
        return None
    try:
        q = Decimal(str(quantity))
    except (TypeError, ValueError, ArithmeticError):
        return None
    if q <= 0:
        return Decimal("0")
    return PANEL_SURFACE_M2 * q


# ---------------------------------------------------------------------------
# Reference tables
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Reference tables
# ---------------------------------------------------------------------------
class WoodType(models.Model):
    """Volume: species / essence (Oak, Beech, Ash, Pine, Mahogany, Teak...).

    Enriched for the public "fiche essence" (species data sheet): provenances
    (origins), moisture behaviour and durability class (NF EN 350), usages and
    the Comarbois umbrella family (Menuiserie & Agencement, Panneaux,
    Aménagement Int./Ext., Produits métallurgiques).
    """

    class Category(models.TextChoices):
        HARDWOOD = "Hardwood"
        SOFTWOOD = "Softwood"
        EXOTIC = "Exotic"

    class ComarboisFamily(models.TextChoices):
        MENUISERIE_AGENCEMENT = "Menuiserie & Agencement"
        PANNEAUX = "Panneaux"
        AMENAGEMENT_INT_EXT = "Aménagement Int./Ext."
        METALLURGIQUE = "Produits métallurgiques"

    name = models.TextField(unique=True)
    scientific_name = models.TextField(blank=True, null=True)
    common_names = models.TextField(
        blank=True, null=True,
        help_text="Noms usuels / synonymes (ex: Pin rouge / Sylvestre, Teck d'Afrique pour l'Iroko).",
    )
    category = models.TextField(
        blank=True, null=True, choices=Category.choices, db_index=True
    )
    comarbois_family = models.TextField(
        blank=True, null=True, choices=ComarboisFamily.choices, db_index=True,
        help_text="Famille du catalogue (style Comarbois) : Menuiserie & Agencement, "
                  "Panneaux, Aménagement Int./Ext., Produits métallurgiques.",
    )
    density_kg_m3 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    provenances = models.TextField(
        blank=True, null=True,
        help_text="Provenances / pays d'origine (ex: Scandinavie, Russie, Afrique Centrale, France).",
    )
    durability_class = models.TextField(
        blank=True, null=True,
        help_text="Classe de durabilité naturelle du duramen (NF EN 350) : 1 à 5 (1 = très durable).",
    )
    moisture_note = models.TextField(
        blank=True, null=True,
        help_text="Comportement à l'humidité / séchage (ex: séchage lent, retrait moyen).",
    )
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wood_types"
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def common_names_list(self):
        return [x.strip() for x in (self.common_names or "").split(",") if x.strip()]


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
        CONSTRUCTION = "Bois de Construction"        # madriers, bastaings, chevrons…
        AUTOCLAVE = "Bois Traité Autoclave"          # Cl.3 vert / Cl.4 marron
        FEUILLUS_NOBLES = "Bois Feuillus & Nobles"   # chêne, hêtre, iroko…
        PANNEAUX = "Panneaux & Dérivés"              # plywood, panneaux…

    class PieceType(models.TextChoices):
        MADRIER = "Madrier"
        BASTING = "Basting"
        CHEVRON = "Chevron"
        VOLIGE = "Volige"
        LAME_TERRASSE = "Lame de Terrasse"
        POTEAU_CARRE = "Poteau Carré"
        RONDIN = "Rondin"
        PLYWOOD = "Plywood Filmé"

    class Treatment(models.TextChoices):
        NONE = "Aucun"
        AUTOCLAVE_CL3_VERT = "Autoclave Cl.3 Vert"
        AUTOCLAVE_CL4_MARRON = "Autoclave Cl.4 Marron"
        KILN_DRIED = "Séché KD (Kiln Dried)"

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
    description = models.TextField(
        blank=True, null=True,
        help_text="Paragraphe « description produit » affiché sur la fiche publique.",
    )
    colis_number = models.TextField(
        blank=True, null=True,
        help_text="Référence / numéro du colis ou fardeau (Colis/Fardeau Ref).",
    )
    wood_type = models.ForeignKey(
        WoodType, on_delete=models.PROTECT, null=True, blank=True, db_index=True
    )
    category = models.TextField(blank=True, null=True, choices=Category.choices, db_index=True)
    piece_type = models.TextField(blank=True, null=True, choices=PieceType.choices, db_index=True)
    treatment = models.TextField(blank=True, null=True, choices=Treatment.choices, db_index=True)
    length_m = models.DecimalField(
        max_digits=10, decimal_places=3, null=True, blank=True,
        help_text="Longueur en mètres (formule m³ = T_mm × W_mm × L_m × Qté / 1 000 000).",
    )
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
        help_text="Seuil d'alerte de réapprovisionnement en m³ (min stock): le stock total "
                  "en volume en dessous de ce seuil déclenche l'alerte.",
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
        computed = compute_volume_m3(self.thickness_mm, self.width_mm, self.length_m)
        self.volume_cubic_m = computed if computed is not None else self.volume_cubic_m
        super().save(*args, **kwargs)

    @property
    def is_panel(self):
        return (
            self.category == self.Category.PANNEAUX
            or self.piece_type == self.PieceType.PLYWOOD
        )

    @property
    def surface_m2(self):
        """Panneaux surface (m²) = 1.22 × 2.44 × quantity — per unit or per stock."""
        return compute_surface_m2(1)

    @property
    def dimensions_display(self):
        if all(x is not None for x in (self.length_m, self.width_mm, self.thickness_mm)):
            return f"{self.thickness_mm:g} x {self.width_mm:g} x {self.length_m:g} m"
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
        if self.below_reorder:
            return "low"
        if self.min_stock_qty and self.total_stock_qty < self.min_stock_qty:
            return "low"
        return "in_stock"

    @property
    def stock_volume_m3(self):
        return self.total_stock_volume_m3 if self.total_stock_volume_m3 is not None else Decimal("0")

    @property
    def below_reorder(self):
        """True when an m³ min-stock alert is set and current stock volume is under it."""
        threshold = self.reorder_threshold_m3
        if threshold is None or threshold <= 0:
            return False
        return self.stock_volume_m3 < threshold


# ---------------------------------------------------------------------------
# Master data — reference pricing per m³ (essences & sheet materials)
# ---------------------------------------------------------------------------
class ReferencePrice(models.Model):
    """Reference (list) price per m³ / m² for a wood essence or sheet material.

    This is the "grille de prix" the sales team works from: one row per
    essence (optionally narrowed by piece type, treatment and category). The
    price is stored per unit (per m³ for timber / per plate or m² for panels)
    and can be overridden at the product level via ``Product.sale_price``.

    All rows are active by default; the vector is editable from the admin /
    back-office so price lists per essence can be maintained dynamically.
    """

    class Target(models.TextChoices):
        TIMBER = "timber"          # bois massif — prix au m³
        PANEL = "panel"            # panneaux / dérivés — prix à l'unité ou au m²

    wood_type = models.ForeignKey(
        WoodType, on_delete=models.CASCADE, null=True, blank=True, db_index=True,
        related_name="reference_prices",
        help_text="Essence liée (facultatif : laisser vide pour une matière non-attachée à une essence).",
    )
    category = models.TextField(
        blank=True, null=True, choices=Product.Category.choices, db_index=True,
        help_text="Catégorie produit éligible (facultatif — grille générique si vide).",
    )
    piece_type = models.TextField(
        blank=True, null=True, db_index=True,
        help_text="Type de pièce éligible (Madrier, Basting, Chevron…). Vide = toutes pièces.",
    )
    treatment = models.TextField(
        blank=True, null=True, db_index=True,
        help_text="Classe de traitement éligible (Autoclave, Séché KD…). Vide = tous traitements.",
    )
    target = models.TextField(choices=Target.choices, default=Target.TIMBER, db_index=True)
    unit_price_mad = models.DecimalField(
        max_digits=14, decimal_places=4, default=Decimal("0"),
        help_text="Prix de référence de la grille (MAD).",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reference_prices"
        ordering = ["wood_type__name", "category", "piece_type"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(unit_price_mad__gte=0), name="reference_prices_price_nonneg"
            ),
        ]
        indexes = [
            models.Index(fields=["wood_type", "category", "piece_type", "treatment"]),
        ]

    def __str__(self):
        who = self.wood_type.name if self.wood_type else "Matière"
        scope = (
            f"{self.category or ''} / {self.piece_type or ''} / {self.treatment or ''}"
        ).strip(" /")
        return f"{who} {scope} — {self.unit_price_mad} MAD"


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
            self.product.length_m,
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

    Moroccan wholesale tracking: ``method_key`` is the formalised payment
    instrument (Chèque, Traite 30/60/90j, Virement, Espèces), ``bank_name`` the
    collecting bank (Attijariwafa, BCP, BOA, BMCI, CDM…) and ``due_date`` the
    expected encaissement date (échéance) for chèques / traites.
    """

    class Method(models.TextChoices):
        CHEQUE = "cheque", "Chèque"
        TRAITE_30 = "traite_30", "Traite bancaire 30 jours"
        TRAITE_60 = "traite_60", "Traite bancaire 60 jours"
        TRAITE_90 = "traite_90", "Traite bancaire 90 jours"
        VIREMENT = "virement", "Virement bancaire"
        ESPECES = "especes", "Espèces"
        AUTRE = "autre", "Autre moyen"

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
    method = models.TextField(blank=True, null=True)  # legacy / free-text label
    method_key = models.TextField(
        choices=Method.choices, default=Method.AUTRE, db_index=True
    )
    bank_name = models.TextField(blank=True, null=True)
    reference = models.TextField(blank=True, null=True)
    due_date = models.DateField(null=True, blank=True, db_index=True)
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

    @property
    def method_label(self):
        """French label: formalised instrument, falling back to the legacy text."""
        if self.method_key and self.method_key != self.Method.AUTRE:
            return dict(self.Method.choices).get(self.method_key)
        return (self.method or "").strip() or dict(self.Method.choices)[self.Method.AUTRE]

    def __str__(self):
        return f"PAY-{self.pk} {self.client.code} {self.amount} MAD"


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
    def applied_avoir(self):
        """Credit notes (Factures d'Avoir) already deducted from this invoice."""
        total = Decimal("0")
        for cn in self.credit_notes.all():
            total += cn.applied_amount or Decimal("0")
        return total

    @property
    def balance_due(self):
        return self.total_amount - self.paid_amount - self.applied_avoir


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
        WAITING = "waiting"           # En attente
        VALIDATED = "validated"       # Validé & Chargé
        INVOICED = "invoiced"         # Facturé
        CANCELLED = "cancelled"       # Annulé

    bl_number = models.TextField(unique=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, db_index=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, db_index=True)
    driver_name = models.TextField(blank=True, null=True)
    truck_plate = models.TextField(blank=True, null=True)
    status = models.TextField(
        default=Status.PREPARATION, choices=Status.choices, db_index=True
    )
    invoice = models.ForeignKey(
        "SalesOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_index=True,
        related_name="delivery_notes",
        help_text="Facture de regroupement (Facturation groupée) à laquelle ce BL est rattaché.",
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
            self.product.length_m,
            self.quantity,
        )


# ---------------------------------------------------------------------------
# Facturation — Facture d'Avoir (credit notes)
# ---------------------------------------------------------------------------
class CreditNote(models.Model):
    """A credit note (Facture d'Avoir) reducing what a client owes.

    Emitted when a wood batch is returned or the invoiced volume (m³) is
    corrected. ``applied_amount`` is the part deducted from the linked invoice
    balance (capped at its current balance); any remainder offsets the client's
    global encours. Creating an Avoir therefore updates the client's receivable
    position automatically (``SalesOrder.balance_due`` and
    ``services.client_credit_summary`` both account for it).
    """

    class Reason(models.TextChoices):
        RETURN = "return", "Retour de marchandise"
        VOLUME_CORRECTION = "volume_correction", "Correction de volume (m³)"
        COMMERCIAL = "commercial", "Avoir commercial"

    credit_note_number = models.TextField(unique=True)
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT, related_name="credit_notes", db_index=True
    )
    sales_order = models.ForeignKey(
        "SalesOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_notes",
        db_index=True,
        help_text="Facture d'origine à laquelle l'avoir se rattache.",
    )
    delivery_note = models.ForeignKey(
        DeliveryNote,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_notes",
        db_index=True,
    )
    reason = models.TextField(
        choices=Reason.choices, default=Reason.RETURN, db_index=True
    )
    volume_m3 = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True,
        help_text="Volume corrigé / retourné (m³) le cas échéant.",
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)  # Montant HT
    applied_amount = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"),
        help_text="Part de l'avoir déduite du solde de la facture d'origine.",
    )
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_date = models.DateField(auto_now_add=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "credit_notes"
        ordering = ["-created_date", "-id"]

    @property
    def amount_ttc(self):
        return (Decimal(str(self.amount)) * Decimal("1.20")).quantize(Decimal("0.01"))

    @property
    def reason_label(self):
        return dict(self.Reason.choices).get(self.reason)

    def __str__(self):
        return self.credit_note_number


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


# ---------------------------------------------------------------------------
# Espace Pro — Client portal models
# ---------------------------------------------------------------------------
class ClientUser(models.Model):
    """Links a Django auth User to a Client for the professional portal.

    Each client company can have one or more login accounts. ``is_primary``
    marks the account holder (the one who manages the company's portal access).
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="client_profile",
        db_index=True,
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name="users",
        db_index=True,
    )
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "client_users"
        constraints = [
            models.UniqueConstraint(fields=["user"], name="client_users_user_key"),
        ]

    def __str__(self):
        return f"{self.user.username} → {self.client.code}"


class Quote(models.Model):
    """A quote / devis created by a client through the Espace Pro portal.

    Status lifecycle: draft → sent → accepted | rejected | expired.
    """

    class Status(models.TextChoices):
        DRAFT = "draft"
        SENT = "sent"
        ACCEPTED = "accepted"
        REJECTED = "rejected"
        EXPIRED = "expired"

    quote_number = models.TextField(unique=True)
    client = models.ForeignKey(
        Client, on_delete=models.CASCADE, db_index=True, related_name="quotes"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        db_index=True,
    )
    status = models.TextField(
        default=Status.DRAFT, choices=Status.choices, db_index=True
    )
    subtotal = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    currency = models.TextField(default="MAD")
    notes = models.TextField(blank=True, null=True)
    valid_until = models.DateField(null=True, blank=True)
    delivery_address = models.TextField(
        blank=True, null=True,
        help_text="Destination de livraison souhaitée (chantier, dépôt client…).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "quotes"
        ordering = ["-created_at"]

    def __str__(self):
        return self.quote_number


class QuoteItem(models.Model):
    """One line of a quote / devis."""

    quote = models.ForeignKey(
        Quote, on_delete=models.CASCADE, related_name="items", db_index=True
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, db_index=True
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    unit_price = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "quote_items"

    def __str__(self):
        return f"{self.quote} - {self.product}"


class ClientNotification(models.Model):
    """Notifications for client portal users (quote status, delivery updates, etc.)."""

    class Kind(models.TextChoices):
        QUOTE_UPDATE = "quote_update"
        ORDER_UPDATE = "order_update"
        DELIVERY_UPDATE = "delivery_update"
        PAYMENT_RECEIVED = "payment_received"
        CREDIT_ALERT = "credit_alert"
        GENERAL = "general"

    client = models.ForeignKey(
        Client, on_delete=models.CASCADE, db_index=True, related_name="notifications"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True, blank=True,
        db_index=True,
    )
    kind = models.TextField(choices=Kind.choices, default=Kind.GENERAL, db_index=True)
    title = models.TextField()
    message = models.TextField(blank=True, null=True)
    is_read = models.BooleanField(default=False, db_index=True)
    link = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "client_notifications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.kind}] {self.title}"


# ---------------------------------------------------------------------------
# Espace Pro — B2B pricing, loyalty & credit-request extensions
# ---------------------------------------------------------------------------
class ClientPriceDiscount(models.Model):
    """Client-specific B2B discount rate applied on top of the list price.

    scoped by product category (e.g. « -10% sur le Pin » → category
    ``Bois de Construction``) or by a single wood species. ``scope="all"``
    covers every product of the client. The most specific rule wins
    (species > category > all) and the resulting price is what the client
    sees in the Catalogue & Tarifs page and in the online timber calculator.
    """

    class Scope(models.TextChoices):
        ALL = "all"
        CATEGORY = "category"
        WOOD_TYPE = "wood_type"

    client = models.ForeignKey(
        Client, on_delete=models.CASCADE, db_index=True, related_name="price_discounts"
    )
    label = models.TextField(
        help_text="Libellé affiché au client (ex. « Atelier Premium : −10 % sur le Pin »).",
    )
    scope = models.TextField(choices=Scope.choices, default=Scope.ALL, db_index=True)
    category = models.TextField(blank=True, null=True, choices=Product.Category.choices)
    wood_type = models.ForeignKey(
        WoodType, on_delete=models.CASCADE, null=True, blank=True, db_index=True
    )
    discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0"),
        help_text="Remise en % appliquée sur le prix de vente catalogue (HT par m³).",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "client_price_discounts"
        ordering = ["-discount_percent"]

    def __str__(self):
        return f"{self.client.code} — {self.label} (−{self.discount_percent}%)"


class LoyaltyLedger(models.Model):
    """Points Pro earned by a professional client on shipped (invoiced) volume.

    Rule: **1 m³ acheté = 50 Points Pro** (rounding down). The ledger keeps
    one entry per sale order so the Fidélité page can show a real points
    history. Tiers (Argent / Or / Platine) are derived from the cumulative
    invoiced volume; perks (livraison offerte, ristourne annuelle) depend on
    the tier.
    """

    class Reason(models.TextChoices):
        VOLUME = "volume"          # points earned on a shipped sales order
        ADJUSTMENT = "adjustment"  # manual credit/debit by the back-office

    client = models.ForeignKey(
        Client, on_delete=models.CASCADE, db_index=True, related_name="loyalty_ledger"
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        db_index=True,
        related_name="loyalty_entries",
    )
    reason = models.TextField(choices=Reason.choices, default=Reason.VOLUME, db_index=True)
    points = models.IntegerField(default=0)
    volume_m3 = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0"))
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "loyalty_ledger"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.client.code} {self.points:+d} pts ({self.reason})"


class CreditLimitRequest(models.Model):
    """A client's request to raise their authorised credit ceiling.

    The portal blocks order placement once the client is ``is_blocked`` or
    when the projected encours would exceed the plafond; the client then asks
    for an increase and the back-office approves / rejects it.
    """

    class Status(models.TextChoices):
        PENDING = "pending"
        APPROVED = "approved"
        REJECTED = "rejected"

    client = models.ForeignKey(
        Client, on_delete=models.CASCADE, db_index=True, related_name="credit_requests"
    )
    requested_limit = models.DecimalField(max_digits=14, decimal_places=2)
    reason = models.TextField(blank=True, null=True)
    status = models.TextField(choices=Status.choices, default=Status.PENDING, db_index=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        db_index=True,
    )
    decision_note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "credit_limit_requests"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.client.code} → {self.requested_limit} MAD ({self.status})"