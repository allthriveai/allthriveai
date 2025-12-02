"""
Management command to sync all active RSS feed agents.
Run with: python manage.py sync_rss_agents
"""

from django.core.management.base import BaseCommand

from core.integrations.rss_models import RSSFeedAgent
from services.integrations.rss.sync import RSSFeedSyncService


class Command(BaseCommand):
    help = 'Sync all active RSS feed agents'

    def add_arguments(self, parser):
        parser.add_argument(
            '--agent-id',
            type=int,
            help='Sync only a specific agent by ID',
        )
        parser.add_argument(
            '--source-name',
            type=str,
            help='Sync only agents matching this source name',
        )

    def handle(self, *args, **options):
        agent_id = options.get('agent_id')
        source_name = options.get('source_name')

        if agent_id:
            # Sync specific agent by ID
            try:
                agent = RSSFeedAgent.objects.get(id=agent_id)
                self.stdout.write(f'Syncing agent: {agent.name}')
                results = RSSFeedSyncService.sync_agent(agent)
                self._display_results(results, agent.name)
            except RSSFeedAgent.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'Agent with ID {agent_id} not found'))
                return

        elif source_name:
            # Sync agents matching source name
            agents = RSSFeedAgent.objects.filter(
                source_name__icontains=source_name,
                status=RSSFeedAgent.Status.ACTIVE,
            )
            if not agents.exists():
                self.stdout.write(self.style.WARNING(f'No active agents found for source: {source_name}'))
                return

            self.stdout.write(f'Syncing {agents.count()} agent(s) matching "{source_name}"...\n')
            for agent in agents:
                self.stdout.write(f'Syncing: {agent.name}')
                results = RSSFeedSyncService.sync_agent(agent)
                self._display_results(results, agent.name)
                self.stdout.write('')  # Empty line

        else:
            # Sync all active agents
            agents = RSSFeedAgent.objects.filter(status=RSSFeedAgent.Status.ACTIVE)

            if not agents.exists():
                self.stdout.write(self.style.WARNING('No active RSS feed agents found'))
                return

            self.stdout.write(f'Syncing {agents.count()} active RSS feed agent(s)...\n')

            total_results = {
                'total_created': 0,
                'total_updated': 0,
                'total_errors': 0,
            }

            for agent in agents:
                self.stdout.write(f'Syncing: {agent.name}')
                results = RSSFeedSyncService.sync_agent(agent)
                self._display_results(results, agent.name)

                total_results['total_created'] += results['created']
                total_results['total_updated'] += results['updated']
                total_results['total_errors'] += results['errors']

                self.stdout.write('')  # Empty line

            # Display overall summary
            self.stdout.write(self.style.SUCCESS('=' * 60))
            self.stdout.write(self.style.SUCCESS('Overall Summary:'))
            self.stdout.write(f'  Agents synced: {agents.count()}')
            self.stdout.write(f'  Total created: {total_results["total_created"]}')
            self.stdout.write(f'  Total updated: {total_results["total_updated"]}')
            self.stdout.write(f'  Total errors: {total_results["total_errors"]}')
            self.stdout.write(self.style.SUCCESS('=' * 60))

    def _display_results(self, results: dict, agent_name: str):
        """Display sync results for an agent."""
        if results['errors'] == 0:
            self.stdout.write(
                self.style.SUCCESS(f'  ✅ {agent_name}: {results["created"]} created, ' f'{results["updated"]} updated')
            )
        else:
            self.stdout.write(
                self.style.ERROR(
                    f'  ❌ {agent_name}: {results["created"]} created, '
                    f'{results["updated"]} updated, {results["errors"]} errors'
                )
            )
            for error in results['error_messages']:
                self.stdout.write(self.style.ERROR(f'     - {error}'))
