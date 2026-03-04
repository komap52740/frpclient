from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0009_user_email_verified_at_user_is_email_verified_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="wholesale_address",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
