from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0010_user_wholesale_address"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="wholesale_city",
            field=models.CharField(blank=True, max_length=128),
        ),
    ]

