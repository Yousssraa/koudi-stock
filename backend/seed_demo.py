"""Populate the database with a realistic merchant timber catalog for KOUDI STOCK.

Run:  python seed_demo.py

Catalog is organised like a real wood merchant ("négociant en bois"):
  * Bois rouge   (Pin sylvestre)  — SCA, RML, FENNIA, STORA, METSÄ, NORRA, JULA
  * Bois blanc   (Épicéa)         — SCA, RML, METSÄ
  * Bois exotique                 — Sapelli, Kossipo, Dabema, Dibétou, Iroko
  * Bois noble                    — Chêne, Noyer
  * Panneaux                      — MDF brut/décor, Stratifié, OSB, Latté, Sorel, High Gloss, CP Okoumé
  * Coffrage                      — panneaux de coffrage, CP bakélisé, poutrelle H20

Reference rows (warehouses, species, suppliers, clients, products) are created
idempotently. Transactional data (movements, inventory, orders) is wiped and
rebuilt from a deterministic Jan–Aug 2026 schedule: every product opens with
stock, repurchases on the months it sells (before the sale, so stock never goes
negative), some transfers feed the Tanger depot, and each month's sales are
split across two client orders.
"""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "koudi_backend.settings")
django.setup()

from datetime import date, datetime, timedelta
from decimal import Decimal

from stock.models import (
    Client,
    DryingBatch,
    Inventory,
    Kiln,
    MonthlyArchive,
    Payment,
    PriceTier,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    SalesOrder,
    SalesOrderItem,
    StockMovement,
    Supplier,
    Warehouse,
    WoodType,
)
from stock.services import (
    client_credit_summary,
    create_payment,
    create_purchase,
    create_sale,
    log_stock_movement,
    transfer_stock,
)
from django.db.models import Case, DecimalField, F, Q, Sum, When
from django.utils import timezone


def moved_at(mv_date):
    """Aware datetime used both for ledger rows and document timestamps."""
    return timezone.make_aware(datetime.combine(mv_date, datetime.min.time()))


# ---------------------------------------------------------------------------
# Warehouses
# ---------------------------------------------------------------------------
warehouse_main, _ = Warehouse.objects.get_or_create(
    code="WH-CASABLANCA", defaults={"name": "Dépôt Casablanca", "address": "Zone Industrielle, Casablanca"}
)
warehouse_out, _ = Warehouse.objects.get_or_create(
    code="WH-TANGER", defaults={"name": "Dépôt Tanger", "address": "Zone Franche, Tanger"}
)
warehouses = {"WH-CASABLANCA": warehouse_main, "WH-TANGER": warehouse_out}

# ---------------------------------------------------------------------------
# Species (essences)
# ---------------------------------------------------------------------------
# Deactivate species no longer in the catalog. "Oak" stays as a row so the
# smoke test (WoodType.objects.filter(name="Oak")) keeps working.
for old in ["Oak", "European Beech", "Ash", "Pine", "Teak"]:
    WoodType.objects.filter(name=old).update(is_active=False)

SPECIES = [
    # (name, scientific, cat, density, provenances, durability, moisture, family, desc)
    ("Pin sylvestre", "Pinus sylvestris", "Softwood", 510,
     "Scandinavie (Suède, Finlande), Russie, Baltique, Pologne",
     "Classe 3-4 (bois peu durable — à traiter en extérieur)",
     "Séchage rapide et facile ; faible retrait ; humidité d'équilibre 12-16 %",
     "Menuiserie & Agencement",
     "Le pin sylvestre, dit « bois rouge » du Nord, est le grand classique de la construction et de la charpente. Tendre et résineux, il se travaille facilement, se cloue et se visse sans difficulté. Traité autoclave, il prolonge sa durée de vie en usage extérieur et au contact du sol."),
    ("Épicéa", "Picea abies", "Softwood", 450,
     "Scandinavie (Suède, Finlande), Europe du Nord",
     "Classe 4 (peu durable — à traiter en extérieur)",
     "Séchage rapide ; léger et stable ; humidité d'équilibre 12-16 %",
     "Menuiserie & Agencement",
     "L'épicéa, ou « bois blanc » du Nord, est léger, résineux et très régulier. Idéal pour la charpente légère, l'ossature, les voliges et le doublage, il offre un excellent rapport qualité-prix pour les chantiers structurels."),
    ("Sapelli", "Entandrophragma cylindricum", "Exotic", 650,
     "Afrique centrale (Cameroun, Gabon, Congo)",
     "Classe 2-3 (durable)",
     "Séchage lent et difficile — nécessite un séchoir ; bonne stabilité une fois sec",
     "Menuiserie & Agencement",
     "Le sapelli est un bois exotique rouge-brun aux reflets dorés, très apprécié en menuiserie d'agencement, ébénisterie et menuiserie intérieure. Stable et de belle apparence, il se travaille proprement et se vitrifie élégamment."),
    ("Kossipo", "Entandrophragma candollei", "Exotic", 640,
     "Afrique centrale (Cameroun, Gabon, Congo)",
     "Classe 2-3 (durable)",
     "Séchage lent ; retrait faible ; stable en service",
     "Menuiserie & Agencement",
     "Le kossipo est un bois exotique dense et durable, proche du sapelli. Il convient à l'ébénisterie, la menuiserie intérieure et les aménagements qui exigent une bonne résistance mécanique."),
    ("Dabema", "Piptadeniastrum africanum", "Exotic", 690,
     "Afrique de l'Ouest et centrale (Cameroun, Côte d'Ivoire)",
     "Classe 2 (très durable)",
     "Séchage lent ; moyennement nerveux ; humidité d'équilibre faible",
     "Aménagement Int./Ext.",
     "Le dabema est un bois exotique dur et dense à veinage soutenu. Sa bonne durabilité naturelle et sa résistance mécanique le destinent à l'aménagement extérieur, à la menuiserie lourde et aux structures."),
    ("Dibétou", "Lovoa trichilioides", "Exotic", 560,
     "Afrique centrale et de l'Ouest (Gabon, Cameroun)",
     "Classe 3-4 (peu durable en extérieur)",
     "Séchage assez rapide ; retrait faible ; très stable",
     "Menuiserie & Agencement",
     "Le dibétou, surnommé « noyer d'Afrique », présente un beau bois jaune doré à brun, très stable et facile à travailler. Il est idéal pour le mobilier, la menuiserie fine et la réalisation de façades et placages."),
    ("Iroko", "Milicia excelsa", "Exotic", 650,
     "Afrique de l'Ouest et centrale (Côte d'Ivoire, Ghana, Congo)",
     "Classe 1-2 (très durable — imputrescible)",
     "Séchage lent, peu de fentes ; excellente stabilité en service",
     "Aménagement Int./Ext.",
     "L'iroko, « teck d'Afrique », est un bois exotique imputrescible d'une durabilité exceptionnelle. Indispensable pour les terrasses extérieures, le mobilier de jardin, l'agencement maritime et tous les usages exposés à l'humidité."),
    ("Chêne", "Quercus robur", "Hardwood", 720,
     "France, Europe centrale, Russe",
     "Classe 2 (durable)",
     "Séchage lent ; fort retrait ; nécessite une saison soignée",
     "Aménagement Int./Ext.",
     "Le chêne est l'essence noble par excellence. Dense, résistant et chaleureux, il se prête à l'ébénisterie, aux plans de travail, aux escaliers, au parquet et à la menuiserie de caractère. Il demande un séchage lent pour éviter les fentes."),
    ("Noyer", "Juglans regia", "Hardwood", 640,
     "Europe (France, Italie, Espagne), Asie Mineure",
     "Classe 3 (moyennement durable)",
     "Séchage lent ; nécessite un séchage soigneux ; très stable une fois sec",
     "Menuiserie & Agencement",
     "Le noyer est un bois noble brun chocolat aux veinures magnifiques. Très prisé en ébénisterie d'art, placage et mobilier haut de gamme, il offre une finition exceptionnelle et une excellente stabilité."),
    ("Okoumé", "Aucoumea klaineana", "Exotic", 440,
     "Gabon, Afrique centrale (bassins de l'Ogooué)",
     "Classe 3-4 (à protéger en extérieur)",
     "Séchage rapide et sans problème ; très stable ; humidité d'équilibre 8-12 %",
     "Panneaux",
     "L'okoumé est le bois de référence du contreplaqué. Léger, stable et résistant à l'humidité relative, il est largement utilisé pour les panneaux contreplaqués, l'agencement et la construction légère."),
]
for name, sci, cat, dens, prov, dur, moist, fam, desc in SPECIES:
    wt, _ = WoodType.objects.get_or_create(
        name=name,
        defaults={"scientific_name": sci, "category": cat, "density_kg_m3": dens},
    )
    wt.is_active = True
    wt.scientific_name = sci
    wt.category = cat
    wt.density_kg_m3 = dens
    wt.provenances = prov
    wt.durability_class = dur
    wt.moisture_note = moist
    wt.comarbois_family = fam
    wt.description = desc
    wt.save()

