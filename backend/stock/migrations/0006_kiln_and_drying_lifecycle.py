# Generated manually for the Séchoir module refactor:
#   - new `kilns` table (Séchoir units with capacity)
#   - DryingBatch lifecycle status (in_progress / completed / cancelled) replacing
#     the green/air_dried/kd stages, plus kiln FK, initial_volume_m3,
#     estimated_end_date and energy_cost.
from decimal import Decimal

from django.db import migrations, models


def _forward(apps, schema_editor):
    DryingBatch = apps.get_model("stock", "DryingBatch")
    Product = apps.get_model("stock", "Product")
    for b in DryingBatch.objects.all():
        vol = b.initial_volume_m3 or Decimal("0")
        if vol <= 0 and b.product_id:
            p = Product.objects.filter(pk=b.product_id).first()
            if p and p.volume_cubic_m:
                vol = p.volume_cubic_m * b.quantity
        b.initial_volume_m3 = vol.quantize(Decimal("0.0001"))
        if b.status in ("green", "air_dried"):
            b.status = "in_progress"
        elif b.status == "kd":
            b.status = "completed"
        b.save(update_fields=["status", "initial_volume_m3"])


def _backward(apps, schema_editor):
    DryingBatch = apps.get_model("stock", "DryingBatch")
    for b in DryingBatch.objects.all():
        b.status = "completed" if b.status == "completed" else "in_progress"
        b.save(update_fields=["status"])


class Migration(migrations.Migration):

    dependencies = [
        ("stock", "0005_maintain_inventory_trigger"),
    ]

    operations = [
        migrations.CreateModel(
            name="Kiln",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.TextField(unique=True)),
                ("name", models.TextField()),
                (
                    "max_capacity_m3",
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal("0"),
                        help_text="Capacité maximale du séchoir en m³.",
                        max_digits=14,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "warehouse",
                    models.ForeignKey(
                        on_delete=models.deletion.PROTECT,
                        to="stock.warehouse",
                        db_index=True,
                    ),
                ),
            ],
            options={
                "db_table": "kilns",
                "ordering": ["code"],
            },
        ),
        migrations.AddField(
            model_name="dryingbatch",
            name="kiln",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="batches",
                to="stock.kiln",
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name="dryingbatch",
            name="initial_volume_m3",
            field=models.DecimalField(
                decimal_places=4,
                default=Decimal("0"),
                help_text="Volume de bois chargé (m³), figé à la création.",
                max_digits=14,
            ),
        ),
        migrations.AddField(
            model_name="dryingbatch",
            name="estimated_end_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="dryingbatch",
            name="energy_cost",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Coût énergétique / exploitation du cycle (MAD).",
                max_digits=14,
            ),
        ),
        migrations.RunPython(_forward, _backward),
    ]