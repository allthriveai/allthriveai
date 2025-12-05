"""Backfill published_date for RSS articles from content JSON."""

from datetime import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.projects.models import Project


class Command(BaseCommand):
    help = 'Backfill published_date for RSS articles from content JSON'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )

    def parse_date(self, date_str: str) -> datetime | None:
        """Parse various date formats from RSS content."""
        if not date_str:
            return None

        # Try various formats
        formats = [
            '%B %d, %Y',  # "September 19, 2023"
            '%b %d, %Y',  # "Sep 19, 2023"
            '%Y-%m-%d',  # "2023-09-19"
            '%d %B %Y',  # "19 September 2023"
            '%d %b %Y',  # "19 Sep 2023"
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                # Make timezone-aware
                return timezone.make_aware(dt)
            except ValueError:
                continue

        return None

    def extract_published_date(self, content: dict) -> datetime | None:
        """Extract published date from content JSON structure."""
        if not content or not isinstance(content, dict):
            return None

        # Check sections for overview with Published metric
        sections = content.get('sections', [])
        for section in sections:
            if section.get('type') == 'overview':
                metrics = section.get('content', {}).get('metrics', [])
                for metric in metrics:
                    if metric.get('label') == 'Published':
                        date_str = metric.get('value', '')
                        parsed = self.parse_date(date_str)
                        if parsed:
                            return parsed

        return None

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Get all RSS articles without published_date
        rss_articles = Project.objects.filter(
            type='rss_article',
            published_date__isnull=True,
        )

        total = rss_articles.count()
        updated = 0
        failed = 0

        self.stdout.write(f'Found {total} RSS articles without published_date')

        for project in rss_articles:
            published_date = self.extract_published_date(project.content)

            if published_date:
                if dry_run:
                    self.stdout.write(f'  Would update "{project.title}" -> {published_date.strftime("%Y-%m-%d")}')
                else:
                    project.published_date = published_date
                    project.save(update_fields=['published_date'])
                    self.stdout.write(
                        self.style.SUCCESS(f'  Updated "{project.title}" -> {published_date.strftime("%Y-%m-%d")}')
                    )
                updated += 1
            else:
                self.stdout.write(self.style.WARNING(f'  Could not parse date for "{project.title}"'))
                failed += 1

        if dry_run:
            self.stdout.write(self.style.WARNING(f'\nDry run: Would update {updated}/{total} articles'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\nUpdated {updated}/{total} articles'))

        if failed:
            self.stdout.write(self.style.WARNING(f'Failed to parse dates for {failed} articles'))