# Legacy / secondary essences still held in stock (used in usages.js): enrich
# them so their fiche sheet is complete on the boutique.
LEGACY_ESSENCES = {
    "Eucalyptus": {
        "scientific_name": "Eucalyptus globulus",
        "category": "Exotic",
        "density_kg_m3": 750,
        "provenances": "Australie, Amérique du Sud, Afrique du Nord (Maroc)",
        "durability_class": "Classe 2 (durable — résistant au contact sol)",
        "moisture_note": "Séchage rapide; sujet à la torsion si mal séché; très dense",
        "comarbois_family": "Aménagement Int./Ext.",
        "description": "L'eucalyptus est un bois exotique dense, dur et résistant, souvent utilisé pour les poteaux, clôtures, brise-vue et structures extérieures. Il tolère bien l'humidité et le contact avec le sol.",
    },
    "Hêtre étuvé": {
        "scientific_name": "Fagus sylvatica",
        "category": "Hardwood",
        "density_kg_m3": 690,
        "provenances": "Europe (France, Allemagne, Europe centrale)",
        "durability_class": "Classe 5 (peu durable — intérieur uniquement)",
        "moisture_note": "Séchage assez rapide; fort retrait; stable une fois étuvé",
        "comarbois_family": "Menuiserie & Agencement",
        "description": "Le hêtre étuvé est un bois blanc clair et homogène, idéal pour les sièges, la menuiserie intérieure, les objets et l'agencement. L'étuvage le stabilise et le protège des micro-organismes.",
    },
    "Pin Sylvestre (Bois Rouge)": {
        "scientific_name": "Pinus sylvestris",
        "category": "Softwood",
        "density_kg_m3": 510,
        "provenances": "Scandinavie (Suède, Finlande), Russie, Baltique",
        "durability_class": "Classe 3-4 (peu durable — à traiter en extérieur)",
        "moisture_note": "Séchage rapide et facile; faible retrait",
        "comarbois_family": "Menuiserie & Agencement",
        "description": "Le pin rouge du Nord est le grand classique de la construction et de la charpente (madriers, bastaings, chevrons, voliges). Tendre et résineux, il se travaille facilement et se traite bien à l'autoclave.",
    },
    "Sapin du Nord (Bois Blanc)": {
        "scientific_name": "Picea abies",
        "category": "Softwood",
        "density_kg_m3": 450,
        "provenances": "Scandinavie (Suède, Finlande), Europe du Nord",
        "durability_class": "Classe 4 (peu durable — à traiter en extérieur)",
        "moisture_note": "Séchage rapide; léger et stable",
        "comarbois_family": "Menuiserie & Agencement",
        "description": "Le sapin du Nord, ou « bois blanc », est léger, résineux et régulier. Parfait pour la charpente légère, l'ossature, les voliges et le doublage, à un excellent rapport qualité-prix.",
    },
}
def _fold_essence(name):
    """Case- and accent-insensitive key for matching essence names."""
    import unicodedata as _ud
    return "".join(
        c for c in _ud.normalize("NFD", (name or "").lower())
        if not _ud.combining(c)
    )

for _name, _enrich in LEGACY_ESSENCES.items():
    _key = _fold_essence(_name)
    _wt = None
    for _candidate in WoodType.objects.filter(is_active=True):
        if _fold_essence(_candidate.name) == _key:
            _wt = _candidate
            break
    if _wt is None:
        continue
    # Retain the canonical name already present in the DB.
    _enrich = dict(_enrich)
    _enrich.pop("name", None)
    for _k, _v in _enrich.items():
        setattr(_wt, _k, _v)
    _wt.save()
species = {w.name: w for w in WoodType.objects.all()}

