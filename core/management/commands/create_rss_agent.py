"""
Management command to create an RSS feed agent user and configuration.
Run with:
    python manage.py create_rss_agent \
        --feed-url https://research.google/blog/rss/ \
        --source-name "Google Research Blog"
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify
from services.rss_sync_service import RSSFeedSyncService

from core.integrations.rss_models import RSSFeedAgent
from core.users.models import User, UserRole


class Command(BaseCommand):
    help = 'Create an RSS feed curation agent'

    def add_arguments(self, parser):
        parser.add_argument(
            '--feed-url',
            type=str,
            required=True,
            help='RSS/Atom feed URL (e.g., https://research.google/blog/rss/)',
        )
        parser.add_argument(
            '--source-name',
            type=str,
            required=True,
            help='Human-readable source name (e.g., "Google Research Blog")',
        )
        parser.add_argument(
            '--sync',
            action='store_true',
            help='Run initial sync after creating agent',
        )
        parser.add_argument(
            '--max-items',
            type=int,
            default=20,
            help='Maximum number of items to sync (default: 20)',
        )

    def handle(self, *args, **options):
        feed_url = options['feed_url']
        source_name = options['source_name']
        run_sync = options['sync']
        max_items = options['max_items']

        # Generate agent username: {source-name}-rss-agent
        agent_username = f'{slugify(source_name)}-rss-agent'
        agent_display_name = source_name

        self.stdout.write(f'Creating RSS agent for {source_name}...')

        try:
            with transaction.atomic():
                # Check if agent user already exists
                try:
                    agent_user = User.objects.get(username=agent_username)
                    self.stdout.write(self.style.WARNING(f'Agent user already exists: {agent_username}'))
                except User.DoesNotExist:
                    # Create agent user
                    agent_user = User.objects.create(
                        username=agent_username,
                        email=f'{agent_username}@allthrive.ai',
                        first_name=agent_display_name,
                        last_name='RSS Agent',
                        role=UserRole.AGENT,
                        bio=f'Automated curation agent for {source_name}',
                        avatar_url='/rss-icon.svg',
                        is_active=True,
                    )
                    # Agents don't need passwords
                    agent_user.set_unusable_password()
                    agent_user.save()
                    self.stdout.write(self.style.SUCCESS(f'✅ Created agent user: {agent_username}'))

                # Check if agent config already exists
                try:
                    agent_config = RSSFeedAgent.objects.get(feed_url=feed_url)
                    self.stdout.write(self.style.WARNING(f'Agent config already exists for {feed_url}'))
                except RSSFeedAgent.DoesNotExist:
                    # Create agent configuration
                    agent_config = RSSFeedAgent.objects.create(
                        agent_user=agent_user,
                        name=f'{agent_display_name} RSS Agent',
                        feed_url=feed_url,
                        source_name=source_name,
                        status=RSSFeedAgent.Status.ACTIVE,
                        settings={
                            'sync_interval_minutes': 60,
                            'max_items': max_items,
                        },
                    )
                    self.stdout.write(self.style.SUCCESS(f'✅ Created agent config for {source_name}'))

            # Display summary
            self.stdout.write(self.style.SUCCESS('\n🎉 RSS agent created successfully!'))
            self.stdout.write(f'\n  Agent username: {agent_username}')
            self.stdout.write(f'  Profile URL: /{agent_username}')
            self.stdout.write(f'  RSS feed: {agent_config.feed_url}')
            self.stdout.write(f'  Status: {agent_config.status}')

            # Run initial sync if requested
            if run_sync:
                self.stdout.write('\n🔄 Running initial sync...')
                results = RSSFeedSyncService.sync_agent(agent_config)
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
                self.stdout.write('\n💡 Run sync with: python manage.py sync_rss_agents')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ Error creating agent: {e}'))
            raise
