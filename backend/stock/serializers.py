"""DRF serializers for the timber API."""
from decimal import Decimal

from rest_framework import serializers

from . import services
from .models import (
    AuditLog,
    Client,
    CompanyProfile,
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
    Warehouse,
    WoodType,
    compute_volume_m3,
)


class WoodTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = WoodType
        fields = [
            "id", "name", "scientific_name", "category", "density_kg_m3",
            "description", "is_active",
        ]


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ["id", "code", "name", "address", "is_active"]


class ProductWriteSerializer(serializers.ModelSerializer):
    """Used for create/update; volume is computed automatically on save."""

    class Meta:
        model = Product
        fields = [
            "id", "sku", "name", "wood_type", "category", "length_mm", "width_mm",
            "thickness_mm", "grade", "finish", "moisture_content", "volume_cubic_m",
            "uom", "cost_price", "sale_price", "currency", "min_stock_qty",
            "reorder_threshold_m3", "is_active",
        ]
        read_only_fields = ["volume_cubic_m"]

    def validate(self, attrs):
        computed = compute_volume_m3(
            attrs.get("thickness_mm"),
            attrs.get("width_mm"),
            attrs.get("length_mm"),
        )
        if computed is None and self.instance is None:
            raise serializers.ValidationError(
                {"dimensions": "Thickness, width and length (mm) are required to compute the volume."}
            )
        return attrs


class ProductSerializer(ProductWriteSerializer):
    wood_type = WoodTypeSerializer(read_only=True)
    wood_type_id = serializers.PrimaryKeyRelatedField(
        source="wood_type", queryset=WoodType.objects.all(), write_only=True, required=False
    )
    dimensions_display = serializers.CharField(read_only=True)
    total_stock_qty = serializers.DecimalField(max_digits=14, decimal_places=4, read_only=True)
    total_stock_volume_m3 = serializers.SerializerMethodField()
    stock_status = serializers.CharField(read_only=True)
    moisture_status = serializers.SerializerMethodField()
    stock_by_warehouse = serializers.SerializerMethodField()
    stock_volume_m3 = serializers.SerializerMethodField()
    below_reorder = serializers.SerializerMethodField()
    landed_cost_per_m3 = serializers.SerializerMethodField()

    class Meta(ProductWriteSerializer.Meta):
        fields = ProductWriteSerializer.Meta.fields + [
            "wood_type_id", "dimensions_display", "total_stock_qty",
            "total_stock_volume_m3", "stock_status", "moisture_status",
            "stock_by_warehouse", "stock_volume_m3", "below_reorder",
            "landed_cost_per_m3",
        ]
        read_only_fields = ["volume_cubic_m", "dimensions_display", "total_stock_qty", "stock_status"]
        extra_kwargs = {"wood_type_id": {"write_only": True}}

    def get_landed_cost_per_m3(self, obj):
        v = services.landed_cost_per_m3(obj)
        return None if v is None else float(v)

    def get_stock_volume_m3(self, obj):
        v = obj.stock_volume_m3
        return None if v is None else float(v)

    def get_below_reorder(self, obj):
        return bool(obj.below_reorder)

    def get_total_stock_volume_m3(self, obj):
        v = obj.total_stock_volume_m3
        return None if v is None else float(v)

    def get_moisture_status(self, obj):
        """kd (Sec Séchoir) <= 12% · air_dried (Séché à l'air) 12-18% · vert > 18%."""
        mc = obj.moisture_content
        if mc is None:
            return None
        if mc <= 12:
            return "kd"
        if mc <= 18:
            return "air_dried"
        return "green"

    def get_stock_by_warehouse(self, obj):
        return [
            {
                "warehouse_id": inv.warehouse_id,
                "warehouse_name": inv.warehouse.name if inv.warehouse_id else None,
                "quantity": float(inv.quantity),
                "volume_m3": float(
                    compute_volume_m3(obj.thickness_mm, obj.width_mm, obj.length_mm, inv.quantity)
                ) if inv.quantity else 0,
            }
            for inv in obj.inventory_set.all()
        ]


class InventorySerializer(serializers.ModelSerializer):
    product = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse = WarehouseSerializer(read_only=True)
    volume_m3 = serializers.SerializerMethodField()

    class Meta:
        model = Inventory
        fields = [
            "id", "product", "sku", "warehouse", "quantity", "reserved_qty",
            "avg_cost", "volume_m3", "updated_at",
        ]

    def get_volume_m3(self, obj):
        v = compute_volume_m3(
            obj.product.thickness_mm, obj.product.width_mm, obj.product.length_mm, obj.quantity
        )
        return None if v is None else float(v)


