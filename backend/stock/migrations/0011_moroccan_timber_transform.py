from decimal import Decimal, InvalidOperation

from django.db import migrations, models


def convert_length_mm_to_m(apps, schema_editor):
    """Backfill ``length_m`` from the old ``length_mm`` column (mm ÷ 1000)."""
    Product = apps.get_model("stock", "Product")
    for obj in Product.objects.filter(length_mm__isnull=False).only("id", "length_mm"):
        try:
            value = Decimal(str(obj.length_mm))
        except (ValueError, InvalidOperation, TypeError):
            continue
        obj.length_m = value / Decimal("1000")
        obj.save(update_fields=["length_m"])


class Migration(migrations.Migration):

    dependencies = [
        ("stock", "0010_public_lead"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="colis_number",
            field=models.TextField(blank=True, help_text='Référence / numéro du colis ou fardeau (Colis/Fardeau Ref).', null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="length_m",
            field=models.DecimalField(blank=True, decimal_places=3, help_text="Longueur en mètres (formule m³ = T_mm × W_mm × L_m × Qté / 1 000 000).", max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="piece_type",
            field=models.TextField(blank=True, choices=[("Madrier", "Madrier"), ("Basting", "Basting"), ("Chevron", "Chevron"), ("Volige", "Volige"), ("Lame de Terrasse", "Lame Terrasse"), ("Poteau Carré", "Poteau Carre"), ("Rondin", "Rondin"), ("Plywood Filmé", "Plywood")], db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="treatment",
            field=models.TextField(blank=True, choices=[("Aucun", "None"), ("Autoclave Cl.3 Vert", "Autoclave Cl3 Vert"), ("Autoclave Cl.4 Marron", "Autoclave Cl4 Marron"), ("Séché KD (Kiln Dried)", "Kiln Dried")], db_index=True, null=True),
        ),
        migrations.AlterField(
            model_name="product",
            name="category",
            field=models.TextField(blank=True, choices=[("Bois de Construction", "Construction"), ("Bois Traité Autoclave", "Autoclave"), ("Bois Feuillus & Nobles", "Feuillus Nobles"), ("Panneaux & Dérivés", "Panneaux")], db_index=True, null=True),
        ),
        migrations.AlterField(
            model_name="product",
            name="reorder_threshold_m3",
            field=models.DecimalField(blank=True, db_index=True, decimal_places=4, help_text="Seuil d'alerte de réapprovisionnement en m³ (min stock): le stock total en volume en dessous de ce seuil déclenche l'alerte.", max_digits=14, null=True),
        ),
        migrations.RunPython(
            convert_length_mm_to_m,
            migrations.RunPython.noop,
        ),
        migrations.RemoveField(
            model_name="product",
            name="length_mm",
        ),
    ]
