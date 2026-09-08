"""Seed a realistic Facturation demo for Ateliers Menais (the portal client).

Creates the missing pieces of the invoicing story:
  1. two un-invoiced Delivery Notes (BL) for the client, fully delivered,
  2. a consolidated monthly invoice grouping those BLs (FC-DEMO-2026-01),
  3. a Facture d'Avoir (AV-DEMO-2026-01) reducing that invoice's balance,
  4. a chèque payment covering the remaining balance, with an échéance in the
     future so the invoice shows the « En attente d'échéance » badge.

Idempotent: everything is keyed by explicit numbers (BL-DEMO-FAC-…,
FC-DEMO-2026-01, AV-DEMO-2026-01) and skipped when already present.

Run:  python manage.py seed_facturation_demo
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from stock.models import Client, CreditNote, DeliveryNote, Product, SalesOrder, Warehouse
from stock.services import (
    advance_delivery_note,
    create_credit_note,
    create_delivery_note,
    create_grouped_invoice,
    create_payment,
)

DEMO_CLIENT = "Ateliers Menais"
INVOICE_NO = "FC-DEMO-2026-01"
AVOIR_NO = "AV-DEMO-2026-01"


class Command(BaseCommand):
    help = "Seed a grouped invoice + avoir + chèque (échéance) for the demo client."

    def handle(self, *args, **options):
        client = Client.objects.filter(company_name__icontains="Menais").first() or (
            Client.objects.filter(code="CLI-DEMO-Atel").first()
        )
        if client is None:
            self.stderr.write("Client de démonstration (Ateliers Menais) introuvable. Abandon.")
            return
        warehouse = Warehouse.objects.filter(code="WH-CASABLANCA").first()
        if warehouse is None:
            self.stderr.write("Dépôt WH-CASABLANCA introuvable. Abandon.")
            return

        if SalesOrder.objects.filter(so_number=INVOICE_NO).exists():
            self.stdout.write(f"  {INVOICE_NO} déjà présent, rien à faire.")
            return

        bl_numbers = [b.bl_number for b in DeliveryNote.objects.filter(
            client=client, bl_number__startswith="BL-DEMO-FAC-")]
        if len(bl_numbers) < 2:
            bls = self._make_bls(client, warehouse, options.get("verbosity", 1) > 0)
        else:
            bls = list(DeliveryNote.objects.filter(bl_number__startswith="BL-DEMO-FAC-"))
            self.stdout.write(f"  BL démo déjà présents ({', '.join(bl_numbers)}).")

        so = create_grouped_invoice(
            client,
            warehouse,
            [b.pk for b in bls[:2]],
            notes="Facture mensuelle de regroupement BL (démo facturation)",
            so_number=INVOICE_NO,
        )
        self.stdout.write(f"  {so.so_number} : {so.total_amount} MAD — {len(bls[:2])} BL regroupés")

        if not CreditNote.objects.filter(credit_note_number=AVOIR_NO).exists():
            author = User.objects.filter(is_staff=True).order_by("id").first()
            cn = create_credit_note(
                client,
                sales_order=so,
                reason=CreditNote.Reason.COMMERCIAL,
                amount=Decimal("200.00"),
                notes="Avoir commercial accordé sur la facture de regroupement (démo).",
                created_by=author,
                credit_note_number=AVOIR_NO,
            )
            self.stdout.write(f"  {cn.credit_note_number} : {cn.amount} MAD HT (appliqué {cn.applied_amount})")

        if not so.payments.exists():
            balance = so.balance_due
            payment = create_payment(
                client,
                balance,
                sales_order=so,
                method_key="cheque",
                bank_name="Attijariwafa bank",
                reference="CHQ 0048192",
                due_date=timezone.localdate() + timedelta(days=45),
                note="Chèque remis en paiement — en attente d'échéance (démo).",
            )
            self.stdout.write(
                f"  {payment.reference} : {payment.amount} MAD (échéance {payment.due_date})"
            )

        self.stdout.write(self.style.SUCCESS(f"Done. {so.so_number} prêt (registre + avoir + chèque)."))

    def _make_bls(self, client, warehouse, verbose):
        today = timezone.localdate()
        plans = [
            ("BL-DEMO-FAC-001", "PR-063-225-4000", Decimal("12"), Decimal("4800")),
            ("BL-DEMO-FAC-002", "EPC-063-225-4000", Decimal("10"), Decimal("4800")),
        ]
        created = []
        for bl_number, sku, qty, price in plans:
            product = Product.objects.filter(sku=sku, is_active=True).first()
            if product is None:
                self.stderr.write(f"Produit {sku} introuvable. Abandon.")
                return []
            bl = create_delivery_note(
                client,
                warehouse,
                [{"product": product, "quantity": qty, "price_per_m3": price}],
                driver_name="K. Amrani",
                truck_plate="4745-A-6",
                bl_number=bl_number,
                notes="Lot démonstration facturation.",
            )
            advance_delivery_note(bl, DeliveryNote.Status.IN_TRANSIT)
            advance_delivery_note(bl, DeliveryNote.Status.DELIVERED)
            created.append(bl)
            self.stdout.write(f"  {bl.bl_number} livré : {bl.total_amount} MAD")
            _ = today
        return created