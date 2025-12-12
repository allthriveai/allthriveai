"""Management command to backfill tools for RSS articles missing them."""

import logging

from django.core.management.base import BaseCommand
from django.db.models import Count

from core.projects.models import Project
from core.tools.models import Tool
from services.integrations.rss.sync import RSSFeedSyncService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Backfill tools for RSS articles that are missing them using AI extraction'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=50,
            help='Maximum number of articles to process (default: 50)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        limit = options['limit']

        # Find RSS articles without tools
        articles_without_tools = (
            Project.objects.filter(type='rss_article')
            .annotate(tool_count=Count('tools'))
            .filter(tool_count=0)
            .select_related('user')[:limit]
        )

        total = articles_without_tools.count()
        self.stdout.write(f'Found {total} RSS articles without tools')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no changes will be made'))

        # Get all active tools for AI extraction
        available_tools = Tool.objects.filter(is_active=True)
        self.stdout.write(f'Available tools in taxonomy: {available_tools.count()}')

        processed = 0
        updated = 0
        no_match = 0

        for article in articles_without_tools:
            processed += 1
            self.stdout.write(f'\n[{processed}/{total}] Processing: {article.title[:60]}...')
            self.stdout.write(f'  User: {article.user.username}')

            # Build item_data from the article
            item_data = {
                'title': article.title,
                'description': article.description or '',
            }

            if dry_run:
                # Just show what AI would suggest
                tools = RSSFeedSyncService._extract_tools_with_ai(item_data, available_tools)
                if tools:
                    self.stdout.write(self.style.SUCCESS(f'  Would add tools: {[t.name for t in tools]}'))
                    updated += 1
                else:
                    self.stdout.write(self.style.WARNING('  No relevant tools found'))
                    no_match += 1
            else:
                # Actually add tools
                RSSFeedSyncService._add_tools_to_project(article, item_data)

                # Check if tools were added
                article.refresh_from_db()
                new_tools = list(article.tools.values_list('name', flat=True))
                if new_tools:
                    self.stdout.write(self.style.SUCCESS(f'  Added tools: {new_tools}'))
                    updated += 1
                else:
                    self.stdout.write(self.style.WARNING('  No relevant tools found'))
                    no_match += 1

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS(f'Processed: {processed}'))
        self.stdout.write(self.style.SUCCESS(f'Updated with tools: {updated}'))
        self.stdout.write(self.style.WARNING(f'No tools found: {no_match}'))

        if dry_run:
            self.stdout.write(self.style.WARNING('\nThis was a dry run. Run without --dry-run to apply changes.'))
