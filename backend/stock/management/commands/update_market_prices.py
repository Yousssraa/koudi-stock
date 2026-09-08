"""Align KOUDI WOOD sale prices with real 2026 Moroccan timber market data.

Research basis (field / online sources, Morocco — handled in MAD per m³, except
panels that are also expressed per m³ for consistency in this DB):

  - Bois de charpente / résineux (sapin, épicéa, pin) ............ 2 500 – 5 500 DH/m³
  - Madriers & bastaings ......................................... 4 000 – 7 000 DH/m³
  - Pin autoclave classe 3 / Douglas classe 4 .................... 3 200 – 7 500 DH/m³
  - Bois de coffrage ............................................ 3 000 – 5 000 DH/m³
  - Panneaux (OSB/MDF/latté/contreplaqué) ....................... ~100 – 300 DH/panneau
    (i.e. roughly 2 800 – 9 500 DH/m³ depending on the sheet)
  - Bois exotiques (Sapelli, Iroko, Kossipo, Dibétou) ............ 8 000 – 18 000 DH/m³
  - Bois nobles (Chêne, Hêtre, Noyer) ........................... 8 000 – 40 000 DH/m³

Only ``sale_price`` is updated (and the aberrant non-standard madrier length).
Prix de revient (cost_price) is intentionally left untouched.

The command is idempotent and add-only for the corrected SKUs.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand

from stock.models import Product

# (sku, researched sale_price MAD per m³ — or per unit for the okoumé sheet)
MARKET_PRICES = {
    # ---- Bois blanc (épicéa) / charpente ----
    "EPC-027-040-3000": "3000",    # liteau — liteaux ~8-14 DH/ml
    "EPC-050-150-3000": "4000",    # plateau/bastain 50x150
    "EPC-063-175-4000": "4400",    # chevron 63x175
    "EPC-063-225-4000": "4800",    # bastaing 63x225
    # ---- Bois de construction (sapin / pin) ----
    "KS-SAPIN-27x150x4000": "3400",   # volige sapin (déjà aligné)
    "KW-BASTINGSAPIN6317": "3500",    # basting sapin (déjà aligné)
    "KW-MADRIERPINSYLVES": "4100",    # madrier pin 63x225
    "KW-RONDINSAPIN180": "2700",      # rondin sapin brut
    "KW-VOLIGESAPIN22100": "2900",    # volige sapin 22x100
    # ---- Bois rouge (pin sylvestre) ----
    "PR-020-100-3000": "3400",
    "PR-050-100-3000": "3900",
    "PR-050-150-4000": "4100",
    "PR-063-175-4000": "4400",
    "PR-063-225-4000": "4800",
    "PR-100-100-4000": "5400",        # madrier 100x100
    # ---- Bois traité autoclave (classes 3/4) ----
    "KS-PIN-CL4-45x225x5000": "4600", # pin classe 4 — prime de traitement
    "KW-CHEVRONSAPIN4570": "4200",    # chevron autoclave
    "KW-LAMEDETERRASSEPI": "5200",    # lame de terrasse autoclave
    "KW-POTEAUCARRÉEUCAL": "4800",    # poteau eucalyptus
    # ---- Coffrage (équivalent m³) ----
    "CFR-18-2500-1250": "5400",       # contreplaqué coffrage 18mm
    "CPB-18-2500-1220": "13000",      # bakélisé 18mm
    "H20-200-80-5900": "20000",       # poutrelle H20 (ingénierie)
    # ---- Panneaux (équivalent m³) ----
    "CPO-15-2500-1220": "9500",       # contreplaqué okoumé 15mm
    "HLG-18-2800-2070": "15000",      # high gloss 18mm (décor premium)
    "LAT-19-2500-1220": "5000",       # latté 19mm
    "MDF-BRU-18-2500-1220": "3500",   # MDF brut 18mm
    "MDF-DEC-18-2500-1220": "5200",   # MDF décor 18mm
    "OSB-12-2500-1250": "3000",       # OSB 12mm
    "SOR-19-2500-1220": "3300",       # sorrel 19mm
    "STR-18-2500-1220": "4500",       # stratifié 18mm
    "KW-PLYWOODFILMÉ18MM": "9000",    # plywood filmé 18mm (film phénolique)
    # ---- Panneaux & dérivés (pièce) ----
    "KS-OKOUME-18-1220x2440": "380",  # okoumé 18mm — déjà aligné (par unité)
    # ---- Bois exotiques ----
    "DAB-027-145-3000": "12000",      # dabema
    "DIB-027-200-3000": "15000",      # dibétou
    "IRO-050-150-3000": "23000",      # iroko plateau
    "KOS-050-150-3000": "13000",      # kossipo
    "SAP-027-145-3000": "12000",      # sapelli 27x145
    "SAP-050-150-4000": "13000",      # sapelli 50x150
    # ---- Bois feuillus & nobles ----
    "KS-CHENE-50x200x3000": "11500",  # chêne américain (déjà aligné)
    "KW-PLATEAUCHÊNE3218": "10500",   # plateau chêne
    "KW-PLATEAUHÊTREÉTUV": "8000",    # hêtre étuvé
    "KW-PLATEAUIROKO3419": "12000",   # plateau iroko
    "CHE-027-145-2500": "12000",      # chêne 27x145
    "CHE-050-150-2500": "15000",      # chêne 50x150
    "NOY-040-120-2500": "35000",      # noyer
}


class Command(BaseCommand):
    help = "Align KOUDI WOOD sale prices with real 2026 Moroccan timber market data (sale_price only)."

    def handle(self, *args, **options):
        updated = 0
        for sku, price in MARKET_PRICES.items():
            try:
                p = Product.objects.get(sku=sku)
            except Product.DoesNotExist:
                self.stdout.write(f"  - SKU inconnu ignoré : {sku}")
                continue
            old = p.sale_price
            new = Decimal(price)
            if old != new:
                p.sale_price = new
                p.save(update_fields=["sale_price", "updated_at"])
                self.stdout.write(f"  ~ {sku} : {old} -> {new}")
                updated += 1
            else:
                self.stdout.write(f"  = {sku} : déjà à {new}")

        # Correct the non-standard madrier length 4.5 m -> 4.0 m (standard section).
        madrier = Product.objects.filter(sku="KW-MADRIERPINSYLVES").first()
        if madrier and madrier.length_m != Decimal("4"):
            old_l = madrier.length_m
            madrier.length_m = Decimal("4")
            madrier.save(update_fields=["length_m", "updated_at"])
            self.stdout.write(f"  ~ KW-MADRIERPINSYLVES longueur : {old_l} -> 4.0 m")

        self.stdout.write(self.style.SUCCESS(
            f"Terminé : {updated} produit(s) mis à jour (sale_price)."
        ))