# ---------------------------------------------------------------------------
# Suppliers (brands / sawmills = suppliers) & Clients
# ---------------------------------------------------------------------------
SUPPLIERS = [
    ("SUP-SCA", "SCA Timber", "M. Lindqvist", "exports@scatimber.com", "+46 8 788 51 00", "Stockholm, Suède", "SE501234567", "30 days"),
    ("SUP-RML", "RML Timber", "M. Åström", "sales@rmltimber.se", "+46 70 555 23 40", "Råneå, Suède", "SE507654321", "30 days"),
    ("SUP-FENNIA", "Fennia Forest", "Mme. Virtanen", "trade@fenniaforest.fi", "+358 40 123 45 67", "Helsinki, Finlande", "FI12345678", "Net 30"),
    ("SUP-STORA", "Stora Enso Timber", "M. Korpela", "timber@storaenso.com", "+358 20 46 121", "Helsinki, Finlande", "FI87654321", "45 days"),
    ("SUP-METSA", "Metsä Wood", "M. Räsänen", "wood@metsagroup.com", "+358 10 460 5000", "Espoo, Finlande", "FI11223344", "30 days"),
    ("SUP-NORRA", "Norra Timber", "M. Dahlberg", "info@norra.se", "+46 910 88 70 00", "Skellefteå, Suède", "SE99887766", "30 days"),
    ("SUP-JULA", "Jula Timber", "Mme. Eriksen", "timber@jula.no", "+47 62 50 31 00", "Oslo, Norvège", "NO88776655", "Net 30"),
    ("SUP-TROPIC", "Bois Tropicaux Import", "M. Diop", "contact@bois-tropiques.ma", "+212 5 22 35 19 40", "Quartier des Industriels, Casablanca", "MA4033332211", "Acompte 50%"),
    ("SUP-OKOUME", "Okoumé & CP du Gabon", "M. Ndong", "ventes@cp-gabon.ma", "+212 5 22 41 77 63", "Mohammedia", "MA4044455667", "30 days"),
    ("SUP-PANNEAU", "Panneaux du Maroc", "Mme. Chraibi", "commandes@panneaux-maroc.ma", "+212 5 22 67 89 10", "Ain Sebaâ, Casablanca", "MA4055667788", "30 days"),
    ("SUP-NOBLE", "Bois Nobles de France", "M. Fontaine", "export@boisnobles.fr", "+33 4 72 55 44 33", "Lyon, France", "FR44556677", "Net 30"),
    ("SUP-COFFRAGE", "Coffrages & Formworks", "M. Benjelloun", "ventes@coffrages.ma", "+212 5 39 32 45 87", "Zone Franche, Tanger", "MA4066778899", "45 days"),
]
for code, company, contact, email, phone, addr, tax, terms in SUPPLIERS:
    Supplier.objects.get_or_create(
        code=code,
        defaults={
            "company_name": company, "contact_name": contact, "email": email,
            "phone": phone, "address": addr, "tax_id": tax, "payment_terms": terms,
        },
    )
suppliers = {s.code: s for s in Supplier.objects.all()}

CLIENTS = [
    ("CLI-MENUISERIE", "Menuiserie Al Atlas", "M. Benali", "contact@menuiserie-atlas.ma", "+212 6 61 22 33 44", "Ain Sebaâ, Casablanca", "MA5011112222", "30 days", "1500000"),
    ("CLI-CHARENTE", "Charpente Moderna", "Mme. Radi", "commandes@charpente-moderna.ma", "+212 6 62 45 78 90", "Bouskoura, Casablanca", "MA5022223333", "45 days", "2000000"),
    ("CLI-EBENISTE", "Atelier Ébénisterie Royale", "M. Chraibi", "atelier@ebenisterie-royale.ma", "+212 6 63 87 12 45", "Guéliz, Marrakech", "MA5033334444", "Net 30", "1200000"),
    ("CLI-MOBILIER", "Mobilier Contemporain SARL", "Mme. Berrada", "achats@mobilier-contemporain.ma", "+212 6 64 21 98 76", "Fès", "MA5044445555", "30 days", "1800000"),
    ("CLI-CONSTRUCT", "Construction Benjelloun & Fils", "M. Benjelloun", "admin@benjelloun-construction.ma", "+212 6 65 33 21 09", "Tétouan", "MA5055556666", "60 days", "3000000"),
    ("CLI-PARQUET", "Parquets du Maroc", "Mme. Ziani", "ventes@parquets-maroc.ma", "+212 6 66 77 88 99", "Rabat", "MA5066667777", "30 days", "900000"),
    ("CLI-BRICO", "Bricomarché Maroc", "M. Amrani", "achats@bricomarche-ma.ma", "+212 6 67 55 44 33", "Sidi Maârouf, Casablanca", "MA5077778888", "30 days", "2500000"),
]
for code, company, contact, email, phone, addr, tax, terms, limit in CLIENTS:
    Client.objects.get_or_create(
        code=code,
        defaults={
            "company_name": company, "contact_name": contact, "email": email,
            "phone": phone, "address": addr, "tax_id": tax, "payment_terms": terms,
            "credit_limit": Decimal(limit),
        },
    )
clients = {c.code: c for c in Client.objects.all()}

# Credit settings: parse payment terms into days; every client stays open.
DAYS_BY_TERMS = {
    "30 days": 30, "45 days": 45, "Net 30": 30, "60 days": 60, "Acompte 50%": 30,
}
for c in clients.values():
    c.payment_terms_days = DAYS_BY_TERMS.get(c.payment_terms, 30)
    c.is_blocked = False
    c.save(update_fields=["payment_terms_days", "is_blocked"])

