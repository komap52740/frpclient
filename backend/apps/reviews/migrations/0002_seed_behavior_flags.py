from django.db import migrations


FLAGS = [
    ("bad_internet", "Проблемный интернет"),
    ("weak_pc", "Слабый ПК"),
    ("difficult_client", "Сложный клиент"),
    ("did_not_follow_instructions", "Не следовал инструкциям"),
    ("late_to_session", "Опоздал к подключению"),
    ("good_connection", "Отличная связь"),
    ("well_prepared", "Подготовлен заранее"),
]


def seed_flags(apps, schema_editor):
    BehaviorFlag = apps.get_model("reviews", "BehaviorFlag")
    for code, label in FLAGS:
        BehaviorFlag.objects.get_or_create(code=code, defaults={"label": label, "is_active": True})


def unseed_flags(apps, schema_editor):
    BehaviorFlag = apps.get_model("reviews", "BehaviorFlag")
    BehaviorFlag.objects.filter(code__in=[code for code, _ in FLAGS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("reviews", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_flags, reverse_code=unseed_flags),
    ]
