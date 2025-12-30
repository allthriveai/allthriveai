"""
Management command to delete curation agents by type.

Usage:
    python manage.py delete_curation_agents --youtube
    python manage.py delete_curation_agents --rss
    python manage.py delete_curation_agents --all
"""

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Delete curation agents and their associated data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--youtube',
            action='store_true',
            help='Delete YouTube feed agents',
        )
        parser.add_argument(
            '--rss',
            action='store_true',
            help='Delete RSS feed agents',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Delete all curation agents',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        delete_youtube = options['youtube'] or options['all']
        delete_rss = options['rss'] or options['all']

        if not any([delete_youtube, delete_rss]):
            self.stdout.write(self.style.ERROR('Please specify --youtube, --rss, or --all'))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made\n'))

        with transaction.atomic():
            if delete_youtube:
                self._delete_youtube_agents(dry_run)

            if delete_rss:
                self._delete_rss_agents(dry_run)

        self.stdout.write(self.style.SUCCESS('\nDone!'))

    def _delete_youtube_agents(self, dry_run: bool):
        """Delete YouTube feed agents."""
        from core.integrations.youtube_feed_models import YouTubeFeedAgent, YouTubeFeedVideo
        from core.projects.models import Project

        self.stdout.write(self.style.HTTP_INFO('\nYouTube Agents:'))

        agents = YouTubeFeedAgent.objects.select_related('agent_user').all()
        if not agents.exists():
            self.stdout.write('  No YouTube agents found')
            return

        for agent in agents:
            user = agent.agent_user
            videos = YouTubeFeedVideo.objects.filter(agent=agent)
            projects = Project.objects.filter(user=user)

            self.stdout.write(f'  {agent.name}')
            self.stdout.write(f'    - User: {user.username} (ID: {user.id})')
            self.stdout.write(f'    - Videos: {videos.count()}')
            self.stdout.write(f'    - Projects: {projects.count()}')

            if not dry_run:
                videos.delete()
                projects.delete()
                agent.delete()
                user.delete()
                self.stdout.write(self.style.SUCCESS('    - DELETED'))

    def _delete_rss_agents(self, dry_run: bool):
        """Delete RSS feed agents."""
        from core.integrations.rss_models import RSSFeedAgent, RSSFeedItem
        from core.projects.models import Project

        self.stdout.write(self.style.HTTP_INFO('\nRSS Agents:'))

        agents = RSSFeedAgent.objects.select_related('agent_user').all()
        if not agents.exists():
            self.stdout.write('  No RSS agents found')
            return

        for agent in agents:
            user = agent.agent_user
            items = RSSFeedItem.objects.filter(agent=agent)
            projects = Project.objects.filter(user=user)

            self.stdout.write(f'  {agent.name}')
            self.stdout.write(f'    - User: {user.username} (ID: {user.id})')
            self.stdout.write(f'    - Items: {items.count()}')
            self.stdout.write(f'    - Projects: {projects.count()}')

            if not dry_run:
                items.delete()
                projects.delete()
                agent.delete()
                user.delete()
                self.stdout.write(self.style.SUCCESS('    - DELETED'))