# ---------------------------------------------------------------------------
# Products — (sku, name, species, category, grade, finish, T, W, L, mc,
#            cost/m3, sale/m3, min_stock, supplier, end_stock, sales=[(month, qty)])
# ---------------------------------------------------------------------------
PRODUCTS = [
    # --- BOIS ROUGE (Pin sylvestre) ---
    ("PR-063-175-4000", "Chevron Pin 63x175x4000", "Pin sylvestre", "Bois rouge", "Construction", "rough-sawn", 63, 175, 4000, 16, 2800, 4600, 50, "SUP-SCA", 110, [(1, 30), (3, 40), (5, 45), (7, 35), (8, 30)]),
    ("PR-063-225-4000", "Bastaing Pin 63x225x4000", "Pin sylvestre", "Bois rouge", "Construction", "rough-sawn", 63, 225, 4000, 16, 3000, 4900, 40, "SUP-RML", 80, [(2, 25), (4, 30), (6, 28), (8, 20)]),
    ("PR-050-150-4000", "Plateau Pin 50x150x4000", "Pin sylvestre", "Bois rouge", "Standard", "rough-sawn", 50, 150, 4000, 16, 2600, 4300, 40, "SUP-STORA", 90, [(1, 20), (3, 25), (5, 30), (7, 25), (8, 20)]),
    ("PR-100-100-4000", "Madrier Pin 100x100x4000", "Pin sylvestre", "Bois rouge", "Construction", "kiln-dried", 100, 100, 4000, 15, 3400, 5600, 20, "SUP-FENNIA", 45, [(2, 10), (5, 15), (7, 12)]),
    ("PR-020-100-3000", "Volige Pin 20x100x3000", "Pin sylvestre", "Bois rouge", "Standard", "rough-sawn", 20, 100, 3000, 17, 2200, 3700, 60, "SUP-NORRA", 150, [(3, 40), (4, 35), (6, 45), (8, 30)]),
    ("PR-050-100-3000", "Plateau Pin 50x100x3000", "Pin sylvestre", "Bois rouge", "Standard", "rough-sawn", 50, 100, 3000, 16, 2500, 4100, 40, "SUP-JULA", 70, [(2, 15), (4, 18), (6, 20)]),

    # --- BOIS BLANC (Épicéa) ---
    ("EPC-063-175-4000", "Chevron Épicéa 63x175x4000", "Épicéa", "Bois blanc", "Construction", "kiln-dried", 63, 175, 4000, 15, 3000, 5000, 50, "SUP-SCA", 100, [(1, 25), (3, 30), (5, 35), (7, 25), (8, 20)]),
    ("EPC-063-225-4000", "Bastaing Épicéa 63x225x4000", "Épicéa", "Bois blanc", "Construction", "kiln-dried", 63, 225, 4000, 15, 3200, 5300, 40, "SUP-RML", 70, [(2, 20), (4, 25), (6, 22)]),
    ("EPC-050-150-3000", "Plateau Épicéa 50x150x3000", "Épicéa", "Bois blanc", "Standard", "rough-sawn", 50, 150, 3000, 17, 2700, 4500, 40, "SUP-METSA", 80, [(1, 15), (3, 20), (5, 25), (8, 15)]),
    ("EPC-027-040-3000", "Liteau Épicéa 27x40x3000", "Épicéa", "Bois blanc", "Standard", "rough-sawn", 27, 40, 3000, 17, 2400, 4000, 80, "SUP-METSA", 200, [(2, 50), (4, 45), (6, 55), (8, 40)]),

    # --- BOIS EXOTIQUE ---
    ("SAP-027-145-3000", "Planche Sapelli 27x145x3000", "Sapelli", "Bois exotique", "Select", "planed", 27, 145, 3000, 12, 8800, 13200, 15, "SUP-TROPIC", 40, [(2, 8), (4, 10), (6, 9), (8, 8)]),
    ("SAP-050-150-4000", "Plateau Sapelli 50x150x4000", "Sapelli", "Bois exotique", "FAS", "rough-sawn", 50, 150, 4000, 12, 9500, 14500, 26, "SUP-TROPIC", 25, [(1, 5), (5, 7)]),
    ("KOS-050-150-3000", "Plateau Kossipo 50x150x3000", "Kossipo", "Bois exotique", "Select", "rough-sawn", 50, 150, 3000, 12, 9000, 13800, 26, "SUP-TROPIC", 25, [(3, 6), (7, 6)]),
    ("DAB-027-145-3000", "Planche Dabema 27x145x3000", "Dabema", "Bois exotique", "Select", "rough-sawn", 27, 145, 3000, 13, 8600, 13000, 15, "SUP-TROPIC", 35, [(2, 7), (5, 9), (8, 6)]),
    ("DIB-027-200-3000", "Planche Dibétou 27x200x3000", "Dibétou", "Bois exotique", "FAS", "planed", 27, 200, 3000, 11, 11500, 17500, 8, "SUP-TROPIC", 18, [(3, 4), (6, 5)]),
    ("IRO-050-150-3000", "Plateau Iroko 50x150x3000", "Iroko", "Bois exotique", "FAS", "rough-sawn", 50, 150, 3000, 11, 18000, 27000, 5, "SUP-TROPIC", 12, [(2, 3), (4, 4), (8, 2)]),

    # --- BOIS NOBLE ---
    ("CHE-027-145-2500", "Planche Chêne 27x145x2500", "Chêne", "Bois noble", "FAS", "planed", 27, 145, 2500, 10, 8800, 13200, 15, "SUP-NOBLE", 40, [(1, 10), (3, 12), (5, 10), (7, 10), (8, 8)]),
    ("CHE-050-150-2500", "Plateau Chêne 50x150x2500", "Chêne", "Bois noble", "FAS", "planed", 50, 150, 2500, 10, 10500, 15800, 8, "SUP-NOBLE", 20, [(2, 5), (4, 6), (6, 5)]),
    ("NOY-040-120-2500", "Plateau Noyer 40x120x2500", "Noyer", "Bois noble", "FAS", "sanded", 40, 120, 2500, 9, 26000, 39000, 4, "SUP-NOBLE", 10, [(2, 2), (5, 3), (8, 2)]),

    # --- PANNEAUX ---
    ("MDF-BRU-18-2500-1220", "Panneau MDF brut 18x2500x1220", None, "Panneaux", "Standard", "sanded", 18, 2500, 1220, 8, 5200, 7800, 40, "SUP-PANNEAU", 90, [(1, 25), (2, 20), (3, 28), (4, 22), (5, 30), (6, 24), (7, 26), (8, 20)]),
    ("MDF-DEC-18-2500-1220", "Panneau MDF décor 18x2500x1220", None, "Panneaux", "Standard", "sanded", 18, 2500, 1220, 8, 6800, 10200, 30, "SUP-PANNEAU", 60, [(1, 15), (3, 18), (5, 20), (7, 15), (8, 12)]),
    ("STR-18-2500-1220", "Panneau Stratifié 18x2500x1220", None, "Panneaux", "Standard", "sanded", 18, 2500, 1220, 8, 7200, 10800, 30, "SUP-PANNEAU", 55, [(2, 12), (4, 14), (6, 15), (8, 10)]),
    ("OSB-12-2500-1250", "Panneau OSB 3 12x2500x1250", None, "Panneaux", "Standard", None, 12, 2500, 1250, 9, 4200, 6300, 50, "SUP-PANNEAU", 120, [(1, 30), (3, 35), (5, 40), (7, 30), (8, 25)]),
    ("LAT-19-2500-1220", "Panneau latté 19x2500x1220", None, "Panneaux", "Standard", None, 19, 2500, 1220, 9, 6400, 9600, 30, "SUP-PANNEAU", 60, [(2, 12), (4, 15), (6, 14)]),
    ("SOR-19-2500-1220", "Panneau Sorel brut 19x2500x1220", None, "Panneaux", "Standard", None, 19, 2500, 1220, 9, 5400, 8100, 30, "SUP-PANNEAU", 65, [(2, 15), (4, 16), (6, 18)]),
    ("HLG-18-2800-2070", "Panneau High Gloss 18x2800x2070", None, "Panneaux", "Standard", "sanded", 18, 2800, 2070, 8, 11500, 17200, 10, "SUP-PANNEAU", 20, [(3, 4), (5, 5), (7, 4), (8, 3)]),
    ("CPO-15-2500-1220", "Contreplaqué Okoumé 15x2500x1220", "Okoumé", "Panneaux", "Standard", None, 15, 2500, 1220, 9, 7800, 11700, 25, "SUP-OKOUME", 45, [(1, 10), (3, 12), (5, 14), (8, 10)]),

    # --- COFFRAGE ---
    ("CFR-18-2500-1250", "Panneau de coffrage 18x2500x1250", None, "Coffrage", "Standard", None, 18, 2500, 1250, 10, 7600, 11400, 30, "SUP-COFFRAGE", 55, [(1, 12), (3, 15), (5, 18), (7, 12)]),
    ("CPB-18-2500-1220", "Contreplaqué bakélisé 18x2500x1220", None, "Coffrage", "Standard", None, 18, 2500, 1220, 10, 10500, 15800, 15, "SUP-COFFRAGE", 30, [(2, 6), (4, 8), (6, 7), (8, 5)]),
    ("H20-200-80-5900", "Poutrelle H20 80x200x5900", None, "Coffrage", "Construction", None, 80, 200, 5900, 12, 13500, 20500, 26, "SUP-COFFRAGE", 25, [(1, 4), (3, 6), (5, 7), (7, 5)]),
]

