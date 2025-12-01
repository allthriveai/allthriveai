"""
Management command to reprocess existing Reddit posts with improved AI topic extraction.
Run with: python manage.py reprocess_reddit_topics
"""

from django.core.management.base import BaseCommand

from core.integrations.reddit_models import RedditThread
from services.reddit_sync_service import RedditSyncService


class Command(BaseCommand):
    help = 'Reprocess existing Reddit posts to extract better topics using AI'

    def add_arguments(self, parser):
        parser.add_argument(
            '--bot',
            type=str,
            help='Only reprocess threads from a specific bot (username)',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Maximum number of threads to reprocess (default: 100)',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Reprocess all threads (ignores --limit)',
        )

    def handle(self, *args, **options):
        bot_username = options.get('bot')
        limit = options.get('limit')
        process_all = options.get('all')

        self.stdout.write('🔍 Finding Reddit threads to reprocess...')

        # Build query
        threads = RedditThread.objects.select_related('project', 'bot').all()

        if bot_username:
            threads = threads.filter(bot__bot_user__username=bot_username)

        threads = threads.order_by('-created_utc')

        if not process_all:
            threads = threads[:limit]

        total_threads = threads.count()
        self.stdout.write(f'Found {total_threads} Reddit thread(s) to reprocess')

        if total_threads == 0:
            self.stdout.write(self.style.WARNING('No threads found to reprocess.'))
            return

        # Confirm if processing many threads
        if total_threads > 50 and not process_all:
            confirm = input(f'About to reprocess {total_threads} threads. Continue? (y/n): ')
            if confirm.lower() != 'y':
                self.stdout.write(self.style.WARNING('Cancelled.'))
                return

        # Reprocess each thread
        success_count = 0
        error_count = 0

        for i, thread in enumerate(threads, 1):
            try:
                project = thread.project
                bot = thread.bot

                # Get metrics from stored metadata
                metrics = thread.reddit_metadata or {}

                self.stdout.write(f'[{i}/{total_threads}] Processing: {project.title[:50]}...')

                # Rerun auto-tagging with new AI extraction
                RedditSyncService._auto_tag_project(
                    project=project,
                    metrics=metrics,
                    subreddit=thread.subreddit,
                    bot=bot,
                )

                success_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✅ Updated topics: {project.topics[:5]}{"..." if len(project.topics) > 5 else ""}'
                    )
                )

            except Exception as e:
                error_count += 1
                self.stdout.write(self.style.ERROR(f'  ❌ Error: {e}'))

        # Summary
        self.stdout.write(
            self.style.SUCCESS(f'\n✨ Reprocessing complete: {success_count} succeeded, {error_count} failed')
        )
