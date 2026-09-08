"""Configure the company identity (KOUDI STOCK SARL) printed on documents.

Sets the CompanyProfile singleton with the KOUDI STOCK SARL details
(Casablanca): ICE, Registre de commerce, Identifiant fiscal and Patente are
filled from the official legal identifiers so invoices/quotations/POs render a
complete Moroccan legal footer.

Run:  python manage.py setup_company
"""
from django.core.management.base import BaseCommand

from stock.models import CompanyProfile


class Command(BaseCommand):
    help = "Set the CompanyProfile (KOUDI STOCK SARL) used on printed documents."

    def handle(self, *args, **options):
        p = CompanyProfile.current()
        p.name = "KOUDI STOCK SARL"
        p.tagline = "Négoce & Importation de Bois"
        p.address = "Zone Industrielle Lissasba, Rue des Bois, Casablanca"
        p.phone = "0677-580205"
        p.email = "contact@koudistock.ma"
        p.ice = "003124567000012"
        p.registre_commerce = "489201 Casablanca"
        p.identifiant_fiscal = "52891034"
        p.patente = "34109823"
        p.save()
        self.stdout.write(self.style.SUCCESS(
            "Profil société défini : KOUDI STOCK SARL (Casablanca). "
            "Éditez-le via l'écran Paramètres ou /admin/ si ces données changent."
        ))
