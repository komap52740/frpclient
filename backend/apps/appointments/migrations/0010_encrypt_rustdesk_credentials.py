from django.db import migrations

import apps.common.crypto_fields


def encrypt_existing_rustdesk_credentials(apps, schema_editor):
    Appointment = apps.get_model("appointments", "Appointment")
    db_alias = schema_editor.connection.alias
    queryset = Appointment.objects.using(db_alias).all().only("id", "rustdesk_id", "rustdesk_password")
    for appointment in queryset.iterator(chunk_size=200):
        Appointment.objects.using(db_alias).filter(pk=appointment.pk).update(
            rustdesk_id=appointment.rustdesk_id or "",
            rustdesk_password=appointment.rustdesk_password or "",
        )


class Migration(migrations.Migration):

    dependencies = [
        ("appointments", "0009_alter_appointment_lock_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="appointment",
            name="rustdesk_id",
            field=apps.common.crypto_fields.EncryptedTextField(blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="appointment",
            name="rustdesk_password",
            field=apps.common.crypto_fields.EncryptedTextField(blank=True, default=""),
        ),
        migrations.RunPython(encrypt_existing_rustdesk_credentials, migrations.RunPython.noop),
    ]
