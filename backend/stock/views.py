"""API views: ViewSets for CRUD + transactional endpoints + dashboard."""
import calendar
from datetime import date, datetime
from decimal import Decimal, ROUND_CEILING

from django.contrib.auth import authenticate
from django.db.models import F, Prefetch, Q, Sum
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import pdfs, services
from .audit import audit
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
    SalesOrder,
    StockMovement,
    Supplier,
    Warehouse,
    WoodType,
)
from .serializers import (
    AuditLogSerializer,
    ClientSerializer,
    CompanyProfileSerializer,
    DryingBatchSerializer,
    InventorySerializer,
    KilnSerializer,
    MonthlyArchiveMonthSerializer,
    MonthlyArchiveSerializer,
    PaymentCreateSerializer,
    PaymentSerializer,
    PriceTierLookupSerializer,
    PriceTierSerializer,
    ProductSerializer,
    PurchaseOrderSerializer,
    PurchaseTransactionSerializer,
    ReorderSerializer,
    SaleTransactionSerializer,
    SalesOrderSerializer,
    StockAdjustmentSerializer,
    StockMovementSerializer,
    SupplierSerializer,
    TransferSerializer,
    WarehouseSerializer,
    WoodTypeSerializer,
)

ZERO = Decimal("0")


def _pdf_response(pdf_bytes, filename):
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _next_contact_code(model, prefix):
    """Auto-numbered contact code (CLI-0001 / SUP-0001) when none supplied."""
    last = model.objects.filter(code__startswith=f"{prefix}-").order_by("-code").first()
    if last is not None:
        try:
            return f"{prefix}-{int(last.code.rsplit('-', 1)[1]) + 1:04d}"
        except (IndexError, ValueError):
            pass
    return f"{prefix}-0001"


class WoodTypeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = WoodType.objects.filter(is_active=True)
    serializer_class = WoodTypeSerializer


class WarehouseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Warehouse.objects.filter(is_active=True)
    serializer_class = WarehouseSerializer


class ProductViewSet(viewsets.ModelViewSet):
    """CRUD for timber products with species / dimension / stock filters."""

    queryset = Product.objects.select_related("wood_type").all()
    serializer_class = ProductSerializer
    search_fields = ["name", "sku"]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        # Warehouse-scoped stock: when a warehouse is selected, inventory is
        # prefetched for that warehouse only so qty/status reflect it.
        warehouse_id = params.get("warehouse")
        if warehouse_id:
            qs = qs.filter(inventory__warehouse_id=warehouse_id).distinct()
            qs = qs.prefetch_related(
                Prefetch(
                    "inventory_set",
                    queryset=Inventory.objects.filter(warehouse_id=warehouse_id)
                    .select_related("warehouse"),
                )
            )
        else:
            qs = qs.prefetch_related("inventory_set__warehouse")

        species = params.get("species")
        if species:
            qs = qs.filter(wood_type__name__icontains=species)

        category = params.get("category")
        if category:
            qs = qs.filter(category__iexact=category)

        grade = params.get("grade")
        if grade:
            qs = qs.filter(grade__iexact=grade)

        moisture_min = params.get("moisture_min")
        if moisture_min:
            qs = qs.filter(moisture_content__gte=Decimal(moisture_min))

        moisture_max = params.get("moisture_max")
        if moisture_max:
            qs = qs.filter(moisture_content__lte=Decimal(moisture_max))

        length = params.get("length_mm")
        if length:
            qs = qs.filter(length_mm=Decimal(length))

        search = params.get("search")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(sku__icontains=search))

        # Stock-level filters (computing totals on the fly).
        status_filter = params.get("stock_status")
        if status_filter in ("in_stock", "low", "out_of_stock"):
            ids = [
                p.pk
                for p in qs
                if (
                    (status_filter == "in_stock" and p.stock_status == "in_stock")
                    or (status_filter == "low" and p.stock_status == "low")
                    or (status_filter == "out_of_stock" and p.stock_status == "out_of_stock")
                )
            ]
            qs = Product.objects.filter(pk__in=ids).select_related("wood_type")
            qs = (
                qs.prefetch_related(
                    Prefetch(
                        "inventory_set",
                        queryset=Inventory.objects.filter(
                            warehouse_id=warehouse_id
                        ).select_related("warehouse")
                        if warehouse_id
                        else Inventory.objects.all().select_related("warehouse"),
                    )
                )
            )

        return qs

    @action(detail=False, methods=["get"])
    def lookup(self, request):
        """Lightweight id -> {name, sku, prices, dimensions} map for forms."""
        return Response(
            [
                {
                    "id": p.id,
                    "name": p.name,
                    "sku": p.sku,
                    "sale_price": float(p.sale_price),
                    "cost_price": float(p.cost_price),
                    "uom": p.uom,
                    "volume_cubic_m": float(p.volume_cubic_m) if p.volume_cubic_m else None,
                    "thickness_mm": float(p.thickness_mm) if p.thickness_mm is not None else None,
                    "width_mm": float(p.width_mm) if p.width_mm is not None else None,
                    "length_mm": float(p.length_mm) if p.length_mm is not None else None,
                }
                for p in Product.objects.filter(is_active=True)
            ]
        )

    @action(detail=True, methods=["get"], url_path="label")
    def label(self, request, pk=None):
        """Print scannable QR labels for this product/batch.

        Query params: ``qty`` (default 1, max 100) and ``warehouse`` (id).
        The QR payload encodes SKU, dimensions L×W×T mm, volume m³ and the
        warehouse location so bundles can be traced by scanning the tag.
        """
        product = self.get_object()
        try:
            qty = max(1, min(int(request.query_params.get("qty", 1)), 100))
        except (TypeError, ValueError):
            qty = 1

        warehouse = None
        wh_id = request.query_params.get("warehouse")
        if wh_id:
            warehouse = Warehouse.objects.filter(pk=wh_id).first()
        if warehouse is None:
            top_inv = product.inventory_set.order_by("-quantity").first()
            warehouse = top_inv.warehouse if top_inv else None

        audit("download", "product_label", product.pk, product.sku, {
            "qty": qty,
            "warehouse": warehouse.code if warehouse else None,
        })
        return _pdf_response(
            pdfs.build_label_pdf(product, warehouse, total_qty=qty),
            f"label-{product.sku}.pdf",
        )


class InventoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InventorySerializer

    def get_queryset(self):
        qs = Inventory.objects.select_related("product", "warehouse").order_by(
            "product__name", "warehouse__name"
        )
        warehouse = self.request.query_params.get("warehouse")
        product = self.request.query_params.get("product")
        if warehouse:
            qs = qs.filter(warehouse_id=warehouse)
        if product:
            qs = qs.filter(product_id=product)
        return qs


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer

    def get_queryset(self):
        qs = StockMovement.objects.select_related("product", "warehouse").all()
        movement_type = self.request.query_params.get("movement_type")
        product = self.request.query_params.get("product")
        warehouse = self.request.query_params.get("warehouse")
        if movement_type:
            qs = qs.filter(movement_type=movement_type)
        if product:
            qs = qs.filter(product_id=product)
        if warehouse:
            qs = qs.filter(warehouse_id=warehouse)
        return qs


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

    def perform_create(self, serializer):
        serializer.save(
            code=_next_contact_code(Supplier, "SUP") if not serializer.validated_data.get("code")
            else serializer.validated_data["code"]
        )


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer

    def perform_create(self, serializer):
        serializer.save(
            code=_next_contact_code(Client, "CLI") if not serializer.validated_data.get("code")
            else serializer.validated_data["code"]
        )

    @action(detail=True, methods=["get"])
    def credit(self, request, pk=None):
        """GET /api/clients/{id}/credit/ → receivables summary (MAD)."""
        client = self.get_object()
        summary = services.client_credit_summary(client)
        summary.update({
            "code": client.code,
            "company_name": client.company_name,
        })
        return Response(summary)


class PurchaseOrderViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PurchaseOrder.objects.select_related("supplier", "warehouse").prefetch_related("items__product")
    serializer_class = PurchaseOrderSerializer

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        """Download an official purchase order (bon de commande) PDF."""
        po = self.get_object()
        audit("download", "purchase_order", po.pk, po.po_number, {"document": "purchase_order"})
        return _pdf_response(
            pdfs.build_purchase_order_pdf(po), f"{po.po_number}_BON_DE_COMMANDE.pdf"
        )


class SalesOrderViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SalesOrder.objects.select_related("client", "warehouse").prefetch_related(
        "items__product", "client"
    )
    serializer_class = SalesOrderSerializer

    @action(detail=True, methods=["get"])
    def invoice(self, request, pk=None):
        """Download an invoice PDF (official, VAT 20% included)."""
        so = self.get_object()
        audit("download", "sales_order", so.pk, so.so_number, {"document": "invoice"})
        return _pdf_response(
            pdfs.build_invoice_pdf(so), f"{so.so_number}_FACTURE.pdf"
        )

    @action(detail=True, methods=["get"])
    def quotation(self, request, pk=None):
        """Download a quotation PDF (devis, provisional)."""
        so = self.get_object()
        audit("download", "sales_order", so.pk, so.so_number, {"document": "quotation"})
        return _pdf_response(
            pdfs.build_quotation_pdf(so), f"{so.so_number}_DEVIS.pdf"
        )


