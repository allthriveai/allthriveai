"""
Management command to create ChatGPT Reddit agent with 2000+ upvote filter.
Run with: python manage.py create_chatgpt_agent
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from core.integrations.reddit_models import RedditCommunityAgent
from core.users.models import User, UserRole
from services.reddit_sync_service import RedditSyncService


class Command(BaseCommand):
    help = 'Create ChatGPT Reddit agent with 2000+ upvote minimum'

    def add_arguments(self, parser):
        parser.add_argument(
            '--sync',
            action='store_true',
            help='Run initial sync after creating agent',
        )

    def handle(self, *args, **options):
        subreddit = 'ChatGPT'
        run_sync = options.get('sync', True)  # Default to True
        agent_username = f'{slugify(subreddit)}-reddit-agent'

        self.stdout.write(f'Creating Reddit agent for r/{subreddit} with 2000+ upvote filter...')

        try:
            with transaction.atomic():
                # Create agent user if doesn't exist
                try:
                    agent_user = User.objects.get(username=agent_username)
                    self.stdout.write(self.style.WARNING(f'Agent user already exists: {agent_username}'))
                except User.DoesNotExist:
                    agent_user = User.objects.create(
                        username=agent_username,
                        email=f'{agent_username}@allthrive.ai',
                        first_name=subreddit,
                        last_name='Reddit Agent',
                        role=UserRole.AGENT,
                        bio=f'Automated curation agent for r/{subreddit} - featuring top posts with 2000+ upvotes',
                        avatar_url='/Reddit-logo.svg',
                        is_active=True,
                    )
                    agent_user.set_unusable_password()
                    agent_user.save()
                    self.stdout.write(self.style.SUCCESS(f'Created agent user: {agent_username}'))

                # Create agent config with custom min_score of 2000
                try:
                    agent_config = RedditCommunityAgent.objects.get(subreddit=subreddit)
                    self.stdout.write(self.style.WARNING(f'Agent config already exists for r/{subreddit}'))
                except RedditCommunityAgent.DoesNotExist:
                    agent_config = RedditCommunityAgent.objects.create(
                        agent_user=agent_user,
                        name=f'{subreddit} Reddit Agent',
                        subreddit=subreddit,
                        status=RedditCommunityAgent.Status.ACTIVE,
                        settings={
                            'feed_type': 'top',
                            'time_period': 'week',
                            'min_score': 2000,  # Custom minimum upvotes!
                            'min_comments': 5,
                            'sync_interval_minutes': 15,
                        },
                    )
                    self.stdout.write(self.style.SUCCESS(f'Created agent config for r/{subreddit} with min_score=2000'))

            # Display summary
            self.stdout.write(self.style.SUCCESS('\nChatGPT Reddit agent created successfully!'))
            self.stdout.write(f'\n  Agent username: {agent_username}')
            self.stdout.write(f'  Profile URL: /{agent_username}')
            self.stdout.write(f'  RSS feed: {agent_config.rss_feed_url}')
            self.stdout.write(f'  Min score filter: {agent_config.settings.get("min_score")} upvotes')
            self.stdout.write(f'  Status: {agent_config.status}')

            # Run initial sync if requested
            if run_sync:
                self.stdout.write('\nRunning initial sync...')
                results = RedditSyncService.sync_agent(agent_config)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'\nSync complete: {results["created"]} created, '
                        f'{results["updated"]} updated, {results["errors"]} errors'
                    )
                )

                if results['errors'] > 0:
                    self.stdout.write(self.style.ERROR('\nErrors:'))
                    for error in results['error_messages']:
                        self.stdout.write(self.style.ERROR(f'  - {error}'))
            else:
                self.stdout.write('\nRun sync with: python manage.py sync_reddit_agents')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\nError creating agent: {e}'))
            raise
