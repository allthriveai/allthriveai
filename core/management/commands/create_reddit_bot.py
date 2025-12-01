"""
Management command to create a Reddit community bot user and configuration.
Run with: python manage.py create_reddit_bot --subreddit ClaudeCode
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from core.integrations.reddit_models import RedditCommunityBot
from core.users.models import User, UserRole
from services.reddit_sync_service import RedditSyncService


class Command(BaseCommand):
    help = 'Create a Reddit community curation bot'

    def add_arguments(self, parser):
        parser.add_argument(
            '--subreddit',
            type=str,
            required=True,
            help='Subreddit name (e.g., ClaudeCode)',
        )
        parser.add_argument(
            '--sync',
            action='store_true',
            help='Run initial sync after creating bot',
        )

    def handle(self, *args, **options):
        subreddit = options['subreddit']
        run_sync = options['sync']

        # Generate bot username: {subreddit}-reddit-bot
        bot_username = f'{slugify(subreddit)}-reddit-bot'
        bot_display_name = subreddit

        self.stdout.write(f'Creating Reddit bot for r/{subreddit}...')

        try:
            with transaction.atomic():
                # Check if bot user already exists
                try:
                    bot_user = User.objects.get(username=bot_username)
                    self.stdout.write(self.style.WARNING(f'Bot user already exists: {bot_username}'))
                except User.DoesNotExist:
                    # Create bot user
                    bot_user = User.objects.create(
                        username=bot_username,
                        email=f'{bot_username}@allthrive.ai',
                        first_name=bot_display_name,
                        last_name='Reddit Bot',
                        role=UserRole.BOT,
                        bio=f'Automated curation bot for r/{subreddit}',
                        avatar_url='/Reddit-logo.svg',
                        is_active=True,
                    )
                    # Bots don't need passwords
                    bot_user.set_unusable_password()
                    bot_user.save()
                    self.stdout.write(self.style.SUCCESS(f'✅ Created bot user: {bot_username}'))

                # Check if bot config already exists
                try:
                    bot_config = RedditCommunityBot.objects.get(subreddit=subreddit)
                    self.stdout.write(self.style.WARNING(f'Bot config already exists for r/{subreddit}'))
                except RedditCommunityBot.DoesNotExist:
                    # Create bot configuration
                    bot_config = RedditCommunityBot.objects.create(
                        bot_user=bot_user,
                        name=f'{bot_display_name} Reddit Bot',
                        subreddit=subreddit,
                        status=RedditCommunityBot.Status.ACTIVE,
                        settings={
                            'feed_type': 'top',  # hot, top, new
                            'time_period': 'week',  # day, week, month, year, all (for 'top')
                            'min_score': 10,  # Minimum upvotes (not enforced via RSS)
                            'min_comments': 5,  # Minimum comments (not enforced via RSS)
                            'sync_interval_minutes': 15,
                        },
                    )
                    self.stdout.write(self.style.SUCCESS(f'✅ Created bot config for r/{subreddit}'))

            # Display summary
            self.stdout.write(self.style.SUCCESS('\n🎉 Reddit bot created successfully!'))
            self.stdout.write(f'\n  Bot username: {bot_username}')
            self.stdout.write(f'  Profile URL: /{bot_username}')
            self.stdout.write(f'  RSS feed: {bot_config.rss_feed_url}')
            self.stdout.write(f'  Status: {bot_config.status}')

            # Run initial sync if requested
            if run_sync:
                self.stdout.write('\n🔄 Running initial sync...')
                results = RedditSyncService.sync_bot(bot_config)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'\n✅ Sync complete: {results["created"]} created, '
                        f'{results["updated"]} updated, {results["errors"]} errors'
                    )
                )

                if results['errors'] > 0:
                    self.stdout.write(self.style.ERROR('\nErrors:'))
                    for error in results['error_messages']:
                        self.stdout.write(self.style.ERROR(f'  - {error}'))
            else:
                self.stdout.write('\n💡 Run sync with: python manage.py sync_reddit_bots')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ Error creating bot: {e}'))
            raise
