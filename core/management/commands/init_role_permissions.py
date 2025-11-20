"""
Management command to initialize role permissions in the database.
Run this after migrations: python manage.py init_role_permissions
"""
from django.core.management.base import BaseCommand

from core.users.models import UserRole
from core.users.role_models import RolePermission


class Command(BaseCommand):
    help = "Initialize role permissions in the database"

    def handle(self, *args, **options):
        roles_data = [
            {
                "role": UserRole.EXPLORER,
                "display_name": "Explorer",
                "description": "New members exploring the platform. Can create projects and use basic AI features.",
                "badge_color": "slate",
                "hierarchy_level": 1,
                "can_create_projects": True,
                "max_projects": 10,
                "can_create_showcase": False,
                "max_showcase_projects": 0,
                "can_access_ai_chat": True,
                "ai_requests_per_day": 10,
                "can_mentor_users": False,
                "can_access_mentorship": True,
                "can_access_premium_features": False,
                "can_moderate_content": False,
                "can_manage_users": False,
            },
            {
                "role": UserRole.EXPERT,
                "display_name": "Expert",
                "description": (
                    "Experienced members who contribute quality content. " "Increased project limits and AI usage."
                ),
                "badge_color": "blue",
                "hierarchy_level": 2,
                "can_create_projects": True,
                "max_projects": 25,
                "can_create_showcase": True,
                "max_showcase_projects": 5,
                "can_access_ai_chat": True,
                "ai_requests_per_day": 50,
                "can_mentor_users": False,
                "can_access_mentorship": True,
                "can_access_premium_features": False,
                "can_moderate_content": False,
                "can_manage_users": False,
            },
            {
                "role": UserRole.MENTOR,
                "display_name": "Mentor",
                "description": (
                    "Trusted community members who guide and support others. "
                    "Can mentor users and access exclusive features."
                ),
                "badge_color": "purple",
                "hierarchy_level": 3,
                "can_create_projects": True,
                "max_projects": 50,
                "can_create_showcase": True,
                "max_showcase_projects": 15,
                "can_access_ai_chat": True,
                "ai_requests_per_day": 100,
                "can_mentor_users": True,
                "can_access_mentorship": True,
                "can_access_premium_features": True,
                "can_moderate_content": False,
                "can_manage_users": False,
            },
            {
                "role": UserRole.PATRON,
                "display_name": "Patron",
                "description": (
                    "Premium supporters of the platform. Unlimited projects, " "priority support, and premium features."
                ),
                "badge_color": "amber",
                "hierarchy_level": 4,
                "can_create_projects": True,
                "max_projects": 999,  # Effectively unlimited
                "can_create_showcase": True,
                "max_showcase_projects": 999,
                "can_access_ai_chat": True,
                "ai_requests_per_day": 500,
                "can_mentor_users": False,
                "can_access_mentorship": True,
                "can_access_premium_features": True,
                "can_moderate_content": False,
                "can_manage_users": False,
            },
            {
                "role": UserRole.ADMIN,
                "display_name": "Admin",
                "description": "Platform administrators with full access to moderate content and manage users.",
                "badge_color": "red",
                "hierarchy_level": 5,
                "can_create_projects": True,
                "max_projects": 999,
                "can_create_showcase": True,
                "max_showcase_projects": 999,
                "can_access_ai_chat": True,
                "ai_requests_per_day": 999,
                "can_mentor_users": True,
                "can_access_mentorship": True,
                "can_access_premium_features": True,
                "can_moderate_content": True,
                "can_manage_users": True,
            },
        ]

        for role_data in roles_data:
            role_permission, created = RolePermission.objects.update_or_create(
                role=role_data["role"], defaults=role_data
            )

            if created:
                self.stdout.write(self.style.SUCCESS(f'Created role permissions for: {role_data["display_name"]}'))
            else:
                self.stdout.write(self.style.SUCCESS(f'Updated role permissions for: {role_data["display_name"]}'))

        self.stdout.write(self.style.SUCCESS("\nRole permissions initialized successfully!"))
