from django.contrib import admin

from .models import (
    Client,
    CompanyProfile,
    Inventory,
    Lead,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    SalesOrder,
    SalesOrderItem,
    StockMovement,
    Supplier,
    Warehouse,
    WoodType,
)


@admin.register(CompanyProfile)
class CompanyProfileAdmin(admin.ModelAdmin):
    fieldsets = [
        ("Identité", {"fields": ["name", "tagline"]}),
        ("Coordonnées", {"fields": ["address", "phone", "email"]}),
        ("Identifiants fiscaux", {"fields": ["ice", "identifiant_fiscal", "patente", "cnss", "registre_commerce"]}),
        ("Banque", {"fields": ["bank_name", "bank_rib"]}),
    ]

    def has_add_permission(self, request):
        return not CompanyProfile.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(WoodType)
class WoodTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "scientific_name", "category", "density_kg_m3", "is_active")
    search_fields = ("name", "scientific_name")


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active")


class InventoryInline(admin.TabularInline):
    model = Inventory
    extra = 0


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "sku", "name", "wood_type", "thickness_mm", "width_mm", "length_m",
        "volume_cubic_m", "sale_price", "stock_status",
    )
    list_filter = ("wood_type", "grade", "finish", "category", "piece_type", "treatment", "is_active")
    search_fields = ("sku", "name")
    inlines = [InventoryInline]


@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ("product", "warehouse", "quantity", "reserved_qty", "avg_cost")
    list_filter = ("warehouse",)
    search_fields = ("product__sku", "product__name")


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        "movement_no", "product", "warehouse", "movement_type", "quantity",
        "lot_number", "moved_at",
    )
    list_filter = ("movement_type", "warehouse", "moved_at")


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("code", "company_name", "phone", "email", "is_active")


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("code", "company_name", "phone", "email", "credit_limit", "is_active")


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 0


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("po_number", "supplier", "warehouse", "status", "total_amount", "order_date")
    list_filter = ("status", "warehouse")
    inlines = [PurchaseOrderItemInline]


class SalesOrderItemInline(admin.TabularInline):
    model = SalesOrderItem
    extra = 0


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ("so_number", "client", "warehouse", "status", "total_amount", "order_date")
    list_filter = ("status", "warehouse")
    inlines = [SalesOrderItemInline]


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ("kind", "name", "company", "email", "phone", "status", "created_at")
    list_filter = ("kind", "status")