from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0011_user_wholesale_city"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="wholesale_priority",
            field=models.CharField(
                choices=[
                    ("standard", "Стандарт"),
                    ("priority", "Приоритет"),
                    ("critical", "Критический"),
                ],
                db_index=True,
                default="standard",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="wholesale_priority_note",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="user",
            name="wholesale_priority_updated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