# ---------------------------------------------------------------------------
# Transactional endpoints (auto-adjust stock via ledger + DB trigger)
# ---------------------------------------------------------------------------
class PurchaseTransactionView(APIView):
    parser_classes = [JSONParser]

    def post(self, request):
        serializer = PurchaseTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            supplier = Supplier.objects.get(pk=data["supplier_id"])
            warehouse = Warehouse.objects.get(pk=data["warehouse_id"])
            items = [{"product": Product.objects.get(pk=i["product_id"]), **i} for i in data["items"]]
        except (Supplier.DoesNotExist, Warehouse.DoesNotExist, Product.DoesNotExist) as exc:
            return Response({"detail": f"Related object not found: {exc}"}, status=status.HTTP_404_NOT_FOUND)

        fees = data.get("fees") or {}
        po = services.create_purchase(supplier, warehouse, items, fees=fees)
        audit("create", "purchase_order", po.pk, po.po_number, {
            "supplier": supplier.code,
            "warehouse": warehouse.code,
            "fee_total": str(po.total_fees),
            "landed_total": str(po.landed_total),
        })
        return Response(PurchaseOrderSerializer(po).data, status=status.HTTP_201_CREATED)


class SaleTransactionView(APIView):
    parser_classes = [JSONParser]

    def post(self, request):
        serializer = SaleTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            client = Client.objects.get(pk=data["client_id"])
            warehouse = Warehouse.objects.get(pk=data["warehouse_id"])
            items = [{"product": Product.objects.get(pk=i["product_id"]), **i} for i in data["items"]]
        except (Client.DoesNotExist, Warehouse.DoesNotExist, Product.DoesNotExist) as exc:
            return Response({"detail": f"Related object not found: {exc}"}, status=status.HTTP_404_NOT_FOUND)

        # Volume-based tier discount (whole order volume in m³).
        order_volume = ZERO
        for item in items:
            order_volume += services._line_volume_m3(item["product"], item, Decimal(item["quantity"])) or ZERO
        tier = services.resolve_tier(order_volume)
        discount_percent = tier.discount_percent if tier else ZERO
        tier_name = tier.name if tier else None

        # Credit guard: hard block only for explicitly blocked clients.
        projected_total = ZERO
        for item in items:
            vol = services._line_volume_m3(item["product"], item, Decimal(item["quantity"])) or ZERO
            price = Decimal(str(item.get("price_per_m3", item["product"].sale_price or ZERO)))
            projected_total += vol * price
        discount_amount = services.apply_tier_discount(projected_total, discount_percent)
        blocked, credit_summary = services.check_sale_credit(client, projected_total - discount_amount)
        if blocked:
            return Response(
                {
                    "detail": "Client bloqué — les ventes sont suspendues tant que le compte "
                              "n'est pas régularisé. Contactez l'administration."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            so = services.create_sale(
                client, warehouse, items, discount_percent=discount_percent, tier_name=tier_name
            )
        except Exception as exc:  # negative stock constraint etc.
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = SalesOrderSerializer(so).data
        if credit_summary.get("projected_over_limit"):
            payload["credit_warning"] = {
                "message": "Attention : le montant impayé du client dépasse son plafond de crédit.",
                "credit_limit": float(credit_summary["credit_limit"]),
                "outstanding": float(credit_summary["outstanding"]),
                "projected_outstanding": float(credit_summary["projected_outstanding"]),
                "overdue": float(credit_summary["overdue"]),
                "is_blocked": False,
                "terms_days": credit_summary["payment_terms_days"],
            }
            audit("credit_warning", "sales_order", so.pk, so.so_number, {
                "client": client.code,
                "projected_outstanding": str(credit_summary["projected_outstanding"]),
                "credit_limit": str(credit_summary["credit_limit"]),
            })
        audit("create", "sales_order", so.pk, so.so_number, {
            "client": client.code,
            "discount_percent": str(discount_percent),
            "tier": tier_name,
            "volume_m3": str(order_volume),
        })
        return Response(payload, status=status.HTTP_201_CREATED)


class TransferView(APIView):
    parser_classes = [JSONParser]

    def post(self, request):
        serializer = TransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            product = Product.objects.get(pk=data["product_id"])
            from_wh = Warehouse.objects.get(pk=data["from_warehouse_id"])
            to_wh = Warehouse.objects.get(pk=data["to_warehouse_id"])
        except (Product.DoesNotExist, Warehouse.DoesNotExist) as exc:
            return Response(
                {"detail": f"Objet introuvable : {exc}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            transfer_out, _ = services.transfer_stock(
                product,
                from_wh,
                to_wh,
                data["quantity"],
                lot_number=data.get("lot_number"),
            )
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        audit("transfer", "transfer", None, f"{from_wh.code} → {to_wh.code}", {
            "product_sku": product.sku,
            "quantity": str(data["quantity"]),
            "lot": data.get("lot_number"),
        })
        return Response(StockMovementSerializer(transfer_out).data, status=status.HTTP_201_CREATED)


class StockAdjustmentView(APIView):
    """POST /api/stock-adjustments/ → correct warehouse stock for a product.

    Body: { "product_id": 5, "warehouse_id": 1, "quantity": 12.5,
            "reason"?: "Inventaire — surplus constaté" }

    ``quantity`` is signed: a positive value adds stock, a negative value
    removes it. The movement is logged as ``adjustment`` in the ledger; the
    ``maintain_inventory`` trigger applies the signed delta directly to the
    inventory row (it is not negated like a sale). Monthly archive and the
    movement history pick the adjustment up automatically.
    """

    parser_classes = [JSONParser]

    def post(self, request):
        serializer = StockAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            product = Product.objects.get(pk=data["product_id"])
            warehouse = Warehouse.objects.get(pk=data["warehouse_id"])
        except (Product.DoesNotExist, Warehouse.DoesNotExist) as exc:
            return Response(
                {"detail": f"Objet introuvable : {exc}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        quantity = data["quantity"]
        try:
            movement = services.log_stock_movement(
                product=product,
                warehouse=warehouse,
                movement_type=StockMovement.MovementType.ADJUSTMENT,
                quantity=quantity,
                note=(data.get("reason") or "").strip() or "Ajustement de stock",
            )
        except Exception as exc:  # insufficient stock for a negative delta, etc.
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        volume = movement.volume_m3 or ZERO
        audit("adjustment", "stock_movement", movement.pk, movement.movement_no, {
            "product_sku": product.sku,
            "warehouse": warehouse.code,
            "quantity": str(quantity),
            "volume_m3": str(volume),
            "reason": data.get("reason"),
        })
        return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)


class ReorderView(APIView):
    """POST /api/reorders/ → create a DRAFT purchase order from stock alerts.

    Body: { "warehouse_id": 1, "supplier_id"?: 3,
            "items": [ { "product_id": 5, "quantity"?: 40 } ] }

    When ``quantity`` is omitted the server suggests a restock quantity that
    covers the product's m³ deficit versus ``reorder_threshold_m3``. No stock
    movement is created: the PO is a procurement draft.
    """

    parser_classes = [JSONParser]

    def post(self, request):
        serializer = ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            warehouse = Warehouse.objects.get(pk=data["warehouse_id"])
        except Warehouse.DoesNotExist:
            return Response({"detail": "Dépôt introuvable."}, status=status.HTTP_404_NOT_FOUND)

        supplier = supplier_default()
        if data.get("supplier_id"):
            try:
                supplier = Supplier.objects.get(pk=data["supplier_id"], is_active=True)
            except Supplier.DoesNotExist:
                return Response({"detail": "Fournisseur introuvable."}, status=status.HTTP_404_NOT_FOUND)
        if supplier is None:
            return Response(
                {"detail": "Aucun fournisseur actif — impossible de créer la réappro."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        items = []
        for item in data["items"]:
            product = Product.objects.get(pk=item["product_id"])
            qty = item.get("quantity")
            if qty is None:
                threshold = product.reorder_threshold_m3 or ZERO
                deficit = threshold - product.stock_volume_m3
                unit = product.volume_cubic_m or ZERO
                if unit > 0:
                    qty = max((deficit / unit).to_integral_value(rounding=ROUND_CEILING), Decimal("1"))
                else:
                    qty = Decimal("1")
            items.append({"product": product, "quantity": qty})

        po = services.create_reorder(supplier, warehouse, items)
        audit("reorder", "purchase_order", po.pk, po.po_number, {
            "warehouse": warehouse.code,
            "supplier": supplier.code,
            "items": [{"sku": i.product.sku, "quantity": str(i.quantity_ordered)} for i in po.items.all()],
        })
        return Response(PurchaseOrderSerializer(po).data, status=status.HTTP_201_CREATED)


def supplier_default():
    return Supplier.objects.filter(is_active=True).order_by("code").first()


class KilnViewSet(viewsets.ReadOnlyModelViewSet):
    """Séchoir units with live occupancy (volume m³ loaded in-progress)."""

    queryset = Kiln.objects.filter(is_active=True).select_related("warehouse")
    serializer_class = KilnSerializer
    pagination_class = None

    @action(detail=True, methods=["get"])
    def batches(self, request, pk=None):
        """GET /api/kilns/{id}/batches/ → every cycle run on this séchoir."""
        kiln = self.get_object()
        qs = (
            kiln.batches.select_related("product", "product__wood_type", "warehouse")
            .order_by("-created_at")[:200]
        )
        return Response(DryingBatchSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        """GET /api/kilns/dashboard/ → Séchoir metrics for the dashboard page."""
        kilns = list(self.get_queryset())

        total_capacity = ZERO
        occupied = ZERO
        operating = 0
        batches_in_progress = 0
        energy = ZERO
        for k in kilns:
            total_capacity += k.max_capacity_m3 or ZERO
            occupied += k.occupied_m3
            active = k.active_batches.count()
            batches_in_progress += active
            if active > 0:
                operating += 1
            for b in k.batches.filter(status=DryingBatch.Status.IN_PROGRESS):
                energy += b.energy_cost or ZERO

        avg_days = None
        completed = DryingBatch.objects.filter(
            status=DryingBatch.Status.COMPLETED,
            started_at__isnull=False,
            completed_at__isnull=False,
        )
        if completed.exists():
            total_days = sum(
                (c.completed_at - c.started_at).total_seconds() / 86400.0 for c in completed
            )
            avg_days = round(total_days / completed.count(), 1)

        return Response({
            "operating_kilns": operating,
            "total_kilns": len(kilns),
            "total_capacity_m3": float(total_capacity),
            "occupied_m3": float(occupied),
            "utilization_pct": round(float(occupied / total_capacity * 100), 1)
            if total_capacity > 0 else 0.0,
            "batches_in_progress": batches_in_progress,
            "avg_drying_days": avg_days,
            "total_energy_cost": float(energy),
            "kilns": KilnSerializer(kilns, many=True).data,
        })


class DryingBatchViewSet(viewsets.ModelViewSet):
    """Kiln drying charges (lifecycle: in_progress → completed | cancelled)."""

    queryset = DryingBatch.objects.select_related(
        "product", "product__wood_type", "kiln", "warehouse"
    )
    serializer_class = DryingBatchSerializer

    def perform_create(self, serializer):
        kiln = serializer.validated_data.get("kiln")
        warehouse = serializer.validated_data.get("warehouse")
        if warehouse is None and kiln is not None:
            warehouse = kiln.warehouse

        product = serializer.validated_data.get("product")
        quantity = serializer.validated_data.get("quantity") or ZERO
        from .models import compute_volume_m3

        volume = compute_volume_m3(
            product.thickness_mm, product.width_mm, product.length_mm, quantity
        ) or ZERO

        batch = serializer.save(
            batch_no=services.next_batch_no(),
            status=DryingBatch.Status.IN_PROGRESS,
            started_at=timezone.now(),
            warehouse=warehouse,
            initial_volume_m3=volume.quantize(Decimal("0.0001")),
        )
        audit("create", "drying_batch", batch.pk, batch.batch_no, {
            "product": batch.product.sku,
            "quantity": str(batch.quantity),
            "volume_m3": str(batch.initial_volume_m3),
            "kiln": batch.kiln.code if batch.kiln else None,
            "energy_cost": str(batch.energy_cost),
        })

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """POST /api/drying-batches/{id}/complete/ → finish the cycle.

        Marks the product kiln-dried, stores the moisture and raises its unit
        prices by the batch energy cost per m³. Body: { "current_moisture": 9 }.
        """
        batch = self.get_object()
        serializer = DryingBatchSerializer(batch, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            updated = services.complete_drying_batch(
                batch, current_moisture=serializer.validated_data.get("current_moisture")
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        audit("update", "drying_batch", updated.pk, updated.batch_no, {
            "action": "complete",
            "status": updated.status,
            "moisture": str(updated.current_moisture),
            "energy_cost": str(updated.energy_cost),
            "energy_per_m3": str(updated.energy_cost_per_m3),
            "product": updated.product.sku,
        })
        return Response(DryingBatchSerializer(updated).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """POST /api/drying-batches/{id}/cancel/ → abandon the cycle."""
        batch = self.get_object()
        try:
            updated = services.cancel_drying_batch(batch)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        audit("update", "drying_batch", updated.pk, updated.batch_no, {
            "action": "cancel",
            "status": updated.status,
            "product": updated.product.sku,
        })
        return Response(DryingBatchSerializer(updated).data)


class PaymentTransactionView(APIView):
    """GET /api/payments/ (filter ?client=) | POST record a receipt."""

    parser_classes = [JSONParser]

    def get(self, request):
        qs = Payment.objects.select_related("client", "sales_order").all()
        client_id = request.query_params.get("client")
        if client_id:
            qs = qs.filter(client_id=client_id)
        return Response(PaymentSerializer(qs[:200], many=True).data)

    def post(self, request):
        serializer = PaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            client = Client.objects.get(pk=data["client_id"], is_active=True)
        except Client.DoesNotExist:
            return Response({"detail": "Client introuvable ou inactif."}, status=status.HTTP_404_NOT_FOUND)

        sales_order = None
        if data.get("sales_order_id"):
            sales_order = SalesOrder.objects.filter(pk=data["sales_order_id"]).first()

        payment = services.create_payment(
            client,
            data["amount"],
            sales_order=sales_order,
            payment_date=data.get("payment_date"),
            method=data.get("method"),
            reference=data.get("reference"),
            note=data.get("note"),
        )
        audit("payment", "payment", payment.pk, f"PAY-{payment.pk}", {
            "client": client.code,
            "amount": str(payment.amount),
            "sales_order": sales_order.so_number if sales_order else None,
        })
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class PriceTierViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PriceTier.objects.filter(is_active=True)
    serializer_class = PriceTierSerializer
    pagination_class = None


class PricingLookupView(APIView):
    """GET /api/pricing/lookup/?volume_m3=25 → tier + discount preview."""

    def get(self, request):
        volume = request.query_params.get("volume_m3")
        try:
            volume = Decimal(volume)
        except (TypeError, ValueError):
            return Response({"detail": "volume_m3 requis (numérique)."}, status=status.HTTP_400_BAD_REQUEST)

        tier = services.resolve_tier(volume)
        discount_percent = tier.discount_percent if tier else ZERO
        subtotal = Decimal("1")  # per-m³ basis given by the client for the live preview
        discount_mad = services.apply_tier_discount(volume, discount_percent)
        payload = {
            "volume_m3": float(volume),
            "tier_id": tier.pk if tier else None,
            "tier_name": tier.name if tier else None,
            "discount_percent": float(discount_percent),
            "discount_mad": float(discount_mad),
            "discounted_total": float(volume),
            "rate": float(discount_percent / Decimal("100")) if discount_percent else 0.0,
        }
        return Response(PriceTierLookupSerializer(payload).data)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only, admin-only trail of user activity on the business data."""

    permission_classes = [IsAdminUser]
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        qs = AuditLog.objects.select_related("user").order_by("-created_at", "-id")
        params = self.request.query_params
        if params.get("action"):
            qs = qs.filter(action=params["action"])
        if params.get("entity_type"):
            qs = qs.filter(entity_type=params["entity_type"])
        if params.get("user"):
            qs = qs.filter(user__username__icontains=params["user"])
        if params.get("search"):
            qs = qs.filter(
                Q(entity_ref__icontains=params["search"])
                | Q(details__icontains=params["search"])
            )
        if params.get("from"):
            qs = qs.filter(created_at__date__gte=params["from"])
        if params.get("to"):
            qs = qs.filter(created_at__date__lte=params["to"])
        return qs


class LoginView(APIView):
    """Token login; records a ``login`` audit entry."""

    permission_classes = []  # login is public

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {"detail": "Identifiants invalides."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        token, _ = Token.objects.get_or_create(user=user)
        audit("login", "auth", user.pk, user.username)
        return Response(
            {
                "token": token.key,
                "user": {
                    "id": user.pk,
                    "username": user.username,
                    "is_staff": user.is_staff,
                },
            }
        )


class MeView(APIView):
    """Current authenticated user (so the UI can gate admin features)."""

    def get(self, request):
        u = request.user
        return Response(
            {
                "id": u.pk,
                "username": u.username,
                "email": u.email or "",
                "is_staff": u.is_staff,
                "is_superuser": u.is_superuser,
            }
        )


class LogoutView(APIView):
    def post(self, request):
        audit("logout", "auth", request.user.pk, request.user.username)
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Dashboard metrics
# ---------------------------------------------------------------------------
class DashboardView(APIView):
    def get(self, request):
        # Total standing volume & value across all warehouses.
        rows = (
            Inventory.objects.select_related("product")
            .values("product_id")
            .annotate(qty=Sum("quantity"))
        )
        total_volume = ZERO
        stock_value = ZERO
        for row in rows:
            product = Product.objects.filter(pk=row["product_id"]).first()
            if not product or product.volume_cubic_m is None:
                continue
            qty = row["qty"] or ZERO
            vol = product.volume_cubic_m * qty
            total_volume += vol
            stock_value += vol * (product.cost_price or ZERO)  # per m3 in MAD

        # Stock volume distribution grouped by wood species.
        species_qs = (
            Inventory.objects.filter(quantity__gt=0, product__volume_cubic_m__isnull=False)
            .values("product__wood_type__name", "product__category")
            .annotate(volume_m3=Sum(F("product__volume_cubic_m") * F("quantity")))
            .order_by("-volume_m3")
        )
        species_volume_raw = [
            {
                "name": row["product__wood_type__name"],
                "category": row["product__category"],
                "volume_m3": round(float(row["volume_m3"]), 4),
            }
            for row in species_qs
        ]
        _sv_map = {}
        for row in species_volume_raw:
            if row["name"]:
                label = row["name"]
            elif row["category"] in ("Panneaux", "Coffrage"):
                label = row["category"]
            else:
                label = "Autre"
            _sv_map[label] = round(_sv_map.get(label, 0) + row["volume_m3"], 4)
        species_volume = [
            {"name": name, "volume_m3": vol}
            for name, vol in sorted(_sv_map.items(), key=lambda x: -x[1])
        ]

        # Low stock items.
        low_stock = [
            p.pk
            for p in Product.objects.filter(is_active=True)
            if p.stock_status == "low" or p.stock_status == "out_of_stock"
        ]

        # Reorder alerts: active products whose standing volume (m³) is below
        # their reorder threshold, with a suggested restock quantity.
        reorder_alerts = []
        for p in Product.objects.filter(is_active=True, reorder_threshold_m3__gt=0):
            if not p.below_reorder:
                continue
            threshold = p.reorder_threshold_m3
            deficit = threshold - p.stock_volume_m3
            unit = p.volume_cubic_m or ZERO
            suggested = None
            if unit > 0:
                suggested = int(
                    max((deficit / unit).to_integral_value(rounding=ROUND_CEILING), Decimal("1"))
                )
            reorder_alerts.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "stock_m3": round(float(p.stock_volume_m3), 4),
                "threshold_m3": round(float(threshold), 4),
                "deficit_m3": round(float(deficit), 4),
                "suggested_qty": suggested,
            })
        reorder_alerts.sort(key=lambda a: a["deficit_m3"], reverse=True)

        # Monthly sales.
        now = timezone.localtime()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        monthly_sales = (
            SalesOrder.objects.filter(
                status__in=[SalesOrder.Status.SHIPPED, SalesOrder.Status.DELIVERED],
                created_at__gte=start_of_month,
            ).aggregate(total=Coalesce(Sum("total_amount"), ZERO))["total"]
            or ZERO
        )

        # Monthly sales trend (last 6 months, oldest first).
        shipped_statuses = [SalesOrder.Status.SHIPPED, SalesOrder.Status.DELIVERED]
        months_series = []
        for i in range(5, -1, -1):
            idx = now.year * 12 + (now.month - 1) - i
            y, mo = divmod(idx, 12)
            mo += 1
            start = datetime(y, mo, 1, tzinfo=now.tzinfo)
            end = datetime(y + 1, 1, 1, tzinfo=now.tzinfo) if mo == 12 else datetime(y, mo + 1, 1, tzinfo=now.tzinfo)
            total = (
                SalesOrder.objects.filter(
                    status__in=shipped_statuses,
                    created_at__gte=start,
                    created_at__lt=end,
                ).aggregate(t=Coalesce(Sum("total_amount"), ZERO))["t"]
                or ZERO
            )
            months_series.append({
                "month": start.strftime("%b %y"),
                "key": start.strftime("%Y-%m"),
                "total": round(float(total), 2),
            })

        # Top products by standing volume (m³).
        top_qs = (
            Inventory.objects.filter(quantity__gt=0, product__volume_cubic_m__isnull=False)
            .values("product_id", "product__name", "product__sku")
            .annotate(volume=Sum(F("product__volume_cubic_m") * F("quantity")))
            .filter(volume__isnull=False)
            .order_by("-volume")[:5]
        )
        top_products = [
            {
                "id": row["product_id"],
                "name": row["product__name"],
                "sku": row["product__sku"],
                "volume_m3": round(float(row["volume"]), 4),
            }
            for row in top_qs
        ]

        # Monthly movement balance (this calendar month).
        monthly_in = StockMovement.objects.filter(
            movement_type__in=[
                StockMovement.MovementType.PURCHASE_IN,
                StockMovement.MovementType.SALE_RETURN,
                StockMovement.MovementType.TRANSFER_IN,
            ],
            moved_at__gte=start_of_month,
        ).count()
        monthly_out = StockMovement.objects.filter(
            movement_type__in=[
                StockMovement.MovementType.SALE_OUT,
                StockMovement.MovementType.PURCHASE_RETURN,
                StockMovement.MovementType.TRANSFER_OUT,
            ],
            moved_at__gte=start_of_month,
        ).count()

        # Recent movements.
        recent = StockMovement.objects.select_related("product", "warehouse")[:10]

        return Response(
            {
                "total_volume_m3": round(float(total_volume), 4),
                "stock_value": round(float(stock_value), 2),
                "species_volume": species_volume,
                "low_stock_count": len(low_stock),
                "low_stock_ids": low_stock,
                "reorder_alerts": reorder_alerts,
                "monthly_sales": round(float(monthly_sales), 2),
                "product_count": Product.objects.filter(is_active=True).count(),
                "movement_count": StockMovement.objects.count(),
                "monthly_in": monthly_in,
                "monthly_out": monthly_out,
                "monthly_sales_series": months_series,
                "top_products": top_products,
                "recent_movements": StockMovementSerializer(recent, many=True).data,
            }
        )


# ---------------------------------------------------------------------------
# Archive views
# ---------------------------------------------------------------------------
MONTH_NAMES_FR = [
    "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]


class ArchiveMonthsView(APIView):
    """GET /api/archive/ → list of archived months with summaries."""

    def get(self, request):
        from django.db.models import Count

        months_raw = (
            MonthlyArchive.objects.values("year", "month")
            .annotate(
                product_count=Count("id", distinct=True),
                total_closing_qty=Sum("closing_qty"),
                total_closing_value=Sum("closing_value"),
                total_purchase_value=Sum("purchase_value"),
                total_sale_value=Sum("sale_value"),
                total_purchase_qty=Sum("purchase_qty"),
                total_sale_qty=Sum("sale_qty"),
            )
            .order_by("-year", "-month")
        )
        data = []
        for row in months_raw:
            data.append({
                "year": row["year"],
                "month": row["month"],
                "month_name": MONTH_NAMES_FR[row["month"]],
                "product_count": row["product_count"],
                "total_closing_qty": float(row["total_closing_qty"] or 0),
                "total_closing_value": float(row["total_closing_value"] or 0),
                "total_purchase_value": float(row["total_purchase_value"] or 0),
                "total_sale_value": float(row["total_sale_value"] or 0),
                "total_purchase_qty": float(row["total_purchase_qty"] or 0),
                "total_sale_qty": float(row["total_sale_qty"] or 0),
            })
        return Response(data)


class ArchiveMonthProductsView(APIView):
    """GET /api/archive/{year}/{month}/ → archived products for that month."""

    def get(self, request, year, month):
        warehouse = request.query_params.get("warehouse")
        category = request.query_params.get("category")
        search = request.query_params.get("search", "").strip()

        qs = MonthlyArchive.objects.filter(year=year, month=month).select_related(
            "product", "warehouse"
        )
        if warehouse:
            qs = qs.filter(warehouse_id=warehouse)
        if category:
            qs = qs.filter(product__category=category)
        if search:
            qs = qs.filter(
                Q(product__name__icontains=search) | Q(product__sku__icontains=search)
            )

        serializer = MonthlyArchiveSerializer(qs, many=True)
        return Response({
            "year": year,
            "month": month,
            "month_name": MONTH_NAMES_FR[month],
            "products": serializer.data,
        })


class ArchiveCloseView(APIView):
    """POST /api/archive/close/ → close a given month, creating snapshots.

    Body: { "year": 2026, "month": 8 }

    For each product-warehouse inventory row, creates a MonthlyArchive snapshot
    with closing balance and aggregates from movements in that month.
    """

    def post(self, request):
        year = request.data.get("year")
        month = request.data.get("month")
        if not year or not month:
            return Response(
                {"detail": "year and month are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            year = int(year)
            month = int(month)
            if month < 1 or month > 12:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {"detail": "Invalid year/month."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Date range for the month
        start = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end = date(year, month, last_day)
        start_dt = timezone.make_aware(datetime.combine(start, datetime.min.time()))
        end_dt = timezone.make_aware(datetime.combine(end, datetime.max.time()))

        # Check if already archived
        existing = MonthlyArchive.objects.filter(year=year, month=month).count()
        if existing > 0:
            return Response(
                {"detail": f"Month {year}-{month:02d} is already archived ({existing} rows)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get all products with inventory
        inventories = Inventory.objects.filter(quantity__gt=0).select_related("product", "warehouse")

        created = 0
        for inv in inventories:
            p = inv.product
            w = inv.warehouse

            # Movement aggregates for this month
            mvmts = StockMovement.objects.filter(
                product=p, warehouse=w,
                moved_at__gte=start_dt, moved_at__lte=end_dt,
            )
            agg = mvmts.aggregate(
                purchase_qty=Sum("quantity", filter=Q(movement_type="purchase_in")),
                purchase_value=Sum(
                    F("quantity") * F("unit_price"),
                    filter=Q(movement_type="purchase_in"),
                ),
                sale_qty=Sum("quantity", filter=Q(movement_type="sale_out")),
                sale_value=Sum(
                    F("quantity") * F("unit_price"),
                    filter=Q(movement_type="sale_out"),
                ),
                transfer_in_qty=Sum("quantity", filter=Q(movement_type="transfer_in")),
                transfer_out_qty=Sum("quantity", filter=Q(movement_type="transfer_out")),
                adjustment_qty=Sum("quantity", filter=Q(movement_type="adjustment")),
                opening_qty=Sum("quantity", filter=Q(movement_type="opening")),
            )

            MonthlyArchive.objects.create(
                year=year,
                month=month,
                product=p,
                warehouse=w,
                closing_qty=inv.quantity,
                closing_value=inv.quantity * (p.cost_price or ZERO),
                purchase_qty=agg["purchase_qty"] or ZERO,
                purchase_value=Decimal(str(agg["purchase_value"] or 0)),
                sale_qty=agg["sale_qty"] or ZERO,
                sale_value=Decimal(str(agg["sale_value"] or 0)),
                transfer_in_qty=agg["transfer_in_qty"] or ZERO,
                transfer_out_qty=agg["transfer_out_qty"] or ZERO,
                adjustment_qty=agg["adjustment_qty"] or ZERO,
                opening_qty=agg["opening_qty"] or ZERO,
            )
            created += 1

        audit("close_month", "monthly_archive", None, f"{year}-{month:02d}", {
            "rows_created": created,
        })
        return Response(
            {"detail": f"Month {year}-{month:02d} archived.", "rows_created": created}
        )


class CompanyProfileView(APIView):
    """GET / PATCH /api/company/ — identity printed on invoices & quotations."""

    def get(self, request):
        return Response(CompanyProfileSerializer(CompanyProfile.current()).data)

    def patch(self, request):
        profile = CompanyProfile.current()
        serializer = CompanyProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        audit("update", "company_profile", profile.pk, profile.name, {
            "fields": sorted(request.data.keys()),
        })
        return Response(serializer.data)