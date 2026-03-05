from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0012_user_wholesale_priority_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="wholesale_verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="wholesale_verified_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="verified_service_centers",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