# Drop the previous demo catalog, then create the merchant one.
OLD_DEMO_SKUS = [
    "OAK-027-145-2500", "OAK-050-100-3000", "BEE-030-200-3000", "ASH-040-100-2500",
    "PIN-045-120-4000", "PIN-025-100-4000", "IRO-050-150-3000", "TEK-030-120-2000",
]

# Paragraphe « description produit » par SKU (affiché sur la fiche publique).
PRODUCT_DESCRIPTIONS = {
    # --- Bois rouge (Pin sylvestre) ---
    "PR-063-175-4000": "Chevron en pin sylvestre rouge du Nord, scié brut, idéal pour la charpente et l'ossature des toitures. Section courante des zones de pression, il offre une tenue mécanique fiable et se travaille facilement sur chantier.",
    "PR-063-225-4000": "Bastaing en pin sylvestre rouge scandinave, section robuste pour les solives, pannes et supports de charpente. Scié brut, le bois rouge du Nord se cloue et se visse sans effort pour tous vos projets structurels.",
    "PR-050-150-4000": "Plateau en pin sylvestre rouge du Nord, polyvalent pour la menuiserie courante, le coffrage et les ouvrages de structure légère. Bonne régularité de section et excellent rapport qualité-prix.",
    "PR-100-100-4000": "Madrier en pin rouge scandinave séché, section carrée pleine pour les poteaux, poutres et éléments de forte structure. Le séchage en séchoir réduit les tensions et garantit une mise en œuvre stable.",
    "PR-020-100-3000": "Volige en pin sylvestre rouge, faible épaisseur pour le support de couverture, les caissons et les habillages de toiture. Une solution économique et robuste pour vos charpentes.",
    "PR-050-100-3000": "Plateau léger en pin rouge du Nord pour la fixation des chevrons, l'ossature et les coffrages. Section régulière, faciles à manutentionner sur le chantier.",
    # --- Bois blanc (Épicéa) ---
    "EPC-063-175-4000": "Chevron en épicéa du Nord séché, léger et régulier, idéal pour la charpente légère et les zones de pression des toitures. Le bois blanc scandinave combine allégement et tenue mécanique.",
    "EPC-063-225-4000": "Bastaing en épicéa séché pour solives et supports de structure. Bois blanc régulier, sans nœuds bloquants, parfait pour les ossatures de toiture et les planchers.",
    "EPC-050-150-3000": "Plateau en épicéa du Nord pour l'ossature, les voliges et la menuiserie de structure. Léger et stable, il se travaille facilement et offre un très bon rendement au mètre cube.",
    "EPC-027-040-3000": "Liteau en épicéa séché pour la pose des couvertures et l'écartement des chevrons. Section fine et précise, adaptée aux travaux de charpente et de couverture.",
    # --- Bois exotique ---
    "SAP-027-145-3000": "Planche de sapelli rabotée, bois exotique rouge-brun élégant pour l'agencement, la menuiserie intérieure et l'ébénisterie. Surface lisse prête à recevoir huile ou vernis, très stable une fois sec.",
    "SAP-050-150-4000": "Plateau de sapelli brut de première qualité (FAS) pour la menuiserie de caractère, les plans de travail et l'ébénisterie. Belle figure veinée et excellente stabilité dimensionnelle.",
    "KOS-050-150-3000": "Plateau de kossipo, bois exotique dense et durable, pour l'agencement, la menuiserie intérieure et les ouvrages exigeant une bonne résistance. Teinte brun-doré chaleureuse.",
    "DAB-027-145-3000": "Planche de dabema, bois exotique dur et dense, idéal pour l'aménagement extérieur, la menuiserie lourde et les structures. Bonne résistance naturelle aux intempéries.",
    "DIB-027-200-3000": "Planche de dibétou rabotée de première qualité, le « noyer d'Afrique ». Bois très stable et facile à travailler pour le mobilier haut de gamme, les façades et les placages.",
    "IRO-050-150-3000": "Plateau d'iroko, « teck d'Afrique » imputrescible, pour les terrasses extérieures, le mobilier de jardin et l'agencement maritime. Une durabilité exceptionnelle en usage extérieur.",
    # --- Bois noble ---
    "CHE-027-145-2500": "Planche de chêne rabotée de qualité FAS, essence noble dense et chaleureuse pour l'ébénisterie, les plans de travail et la menuiserie de précision. Séchée en séchoir pour une mise en œuvre stable.",
    "CHE-050-150-2500": "Plateau de chêne massif de première qualité pour les plans de travail, escaliers et meubles de caractère. Toucher naturel et veinage affirmé, parfait pour les intérieurs nobles.",
    "NOY-040-120-2500": "Plateau de noyer poncé, bois noble brun chocolat aux veinures magnifiques. Destiné à l'ébénisterie d'art, aux plateaux de table et au mobilier haut de gamme.",
    # --- Panneaux ---
    "MDF-BRU-18-2500-1220": "Panneau MDF brut poncé, surface parfaitement lisse pour la peinture, le laquage et la découpe. Polyvalent pour l'agencement, la menuiserie intérieure et le mobilier.",
    "MDF-DEC-18-2500-1220": "Panneau MDF décor, finition prête à l'emploi pour les façades de meubles, l'agencement et l'habillage intérieur. Consistance homogène et coupe nette.",
    "STR-18-2500-1220": "Panneau stratifié, revêtement décoratif résistant pour les façades, plans de travail et agencements. Surface dure et facile à entretenir, nombreuses teintes disponibles.",
    "OSB-12-2500-1250": "Panneau OSB 3, panneau de particules orientées pour l'ossature, le plancher, l'âme de mur et le coffrage sec. Résistant et économique, adapté aux usages structurels intérieurs.",
    "LAT-19-2500-1220": "Panneau latté, âme de lattis de bois entre deux faces, pour les meubles et l'agencement exigeant une bonne planéité et une fixation solide. Stable et facile à usiner.",
    "SOR-19-2500-1220": "Panneau Sorel brut, panneau de fibres homogène pour la menuiserie, l'habillage et l'isolation. Fonctionnel et économique, idéal pour les travaux courants.",
    "HLG-18-2800-2070": "Panneau High Gloss laqué brillant, finition haut de gamme pour façades de cuisines et dressings. Effet miroir résistant, très prisé en agencement contemporain.",
    "CPO-15-2500-1220": "Contreplaqué en okoumé, bois léger et stable, pour l'agencement, l'ébénisterie et la construction légère. Bonne résistance à l'humidité relative, surface lisse.",
    # --- Coffrage ---
    "CFR-18-2500-1250": "Panneau de coffrage polyvalent pour le béton armé, face lisse et arêtes protégées. Solution économique et résistante pour vos coffrages de dalles et voiles.",
    "CPB-18-2500-1220": "Contreplaqué bakélisé pour coffrage de béton, film phénolique imprégné à haute résistance. Nombreuses réutilisations, parfait pour les voiles verticaux et dalles.",
    "H20-200-80-5900": "Poutrelle de coffrage H20, âme en bois lamellé avec membrure en contreplaqué haute densité. Élément porteur des tablettes de coffrage, léger et très résistant à la flexion.",
}

