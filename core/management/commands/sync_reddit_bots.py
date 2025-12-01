"""
Management command to sync Reddit community bots.
Run with: python manage.py sync_reddit_bots
"""

from django.core.management.base import BaseCommand

from core.integrations.reddit_models import RedditCommunityBot
from services.reddit_sync_service import RedditSyncService


class Command(BaseCommand):
    help = 'Sync Reddit community bots (fetch new threads from RSS feeds)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--bot',
            type=str,
            help='Sync specific bot by username (e.g., claudecode-reddit-bot)',
        )
        parser.add_argument(
            '--subreddit',
            type=str,
            help='Sync specific bot by subreddit name (e.g., ClaudeCode)',
        )
        parser.add_argument(
            '--full',
            action='store_true',
            help='Force full re-sync (process all posts, not just new ones)',
        )

    def handle(self, *args, **options):
        bot_username = options.get('bot')
        subreddit = options.get('subreddit')
        full_sync = options.get('full', False)

        if bot_username:
            # Sync specific bot by username
            self.sync_bot_by_username(bot_username, full_sync)
        elif subreddit:
            # Sync specific bot by subreddit
            self.sync_bot_by_subreddit(subreddit, full_sync)
        else:
            # Sync all active bots
            self.sync_all_bots()

    def sync_bot_by_username(self, username: str, full_sync: bool):
        """Sync a specific bot by bot username."""
        try:
            bot = RedditCommunityBot.objects.select_related('bot_user').get(bot_user__username=username)
            self.stdout.write(f'Syncing bot: {bot.name} (r/{bot.subreddit})...')
            results = RedditSyncService.sync_bot(bot, full_sync=full_sync)
            self.display_results(bot.name, results)
        except RedditCommunityBot.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'❌ Bot not found: {username}'))

    def sync_bot_by_subreddit(self, subreddit: str, full_sync: bool):
        """Sync a specific bot by subreddit name."""
        try:
            bot = RedditCommunityBot.objects.select_related('bot_user').get(subreddit=subreddit)
            self.stdout.write(f'Syncing bot: {bot.name} (r/{bot.subreddit})...')
            results = RedditSyncService.sync_bot(bot, full_sync=full_sync)
            self.display_results(bot.name, results)
        except RedditCommunityBot.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'❌ Bot not found for subreddit: {subreddit}'))

    def sync_all_bots(self):
        """Sync all active bots."""
        active_bots = RedditCommunityBot.objects.filter(status=RedditCommunityBot.Status.ACTIVE).select_related(
            'bot_user'
        )

        if not active_bots.exists():
            self.stdout.write(self.style.WARNING('No active bots found.'))
            self.stdout.write('Create a bot with: python manage.py create_reddit_bot --subreddit <name>')
            return

        self.stdout.write(f'Syncing {active_bots.count()} active bot(s)...\n')

        overall_results = RedditSyncService.sync_all_active_bots()

        self.stdout.write(self.style.SUCCESS('\n✅ All bots synced!'))
        self.stdout.write(f'\n  Bots synced: {overall_results["bots_synced"]}')
        self.stdout.write(f'  Total created: {overall_results["total_created"]}')
        self.stdout.write(f'  Total updated: {overall_results["total_updated"]}')

        if overall_results['total_errors'] > 0:
            self.stdout.write(self.style.ERROR(f'  Total errors: {overall_results["total_errors"]}'))
        else:
            self.stdout.write('  Total errors: 0')

    def display_results(self, bot_name: str, results: dict):
        """Display sync results for a single bot."""
        if results['errors'] == 0:
            self.stdout.write(
                self.style.SUCCESS(f'✅ {bot_name}: {results["created"]} created, {results["updated"]} updated')
            )
        else:
            self.stdout.write(
                self.style.ERROR(
                    f'⚠️  {bot_name}: {results["created"]} created, {results["updated"]} updated, '
                    f'{results["errors"]} errors'
                )
            )
            if results['error_messages']:
                self.stdout.write('\nErrors:')
                for error in results['error_messages']:
                    self.stdout.write(self.style.ERROR(f'  - {error}'))
