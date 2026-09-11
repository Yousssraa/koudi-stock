"""Public vitrine API — unauthenticated read access to the catalog plus the
quote (devis) / contact submission endpoint.

These views deliberately expose no cost price, margin or internal identifiers.
Stock level is surfaced only as a coarse ``stock_status`` ("in_stock" / "low" /
"out_of_stock") so the boutique can badge availability without leaking exact,
commercially sensitive quantities.
"""
from django.db.models import Count, Q
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .audit import audit
from .emails import notify_lead
from .models import CompanyProfile, Lead, Product, WoodType
from .pdfs import build_catalog_pdf
from .serializers import (
    PublicCategorySerializer,
    PublicLeadSerializer,
    PublicProductSerializer,
    PublicWoodTypeLightSerializer,
    PublicWoodTypeSerializer,
)

# The four umbrella families from the Comarbois-style catalog that group the
# essence data sheets on the boutique.
COMARBOIS_FAMILIES = {
    "Menuiserie & Agencement": "Menuiserie & Agencement",
    "Panneaux": "Panneaux",
    "Aménagement Int./Ext.": "Aménagement Int./Ext.",
    "Produits métallurgiques": "Produits métallurgiques",
}
FAMILY_ORDER = list(COMARBOIS_FAMILIES.values())

# Human-readable labels mirroring Product.Category choices (FR).
CATEGORY_LABELS = {
    "Bois rouge": "Bois rouges (pins nordiques)",
    "Bois blanc": "Bois blancs (épicéa)",
    "Bois exotique": "Bois exotiques",
    "Bois noble": "Bois nobles",
    "Panneaux": "Panneaux & dérivés",
    "Coffrage": "Coffrage & construction",
}

CATEGORY_ORDER = [
    "Bois rouge",
    "Bois blanc",
    "Bois exotique",
    "Bois noble",
    "Panneaux",
    "Coffrage",
]


class PublicCategoriesView(APIView):
    """GET /api/public/categories/ → active categories with product counts."""

    permission_classes = [AllowAny]

    def get(self, request):
        rows = (
            Product.objects.filter(is_active=True, category__isnull=False)
            .values("category")
            .annotate(count=Count("id"))
            .order_by("category")
        )
        by_key = {r["category"]: r["count"] for r in rows}
        data = [
            {
                "key": key,
                "label": CATEGORY_LABELS.get(key, key),
                "product_count": by_key.get(key, 0),
            }
            for key in CATEGORY_ORDER
            if key in by_key
        ]
        # Include any categories present in the data but not in the canonical order.
        for key in by_key:
            if key not in [d["key"] for d in data]:
                data.append(
                    {
                        "key": key,
                        "label": CATEGORY_LABELS.get(key, key),
                        "product_count": by_key[key],
                    }
                )
        return Response(PublicCategorySerializer(data, many=True).data)


