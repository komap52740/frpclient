from django.contrib.admin.apps import AdminConfig


class FRPAdminConfig(AdminConfig):
    default_site = "config.admin_site.build_admin_site"