class StockMovementSerializer(serializers.ModelSerializer):
    product = serializers.CharField(source="product.name", read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        source="product", queryset=Product.objects.all(), write_only=True
    )
    warehouse = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_id = serializers.PrimaryKeyRelatedField(
        source="warehouse", queryset=Warehouse.objects.all(), write_only=True
    )
    volume_m3 = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            "id", "movement_no", "product", "product_id", "warehouse", "warehouse_id",
            "movement_type", "quantity", "unit_price", "lot_number",
            "reference_type", "reference_id", "note", "moved_at", "volume_m3",
        ]

    def get_volume_m3(self, obj):
        v = obj.volume_m3
        return None if v is None else float(v)


class SupplierSerializer(serializers.ModelSerializer):
    code = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Supplier
        fields = [
            "id", "code", "company_name", "contact_name", "email", "phone",
            "address", "tax_id", "payment_terms", "is_active",
        ]


class ClientSerializer(serializers.ModelSerializer):
    code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    outstanding = serializers.SerializerMethodField()
    overdue = serializers.SerializerMethodField()
    available_credit = serializers.SerializerMethodField()
    over_limit = serializers.SerializerMethodField()
    credit_used_pct = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            "id", "code", "company_name", "contact_name", "email", "phone",
            "address", "tax_id", "payment_terms", "payment_terms_days",
            "credit_limit", "is_blocked", "is_active",
            "outstanding", "overdue", "available_credit", "over_limit", "credit_used_pct",
        ]

    def _summary(self, obj):
        return services.client_credit_summary(obj)

    def get_outstanding(self, obj):
        return float(self._summary(obj)["outstanding"])

    def get_overdue(self, obj):
        return float(self._summary(obj)["overdue"])

    def get_available_credit(self, obj):
        return float(self._summary(obj)["available_credit"])

    def get_over_limit(self, obj):
        return bool(self._summary(obj)["over_limit"])

    def get_credit_used_pct(self, obj):
        return self._summary(obj)["credit_used_pct"]


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product = serializers.CharField(source="product.name", read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        source="product", queryset=Product.objects.all(), write_only=True
    )
    volume_m3 = serializers.SerializerMethodField()
    landed_cost_per_m3 = serializers.SerializerMethodField()
    landed_line_total = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrderItem
        fields = [
            "id", "product", "product_id", "quantity_ordered",
            "quantity_received", "unit_price", "line_total", "allocated_fees",
            "volume_m3", "landed_cost_per_m3", "landed_line_total",
        ]

    def get_volume_m3(self, obj):
        v = compute_volume_m3(
            obj.product.thickness_mm, obj.product.width_mm, obj.product.length_mm, obj.quantity_ordered
        )
        return None if v is None else float(v)

    def get_landed_cost_per_m3(self, obj):
        volume = Decimal(str(self.get_volume_m3(obj) or 0))
        if volume <= 0:
            return None
        return float(((obj.line_total + obj.allocated_fees) / volume).quantize(Decimal("0.01")))

    def get_landed_line_total(self, obj):
        return float((obj.line_total + obj.allocated_fees).quantize(Decimal("0.01")))


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier = serializers.CharField(source="supplier.company_name", read_only=True)
    supplier_id = serializers.PrimaryKeyRelatedField(
        source="supplier", queryset=Supplier.objects.all()
    )
    warehouse = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_id = serializers.PrimaryKeyRelatedField(
        source="warehouse", queryset=Warehouse.objects.all(), write_only=True
    )
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    total_fees = serializers.SerializerMethodField()
    landed_total = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            "id", "po_number", "supplier", "supplier_id", "warehouse", "warehouse_id",
            "order_date", "expected_date", "status", "subtotal", "tax_amount",
            "freight_cost", "customs_cost", "handling_cost", "total_fees",
            "landed_total", "total_amount", "currency", "notes", "created_at", "items",
        ]

    def get_total_fees(self, obj):
        return float(obj.total_fees)

    def get_landed_total(self, obj):
        return float(obj.landed_total)


