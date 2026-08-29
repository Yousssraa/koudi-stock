"""Configure the company identity (KOUDI WOOD) printed on documents.

Sets the CompanyProfile singleton with the public KOUDI WOOD details
(Casablanca). Fields for which no public value exists (IF, patente, CNSS,
bank, RIB) are left empty and are simply omitted from invoices/quotations/POs.

Run:  python manage.py setup_company
"""
from django.core.management.base import BaseCommand

from stock.models import CompanyProfile


class Command(BaseCommand):
    help = "Set the CompanyProfile (KOUDI WOOD) used on printed documents."

    def handle(self, *args, **options):
        p = CompanyProfile.current()
        p.name = "KOUDI WOOD"
        p.tagline = "Vente de bois massifs & panneaux — Découpe sur mesure"
        p.address = "Bd Med Elyazidi, Hay Douma Sidi Moumen, Casablanca 20400"
        p.phone = "0677-580205"
        p.registre_commerce = "461133"
        p.ice = "002504881000008"
        p.save()
        self.stdout.write(self.style.SUCCESS(
            "Profil société défini : KOUDI WOOD (Casablanca). "
            "Éditez-le via l'écran Paramètres ou /admin/ si ces données changent."
        ))
