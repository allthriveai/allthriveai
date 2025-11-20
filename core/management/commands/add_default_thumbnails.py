"""
Management command to add default AllThrive placeholder thumbnail to projects without thumbnails.
"""
from django.core.management.base import BaseCommand
from django.db import models

from core.projects.models import Project


class Command(BaseCommand):
    help = "Add default AllThrive placeholder thumbnail to all projects without thumbnails"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be updated without making changes",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        # Get all projects without thumbnails
        projects_without_thumbnails = Project.objects.filter(
            models.Q(thumbnail_url__isnull=True) | models.Q(thumbnail_url="")
        )

        count = projects_without_thumbnails.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No projects found without thumbnails."))
            return

        self.stdout.write(f"Found {count} projects without thumbnails.")

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN - No changes will be made"))
            for project in projects_without_thumbnails:
                self.stdout.write(f"  Would update: {project.user.username}/{project.slug} - '{project.title}'")
        else:
            # Update all projects without thumbnails with relative URL
            # The placeholder is served from frontend/public/
            updated = projects_without_thumbnails.update(thumbnail_url="/allthrive-placeholder.svg")

            self.stdout.write(self.style.SUCCESS(f"Successfully updated {updated} projects with default thumbnail"))

            # Show sample of updated projects
            if updated > 0:
                self.stdout.write("\nSample of updated projects:")
                for project in projects_without_thumbnails[:5]:
                    self.stdout.write(f"  ✓ {project.user.username}/{project.slug} - '{project.title}'")
                if updated > 5:
                    self.stdout.write(f"  ... and {updated - 5} more")