class SalesOrderItemSerializer(serializers.ModelSerializer):
    product = serializers.CharField(source="product.name", read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        source="product", queryset=Product.objects.all(), write_only=True
    )
    volume_m3 = serializers.SerializerMethodField()
    landed_cost_per_m3 = serializers.SerializerMethodField()
    unit_margin = serializers.SerializerMethodField()
    line_margin = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrderItem
        fields = [
            "id", "product", "product_id", "quantity_ordered",
            "quantity_shipped", "unit_price", "line_total", "volume_m3",
            "landed_cost_per_m3", "unit_margin", "line_margin",
        ]

    def get_volume_m3(self, obj):
        v = compute_volume_m3(
            obj.product.thickness_mm, obj.product.width_mm, obj.product.length_mm, obj.quantity_ordered
        )
        return None if v is None else float(v)

    def get_landed_cost_per_m3(self, obj):
        v = services.landed_cost_per_m3(obj.product)
        return None if v is None else float(v)

    def get_unit_margin(self, obj):
        landed = services.landed_cost_per_m3(obj.product)
        if landed is None:
            return None
        return float((obj.unit_price - landed).quantize(Decimal("0.01")))

    def get_line_margin(self, obj):
        landed = services.landed_cost_per_m3(obj.product)
        if landed is None:
            return None
        volume = compute_volume_m3(
            obj.product.thickness_mm, obj.product.width_mm, obj.product.length_mm, obj.quantity_ordered
        ) or ZERO
        return float(((obj.unit_price - landed) * volume).quantize(Decimal("0.01")))


class SalesOrderSerializer(serializers.ModelSerializer):
    client = serializers.CharField(source="client.company_name", read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        source="client", queryset=Client.objects.all()
    )
    warehouse = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_id = serializers.PrimaryKeyRelatedField(
        source="warehouse", queryset=Warehouse.objects.all(), write_only=True
    )
    items = SalesOrderItemSerializer(many=True, read_only=True)
    paid_amount = serializers.SerializerMethodField()
    balance_due = serializers.SerializerMethodField()
    due_date = serializers.SerializerMethodField()
    landed_subtotal = serializers.SerializerMethodField()
    margin_mad = serializers.SerializerMethodField()
    margin_pct = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrder
        fields = [
            "id", "so_number", "client", "client_id", "warehouse", "warehouse_id",
            "order_date", "delivery_date", "status", "subtotal", "tax_amount",
            "discount_percent", "discount_amount", "tier_name",
            "total_amount", "currency", "notes", "created_at", "items",
            "paid_amount", "balance_due", "due_date",
            "landed_subtotal", "margin_mad", "margin_pct",
        ]

    def get_paid_amount(self, obj):
        return float(obj.paid_amount)

    def get_balance_due(self, obj):
        return float(obj.balance_due)

    def get_due_date(self, obj):
        return str(services._so_due_date(obj, obj.client))

    def _landed_subtotal(self, obj):
        total = Decimal("0")
        for item in obj.items.all():
            landed = services.landed_cost_per_m3(item.product)
            if landed is None:
                continue
            volume = compute_volume_m3(
                item.product.thickness_mm, item.product.width_mm, item.product.length_mm, item.quantity_ordered
            ) or Decimal("0")
            total += landed * volume
        return total

    def get_landed_subtotal(self, obj):
        return float(self._landed_subtotal(obj).quantize(Decimal("0.01")))

    def get_margin_mad(self, obj):
        return float((obj.total_amount - self._landed_subtotal(obj)).quantize(Decimal("0.01")))

    def get_margin_pct(self, obj):
        subtotal = obj.subtotal
        if not subtotal:
            return None
        return round(float((obj.total_amount - self._landed_subtotal(obj)) / subtotal * 100), 1)


class TransactionItemSerializer(serializers.Serializer):
    """Line item for the quick sale / purchase endpoints (timber pricing)."""

    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=14, decimal_places=4, min_value=Decimal("0.0001"))
    price_per_m3 = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, min_value=Decimal("0")
    )
    thickness_mm = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, min_value=Decimal("0"))
    width_mm = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, min_value=Decimal("0"))
    length_mm = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, min_value=Decimal("0"))
    lot_number = serializers.CharField(required=False, allow_blank=True)


