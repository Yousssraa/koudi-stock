"""Rebuild the reference price grid (grille de Tarifs) as one line per wood
species, priced at the real market rate of the matching products.

Idempotent: existing lines are updated to the target price; old lines that no
longer match the new per-species shape are removed. Only sale_price-style
public figures are touched (the ReferencePrice grid is the pricing reference
shown on /app/tarifs and should mirror the catalogue prices).

Run:  python manage.py rebuild_reference_grid
"""

from decimal import Decimal

from django.core.management.base import BaseCommand

from stock.models import ReferencePrice, WoodType


class Command(BaseCommand):
    help = "Rebuild the reference-price grid as one line per wood species at real market prices."

    # species -> (category, target, price_mad)
    # Prices are real m3 rates matching the catalogue products shown on the
    # public shop / homepage.
    GRID = [
        ("Sapin du Nord Rouge", "Bois de Construction", "timber", 3400),
        ("Pin sylvestre", "Bois de Construction", "timber", 4800),
        ("Épicéa", "Bois de Construction", "timber", 4400),
        ("Eucalyptus", "Bois de Construction", "timber", 4800),
        ("Chêne Américain", "Bois Feuillus & Nobles", "timber", 11500),
        ("Sapelli", "Bois Feuillus & Nobles", "timber", 12500),
        ("Iroko", "Bois Feuillus & Nobles", "timber", 17500),
        ("Kossipo", "Bois Feuillus & Nobles", "timber", 13000),
        ("Dabema", "Bois Feuillus & Nobles", "timber", 12000),
        ("Dibétou", "Bois Feuillus & Nobles", "timber", 15000),
        ("Hêtre Étuvé", "Bois Feuillus & Nobles", "timber", 8000),
        ("Noyer", "Bois Feuillus & Nobles", "timber", 35000),
        ("Okoumé", "Panneaux & Dérivés", "timber", 9500),
    ]

    def handle(self, *args, **options):
        target_map = {
            "timber": ReferencePrice.Target.TIMBER,
            "panel": ReferencePrice.Target.PANEL,
        }

        # 1) Upsert the per-species lines.
        kept = set()
        for name, category, target, price in self.GRID:
            wt = WoodType.objects.filter(name=name).first()
            if wt is None:
                self.stdout.write(self.style.WARNING(f"  ! essence introuvable : {name}"))
                continue
            tgt = target_map[target]
            rp, created = ReferencePrice.objects.get_or_create(
                wood_type=wt,
                category=category,
                piece_type="",
                treatment="",
                target=tgt,
                defaults=dict(unit_price_mad=Decimal(str(price)), is_active=True),
            )
            kept.add(rp.pk)
            if created:
                action = "+"
            elif rp.unit_price_mad != Decimal(str(price)):
                rp.unit_price_mad = Decimal(str(price))
                rp.save(update_fields=["unit_price_mad", "updated_at"])
                action = "~"
            else:
                action = "="
            self.stdout.write(
                f"  {action} {name}: {price} MAD/{'m³' if tgt == ReferencePrice.Target.TIMBER else 'unité'}"
            )

        # 2) Remove any legacy lines that don't belong to the per-species grid.
        stale = ReferencePrice.objects.exclude(pk__in=kept or [0]).all()
        removed = 0
        for rp in stale:
            rp.delete()
            removed += 1
        if removed:
            self.stdout.write(f"  - {removed} ancienne(s) ligne(s) supprimée(s)")

        self.stdout.write(self.style.SUCCESS(
            f"Grille de référence reconstruite : {len(kept)} lignes (une par essence)."
        ))
