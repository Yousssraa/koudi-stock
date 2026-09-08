"""Espace Pro — Client portal API views.

This module exposes a dedicated authenticated surface for professional
clients. It is separate from the internal back-office so clients only ever
see their own data (quotes, orders, invoices, credit, catalog).
"""
from decimal import Decimal

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import parsers

from . import pdfs, services
from .audit import audit
from .models import (
    Client,
    ClientNotification,
    ClientUser,
    CreditNote,
    Payment,
    Product,
    Quote,
    QuoteItem,
    SalesOrder,
    compute_volume_m3,
)
from .serializers import (
    ClientNotificationSerializer,
    ClientProfileSerializer,
    CreditNoteSerializer,
    ProPaymentSerializer,
    ProProductSerializer,
    ProSalesOrderSerializer,
    QuoteCreateSerializer,
    QuoteItemSerializer,
    QuoteSerializer,
)

ZERO = Decimal("0")


def _pdf_response(pdf_bytes, filename):
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _quote_line_total(product, quantity, unit_price):
    """Timber is priced per cubic metre: line total = volume (m³) × sales price."""
    volume = compute_volume_m3(
        product.thickness_mm, product.width_mm, product.length_m, quantity
    ) or ZERO
    return (volume * unit_price).quantize(Decimal("0.0001"))


def _fr(n, digits=2):
    """Decimal → French-formatted number (e.g. 1 234,56)."""
    s = f"{Decimal(str(n)):.{digits}f}"
    int_part, _, dec_part = s.partition(".")
    int_part = f"{int(int_part):,}".replace(",", " ") if int_part else "0"
    return f"{int_part},{dec_part}" if dec_part else int_part


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_client_from_user(user):
    try:
        cu = ClientUser.objects.select_related("client").get(user=user)
        return cu.client
    except ClientUser.DoesNotExist:
        return None


