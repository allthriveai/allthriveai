"""
Management command to create a Reddit community agent user and configuration.
Run with: python manage.py create_reddit_agent --subreddit ClaudeCode
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from core.integrations.reddit_models import RedditCommunityAgent
from core.users.models import User, UserRole
from services.integrations.reddit.sync import RedditSyncService


class Command(BaseCommand):
    help = 'Create a Reddit community curation agent'

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
            help='Run initial sync after creating agent',
        )

    def handle(self, *args, **options):
        subreddit = options['subreddit']
        run_sync = options['sync']

        # Generate agent username: {subreddit}-reddit-agent
        agent_username = f'{slugify(subreddit)}-reddit-agent'
        agent_display_name = subreddit

        self.stdout.write(f'Creating Reddit agent for r/{subreddit}...')

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
                        last_name='Reddit Agent',
                        role=UserRole.AGENT,
                        bio=f'Automated curation agent for r/{subreddit}',
                        avatar_url='/Reddit-logo.svg',
                        is_active=True,
                    )
                    # Agents don't need passwords
                    agent_user.set_unusable_password()
                    agent_user.save()
                    self.stdout.write(self.style.SUCCESS(f'✅ Created agent user: {agent_username}'))

                # Check if agent config already exists
                try:
                    agent_config = RedditCommunityAgent.objects.get(subreddit=subreddit)
                    self.stdout.write(self.style.WARNING(f'Agent config already exists for r/{subreddit}'))
                except RedditCommunityAgent.DoesNotExist:
                    # Create agent configuration
                    agent_config = RedditCommunityAgent.objects.create(
                        agent_user=agent_user,
                        name=f'{agent_display_name} Reddit Agent',
                        subreddit=subreddit,
                        status=RedditCommunityAgent.Status.ACTIVE,
                        settings={
                            'feed_type': 'top',  # hot, top, new
                            'time_period': 'week',  # day, week, month, year, all (for 'top')
                            'min_score': 10,  # Minimum upvotes (not enforced via RSS)
                            'min_comments': 5,  # Minimum comments (not enforced via RSS)
                            'sync_interval_minutes': 15,
                        },
                    )
                    self.stdout.write(self.style.SUCCESS(f'✅ Created agent config for r/{subreddit}'))

            # Display summary
            self.stdout.write(self.style.SUCCESS('\n🎉 Reddit agent created successfully!'))
            self.stdout.write(f'\n  Agent username: {agent_username}')
            self.stdout.write(f'  Profile URL: /{agent_username}')
            self.stdout.write(f'  RSS feed: {agent_config.rss_feed_url}')
            self.stdout.write(f'  Status: {agent_config.status}')

            # Run initial sync if requested
            if run_sync:
                self.stdout.write('\n🔄 Running initial sync...')
                results = RedditSyncService.sync_agent(agent_config)
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
                self.stdout.write('\n💡 Run sync with: python manage.py sync_reddit_agents')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ Error creating agent: {e}'))
            raise
