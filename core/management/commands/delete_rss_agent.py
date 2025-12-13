"""Management command to safely delete an RSS agent and its projects."""

from django.core.management.base import BaseCommand

from core.integrations.rss_models import RSSFeedAgent, RSSFeedItem


class Command(BaseCommand):
    help = 'Delete an RSS feed agent and all its associated projects'

    def add_arguments(self, parser):
        parser.add_argument(
            '--feed-url-contains',
            type=str,
            required=True,
            help='Substring to match in feed URL (e.g., "changelog_claude_code")',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        feed_url_contains = options['feed_url_contains']
        dry_run = options['dry_run']

        # Find the agent
        agent = RSSFeedAgent.objects.filter(feed_url__icontains=feed_url_contains).first()

        if not agent:
            self.stdout.write(self.style.WARNING(f'No RSS agent found with feed URL containing: {feed_url_contains}'))
            return

        self.stdout.write(f'Found agent: {agent.name}')
        self.stdout.write(f'  User: {agent.agent_user.username}')
        self.stdout.write(f'  Feed URL: {agent.feed_url}')
        self.stdout.write(f'  Status: {agent.status}')

        # Get feed items
        items = RSSFeedItem.objects.filter(agent=agent).select_related('project')
        self.stdout.write(f'  Total feed items/projects: {items.count()}')

        if items.exists():
            self.stdout.write('\n  Projects to delete:')
            for item in items:
                self.stdout.write(f'    - {item.project.slug}: {item.project.title[:60]}')

        if dry_run:
            self.stdout.write(self.style.WARNING('\n[DRY RUN] No changes made. Remove --dry-run to delete.'))
            return

        # Delete projects (cascades to RSSFeedItem)
        deleted_count = 0
        for item in items:
            project = item.project
            project.delete()
            deleted_count += 1
            self.stdout.write(f'  Deleted project: {project.slug}')

        # Delete the agent
        agent.delete()

        self.stdout.write(self.style.SUCCESS(f'\nDeleted agent "{agent.name}" and {deleted_count} projects.'))
