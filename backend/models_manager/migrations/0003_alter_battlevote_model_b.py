from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("models_manager", "0002_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="battlevote",
            name="model_b",
            field=models.CharField(
                blank=True,
                help_text="模型B的名称",
                max_length=100,
                null=True,
            ),
        ),
    ]
