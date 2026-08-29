import os
import time
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "koudi_backend.settings")
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient
from stock.models import Client, Inventory, Product, StockMovement, Supplier, WoodType

User = get_user_model()
user, _ = User.objects.get_or_create(username="smoke-test-user")
user.set_password("test")
user.save()
token, _ = Token.objects.get_or_create(user=user)

c = APIClient()
c.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

r = c.get("/api/wood-types/")
print("wood-types:", r.status_code, "count =", r.data.get("count"))

r = c.get("/api/warehouses/")
print("warehouses:", r.status_code, "count =", r.data.get("count"))
warehouse_id = r.data["results"][0]["id"]

wt = WoodType.objects.filter(name="Oak").first()
sku = f"OAK-{int(time.time())}"
r = c.post(
    "/api/products/",
    {
        "sku": sku,
        "name": "Oak Board 30x140x3.0",
        "wood_type_id": wt.id,
        "category": "Bois Feuillus & Nobles",
        "grade": "FAS",
        "thickness_mm": 30,
        "width_mm": 140,
        "length_m": 3.0,
        "moisture_content": 12,
        "finish": "planed",
        "uom": "cbm",
        "cost_price": 8500,
        "sale_price": 12800,
        "min_stock_qty": 5,
    },
    format="json",
)
print("create product:", r.status_code, r.data.get("sku"), "volume_m3 =", r.data.get("volume_cubic_m"))
pid = r.data.get("id")

r = c.get("/api/products/?species=Oak")
print("filter species=Oak count:", r.data.get("count"))

# ---------- transactional flow ----------
client = Client.objects.create(code=f"CLI-{int(time.time())}", company_name="Test Client")
supplier = Supplier.objects.create(code=f"SUP-{int(time.time())}", company_name="Test Supplier")

r = c.post(
    "/api/purchases/",
    {
        "supplier_id": supplier.id,
        "warehouse_id": warehouse_id,
        "items": [{"product_id": pid, "quantity": 100, "price_per_m3": 8500, "lot_number": "LOT-2026-01"}],
    },
    format="json",
)
print("purchase:", r.status_code, r.data.get("po_number"), "total =", r.data.get("total_amount"))

inv = Inventory.objects.get(product_id=pid, warehouse_id=warehouse_id)
print("inventory after purchase:", inv.quantity, "| volume_m3 =", float(inv.quantity) * 0.0126)

r = c.post(
    "/api/sales/",
    {
        "client_id": client.id,
        "warehouse_id": warehouse_id,
        "items": [{"product_id": pid, "quantity": 30, "price_per_m3": 12800}],
    },
    format="json",
)
print("sale:", r.status_code, r.data.get("so_number"), "total =", r.data.get("total_amount"))
if r.status_code >= 400:
    print("   sale error body:", r.data)

inv.refresh_from_db()
print("inventory after sale:", inv.quantity, "(expected 70)")

r = c.get("/api/stock-movements/?product=%s" % pid)
print("movements for product:", r.data.get("count"))
for m in r.data["results"]:
    print("   -", m["movement_type"], m["quantity"], m.get("lot_number"), "vol:", m.get("volume_m3"))

r = c.get("/api/dashboard/")
dash = {k: v for k, v in r.data.items() if k != "recent_movements"}
print("dashboard:", r.status_code, dash)

# cleanup (children first for protected FKs)
from stock.models import (
    PurchaseOrderItem,
    PurchaseOrder,
    SalesOrderItem,
    SalesOrder,
    Inventory,
)

StockMovement.objects.filter(product_id=pid).delete()
SalesOrderItem.objects.filter(product_id=pid).delete()
PurchaseOrderItem.objects.filter(product_id=pid).delete()
SalesOrder.objects.filter(items__isnull=True).delete()
PurchaseOrder.objects.filter(items__isnull=True).delete()
Inventory.objects.filter(product_id=pid).delete()
Product.objects.filter(pk=pid).delete()
Client.objects.filter(pk=client.id).delete()
Supplier.objects.filter(pk=supplier.id).delete()
print("cleaned up test data")
