"""API URL routes for the stock app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"wood-types", views.WoodTypeViewSet, basename="wood-type")
router.register(r"warehouses", views.WarehouseViewSet, basename="warehouse")
router.register(r"products", views.ProductViewSet, basename="product")
router.register(r"inventory", views.InventoryViewSet, basename="inventory")
router.register(r"stock-movements", views.StockMovementViewSet, basename="stock-movement")
router.register(r"suppliers", views.SupplierViewSet, basename="supplier")
router.register(r"clients", views.ClientViewSet, basename="client")
router.register(r"purchase-orders", views.PurchaseOrderViewSet, basename="purchase-order")
router.register(r"sales-orders", views.SalesOrderViewSet, basename="sales-order")
router.register(r"audit", views.AuditLogViewSet, basename="audit")
router.register(r"drying-batches", views.DryingBatchViewSet, basename="drying-batch")
router.register(r"kilns", views.KilnViewSet, basename="kiln")
router.register(r"price-tiers", views.PriceTierViewSet, basename="price-tier")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/login/", views.LoginView.as_view(), name="api-login"),
    path("auth/logout/", views.LogoutView.as_view(), name="api-logout"),
    path("auth/me/", views.MeView.as_view(), name="api-me"),
    path("purchases/", views.PurchaseTransactionView.as_view(), name="purchase-transaction"),
    path("sales/", views.SaleTransactionView.as_view(), name="sale-transaction"),
    path("transfers/", views.TransferView.as_view(), name="transfer"),
    path("reorders/", views.ReorderView.as_view(), name="reorder"),
    path("payments/", views.PaymentTransactionView.as_view(), name="payment-transaction"),
    path("pricing/lookup/", views.PricingLookupView.as_view(), name="pricing-lookup"),
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
    path("archive/", views.ArchiveMonthsView.as_view(), name="archive-months"),
    path("archive/<int:year>/<int:month>/", views.ArchiveMonthProductsView.as_view(), name="archive-month-products"),
    path("archive/close/", views.ArchiveCloseView.as_view(), name="archive-close"),
    path("company/", views.CompanyProfileView.as_view(), name="company-profile"),
]