print("Resetting transactional data (movements / inventory / orders)...")
StockMovement.objects.all().delete()
Inventory.objects.all().delete()
PurchaseOrderItem.objects.all().delete()
PurchaseOrder.objects.all().delete()
SalesOrderItem.objects.all().delete()
SalesOrder.objects.all().delete()
Payment.objects.all().delete()
DryingBatch.objects.all().delete()
Kiln.objects.all().delete()

Product.objects.filter(sku__in=OLD_DEMO_SKUS).delete()

created = 0
for (sku, name, sp, cat, grade, finish, t, w, l, mc, cost, sale, min_q, sup, _end, _sales) in PRODUCTS:
    _, was_created = Product.objects.get_or_create(
        sku=sku,
        defaults={
            "name": name,
            "wood_type": species[sp] if sp else None,
            "category": cat,
            "grade": grade,
            "finish": finish,
            "thickness_mm": t,
            "width_mm": w,
            "length_m": Decimal(l) / Decimal("1000"),
            "moisture_content": mc,
            "description": PRODUCT_DESCRIPTIONS.get(sku),
            "cost_price": Decimal(cost),
            "sale_price": Decimal(sale),
            "min_stock_qty": Decimal(min_q),
            "currency": "MAD",
        },
    )
    created += int(was_created)
# Backfill descriptions on pre-existing products (idempotent re-seed).
for sku, desc in PRODUCT_DESCRIPTIONS.items():
    Product.objects.filter(sku=sku, description__isnull=True).update(description=desc)
print(f"products created: {created} (total active: {Product.objects.filter(is_active=True).count()})")
products = {p.sku: p for p in Product.objects.all()}

# ---------------------------------------------------------------------------
# Volume-based tier pricing (discount brackets on total order volume in m³)
# ---------------------------------------------------------------------------
PRICE_TIERS = [
    ("Tarif détail", Decimal("0"), Decimal("10"), Decimal("0")),
    ("Tarif semi-gros", Decimal("10"), Decimal("25"), Decimal("3")),
    ("Tarif gros", Decimal("25"), Decimal("50"), Decimal("5")),
    ("Tarif industriel", Decimal("50"), None, Decimal("8")),
]
for _name, _min_v, _max_v, _pct in PRICE_TIERS:
    _tier, _ = PriceTier.objects.get_or_create(
        name=_name,
        defaults={
            "min_volume_m3": _min_v,
            "max_volume_m3": _max_v,
            "discount_percent": _pct,
            "is_active": True,
        },
    )
    _tier.min_volume_m3 = _min_v
    _tier.max_volume_m3 = _max_v
    _tier.discount_percent = _pct
    _tier.is_active = True
    _tier.save()
PriceTier.objects.exclude(name__in=[t[0] for t in PRICE_TIERS]).update(is_active=False)
print(f"price tiers: {PriceTier.objects.filter(is_active=True).count()} actifs")

# ---------------------------------------------------------------------------
# Transfers between depots: (date, from, to, sku, qty, lot)
# ---------------------------------------------------------------------------
TRANSFERS = [
    (date(2026, 1, 8), "WH-CASABLANCA", "WH-TANGER", "PR-063-175-4000", 20, "LOT-2026-011"),
    (date(2026, 2, 8), "WH-CASABLANCA", "WH-TANGER", "EPC-063-175-4000", 15, "LOT-2026-012"),
    (date(2026, 3, 8), "WH-CASABLANCA", "WH-TANGER", "OSB-12-2500-1250", 20, "LOT-2026-021"),
    (date(2026, 5, 8), "WH-CASABLANCA", "WH-TANGER", "MDF-BRU-18-2500-1220", 15, "LOT-2026-041"),
]

# ---------------------------------------------------------------------------
# Build the ledger plan (chronology keeps stock >= 0 at every step).
#   * opening  = end_stock + (August sales not re-purchased) + transfers out
#   * purchase = same qty as that month's sale, on day 3 (months 1-7)
#   * transfer = day 8
#   * sale     = day 20, split across two clients per month
# ---------------------------------------------------------------------------
CLIENT_ROTATION = {
    1: ["CLI-MENUISERIE", "CLI-CHARENTE"],
    2: ["CLI-MOBILIER", "CLI-EBENISTE"],
    3: ["CLI-CONSTRUCT", "CLI-PARQUET"],
    4: ["CLI-BRICO", "CLI-MENUISERIE"],
    5: ["CLI-CHARENTE", "CLI-EBENISTE"],
    6: ["CLI-MOBILIER", "CLI-CONSTRUCT"],
    7: ["CLI-PARQUET", "CLI-BRICO"],
    8: ["CLI-MENUISERIE", "CLI-MOBILIER"],
}

# Imported (fret / marine) suppliers — their POs carry logistics fees so the
# landed-cost margin reports are meaningful vs. domestic panel purchases.
IMPORT_SUPPLIERS = {"SUP-TROPIC", "SUP-OKOUME", "SUP-NOBLE", "SUP-COFFRAGE"}

sales_map = {}
purchases_map = {}

for (sku, _name, _sp, _cat, _grade, _finish, _t, _w, _l, _mc, _cost, _sale, _min, sup, end_stock, sales) in PRODUCTS:
    p = products[sku]
    s8 = sum(q for m, q in sales if m == 8)
    transfer_out = sum(
        q for (_, f, _, tsku, q, _) in TRANSFERS if tsku == sku and f == "WH-CASABLANCA"
    )
    opening = Decimal(end_stock) + Decimal(s8) + Decimal(transfer_out)
    log_stock_movement(
        product=p,
        warehouse=warehouse_main,
        movement_type=StockMovement.MovementType.OPENING,
        quantity=opening,
        note="Stock d'ouverture 2026",
        moved_at=moved_at(date(2026, 1, 2)),
    )
    for m, q in sales:
        sales_map.setdefault(m, []).append((p, Decimal(q)))
        if m < 8:
            purchases_map.setdefault((sku, m), (p, suppliers[sup], Decimal(q)))