class FeesField(serializers.DictField):
    """Logistics fees breakdown (MAD): freight / customs / handling."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("child", serializers.DecimalField(
            max_digits=14, decimal_places=2, min_value=Decimal("0"), required=False
        ))
        super().__init__(*args, **kwargs)

    def to_internal_value(self, data):
        if data is None:
            return {}
        out = {}
        for key in ("freight_cost", "customs_cost", "handling_cost"):
            val = data.get(key)
            if val is None or val == "":
                continue
            out[key] = Decimal(str(val))
        return out


class PurchaseTransactionSerializer(serializers.Serializer):
    supplier_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    items = TransactionItemSerializer(many=True)
    fees = FeesField(required=False, allow_null=True)


class SaleTransactionSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    items = TransactionItemSerializer(many=True)


class TransferSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    from_warehouse_id = serializers.IntegerField()
    to_warehouse_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=14, decimal_places=4, min_value=Decimal("0.0001"))
    lot_number = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["from_warehouse_id"] == attrs["to_warehouse_id"]:
            raise serializers.ValidationError(
                "Le dépôt source et le dépôt de destination doivent être différents."
            )
        return attrs


# ---------------------------------------------------------------------------
# Monthly archive serializers
# ---------------------------------------------------------------------------
class MonthlyArchiveSerializer(serializers.ModelSerializer):
    product = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse = serializers.CharField(source="warehouse.name", read_only=True)
    volume_m3 = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyArchive
        fields = [
            "id", "year", "month", "product", "sku", "warehouse",
            "closing_qty", "closing_value", "volume_m3",
            "purchase_qty", "purchase_value",
            "sale_qty", "sale_value",
            "transfer_in_qty", "transfer_out_qty", "adjustment_qty",
            "opening_qty",
        ]

    def get_volume_m3(self, obj):
        from .models import compute_volume_m3
        v = compute_volume_m3(
            obj.product.thickness_mm, obj.product.width_mm, obj.product.length_mm, obj.closing_qty
        )
        return None if v is None else float(v)


class MonthlyArchiveMonthSerializer(serializers.Serializer):
    """Summary for one archived month."""
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    product_count = serializers.IntegerField()
    total_closing_qty = serializers.DecimalField(max_digits=14, decimal_places=4)
    total_closing_value = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_purchase_value = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_sale_value = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_purchase_qty = serializers.DecimalField(max_digits=14, decimal_places=4)
    total_sale_qty = serializers.DecimalField(max_digits=14, decimal_places=4)


# ---------------------------------------------------------------------------
# Enterprise serializers: audit trail, reorders, current user
# ---------------------------------------------------------------------------
class AuditLogSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id", "user", "action", "entity_type", "entity_id",
            "entity_ref", "details", "ip_address", "created_at",
        ]

    def get_user(self, obj):
        return obj.user.username if obj.user else None


class ReorderItemSerializer(serializers.Serializer):
    """One line for a purchase reorder: the quantity is optional, the server
    suggests a restock quantity from the product's m³ deficit when omitted."""
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(
        max_digits=14, decimal_places=4, required=False, min_value=Decimal("0.0001")
    )

    def validate_product_id(self, value):
        if not Product.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Produit introuvable ou inactif.")
        return value


class ReorderSerializer(serializers.Serializer):
    warehouse_id = serializers.IntegerField()
    supplier_id = serializers.IntegerField(required=False, allow_null=True)
    items = ReorderItemSerializer(many=True, min_length=1)


# ---------------------------------------------------------------------------
# Enterprise serializers: payments, kiln drying, volume tier pricing
# ---------------------------------------------------------------------------
class PaymentSerializer(serializers.ModelSerializer):
    client = serializers.CharField(source="client.company_name", read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        source="client", queryset=Client.objects.all()
    )
    sales_order_ref = serializers.CharField(
        source="sales_order.so_number", read_only=True, default=None
    )
    payment_date = serializers.DateField(format="%Y-%m-%d")

    class Meta:
        model = Payment
        fields = [
            "id", "client", "client_id", "sales_order", "sales_order_ref",
            "amount", "payment_date", "method", "reference", "note", "created_at",
        ]


class PaymentCreateSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    sales_order_id = serializers.IntegerField(required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    payment_date = serializers.DateField(required=False)
    method = serializers.CharField(required=False, allow_blank=True)
    reference = serializers.CharField(required=False, allow_blank=True)
    note = serializers.CharField(required=False, allow_blank=True)

    def validate_client_id(self, value):
        if not Client.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Client introuvable ou inactif.")
        return value

    def validate_sales_order_id(self, value):
        if value is not None and not SalesOrder.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Commande de vente introuvable.")
        return value


class KilnSerializer(serializers.ModelSerializer):
    warehouse = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_id = serializers.PrimaryKeyRelatedField(
        source="warehouse", queryset=Warehouse.objects.all()
    )
    occupied_m3 = serializers.SerializerMethodField()
    available_m3 = serializers.SerializerMethodField()
    active_batch_count = serializers.SerializerMethodField()

    class Meta:
        model = Kiln
        fields = [
            "id", "code", "name", "warehouse", "warehouse_id",
            "max_capacity_m3", "occupied_m3", "available_m3",
            "active_batch_count", "is_active",
        ]

    def get_occupied_m3(self, obj):
        return float(obj.occupied_m3)

    def get_available_m3(self, obj):
        return float(obj.available_m3)

    def get_active_batch_count(self, obj):
        return obj.active_batches.count()


class DryingBatchSerializer(serializers.ModelSerializer):
    product = serializers.CharField(source="product.name", read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        source="product", queryset=Product.objects.all()
    )
    sku = serializers.CharField(source="product.sku", read_only=True)
    species = serializers.CharField(source="product.wood_type.name", read_only=True, default=None)
    kiln = serializers.CharField(source="kiln.name", read_only=True, default=None)
    kiln_code = serializers.CharField(source="kiln.code", read_only=True, default=None)
    kiln_id = serializers.PrimaryKeyRelatedField(
        source="kiln", queryset=Kiln.objects.all(), required=False, allow_null=True
    )
    warehouse = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_id = serializers.PrimaryKeyRelatedField(
        source="warehouse", queryset=Warehouse.objects.all(), required=False, allow_null=True
    )
    status_label = serializers.SerializerMethodField()
    stage = serializers.CharField(read_only=True)
    stage_label = serializers.SerializerMethodField()
    progress_pct = serializers.SerializerMethodField()
    energy_cost_per_m3 = serializers.SerializerMethodField()

    class Meta:
        model = DryingBatch
        fields = [
            "id", "batch_no", "product", "product_id", "sku", "species",
            "kiln", "kiln_id", "kiln_code", "warehouse", "warehouse_id",
            "status", "status_label", "stage", "stage_label", "progress_pct",
            "quantity", "initial_volume_m3", "start_moisture", "target_moisture",
            "current_moisture", "energy_cost", "energy_cost_per_m3",
            "estimated_end_date", "notes", "started_at", "completed_at",
            "created_at", "updated_at",
        ]
        read_only_fields = ["batch_no", "started_at", "completed_at"]

    def validate(self, attrs):
        if self.instance is not None:
            return attrs
        kiln = attrs.get("kiln")
        product = attrs.get("product")
        quantity = attrs.get("quantity") or Decimal("0")
        if kiln is None or product is None:
            return attrs
        volume = compute_volume_m3(
            product.thickness_mm, product.width_mm, product.length_mm, quantity
        ) or Decimal("0")
        available = Decimal(str(kiln.available_m3))
        if volume > available:
            raise serializers.ValidationError(
                f"Capacité insuffisante : {kiln.code} dispose de {available:.4f} m³ "
                f"disponibles ({volume:.4f} m³ demandés)."
            )
        return attrs

    def get_status_label(self, obj):
        return {
            DryingBatch.Status.IN_PROGRESS: "En cours",
            DryingBatch.Status.COMPLETED: "Terminé",
            DryingBatch.Status.CANCELLED: "Annulé",
        }.get(obj.status)

    def get_stage_label(self, obj):
        return {
            "green": "Vert",
            "air_dried": "Séché à l'air",
            "kd": "Sec Séchoir",
        }.get(obj.stage)

    def get_progress_pct(self, obj):
        p = obj.progress_pct
        return None if p is None else float(p)

    def get_energy_cost_per_m3(self, obj):
        return float(obj.energy_cost_per_m3)


class PriceTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceTier
        fields = [
            "id", "name", "min_volume_m3", "max_volume_m3",
            "discount_percent", "is_active", "created_at", "updated_at",
        ]


class PriceTierLookupSerializer(serializers.Serializer):
    """Response of GET /api/pricing/lookup/?volume_m3=<m³>."""
    volume_m3 = serializers.FloatField()
    tier_id = serializers.IntegerField(allow_null=True)
    tier_name = serializers.CharField(allow_null=True)
    discount_percent = serializers.FloatField()
    discount_mad = serializers.FloatField()
    discounted_total = serializers.FloatField()


class CompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyProfile
        fields = [
            "name", "tagline", "address", "phone", "email",
            "ice", "registre_commerce", "identifiant_fiscal",
            "patente", "cnss", "bank_name", "bank_rib",
        ]