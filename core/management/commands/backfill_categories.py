"""
Management command to backfill categories for existing projects using AI extraction.
Run with: python manage.py backfill_categories
"""

from django.core.management.base import BaseCommand
from django.db.models import Count

from core.projects.models import Project
from services.integrations.rss.sync import RSSFeedSyncService


class Command(BaseCommand):
    help = 'Backfill categories for existing projects using AI extraction'

    def add_arguments(self, parser):
        parser.add_argument(
            '--type',
            type=str,
            choices=['rss_article', 'youtube_video', 'reddit_thread', 'all'],
            default='all',
            help='Only backfill projects of a specific type (default: all)',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=50,
            help='Maximum number of projects to process (default: 50)',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Process all projects without categories (ignores --limit)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        project_type = options.get('type')
        limit = options.get('limit')
        process_all = options.get('all')
        dry_run = options.get('dry_run')

        self.stdout.write('Finding projects without categories...')

        # Build query - projects without any categories
        projects = Project.objects.annotate(category_count=Count('categories')).filter(category_count=0)

        # Filter by project type
        if project_type and project_type != 'all':
            projects = projects.filter(type=project_type)

        # Order by most recent first
        projects = projects.order_by('-created_at')

        if not process_all:
            projects = projects[:limit]

        # Convert to list for counting
        projects = list(projects)
        total_projects = len(projects)

        self.stdout.write(f'Found {total_projects} project(s) without categories')

        if total_projects == 0:
            self.stdout.write(self.style.SUCCESS('All projects have categories!'))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no changes will be made'))

        # Confirm if processing many projects
        if total_projects > 20 and not process_all and not dry_run:
            confirm = input(f'About to process {total_projects} projects with AI. Continue? (y/n): ')
            if confirm.lower() != 'y':
                self.stdout.write(self.style.WARNING('Cancelled.'))
                return

        # Process each project
        success_count = 0
        error_count = 0
        skipped_count = 0

        for i, project in enumerate(projects, 1):
            try:
                self.stdout.write(f'[{i}/{total_projects}] Processing: {project.title[:50]}...')

                if dry_run:
                    # Show what would be done
                    category = RSSFeedSyncService._extract_category_with_ai(
                        title=project.title, description=project.description or ''
                    )
                    if category:
                        self.stdout.write(self.style.SUCCESS(f'  Would assign category: {category}'))
                    else:
                        self.stdout.write(self.style.WARNING('  No category found'))
                        skipped_count += 1
                    success_count += 1
                    continue

                # Build item_data for the AI extraction
                item_data = {
                    'title': project.title,
                    'description': project.description or '',
                    'categories': [],  # No existing RSS categories
                }

                # Use the RSS sync service's category extraction (with AI fallback)
                RSSFeedSyncService._add_categories_to_project(project=project, rss_categories=[], item_data=item_data)

                # Check if category was added
                project.refresh_from_db()
                categories = list(project.categories.values_list('name', flat=True))

                if categories:
                    success_count += 1
                    self.stdout.write(self.style.SUCCESS(f'  Added categories: {", ".join(categories)}'))
                else:
                    skipped_count += 1
                    self.stdout.write(self.style.WARNING('  No category could be determined'))

            except Exception as e:
                error_count += 1
                self.stdout.write(self.style.ERROR(f'  Error: {e}'))

        # Summary
        self.stdout.write('')
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f'DRY RUN complete: {success_count} would succeed, {skipped_count} skipped, {error_count} errors'
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Backfill complete: {success_count} categorized, {skipped_count} skipped, {error_count} errors'
                )
            )
