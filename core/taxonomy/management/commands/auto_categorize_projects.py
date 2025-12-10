"""
Management command to auto-categorize existing projects that have no category.

Usage:
    python manage.py auto_categorize_projects [--dry-run] [--limit N]

This command retroactively applies AI-based category assignment to existing
projects that don't have a category assigned.
"""

from django.core.management.base import BaseCommand
from django.db.models import Count

from core.projects.models import Project
from core.taxonomy.services import auto_assign_category_to_project


class Command(BaseCommand):
    help = 'Auto-categorize existing projects without categories using AI'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--limit',
            type=int,
            help='Limit number of projects to process',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Re-categorize even if project already has categories',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        limit = options.get('limit')
        force = options.get('force', False)

        self.stdout.write(self.style.SUCCESS('Starting auto-categorize process...'))

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))

        # Get projects without categories (or all if force)
        if force:
            queryset = Project.objects.filter(is_archived=False)
        else:
            queryset = (
                Project.objects.filter(is_archived=False)
                .annotate(category_count=Count('categories'))
                .filter(category_count=0)
            )

        if limit:
            queryset = queryset[:limit]
            self.stdout.write(f'Limiting to {limit} projects')

        project_count = queryset.count()
        self.stdout.write(f'Found {project_count} projects to process\n')

        # Track statistics
        processed = 0
        categorized = 0
        errors = 0

        for project in queryset:
            try:
                self.stdout.write(f'Processing: {project.user.username if project.user else "no-user"}/{project.slug}')
                self.stdout.write(f'  Title: {project.title}')
                self.stdout.write(f'  Type: {project.type}')

                if dry_run:
                    self.stdout.write(self.style.NOTICE('  [DRY RUN] Would attempt AI categorization'))
                else:
                    category = auto_assign_category_to_project(project, force=force)
                    if category:
                        categorized += 1
                        self.stdout.write(self.style.SUCCESS(f'  Assigned category: {category.name}'))
                    else:
                        self.stdout.write(self.style.WARNING('  No category assigned'))

                processed += 1
                self.stdout.write('')  # Blank line

            except Exception as e:
                errors += 1
                self.stdout.write(self.style.ERROR(f'  Error processing project: {e}'))
                self.stdout.write('')

        # Summary
        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(self.style.SUCCESS('Auto-categorization complete!'))
        self.stdout.write(f'Projects processed: {processed}')
        if not dry_run:
            self.stdout.write(f'Projects categorized: {categorized}')
        self.stdout.write(f'Errors: {errors}')
