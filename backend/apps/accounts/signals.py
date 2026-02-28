from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import ClientStats, RoleChoices, User


@receiver(post_save, sender=User)
def ensure_client_stats(sender, instance: User, created: bool, **kwargs):
    if instance.role == RoleChoices.CLIENT:
        ClientStats.objects.get_or_create(user=instance)
