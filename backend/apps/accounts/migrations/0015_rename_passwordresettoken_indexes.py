from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0014_passwordresettoken"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="passwordresettoken",
            new_name="accounts_pa_user_id_38eca7_idx",
            old_name="accounts_pa_user_id_c7800e_idx",
        ),
        migrations.RenameIndex(
            model_name="passwordresettoken",
            new_name="accounts_pa_expires_01b447_idx",
            old_name="accounts_pa_expires_101598_idx",
        ),
    ]
