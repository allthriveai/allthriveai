"""
Management command to sync Reddit community agents.
Run with: python manage.py sync_reddit_agents
"""

from django.core.management.base import BaseCommand

from core.integrations.reddit_models import RedditCommunityAgent
from services.integrations.reddit.sync import RedditSyncService


class Command(BaseCommand):
    help = 'Sync Reddit community agents (fetch new threads from RSS feeds)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--agent',
            type=str,
            help='Sync specific agent by username (e.g., claudecode-reddit-agent)',
        )
        parser.add_argument(
            '--subreddit',
            type=str,
            help='Sync specific agent by subreddit name (e.g., ClaudeCode)',
        )
        parser.add_argument(
            '--full',
            action='store_true',
            help='Force full re-sync (process all posts, not just new ones)',
        )

    def handle(self, *args, **options):
        agent_username = options.get('agent')
        subreddit = options.get('subreddit')
        full_sync = options.get('full', False)

        if agent_username:
            # Sync specific agent by username
            self.sync_agent_by_username(agent_username, full_sync)
        elif subreddit:
            # Sync specific agent by subreddit
            self.sync_agent_by_subreddit(subreddit, full_sync)
        else:
            # Sync all active agents
            self.sync_all_agents()

    def sync_agent_by_username(self, username: str, full_sync: bool):
        """Sync a specific agent by agent username."""
        try:
            agent = RedditCommunityAgent.objects.select_related('agent_user').get(agent_user__username=username)
            self.stdout.write(f'Syncing agent: {agent.name} (r/{agent.subreddit})...')
            results = RedditSyncService.sync_agent(agent, full_sync=full_sync)
            self.display_results(agent.name, results)
        except RedditCommunityAgent.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'❌ Agent not found: {username}'))

    def sync_agent_by_subreddit(self, subreddit: str, full_sync: bool):
        """Sync a specific agent by subreddit name."""
        try:
            agent = RedditCommunityAgent.objects.select_related('agent_user').get(subreddit=subreddit)
            self.stdout.write(f'Syncing agent: {agent.name} (r/{agent.subreddit})...')
            results = RedditSyncService.sync_agent(agent, full_sync=full_sync)
            self.display_results(agent.name, results)
        except RedditCommunityAgent.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'❌ Agent not found for subreddit: {subreddit}'))

    def sync_all_agents(self):
        """Sync all active agents."""
        active_agents = RedditCommunityAgent.objects.filter(status=RedditCommunityAgent.Status.ACTIVE).select_related(
            'agent_user'
        )

        if not active_agents.exists():
            self.stdout.write(self.style.WARNING('No active agents found.'))
            self.stdout.write('Create an agent with: python manage.py create_reddit_agent --subreddit <name>')
            return

        self.stdout.write(f'Syncing {active_agents.count()} active agent(s)...\n')

        overall_results = RedditSyncService.sync_all_active_agents()

        self.stdout.write(self.style.SUCCESS('\n✅ All agents synced!'))
        self.stdout.write(f'\n  Agents synced: {overall_results["agents_synced"]}')
        self.stdout.write(f'  Total created: {overall_results["total_created"]}')
        self.stdout.write(f'  Total updated: {overall_results["total_updated"]}')

        if overall_results['total_errors'] > 0:
            self.stdout.write(self.style.ERROR(f'  Total errors: {overall_results["total_errors"]}'))
        else:
            self.stdout.write('  Total errors: 0')

    def display_results(self, agent_name: str, results: dict):
        """Display sync results for a single agent."""
        if results['errors'] == 0:
            self.stdout.write(
                self.style.SUCCESS(f'✅ {agent_name}: {results["created"]} created, {results["updated"]} updated')
            )
        else:
            self.stdout.write(
                self.style.ERROR(
                    f'⚠️  {agent_name}: {results["created"]} created, {results["updated"]} updated, '
                    f'{results["errors"]} errors'
                )
            )
            if results['error_messages']:
                self.stdout.write('\nErrors:')
                for error in results['error_messages']:
                    self.stdout.write(self.style.ERROR(f'  - {error}'))