po_seq = 0
for m in range(1, 9):
    # Purchases (day 3)
    if m < 8:
        groups = {}
        for (sku, mm), (p, sup_obj, q) in purchases_map.items():
            if mm == m:
                groups.setdefault(p, []).append((sup_obj, q))
        for p in sorted(groups, key=lambda x: x.sku):
            po_seq += 1
            lot = f"LOT-2026-{m:02d}-{po_seq:02d}"
            sup_obj, _ = groups[p][0]
            fees = None
            if sup_obj.code in IMPORT_SUPPLIERS:
                fees = {
                    "freight_cost": Decimal("6000") + Decimal(m) * Decimal("200"),
                    "customs_cost": Decimal("3500"),
                    "handling_cost": Decimal("800"),
                }
            create_purchase(
                sup_obj,
                warehouse_main,
                [{"product": p, "quantity": q, "lot_number": lot} for _, q in groups[p]],
                order_date=date(2026, m, 3),
                moved_at=moved_at(date(2026, m, 3)),
                po_number=f"PO-2026-{m:02d}{po_seq:02d}",
                fees=fees,
            )
    # Transfers (day 8)
    for tdate, f, t, sku, qty, lot in TRANSFERS:
        if tdate.month == m:
            transfer_stock(products[sku], warehouses[f], warehouses[t], qty, lot_number=lot, moved_at=moved_at(tdate))
    # Sales (day 20) — split into two client orders
    items = sales_map.get(m, [])
    if items:
        cA, cB = CLIENT_ROTATION[m]
        half = (len(items) + 1) // 2
        base = f"SO-2026-{m:02d}"
        create_sale(
            clients[cA], warehouse_main,
            [{"product": p, "quantity": q} for p, q in items[:half]],
            order_date=date(2026, m, 20),
            moved_at=moved_at(date(2026, m, 20)),
            so_number=f"{base}A",
        )
        if items[half:]:
            create_sale(
                clients[cB], warehouse_main,
                [{"product": p, "quantity": q} for p, q in items[half:]],
                order_date=date(2026, m, 20),
                moved_at=moved_at(date(2026, m, 20)),
                so_number=f"{base}B",
            )

# ---------------------------------------------------------------------------
# Client payments: settle every invoice except the most recent (half paid).
# Each client keeps a small, in-terms outstanding balance well under its
# credit limit — the receivables dashboard stays healthy yet non-trivial.
# ---------------------------------------------------------------------------
so_by_client = {}
for so in SalesOrder.objects.select_related("client").order_by("order_date", "id"):
    so_by_client.setdefault(so.client_id, []).append(so)

for _sos in so_by_client.values():
    for _i, so in enumerate(_sos):
        _fraction = Decimal("1") if _i < len(_sos) - 1 else Decimal("0.5")
        _amount = (so.total_amount * _fraction).quantize(Decimal("0.01"))
        if _amount <= 0:
            continue
        create_payment(
            client=so.client,
            amount=_amount,
            sales_order=so,
            payment_date=(so.order_date or date(2026, 8, 18)) + timedelta(days=15),
            method="Virement",
            reference=f"REG-{so.so_number}",
            note="Règlement démo",
        )
print(f"payments seeded: {Payment.objects.count()}")

# ---------------------------------------------------------------------------
# Kiln drying (Séchoirs): lifecycle batches (in_progress → completed|cancelled)
# linked to dedicated kiln units, with energy cost and estimated end date.
# Drying tracks the charge — it does not consume inventory. Completed rows are
# created directly so catalog prices stay idempotent across runs (the
# energy-cost price bump is exercised by the automated test suite instead).
# ---------------------------------------------------------------------------
_d_now = timezone.now()


def _upsert_kiln(code, name, warehouse, capacity):
    k, _ = Kiln.objects.get_or_create(
        code=code,
        defaults={"name": name, "warehouse": warehouse, "max_capacity_m3": capacity},
    )
    if k.name != name or k.warehouse_id != warehouse.pk or k.max_capacity_m3 != capacity:
        k.name, k.warehouse, k.max_capacity_m3 = name, warehouse, capacity
        k.save()
    return k


def _volume_m3(product, qty):
    return (product.volume_cubic_m or Decimal("0")) * Decimal(str(qty))


_kiln_a = _upsert_kiln("SEC-1", "Séchoir Casablanca 1", warehouse_main, Decimal("60"))
_kiln_b = _upsert_kiln("SEC-2", "Séchoir Casablanca 2", warehouse_main, Decimal("40"))
_kiln_c = _upsert_kiln("SEC-3", "Séchoir Tanger", warehouse_out, Decimal("50"))

# KD-2026-001 — Chêne, en cours (SEC-1), humidité 14 → 13.2 (≈16 %).
_p = products["CHE-027-145-2500"]
DryingBatch.objects.create(
    batch_no="KD-2026-001",
    product=_p,
    kiln=_kiln_a,
    warehouse=warehouse_main,
    status=DryingBatch.Status.IN_PROGRESS,
    quantity=Decimal("2400"),
    initial_volume_m3=_volume_m3(_p, 2400),
    start_moisture=Decimal("14"),
    target_moisture=Decimal("9"),
    current_moisture=Decimal("13.2"),
    energy_cost=Decimal("1200"),
    estimated_end_date=_d_now.date() + timedelta(days=12),
    notes="Chargement chêne — séchage en cours.",
    started_at=_d_now - timedelta(days=2),
)

# KD-2026-002 — Noyer, en cours (SEC-2), humidité 13 → 9.5 (≈70 %).
_p = products["NOY-040-120-2500"]
DryingBatch.objects.create(
    batch_no="KD-2026-002",
    product=_p,
    kiln=_kiln_b,
    warehouse=warehouse_main,
    status=DryingBatch.Status.IN_PROGRESS,
    quantity=Decimal("2000"),
    initial_volume_m3=_volume_m3(_p, 2000),
    start_moisture=Decimal("13"),
    target_moisture=Decimal("8"),
    current_moisture=Decimal("9.5"),
    energy_cost=Decimal("900"),
    estimated_end_date=_d_now.date() + timedelta(days=9),
    notes="Pré-séchage à l'air terminé — passage séchoir.",
    started_at=_d_now - timedelta(days=6),
)

# KD-2026-003 — Sapin, terminé (SEC-1) après 17 jours ; 1500 MAD d'énergie.
_p = products["SAP-027-145-3000"]
DryingBatch.objects.create(
    batch_no="KD-2026-003",
    product=_p,
    kiln=_kiln_a,
    warehouse=warehouse_main,
    status=DryingBatch.Status.COMPLETED,
    quantity=Decimal("3000"),
    initial_volume_m3=_volume_m3(_p, 3000),
    start_moisture=Decimal("16"),
    target_moisture=Decimal("12"),
    current_moisture=Decimal("12"),
    energy_cost=Decimal("1500"),
    notes="Sortie séchoir — prêt à vendre.",
    started_at=_d_now - timedelta(days=20),
    completed_at=_d_now - timedelta(days=3),
)

# KD-2025-009 — Chevron épicéa, terminé (SEC-2) après 14 jours.
_p = products["EPC-063-175-4000"]
DryingBatch.objects.create(
    batch_no="KD-2025-009",
    product=_p,
    kiln=_kiln_b,
    warehouse=warehouse_main,
    status=DryingBatch.Status.COMPLETED,
    quantity=Decimal("1500"),
    initial_volume_m3=_volume_m3(_p, 1500),
    start_moisture=Decimal("15"),
    target_moisture=Decimal("11"),
    current_moisture=Decimal("11"),
    energy_cost=Decimal("800"),
    started_at=_d_now - timedelta(days=40),
    completed_at=_d_now - timedelta(days=26),
)

