"""API URL routes for the stock app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views, views_public, views_pro

router = DefaultRouter()
router.register(r"wood-types", views.WoodTypeViewSet, basename="wood-type")
router.register(r"warehouses", views.WarehouseViewSet, basename="warehouse")
router.register(r"reference-prices", views.ReferencePriceViewSet, basename="reference-price")
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
router.register(r"delivery-notes", views.DeliveryNoteViewSet, basename="delivery-note")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/login/", views.LoginView.as_view(), name="api-login"),
    path("auth/logout/", views.LogoutView.as_view(), name="api-logout"),
    path("auth/me/", views.MeView.as_view(), name="api-me"),
    path("purchases/", views.PurchaseTransactionView.as_view(), name="purchase-transaction"),
    path("sales/", views.SaleTransactionView.as_view(), name="sale-transaction"),
    path("transfers/", views.TransferView.as_view(), name="transfer"),
    path("stock-adjustments/", views.StockAdjustmentView.as_view(), name="stock-adjustment"),
    path("reorders/", views.ReorderView.as_view(), name="reorder"),
    path("payments/", views.PaymentTransactionView.as_view(), name="payment-transaction"),
    path("pricing/lookup/", views.PricingLookupView.as_view(), name="pricing-lookup"),
    # Facturation — invoice register, BL grouping, avoirs, relances & exports
    path("invoices/", views.InvoiceListView.as_view(), name="invoice-list"),
    path("invoices/export/", views.InvoiceExportView.as_view(), name="invoice-export"),
    path("invoices/grouped/", views.GroupedInvoiceView.as_view(), name="invoice-grouped"),
    path("invoices/unbilled-bl/", views.UnbilledDeliveryNotesView.as_view(), name="invoice-unbilled-bl"),
    path("invoices/<int:pk>/", views.InvoiceDetailView.as_view(), name="invoice-detail"),
    path("invoices/<int:pk>/pdf/", views.InvoicePdfView.as_view(), name="invoice-pdf"),
    path("invoices/<int:pk>/reminder/whatsapp/", views.InvoiceWhatsAppReminderView.as_view(), name="invoice-whatsapp"),
    path("invoices/<int:pk>/reminder/email/", views.InvoiceEmailReminderView.as_view(), name="invoice-email-reminder"),
    path("credit-notes/", views.CreditNoteListCreateView.as_view(), name="credit-note-list"),
    path("credit-notes/<int:pk>/pdf/", views.CreditNotePdfView.as_view(), name="credit-note-pdf"),
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
    path("archive/", views.ArchiveMonthsView.as_view(), name="archive-months"),
    path("archive/<int:year>/<int:month>/", views.ArchiveMonthProductsView.as_view(), name="archive-month-products"),
    path("archive/close/", views.ArchiveCloseView.as_view(), name="archive-close"),
    path("company/", views.CompanyProfileView.as_view(), name="company-profile"),
    path("catalog-config/", views.CatalogConfigView.as_view(), name="catalog-config"),
    # Public vitrine (unauthenticated)
    path("public/categories/", views_public.PublicCategoriesView.as_view(), name="public-categories"),
    path("public/essences/", views_public.PublicEssencesView.as_view(), name="public-essences"),
    path("public/essences/<str:name>/", views_public.PublicEssenceDetailView.as_view(), name="public-essence-detail"),
    path("public/products/", views_public.PublicProductsView.as_view(), name="public-products"),
    path("public/products/<int:pk>/", views_public.PublicProductDetailView.as_view(), name="public-product-detail"),
    path("public/company/", views_public.PublicCompanyView.as_view(), name="public-company"),
    path("public/catalog.pdf/", views_public.PublicCatalogView.as_view(), name="public-catalog"),
    path("public/leads/", views_public.PublicLeadView.as_view(), name="public-lead"),
    # Espace Pro — client portal
    path("pro/auth/login/", views_pro.ProLoginView.as_view(), name="pro-login"),
    path("pro/auth/logout/", views_pro.ProLogoutView.as_view(), name="pro-logout"),
    path("pro/auth/me/", views_pro.ProMeView.as_view(), name="pro-me"),
    path("pro/dashboard/", views_pro.ProDashboardView.as_view(), name="pro-dashboard"),
    path("pro/notifications/", views_pro.ProNotificationsView.as_view(), name="pro-notifications"),
    path("pro/notifications/<int:pk>/read/", views_pro.ProNotificationMarkReadView.as_view(), name="pro-notification-read"),
    path("pro/quotes/", views_pro.ProQuoteListView.as_view(), name="pro-quotes"),
    path("pro/quotes/create/", views_pro.ProQuoteCreateView.as_view(), name="pro-quote-create"),
    path("pro/quotes/<int:pk>/", views_pro.ProQuoteDetailView.as_view(), name="pro-quote-detail"),
    path("pro/quotes/<int:pk>/items/", views_pro.ProQuoteItemsView.as_view(), name="pro-quote-items"),
    path("pro/orders/", views_pro.ProOrderListView.as_view(), name="pro-orders"),
    path("pro/orders/<int:pk>/", views_pro.ProOrderDetailView.as_view(), name="pro-order-detail"),
    path("pro/invoices/", views_pro.ProInvoiceListView.as_view(), name="pro-invoices"),
    path("pro/invoices/<int:pk>/pdf/", views_pro.ProInvoicePdfView.as_view(), name="pro-invoice-pdf"),
    path("pro/avoirs/", views_pro.ProAvoirListView.as_view(), name="pro-avoirs"),
    path("pro/avoirs/<int:pk>/pdf/", views_pro.ProAvoirPdfView.as_view(), name="pro-avoir-pdf"),
    path("pro/payments/", views_pro.ProPaymentListView.as_view(), name="pro-payments"),
    path("pro/credit/", views_pro.ProCreditView.as_view(), name="pro-credit"),
    path("pro/loyalty/", views_pro.ProLoyaltyView.as_view(), name="pro-loyalty"),
    path("pro/catalog/", views_pro.ProCatalogView.as_view(), name="pro-catalog"),
    path("pro/tiers/", views_pro.ProPriceTierView.as_view(), name="pro-tiers"),
    path("pro/profile/", views_pro.ProProfileView.as_view(), name="pro-profile"),
]