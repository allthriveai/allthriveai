"""
Management command to sync all active YouTube feed agents.

Run with:
    python manage.py sync_youtube_feed_agents

Or sync a specific agent:
    python manage.py sync_youtube_feed_agents --agent-id 1
"""

from django.core.management.base import BaseCommand

from core.integrations.youtube_feed_models import YouTubeFeedAgent
from services.integrations.youtube_feed import YouTubeFeedSyncService


class Command(BaseCommand):
    help = 'Sync YouTube feed agents to fetch new videos'

    def add_arguments(self, parser):
        parser.add_argument(
            '--agent-id',
            type=int,
            required=False,
            help='Sync a specific agent by ID',
        )

    def handle(self, *args, **options):
        agent_id = options.get('agent_id')

        if agent_id:
            # Sync specific agent
            try:
                agent = YouTubeFeedAgent.objects.get(id=agent_id)
                self.stdout.write(f'Syncing agent: {agent.name}')
                results = YouTubeFeedSyncService.sync_agent(agent)
                self._print_results(agent.name, results)
            except YouTubeFeedAgent.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'Agent with ID {agent_id} not found'))
        else:
            # Sync all active agents
            agents = YouTubeFeedAgent.objects.filter(status=YouTubeFeedAgent.Status.ACTIVE)

            if not agents.exists():
                self.stdout.write(self.style.WARNING('No active YouTube feed agents found'))
                return

            self.stdout.write(f'Syncing {agents.count()} active YouTube feed agents...\n')

            total_created = 0
            total_updated = 0
            total_errors = 0

            for agent in agents:
                self.stdout.write(f'Syncing: {agent.name}')
                results = YouTubeFeedSyncService.sync_agent(agent)
                self._print_results(agent.name, results)

                total_created += results['created']
                total_updated += results['updated']
                total_errors += results['errors']

            # Summary
            self.stdout.write(
                self.style.SUCCESS(f'\nTotal: {total_created} created, {total_updated} updated, {total_errors} errors')
            )

    def _print_results(self, agent_name: str, results: dict):  # noqa: ARG002 - agent_name for future use
        """Print sync results for an agent."""
        style = self.style.SUCCESS if results['errors'] == 0 else self.style.WARNING

        self.stdout.write(
            style(f'  {results["created"]} created, {results["updated"]} updated, {results["errors"]} errors')
        )

        if results['error_messages']:
            for error in results['error_messages']:
                self.stdout.write(self.style.ERROR(f'    Error: {error}'))
