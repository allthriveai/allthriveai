"""
Management command to create ChatGPT Reddit bot with 2000+ upvote filter.
Run with: python manage.py create_chatgpt_bot
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from core.integrations.reddit_models import RedditCommunityBot
from core.users.models import User, UserRole
from services.reddit_sync_service import RedditSyncService


class Command(BaseCommand):
    help = 'Create ChatGPT Reddit bot with 2000+ upvote minimum'

    def add_arguments(self, parser):
        parser.add_argument(
            '--sync',
            action='store_true',
            help='Run initial sync after creating bot',
        )

    def handle(self, *args, **options):
        subreddit = 'ChatGPT'
        run_sync = options.get('sync', True)  # Default to True
        bot_username = f'{slugify(subreddit)}-reddit-bot'

        self.stdout.write(f'Creating Reddit bot for r/{subreddit} with 2000+ upvote filter...')

        try:
            with transaction.atomic():
                # Create bot user if doesn't exist
                try:
                    bot_user = User.objects.get(username=bot_username)
                    self.stdout.write(self.style.WARNING(f'Bot user already exists: {bot_username}'))
                except User.DoesNotExist:
                    bot_user = User.objects.create(
                        username=bot_username,
                        email=f'{bot_username}@allthrive.ai',
                        first_name=subreddit,
                        last_name='Reddit Bot',
                        role=UserRole.BOT,
                        bio=f'Automated curation bot for r/{subreddit} - featuring top posts with 2000+ upvotes',
                        avatar_url='/Reddit-logo.svg',
                        is_active=True,
                    )
                    bot_user.set_unusable_password()
                    bot_user.save()
                    self.stdout.write(self.style.SUCCESS(f'✅ Created bot user: {bot_username}'))

                # Create bot config with custom min_score of 2000
                try:
                    bot_config = RedditCommunityBot.objects.get(subreddit=subreddit)
                    self.stdout.write(self.style.WARNING(f'Bot config already exists for r/{subreddit}'))
                except RedditCommunityBot.DoesNotExist:
                    bot_config = RedditCommunityBot.objects.create(
                        bot_user=bot_user,
                        name=f'{subreddit} Reddit Bot',
                        subreddit=subreddit,
                        status=RedditCommunityBot.Status.ACTIVE,
                        settings={
                            'feed_type': 'top',
                            'time_period': 'week',
                            'min_score': 2000,  # Custom minimum upvotes!
                            'min_comments': 5,
                            'sync_interval_minutes': 15,
                        },
                    )
                    self.stdout.write(
                        self.style.SUCCESS(f'✅ Created bot config for r/{subreddit} with min_score=2000')
                    )

            # Display summary
            self.stdout.write(self.style.SUCCESS('\n🎉 ChatGPT Reddit bot created successfully!'))
            self.stdout.write(f'\n  Bot username: {bot_username}')
            self.stdout.write(f'  Profile URL: /{bot_username}')
            self.stdout.write(f'  RSS feed: {bot_config.rss_feed_url}')
            self.stdout.write(f'  Min score filter: {bot_config.settings.get("min_score")} upvotes')
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
