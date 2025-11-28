"""
Django management command to clean up unpublished "Untitled Project" entries.
"""

from django.core.management.base import BaseCommand

from core.projects.models import Project


class Command(BaseCommand):
    help = "Delete unpublished 'Untitled Project' entries that clutter the UI"

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            help='Only clean projects for specific username',
        )
        parser.add_argument('--dry-run', action='store_true', help='Show what would be deleted without deleting')

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        username = options.get('username')

        # Find all unpublished projects titled "Untitled Project"
        query = Project.objects.filter(title='Untitled Project', is_published=False)

        if username:
            query = query.filter(user__username=username)

        projects_to_delete = list(query)

        if not projects_to_delete:
            self.stdout.write(self.style.SUCCESS('No untitled projects found to clean up.'))
            return

        self.stdout.write(f'\nFound {len(projects_to_delete)} untitled project(s) to delete:')
        for proj in projects_to_delete:
            self.stdout.write(
                f"  • ID {proj.id}: '{proj.title}' by @{proj.user.username} "
                f'(showcase={proj.is_showcase}, created={proj.created_at.strftime("%Y-%m-%d")})'
            )

        if dry_run:
            self.stdout.write(self.style.WARNING('\n[DRY RUN] No projects were deleted.'))
            return

        # Delete the projects
        deleted_count, _ = query.delete()

        self.stdout.write(self.style.SUCCESS(f'\n✓ Successfully deleted {deleted_count} untitled project(s)!'))