def _require_client(request):
    client = _get_client_from_user(request.user)
    if client is None:
        return None, Response(
            {"detail": "Ce compte n'est pas rattaché à un client professionnel."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if not client.is_active:
        return None, Response(
            {"detail": "Ce compte client est inactif. Contactez l'administration."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return client, None


def _only_primary(request):
    """Restrict account-management actions to the primary portal user."""
    try:
        return request.user.client_profile.is_primary
    except ClientUser.DoesNotExist:
        return False


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
class ProLoginView(APIView):
    """POST /api/pro/auth/login/ → token login for portal users.

    Body: { "username": "...", "password": "..." }
    Only users linked to a professional client can log in here.
    """

    permission_classes = []
    parser_classes = [parsers.JSONParser]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {"detail": "Identifiants invalides."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client = _get_client_from_user(user)
        if client is None:
            return Response(
                {"detail": "Ce compte n'est pas autorisé à accéder à l'Espace Pro."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not client.is_active:
            return Response(
                {"detail": "Ce compte client est inactif."},
                status=status.HTTP_403_FORBIDDEN,
            )

        token, _ = Token.objects.get_or_create(user=user)
        audit("login", "pro_auth", user.pk, user.username)
        return Response(
            {
                "token": token.key,
                "user": {
                    "id": user.pk,
                    "username": user.username,
                    "email": user.email or "",
                    "client_id": client.pk,
                    "company_name": client.company_name,
                    "is_primary": ClientUser.objects.filter(
                        user=user, is_primary=True
                    ).exists(),
                },
            }
        )


class ProLogoutView(APIView):
    """POST /api/pro/auth/logout/ → revoke the current portal token."""

    def post(self, request):
        audit("logout", "pro_auth", request.user.pk, request.user.username)
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProMeView(APIView):
    """GET /api/pro/auth/me/ → current portal user + linked client profile."""

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err
        return Response(
            {
                "id": request.user.pk,
                "username": request.user.username,
                "email": request.user.email or "",
                "is_primary": ClientUser.objects.filter(
                    user=request.user, is_primary=True
                ).exists(),
                "client": ClientProfileSerializer(client).data,
            }
        )


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class ProDashboardView(APIView):
    """GET /api/pro/dashboard/ → client-facing KPIs."""

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err

        credit = services.client_credit_summary(client)

        shipped = SalesOrder.objects.filter(
            client=client,
            status__in=[
                SalesOrder.Status.CONFIRMED,
                SalesOrder.Status.PARTIALLY_SHIPPED,
                SalesOrder.Status.SHIPPED,
                SalesOrder.Status.DELIVERED,
            ],
        )

        quotes = Quote.objects.filter(client=client)
        orders = SalesOrder.objects.filter(client=client)
        payments = Payment.objects.filter(client=client, payment_date__isnull=False)

        # Recent orders (delivery tracking)
        recent_orders = orders.order_by("-order_date")[:5]

        total_invoiced = sum((o.total_amount or ZERO for o in shipped), ZERO)
        total_paid = sum((p.amount or ZERO for p in payments), ZERO)
        total_quotes = quotes.count()
        pending_quotes = quotes.filter(status=Quote.Status.SENT).count()
        open_orders = orders.exclude(
            status__in=[
                SalesOrder.Status.CANCELLED,
                SalesOrder.Status.DELIVERED,
            ]
        ).count()

        # Delivery notes for this client
        from .models import DeliveryNote
        deliveries = DeliveryNote.objects.filter(client=client).order_by("-order_date")[:5]

        return Response(
            {
                "company": ClientProfileSerializer(client).data,
                "credit": {
                    "limit": float(credit["credit_limit"]),
                    "outstanding": float(credit["outstanding"]),
                    "overdue": float(credit["overdue"]),
                    "available_credit": float(credit["available_credit"]),
                    "credit_used_pct": credit["credit_used_pct"],
                    "is_blocked": client.is_blocked,
                    "payment_terms_days": credit["payment_terms_days"],
                },
                "summary": {
                    "total_invoiced": round(float(total_invoiced), 2),
                    "total_paid": round(float(total_paid), 2),
                    "balance_due": round(float(total_invoiced - total_paid), 2),
                    "total_quotes": total_quotes,
                    "pending_quotes": pending_quotes,
                    "open_orders": open_orders,
                },
                "recent_orders": ProSalesOrderSerializer(recent_orders, many=True).data,
                "recent_deliveries": [
                    {
                        "bl_number": d.bl_number,
                        "status": d.status,
                        "order_date": d.order_date.isoformat(),
                        "total_volume_m3": round(float(d.total_volume_m3), 4),
                    }
                    for d in deliveries
                ],
                "notifications": ClientNotificationSerializer(
                    ClientNotification.objects.filter(client=client, is_read=False)[:5],
                    many=True,
                ).data,
            }
        )


class ProNotificationsView(APIView):
    """GET /api/pro/notifications/ → list notifications (optionally unread only)."""

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err
        qs = ClientNotification.objects.filter(client=client)
        unread = request.query_params.get("unread")
        if unread in ("1", "true"):
            qs = qs.filter(is_read=False)
        return Response(ClientNotificationSerializer(qs[:50], many=True).data)


class ProNotificationMarkReadView(APIView):
    """POST /api/pro/notifications/{id}/read/ → mark a notification as read."""

    def post(self, request, pk=None):
        client, err = _require_client(request)
        if err:
            return err
        notif = ClientNotification.objects.filter(pk=pk, client=client).first()
        if notif is None:
            return Response(
                {"detail": "Notification introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response(ClientNotificationSerializer(notif).data)


# ---------------------------------------------------------------------------
# Quotes / Devis
# ---------------------------------------------------------------------------
class ProQuoteListView(APIView):
    """GET /api/pro/quotes/ → list the client's quotes.

    Filters: ?status=draft|sent|accepted|rejected|expired
    """

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err
        qs = Quote.objects.filter(client=client).prefetch_related("items__product")
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(QuoteSerializer(qs, many=True).data)


class ProQuoteCreateView(APIView):
    """POST /api/pro/quotes/ → create a new draft quote with items.

    Body:
    {
      "notes": "...",
      "valid_until": "2026-12-31",
      "items": [ { "product_id": 5, "quantity": 40, "unit_price"?: 3200 } ]
    }
    If ``unit_price`` is omitted, the product's current sale price is used.
    """

    parser_classes = [parsers.JSONParser]

    def post(self, request):
        client, err = _require_client(request)
        if err:
            return err

        serializer = QuoteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Build items with prices resolved against the live catalog.
        items = []
        subtotal = ZERO
        for it in data["items"]:
            product = Product.objects.filter(pk=it["product_id"], is_active=True).first()
            if product is None:
                return Response(
                    {"detail": f"Produit {it['product_id']} introuvable ou inactif."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            qty = it["quantity"]
            unit_price = it.get("unit_price") or product.sale_price or ZERO
            line_total = _quote_line_total(product, qty, unit_price)
            subtotal += line_total
            items.append(
                {
                    "product": product,
                    "quantity": qty,
                    "unit_price": unit_price,
                    "line_total": line_total,
                    "notes": it.get("notes"),
                }
            )

        quote = Quote.objects.create(
            quote_number=_next_quote_number(),
            client=client,
            created_by=request.user,
            status=Quote.Status.DRAFT,
            subtotal=subtotal,
            total_amount=subtotal,
            currency="MAD",
            notes=data.get("notes"),
            valid_until=data.get("valid_until"),
        )
        for it in items:
            QuoteItem.objects.create(quote=quote, **it)

        audit("create", "quote", quote.pk, quote.quote_number, {
            "client": client.code,
            "status": quote.status,
            "items": [{"sku": i["product"].sku, "quantity": str(i["quantity"])} for i in items],
        })

        ClientNotification.objects.create(
            client=client,
            user=request.user,
            kind=ClientNotification.Kind.QUOTE_UPDATE,
            title="Nouveau devis",
            message=f"Votre devis {quote.quote_number} a été créé.",
            link="/pro/devis",
        )

        return Response(QuoteSerializer(quote).data, status=status.HTTP_201_CREATED)


class ProQuoteDetailView(APIView):
    """GET/PATCH/DELETE /api/pro/quotes/{pk}/ → manage a single draft quote.

    A draft can be updated (items replaced) and deleted by its creator.
    """

    def _get_quote(self, request, pk):
        return _get_client_quote(request, pk)

    def get(self, request, pk=None):
        _, quote, err = self._get_quote(request, pk)
        if err:
            return err
        return Response(QuoteSerializer(quote).data)

    def delete(self, request, pk=None):
        client, quote, err = self._get_quote(request, pk)
        if err:
            return err
        if quote.status != Quote.Status.DRAFT:
            return Response(
                {"detail": "Seul un devis en brouillon peut être supprimé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        quote.delete()
        audit("delete", "quote", quote.pk, quote.quote_number, {"client": client.code})
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, pk=None):
        """Update quote header fields (notes / valid_until) for a draft."""
        client, quote, err = self._get_quote(request, pk)
        if err:
            return err
        if quote.status != Quote.Status.DRAFT:
            return Response(
                {"detail": "Seul un devis en brouillon peut être modifié."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if "notes" in request.data:
            quote.notes = request.data["notes"]
        if "valid_until" in request.data:
            quote.valid_until = request.data["valid_until"]
        quote.save()
        return Response(QuoteSerializer(quote).data)


class ProQuoteItemsView(APIView):
    """PATCH /api/pro/quotes/{pk}/items/ → replace the items of a draft quote."""

    parser_classes = [parsers.JSONParser]

    def patch(self, request, pk=None):
        client, quote, err = _get_client_quote(request, pk)
        if err:
            return err
        if quote.status != Quote.Status.DRAFT:
            return Response(
                {"detail": "Seul un devis en brouillon peut être modifié."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = QuoteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        subtotal = ZERO
        quote.items.all().delete()
        for it in data["items"]:
            product = Product.objects.filter(pk=it["product_id"], is_active=True).first()
            if product is None:
                return Response(
                    {"detail": f"Produit {it['product_id']} introuvable ou inactif."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            qty = it["quantity"]
            unit_price = it.get("unit_price") or product.sale_price or ZERO
            line_total = _quote_line_total(product, qty, unit_price)
            subtotal += line_total
            QuoteItem.objects.create(
                quote=quote,
                product=product,
                quantity=qty,
                unit_price=unit_price,
                line_total=line_total,
                notes=it.get("notes"),
            )
        quote.subtotal = subtotal
        quote.total_amount = subtotal
        quote.save()
        return Response(QuoteSerializer(quote).data)


class ProQuoteSubmitView(APIView):
    """POST /api/pro/quotes/<pk>/submit/ → send a draft request to the team.

    A submitted quote becomes ``sent`` and can no longer be edited/deleted by
    the client; the back-office picks it up for processing.
    """

    def post(self, request, pk=None):
        client, quote, err = _get_client_quote(request, pk)
        if err:
            return err
        if quote.status != Quote.Status.DRAFT:
            return Response(
                {"detail": "Seul un devis en brouillon peut être soumis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        quote.status = Quote.Status.SENT
        quote.save(update_fields=["status", "updated_at"])
        audit("submit", "quote", quote.pk, quote.quote_number, {"client": client.code})

        ClientNotification.objects.create(
            client=client,
            user=request.user,
            kind=ClientNotification.Kind.QUOTE_UPDATE,
            title="Devis envoyé",
            message=f"Votre demande {quote.quote_number} a bien été transmise à notre équipe.",
            link="/pro/devis",
        )
        return Response(QuoteSerializer(quote).data)


class ProQuoteRespondView(APIView):
    """POST /api/pro/quotes/<pk>/accept|reject/ → answer a submitted quote.

    Accepting a quote signals our team to prepare the order; rejecting closes
    the request. Only ``sent`` quotes can be answered.
    """

    parser_classes = [parsers.JSONParser]

    def post(self, request, pk=None, action=None):
        client, quote, err = _get_client_quote(request, pk)
        if err:
            return err
        if quote.status != Quote.Status.SENT:
            return Response(
                {"detail": "Seuls les devis envoyés peuvent être acceptés ou refusés."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action == "accept":
            quote.status = Quote.Status.ACCEPTED
            quote.save(update_fields=["status", "updated_at"])
            audit("accept", "quote", quote.pk, quote.quote_number, {"client": client.code})
            ClientNotification.objects.create(
                client=client,
                user=request.user,
                kind=ClientNotification.Kind.QUOTE_UPDATE,
                title="Devis accepté",
                message=f"Merci ! Notre équipe va transformer votre devis {quote.quote_number} en commande.",
                link="/pro/commandes",
            )
            return Response(QuoteSerializer(quote).data)

        if action == "reject":
            quote.status = Quote.Status.REJECTED
            quote.save(update_fields=["status", "updated_at"])
            audit("reject", "quote", quote.pk, quote.quote_number, {"client": client.code})
            ClientNotification.objects.create(
                client=client,
                user=request.user,
                kind=ClientNotification.Kind.QUOTE_UPDATE,
                title="Devis refusé",
                message=f"Votre devis {quote.quote_number} a été clôturé.",
                link="/pro/devis",
            )
            return Response(QuoteSerializer(quote).data)

        return Response(
            {"detail": "Action inconnue."}, status=status.HTTP_400_BAD_REQUEST
        )


def _next_quote_number():
    from django.utils import timezone
    return timezone.localtime().strftime("QT%Y%m%d%H%M%S")


def _get_client_quote(request, pk):
    """Fetch a quote owned by the requesting client (None-safe)."""
    client, err = _require_client(request)
    if err:
        return None, None, err
    quote = Quote.objects.filter(pk=pk, client=client).prefetch_related(
        "items__product"
    ).first()
    if quote is None:
        return None, None, Response(
            {"detail": "Devis introuvable."}, status=status.HTTP_404_NOT_FOUND
        )
    return client, quote, None


# ---------------------------------------------------------------------------
# Orders / Commandes
# ---------------------------------------------------------------------------
class ProOrderListView(APIView):
    """GET /api/pro/orders/ → list the client's sales orders."""

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err
        qs = (
            SalesOrder.objects.filter(client=client)
            .prefetch_related("items__product")
            .select_related("warehouse")
        )
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(ProSalesOrderSerializer(qs, many=True).data)


class ProOrderDetailView(APIView):
    """GET /api/pro/orders/{pk}/ → a single client order with items."""

    def get(self, request, pk=None):
        client, err = _require_client(request)
        if err:
            return err
        order = (
            SalesOrder.objects.filter(pk=pk, client=client)
            .prefetch_related("items__product")
            .select_related("warehouse")
            .first()
        )
        if order is None:
            return Response(
                {"detail": "Commande introuvable."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(ProSalesOrderSerializer(order).data)


# ---------------------------------------------------------------------------
# Invoices / Factures & Payments
# ---------------------------------------------------------------------------
class ProInvoiceListView(APIView):
    """GET /api/pro/invoices/ → the client's shipped orders (invoices)."""

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err
        qs = (
            SalesOrder.objects.filter(
                client=client,
                status__in=[
                    SalesOrder.Status.SHIPPED,
                    SalesOrder.Status.DELIVERED,
                ],
            )
            .select_related("warehouse")
            .prefetch_related(
                "items__product",
                "delivery_notes",
                "credit_notes",
                "payments",
            )
            .order_by("-order_date")
        )
        return Response(ProSalesOrderSerializer(qs, many=True).data)


class ProInvoicePdfView(APIView):
    """GET /api/pro/invoices/<pk>/pdf/ → the client's legal A4 invoice PDF."""

    def get(self, request, pk=None):
        client, err = _require_client(request)
        if err:
            return err
        so = (
            SalesOrder.objects.filter(
                pk=pk,
                client=client,
                status__in=[
                    SalesOrder.Status.SHIPPED,
                    SalesOrder.Status.DELIVERED,
                ],
            )
            .select_related("client", "warehouse")
            .prefetch_related("delivery_notes", "credit_notes", "payments", "items__product")
            .first()
        )
        if so is None:
            return Response({"detail": "Facture introuvable."}, status=status.HTTP_404_NOT_FOUND)
        audit("download", "sales_order", so.pk, so.so_number, {"document": "invoice", "portal": "pro"})
        return _pdf_response(pdfs.build_invoice_pdf(so), f"{so.so_number}_FACTURE.pdf")


class ProAvoirListView(APIView):
    """GET /api/pro/avoirs/ → the client's Factures d'Avoir (credit notes)."""

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err
        notes = (
            CreditNote.objects.filter(client=client)
            .select_related("sales_order", "delivery_note")
            .order_by("-created_date", "-id")
        )
        return Response(CreditNoteSerializer(notes[:100], many=True).data)


class ProAvoirPdfView(APIView):
    """GET /api/pro/avoirs/<pk>/pdf/ → the client's Facture d'Avoir PDF."""

    def get(self, request, pk=None):
        client, err = _require_client(request)
        if err:
            return err
        cn = (
            CreditNote.objects.filter(pk=pk, client=client)
            .select_related("sales_order")
            .first()
        )
        if cn is None:
            return Response({"detail": "Avoir introuvable."}, status=status.HTTP_404_NOT_FOUND)
        audit("download", "credit_note", cn.pk, cn.credit_note_number, {"document": "credit_note", "portal": "pro"})
        return _pdf_response(pdfs.build_credit_note_pdf(cn), f"{cn.credit_note_number}_AVOIR.pdf")


class ProPaymentListView(APIView):
    """GET /api/pro/payments/ → the client's payment history."""

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err
        payments = Payment.objects.filter(client=client).select_related("sales_order")
        return Response(ProPaymentSerializer(payments, many=True).data)


# ---------------------------------------------------------------------------
# Credit / Solde
# ---------------------------------------------------------------------------
class ProCreditView(APIView):
    """GET /api/pro/credit/ → the client's credit summary."""

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err
        credit = services.client_credit_summary(client)

        # Open balances per order for a detailed statement.
        statement = []
        shipped = SalesOrder.objects.filter(
            client=client,
            status__in=[
                SalesOrder.Status.CONFIRMED,
                SalesOrder.Status.PARTIALLY_SHIPPED,
                SalesOrder.Status.SHIPPED,
                SalesOrder.Status.DELIVERED,
            ],
        ).order_by("order_date")
        for so in shipped:
            statement.append(
                {
                    "so_number": so.so_number,
                    "order_date": so.order_date.isoformat(),
                    "total_amount": float(so.total_amount),
                    "paid": float(so.paid_amount),
                    "balance": float(so.balance_due),
                }
            )

        return Response(
            {
                "credit_limit": float(credit["credit_limit"]),
                "outstanding": float(credit["outstanding"]),
                "overdue": float(credit["overdue"]),
                "available_credit": float(credit["available_credit"]),
                "credit_used_pct": credit["credit_used_pct"],
                "over_limit": credit["over_limit"],
                "is_blocked": client.is_blocked,
                "payment_terms_days": credit["payment_terms_days"],
                "statement": statement,
            }
        )


# ---------------------------------------------------------------------------
# Loyalty / Clients fidèles
# ---------------------------------------------------------------------------
class ProLoyaltyView(APIView):
    """GET /api/pro/loyalty/ → the client's loyalty status + scorecard.

    Four criteria decide the « client fidèle » badge:
      1. Volume d'achats : volume commandé (m³) au-dessus du seuil.
      2. Nombre de commandes : commandes facturées (confirmées et après).
      3. Paiements ponctuels : factures réglées à l'échéance, aucun retard.
      4. Aucun devis refusé : aucun devis au statut « refusé ».

    The payload also includes the client's complete dossier (recent quotes,
    orders, invoices and payments) for a self-service file.
    """

    MIN_VOLUME_M3 = Decimal("3")
    MIN_ORDERS = 3

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err

        today = timezone.localdate()
        from .models import compute_volume_m3
        from .services import _SHIPPED_STATUSES, _so_due_date

        invoiced = list(
            SalesOrder.objects.filter(client=client, status__in=_SHIPPED_STATUSES)
            .order_by("-order_date")
            .select_related("warehouse")
            .prefetch_related("items__product", "payments")
        )

        volume = ZERO
        overdue = ZERO
        on_time = 0  # invoices fully settled by their due date
        settled = 0  # invoices fully settled to date
        total_invoiced = ZERO
        total_paid = ZERO
        for so in invoiced:
            total_invoiced += so.total_amount or ZERO
            paid_so = so.paid_amount
            total_paid += paid_so
            for item in so.items.all():
                volume += (
                    compute_volume_m3(
                        item.product.thickness_mm,
                        item.product.width_mm,
                        item.product.length_m,
                        item.quantity_ordered,
                    )
                    or ZERO
                )
            due = _so_due_date(so, client)
            paid_by_due = sum(
                (p.amount or ZERO)
                for p in so.payments.all()
                if p.payment_date and p.payment_date <= due
            )
            if paid_so >= (so.total_amount or ZERO):
                settled += 1
                if paid_by_due >= (so.total_amount or ZERO):
                    on_time += 1
            if (so.balance_due or ZERO) > services.PAYMENT_EPSILON and due < today:
                overdue += so.balance_due

        quotes = Quote.objects.filter(client=client)
        rejected = quotes.filter(status=Quote.Status.REJECTED).count()
        accepted = quotes.filter(status=Quote.Status.ACCEPTED).count()

        criteria = [
            {
                "key": "volume",
                "label": "Volume d'achats",
                "met": volume >= self.MIN_VOLUME_M3,
                "detail": f"{_fr(volume)} m³ commandés (minimum {_fr(self.MIN_VOLUME_M3)})",
                "value": round(float(volume), 2),
                "target": float(self.MIN_VOLUME_M3),
            },
            {
                "key": "orders",
                "label": "Nombre de commandes",
                "met": len(invoiced) >= self.MIN_ORDERS,
                "detail": f"{len(invoiced)} commande(s) facturée(s) (minimum {self.MIN_ORDERS})",
                "value": len(invoiced),
                "target": self.MIN_ORDERS,
            },
            {
                "key": "on_time",
                "label": "Paiements ponctuels",
                "met": overdue == 0 and on_time == settled,
                "detail": (
                    f"{on_time} sur {settled} facture(s) réglée(s) à l'échéance"
                    if settled
                    else "Aucune facture réglée"
                ),
                "value": on_time,
                "target": max(settled, 1),
            },
            {
                "key": "no_rejected",
                "label": "Aucun devis refusé",
                "met": rejected == 0,
                "detail": (
                    "Aucun devis refusé"
                    if rejected == 0
                    else f"{rejected} devis refusé(s)"
                ),
                "value": rejected,
                "target": 1,
            },
        ]

        met_count = sum(1 for c in criteria if c["met"])
        if client.is_blocked:
            status_key, status_label = "a_risque", "Client à risque"
        elif met_count == 4:
            status_key, status_label = "fidele", "Client Fidèle"
        elif invoiced or accepted:
            status_key, status_label = "actif", "Client actif"
        else:
            status_key, status_label = "nouveau", "Nouveau client"

        since = invoiced[0].order_date if invoiced else client.created_at.date()

        return Response(
            {
                "status": status_key,
                "status_label": status_label,
                "is_loyal": met_count == 4,
                "since": since.isoformat(),
                "criteria": criteria,
                "stats": {
                    "invoiced_volume_m3": round(float(volume), 2),
                    "total_invoiced": round(float(total_invoiced), 2),
                    "total_paid": round(float(total_paid), 2),
                    "outstanding": round(float(total_invoiced - total_paid), 2),
                    "overdue": round(float(overdue), 2),
                    "order_count": len(invoiced),
                    "rejected_quotes": rejected,
                    "accepted_quotes": accepted,
                    "on_time_settled": on_time,
                    "settled": settled,
                },
                "recent_quotes": QuoteSerializer(
                    quotes.prefetch_related("items__product")[:5], many=True
                ).data,
                "recent_orders": ProSalesOrderSerializer(
                    SalesOrder.objects.filter(client=client)
                    .select_related("warehouse")
                    .prefetch_related("items__product", "payments")
                    .order_by("-order_date")[:5],
                    many=True,
                ).data,
                "recent_invoices": ProSalesOrderSerializer(
                    SalesOrder.objects.filter(
                        client=client,
                        status__in=[
                            SalesOrder.Status.SHIPPED,
                            SalesOrder.Status.DELIVERED,
                        ],
                    )
                    .select_related("warehouse")
                    .prefetch_related("items__product")
                    .order_by("-order_date")[:5],
                    many=True,
                ).data,
                "recent_payments": ProPaymentSerializer(
                    Payment.objects.filter(client=client)
                    .select_related("sales_order")
                    .order_by("-payment_date")[:5],
                    many=True,
                ).data,
            }
        )


# ---------------------------------------------------------------------------
# Catalog / Tarifs
# ---------------------------------------------------------------------------
class ProCatalogView(APIView):
    """GET /api/pro/catalog/ → active products with pro prices.

    Filters: ?category=, ?wood_type=, ?search=, ?piece_type=
    """

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err

        qs = Product.objects.filter(is_active=True).select_related("wood_type")
        params = request.query_params

        category = params.get("category")
        if category:
            qs = qs.filter(category__iexact=category)

        wood_type = params.get("wood_type")
        if wood_type:
            qs = qs.filter(wood_type_id=wood_type)

        piece_type = params.get("piece_type")
        if piece_type:
            qs = qs.filter(piece_type=piece_type)

        search = params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(sku__icontains=search)
                | Q(wood_type__name__icontains=search)
            )

        qs = qs.prefetch_related("inventory_set")[:500]
        return Response(ProProductSerializer(qs, many=True).data)


class ProPriceTierView(APIView):
    """GET /api/pro/tiers/ → the volume discount brackets shown to clients."""

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err
        from .models import PriceTier

        tiers = PriceTier.objects.filter(is_active=True).order_by("min_volume_m3")
        return Response(
            [
                {
                    "name": t.name,
                    "min_volume_m3": float(t.min_volume_m3),
                    "max_volume_m3": float(t.max_volume_m3) if t.max_volume_m3 is not None else None,
                    "discount_percent": float(t.discount_percent),
                }
                for t in tiers
            ]
        )


# ---------------------------------------------------------------------------
# Client profile (contact details)
# ---------------------------------------------------------------------------
class ProProfileView(APIView):
    """GET / PATCH /api/pro/profile/ → the client's contact details.

    Clients update their own contact info but not their credit terms (which
    are set by the back-office).
    """

    parser_classes = [parsers.JSONParser]

    ALLOWED = {
        "company_name", "contact_name", "email", "phone",
        "address", "tax_id",
    }

    def get(self, request):
        client, err = _require_client(request)
        if err:
            return err
        return Response(ClientProfileSerializer(client).data)

    def patch(self, request):
        client, err = _require_client(request)
        if err:
            return err
        data = {k: v for k, v in request.data.items() if k in self.ALLOWED}
        for k, v in data.items():
            setattr(client, k, v)
        client.save()
        audit("update", "client_profile", client.pk, client.code, {
            "fields": sorted(data.keys()),
        })
        return Response(ClientProfileSerializer(client).data)
