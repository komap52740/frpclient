from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0002_message_deleted_by"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MasterQuickReply",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("command", models.CharField(max_length=20)),
                ("title", models.CharField(blank=True, max_length=120)),
                ("text", models.TextField()),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="master_quick_replies", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "ordering": ("command", "id"),
                "unique_together": {("user", "command")},
            },
        ),
        migrations.AddIndex(
            model_name="masterquickreply",
            index=models.Index(fields=["user", "command"], name="chat_mqr_user_cmd_idx"),
        ),
    ]