class PublicEssencesView(APIView):
    """GET /api/public/essences/ → active essences grouped by Comarbois family.

    Each essence is returned light (name / family / category) so the vitrine can
    build the merged "Menuiserie & Agencement, Panneaux, Aménagement Int./Ext.,
    Produits métallurgiques" inventory, plus its ``product_count``.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        rows = (
            WoodType.objects.filter(is_active=True)
            .annotate(product_count=Count("product", filter=Q(product__is_active=True)))
            .order_by("name")
        )
        counts = {r.pk: r.product_count for r in rows}
        data = PublicWoodTypeLightSerializer(rows, many=True).data
        for item in data:
            item["product_count"] = counts.get(item["id"], 0)
        grouped = {fam: [] for fam in FAMILY_ORDER}
        for item in data:
            fam = item.get("comarbois_family") or "Aménagement Int./Ext."
            grouped.setdefault(fam, []).append(item)
        return Response(
            {
                "families": [
                    {"key": fam, "label": COMARBOIS_FAMILIES.get(fam, fam),
                     "essences": grouped.get(fam, [])}
                    for fam in FAMILY_ORDER
                ],
                "total": len(data),
            }
        )


class PublicEssenceDetailView(APIView):
    """GET /api/public/essences/<name>/ → full essence data sheet + its products.

    ``name`` is the essence (wood type) name (URL-encoded). Returns the fiche
    (provenances, humidité/durabilité, utilisations) plus every active product
    of that essence for the "produits associés" / range display.
    """

    permission_classes = [AllowAny]

    def get(self, request, name):
        wood_type = WoodType.objects.filter(name__iexact=name, is_active=True).first()
        if wood_type is None:
            # Try a fuzzy match (accent-insensitive fallback).
            wood_type = (
                WoodType.objects.filter(is_active=True)
                .filter(name__icontains=name)
                .order_by("id")
                .first()
            )
        if wood_type is None:
            return Response(
                {"detail": "Essence introuvable."}, status=status.HTTP_404_NOT_FOUND
            )
        products = (
            Product.objects.select_related("wood_type")
            .prefetch_related("inventory_set")
            .filter(is_active=True, wood_type=wood_type)
            .order_by("name")
        )
        return Response(
            {
                "essence": PublicWoodTypeSerializer(wood_type).data,
                "products": PublicProductSerializer(products, many=True).data,
            }
        )


class PublicProductsView(APIView):
    """GET /api/public/products/ → active products for the boutique.

    Query params: ``category`` (exact key), ``search``, ``species`` (wood type
    name substring), ``in_stock`` ("1" to hide out-of-stock items).
    """

    permission_classes = [AllowAny]

    def get(self, request):
        params = request.query_params
        qs = (
            Product.objects.select_related("wood_type")
            .prefetch_related("inventory_set")
            .filter(is_active=True)
            .order_by("name")
        )
        if params.get("category"):
            qs = qs.filter(category=params["category"])
        if params.get("species"):
            qs = qs.filter(wood_type__name__icontains=params["species"])
        if params.get("search"):
            q = params["search"]
            qs = qs.filter(Q(name__icontains=q) | Q(sku__icontains=q))
        if params.get("in_stock") == "1":
            qs = qs.filter(
                inventory__quantity__gt=0, inventory__warehouse__is_active=True
            ).distinct()
        if params.get("limit"):
            try:
                qs = qs[: max(1, int(params["limit"]))]
            except (TypeError, ValueError):
                pass
        return Response(PublicProductSerializer(qs, many=True).data)


class PublicProductDetailView(APIView):
    """GET /api/public/products/{id}/ → single product for the detail page."""

    permission_classes = [AllowAny]

    def get(self, request, pk):
        product = (
            Product.objects.select_related("wood_type")
            .prefetch_related("inventory_set")
            .filter(pk=pk, is_active=True)
            .first()
        )
        if product is None:
            return Response(
                {"detail": "Produit introuvable."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(PublicProductSerializer(product).data)


class PublicCompanyView(APIView):
    """GET /api/public/company/ → public company identity (no bank / RIB)."""

    permission_classes = [AllowAny]

    def get(self, request):
        profile = CompanyProfile.current()
        return Response(
            {
                "name": profile.name,
                "tagline": profile.tagline,
                "address": profile.address,
                "phone": profile.phone,
                "email": profile.email,
                "ice": profile.ice,
                "registre_commerce": profile.registre_commerce,
                "identifiant_fiscal": profile.identifiant_fiscal or None,
                "patente": profile.patente or None,
                "cnss": profile.cnss or None,
            }
        )


class PublicLeadView(APIView):
    """POST /api/public/leads/ → capture a devis or contact request.

    Body (kind="devis" or "contact"):
    {
      "kind": "devis",
      "name": "…", "email": "…", "phone": "…", "company": "…", "city": "…",
      "subject": "…", "message": "…",
      "requested_lines": [ { "sku": "…", "name": "…", "quantity": "10 m³" } ]
    }
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PublicLeadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        lead = Lead.objects.create(
            kind=data["kind"],
            name=data["name"],
            company=data.get("company") or None,
            email=data["email"],
            phone=data.get("phone") or None,
            city=data.get("city") or None,
            subject=data.get("subject") or None,
            message=data.get("message") or None,
            requested_lines=data.get("requested_lines") or [],
        )
        audit(
            "create",
            "lead",
            lead.pk,
            f"{lead.kind}:{lead.email}",
            {
                "kind": lead.kind,
                "name": lead.name,
                "company": lead.company,
                "email": lead.email,
                "phone": lead.phone,
                "requested_lines": lead.requested_lines,
            },
        )
        # Notify the company by e-mail (deliverability depends on SMTP settings).
        notify_lead(lead)
        return Response({"id": lead.pk, "status": "received"}, status=status.HTTP_201_CREATED)


class PublicCatalogView(APIView):
    """GET /api/public/catalog.pdf/ → downloadable PDF catalog of active products.

    Products are grouped by category and priced per m³ (or m² for panels).
    No cost price, margin or internal stock is exposed.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        qs = (
            Product.objects.select_related("wood_type")
            .prefetch_related("inventory_set")
            .filter(is_active=True)
            .order_by("name")
        )
        grouped = {}
        for p in qs:
            grouped.setdefault(p.category, []).append(p)

        label = dict(Product.Category.choices)
        groups = [(label.get(k, k), v) for k, v in grouped.items()]

        payload = build_catalog_pdf(list(qs), groups)
        filename = "KOUDI-WOOD-Catalogue.pdf"
        return HttpResponse(
            payload, content_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