# KD-2026-000 — Dibétou, annulé (SEC-3).
_p = products["DIB-027-200-3000"]
DryingBatch.objects.create(
    batch_no="KD-2026-000",
    product=_p,
    kiln=_kiln_c,
    warehouse=warehouse_out,
    status=DryingBatch.Status.CANCELLED,
    quantity=Decimal("800"),
    initial_volume_m3=_volume_m3(_p, 800),
    start_moisture=Decimal("20"),
    target_moisture=Decimal("10"),
    current_moisture=Decimal("19"),
    energy_cost=Decimal("350"),
    estimated_end_date=_d_now.date() + timedelta(days=15),
    notes="Cycle suspendu — humidité extérieure élevée.",
    started_at=_d_now - timedelta(days=8),
)
print(f"kilns seeded: {Kiln.objects.count()} | drying batches seeded: {DryingBatch.objects.count()}")

# ---------------------------------------------------------------------------
# Reorder thresholds (m³): curate a realistic alert policy so the stock-level
# dashboard alerts showcase the enterprise "reorder" workflow. The threshold
# is anchored slightly above each product's current standing volume so a few
# well-chosen items (rare noble/exotic woods, high-turnover panels) trigger
# the alert while the rest stay healthy.
# ---------------------------------------------------------------------------
REORDER_FACTORS = {
    "PR-020-100-3000": 1.4,     # volige à rotation rapide
    "MDF-BRU-18-2500-1220": 1.3,
    "SAP-027-145-3000": 1.6,
    "KOS-050-150-3000": 1.9,
    "DIB-027-200-3000": 1.9,
    "IRO-050-150-3000": 2.2,
    "NOY-040-120-2500": 2.4,
    "HLG-18-2800-2070": 1.7,
}
for _sku, _factor in REORDER_FACTORS.items():
    _p = products.get(_sku)
    if _p is None:
        continue
    _p.reorder_threshold_m3 = Decimal(str(round(float(_p.stock_volume_m3) * _factor, 4)))
    _p.save(update_fields=["reorder_threshold_m3"])

_alerted = Product.objects.filter(is_active=True, reorder_threshold_m3__gt=0).count()
print(f"reorder thresholds set on {len(REORDER_FACTORS)} products "
      f"(active with a threshold: {_alerted})")

# ---------------------------------------------------------------------------
# Build monthly archives for months 1-7 (August = current, not archived)
# ---------------------------------------------------------------------------
import calendar as _cal
from stock.models import MonthlyArchive

MONTH_NAMES = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
               "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

MonthlyArchive.objects.all().delete()
print("\nBuilding monthly archives for Jan–Jul 2026...")

for _yr in [2026]:
    for _mo in range(1, 8):
        _last = _cal.monthrange(_yr, _mo)[1]
        _end_dt = moved_at(date(_yr, _mo, _last))
        _start_dt = moved_at(date(_yr, _mo, 1))

        # All product-warehouse pairs that have any movement by end of this month.
        # NOTE: .order_by() clears the model default ordering (-moved_at), which
        # would otherwise be appended to the SELECT and defeat DISTINCT.
        _pairs = (
            StockMovement.objects.filter(moved_at__lte=_end_dt)
            .order_by()
            .values("product_id", "warehouse_id")
            .distinct()
        )

        _archived = 0
        for _pair in _pairs:
            _pid = _pair["product_id"]
            _wid = _pair["warehouse_id"]

            # Cumulative closing balance (all movements Jan 1 → end of month).
            # The ledger stores sale_out / transfer_out / purchase_return as
            # POSITIVE quantities (the DB trigger negates them); so sum the
            # signed effect: add inflows, subtract outflows.
            _closing = (
                StockMovement.objects.filter(
                    product_id=_pid, warehouse_id=_wid, moved_at__lte=_end_dt
                )
                .aggregate(
                    sign=Sum(
                        Case(
                            When(movement_type__in=["purchase_in", "sale_return", "transfer_in", "opening"], then=F("quantity")),
                            When(movement_type__in=["sale_out", "purchase_return", "transfer_out"], then=-F("quantity")),
                            default=F("quantity"),
                            output_field=DecimalField(max_digits=14, decimal_places=4),
                        )
                    )
                )["sign"]
                or Decimal("0")
            )

            # Monthly aggregates (movements within this month only)
            _agg = StockMovement.objects.filter(
                product_id=_pid, warehouse_id=_wid,
                moved_at__gte=_start_dt, moved_at__lte=_end_dt,
            ).aggregate(
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

            _prod = Product.objects.get(pk=_pid)
            _closing_value = _closing * (_prod.cost_price or Decimal("0"))

            MonthlyArchive.objects.create(
                year=_yr,
                month=_mo,
                product_id=_pid,
                warehouse_id=_wid,
                closing_qty=_closing,
                closing_value=_closing_value,
                purchase_qty=_agg["purchase_qty"] or Decimal("0"),
                purchase_value=Decimal(str(_agg["purchase_value"] or 0)),
                sale_qty=_agg["sale_qty"] or Decimal("0"),
                sale_value=Decimal(str(_agg["sale_value"] or 0)),
                transfer_in_qty=_agg["transfer_in_qty"] or Decimal("0"),
                transfer_out_qty=_agg["transfer_out_qty"] or Decimal("0"),
                adjustment_qty=_agg["adjustment_qty"] or Decimal("0"),
                opening_qty=_agg["opening_qty"] or Decimal("0"),
            )
            _archived += 1

        print(f"  {MONTH_NAMES[_mo]:>10s} {_yr}: {_archived} rows archived")

# ---------------------------------------------------------------------------
# Demo user + summary
# ---------------------------------------------------------------------------
from django.contrib.auth import get_user_model

User = get_user_model()
user, _ = User.objects.get_or_create(username="demo")
user.is_staff = True
user.set_password("demo2026")
user.save()

print("\n--- KOUDI STOCK demo data ready ---")
for fam in ["Bois rouge", "Bois blanc", "Bois exotique", "Bois noble", "Panneaux", "Coffrage"]:
    print(f"  {fam:14s}: {Product.objects.filter(category=fam, is_active=True).count()} produits")
print(f"  fournisseurs : {Supplier.objects.count()} | clients : {Client.objects.count()}")
print(f"  purchase POs : {PurchaseOrder.objects.count()} | sales SOs : {SalesOrder.objects.count()}")
print(f"  mouvements   : {StockMovement.objects.count()} | lignes inventaire : {Inventory.objects.count()}")
print(f"  paiements    : {Payment.objects.count()} | kilns : {Kiln.objects.count()} | lots séchage : {DryingBatch.objects.count()}")

print("\n  crédit clients (impayé / plafond):")
for c in Client.objects.filter(is_active=True).order_by("code"):
    s = client_credit_summary(c)
    flag = " ⚠ BLOQUÉ" if s["is_blocked"] else (" ⚠ dépassé" if s["over_limit"] else "")
    print(f"    {c.code:16s} {float(s['outstanding']):>12,.0f} / {float(s['credit_limit']):>12,.0f} MAD  (retard {float(s['overdue']):>8,.0f}){flag}")
print("\nDemo user:  demo / demo2026")
