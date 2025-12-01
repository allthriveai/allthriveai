"""
Management command to retroactively moderate Reddit threads that were created
before moderation was implemented or somehow skipped moderation.
"""

import logging

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.integrations.reddit_models import RedditThread
from services.reddit_sync_service import RedditSyncService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Retroactively moderate Reddit threads that were never moderated'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without actually moderating',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help='Limit number of threads to process (0 = no limit)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        limit = options['limit']

        # Find all threads that were never moderated
        unmoderated_threads = RedditThread.objects.filter(moderated_at__isnull=True).select_related('project', 'bot')

        if limit > 0:
            unmoderated_threads = unmoderated_threads[:limit]

        total = unmoderated_threads.count()

        self.stdout.write(self.style.WARNING(f'Found {total} unmoderated threads'))

        if dry_run:
            self.stdout.write(self.style.NOTICE('DRY RUN - No changes will be made\n'))

        stats = {
            'processed': 0,
            'approved': 0,
            'rejected': 0,
            'errors': 0,
        }

        for thread in unmoderated_threads:
            try:
                self.stdout.write(f'\nProcessing: {thread.project.title[:60]}...')
                self.stdout.write(f'  Subreddit: r/{thread.subreddit}')
                self.stdout.write(f'  Score: {thread.score}')
                self.stdout.write(f'  URL: {thread.permalink}')

                # Get the post content from metadata or fetch from Reddit
                metadata = thread.reddit_metadata or {}
                title = thread.project.title
                selftext = metadata.get('selftext', '')
                image_url = metadata.get('image_url', '') or thread.thumbnail_url

                self.stdout.write(f'  Content length: title={len(title)}, selftext={len(selftext)}')

                if not dry_run:
                    # Moderate the content
                    approved, reason, moderation_data = RedditSyncService._moderate_content(
                        title=title,
                        selftext=selftext,
                        image_url=image_url,
                        subreddit=thread.subreddit,
                    )

                    # Update thread with moderation results
                    with transaction.atomic():
                        thread.moderation_status = (
                            RedditThread.ModerationStatus.APPROVED
                            if approved
                            else RedditThread.ModerationStatus.REJECTED
                        )
                        thread.moderation_reason = reason
                        thread.moderation_data = moderation_data
                        thread.moderated_at = timezone.now()
                        thread.save(
                            update_fields=['moderation_status', 'moderation_reason', 'moderation_data', 'moderated_at']
                        )

                        # If rejected, make the project private
                        if not approved:
                            thread.project.is_private = True
                            thread.project.save(update_fields=['is_private'])

                    stats['processed'] += 1
                    if approved:
                        stats['approved'] += 1
                        self.stdout.write(self.style.SUCCESS(f'  ✓ APPROVED: {reason}'))
                    else:
                        stats['rejected'] += 1
                        self.stdout.write(self.style.ERROR(f'  ✗ REJECTED: {reason}'))
                else:
                    # Dry run - just show what would happen
                    stats['processed'] += 1
                    self.stdout.write(self.style.NOTICE('  [DRY RUN] Would moderate this post'))

            except Exception as e:
                stats['errors'] += 1
                self.stdout.write(self.style.ERROR(f'  ERROR: {str(e)}'))
                logger.exception(f'Error moderating thread {thread.id}')

        # Print summary
        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(self.style.SUCCESS(f'\nModeration {"(DRY RUN) " if dry_run else ""}Summary:'))
        self.stdout.write(f'  Total processed: {stats["processed"]}')
        self.stdout.write(self.style.SUCCESS(f'  Approved: {stats["approved"]}'))
        self.stdout.write(self.style.ERROR(f'  Rejected: {stats["rejected"]}'))
        if stats['errors'] > 0:
            self.stdout.write(self.style.ERROR(f'  Errors: {stats["errors"]}'))

        if dry_run:
            self.stdout.write(self.style.WARNING('\nThis was a DRY RUN. Run without --dry-run to apply changes.'))
