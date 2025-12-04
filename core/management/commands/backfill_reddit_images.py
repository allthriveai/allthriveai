"""
Management command to backfill high-resolution images for existing Reddit threads.
Run with: python manage.py backfill_reddit_images

This command fetches full-size images from Reddit's JSON API and updates
existing threads that have small thumbnail URLs.
"""

import time

from django.core.management.base import BaseCommand

from core.integrations.reddit_models import RedditThread
from services.integrations.reddit.sync import RedditSyncService


class Command(BaseCommand):
    help = 'Backfill high-resolution images for existing Reddit threads'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Maximum number of threads to process (default: 100)',
        )
        parser.add_argument(
            '--agent',
            type=str,
            help='Only process threads from a specific agent username',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Process all threads, not just those with thumbnail URLs',
        )
        parser.add_argument(
            '--delay',
            type=float,
            default=1.0,
            help='Delay in seconds between API requests (default: 1.0)',
        )

    def handle(self, *args, **options):
        limit = options['limit']
        agent_username = options.get('agent')
        dry_run = options.get('dry_run', False)
        process_all = options.get('all', False)
        delay = options.get('delay', 1.0)

        # Build queryset
        threads = RedditThread.objects.select_related('project', 'agent__agent_user')

        if agent_username:
            threads = threads.filter(agent__agent_user__username=agent_username)

        if not process_all:
            # Only process threads that likely have small thumbnails
            # Reddit thumbnails are usually from "b.thumbs.redditmedia.com" or small preview.redd.it
            threads = threads.filter(thumbnail_url__contains='thumbs.redditmedia.com') | threads.filter(
                thumbnail_url__contains='preview.redd.it'
            ).filter(
                thumbnail_url__contains='width=108'  # Small thumbnail indicator
            )

        threads = threads.order_by('-created_utc')[:limit]
        total = threads.count()

        if total == 0:
            self.stdout.write(self.style.WARNING('No threads found matching criteria.'))
            return

        self.stdout.write(f'Processing {total} thread(s)...\n')

        updated = 0
        skipped = 0
        errors = 0

        for i, thread in enumerate(threads, 1):
            try:
                old_url = thread.thumbnail_url  # noqa: F841 - for debugging

                # Fetch fresh metrics including high-res image
                self.stdout.write(f'[{i}/{total}] Fetching: {thread.reddit_post_id}...')
                metrics = RedditSyncService.fetch_post_metrics(thread.permalink)

                # Get best image URL
                new_url = ''
                if metrics.get('is_gallery') and metrics.get('gallery_images'):
                    new_url = metrics['gallery_images'][0]
                elif metrics.get('image_url'):
                    new_url = metrics['image_url']

                if not new_url:
                    self.stdout.write(self.style.WARNING('  No high-res image found, skipping'))
                    skipped += 1
                    continue

                # Check if it's actually different
                if new_url == old_url:
                    self.stdout.write('  Image already up-to-date')
                    skipped += 1
                    continue

                if dry_run:
                    self.stdout.write('  Would update:')
                    self.stdout.write(f'    Old: {old_url[:80]}...' if len(old_url) > 80 else f'    Old: {old_url}')
                    self.stdout.write(f'    New: {new_url[:80]}...' if len(new_url) > 80 else f'    New: {new_url}')
                    updated += 1
                else:
                    # Update thread and project
                    thread.thumbnail_url = new_url
                    thread.save(update_fields=['thumbnail_url'])

                    thread.project.featured_image_url = new_url
                    thread.project.save(update_fields=['featured_image_url'])

                    self.stdout.write(self.style.SUCCESS('  ✅ Updated to high-res image'))
                    updated += 1

                # Rate limit to avoid hammering Reddit
                time.sleep(delay)

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  ❌ Error: {e}'))
                errors += 1
                continue

        # Summary
        self.stdout.write('')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes made'))
        self.stdout.write(self.style.SUCCESS(f'Done! Updated: {updated}, Skipped: {skipped}, Errors: {errors}'))
