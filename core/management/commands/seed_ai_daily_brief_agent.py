"""
Management command to seed the AI Daily Brief YouTube feed agent.

This agent automatically pulls in videos from the AI Daily Brief YouTube channel
(https://www.youtube.com/@AIDailyBrief) with proper attribution.

Run with:
    python manage.py seed_ai_daily_brief_agent

Or with initial sync:
    python manage.py seed_ai_daily_brief_agent --sync
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from core.integrations.youtube_feed_models import YouTubeFeedAgent
from core.users.models import User, UserRole
from services.integrations.youtube_feed import YouTubeFeedSyncService


class Command(BaseCommand):
    help = 'Seed the AI Daily Brief YouTube feed agent'

    # AI Daily Brief channel configuration
    CHANNEL_URL = 'https://www.youtube.com/@AIDailyBrief'
    CHANNEL_NAME = 'AI Daily Brief'
    SOURCE_NAME = 'AI Daily Brief'

    # Custom attribution for this channel
    ATTRIBUTION_TEXT = (
        'All content is owned by AI Daily Brief. '
        'Visit their YouTube channel to support them directly and stay updated on the latest AI news.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--sync',
            action='store_true',
            help='Run initial sync after creating agent (fetches latest videos)',
        )
        parser.add_argument(
            '--max-videos',
            type=int,
            default=20,
            help='Maximum number of videos to sync (default: 20)',
        )

    def handle(self, *args, **options):
        run_sync = options['sync']
        max_videos = options['max_videos']

        agent_username = f'{slugify(self.SOURCE_NAME)}-youtube-agent'

        self.stdout.write('Creating AI Daily Brief YouTube feed agent...')

        try:
            # Resolve channel ID from URL
            self.stdout.write(f'Resolving channel from URL: {self.CHANNEL_URL}')

            # Extract handle from URL
            handle = self.CHANNEL_URL.split('/@')[1].split('/')[0].split('?')[0]
            channel_info = YouTubeFeedSyncService.resolve_channel_id_from_handle(f'@{handle}')

            if not channel_info:
                self.stdout.write(
                    self.style.ERROR('Could not resolve channel from URL. Is the YouTube API key configured?')
                )
                self.stdout.write('\nTo configure, set YOUTUBE_API_KEY in your .env file')
                return

            channel_id = channel_info['channel_id']
            channel_name = channel_info['channel_name']

            self.stdout.write(self.style.SUCCESS(f'  Found channel: {channel_name}'))
            self.stdout.write(f'    Channel ID: {channel_id}')
            self.stdout.write(f'    Subscribers: {channel_info.get("subscriber_count", "N/A"):,}')
            self.stdout.write(f'    Videos: {channel_info.get("video_count", "N/A"):,}')

            with transaction.atomic():
                # Check if agent user already exists
                try:
                    agent_user = User.objects.get(username=agent_username)
                    self.stdout.write(self.style.WARNING(f'Agent user already exists: {agent_username}'))
                except User.DoesNotExist:
                    # Create agent user with appropriate bio
                    agent_user = User.objects.create(
                        username=agent_username,
                        email=f'{agent_username}@allthrive.ai',
                        first_name=self.CHANNEL_NAME,
                        last_name='',
                        role=UserRole.AGENT,
                        tier='curation',  # Curation tier hides points/achievements on profile
                        bio=(
                            f'Automated curation agent for {self.CHANNEL_NAME} YouTube channel. {self.ATTRIBUTION_TEXT}'
                        ),
                        avatar_url='/youtube-icon.svg',
                        is_active=True,
                    )
                    agent_user.set_unusable_password()
                    agent_user.save()
                    self.stdout.write(self.style.SUCCESS(f'Created agent user: {agent_username}'))

                # Check if agent config already exists
                try:
                    agent_config = YouTubeFeedAgent.objects.get(channel_id=channel_id)
                    self.stdout.write(self.style.WARNING(f'Agent config already exists for channel {channel_id}'))
                except YouTubeFeedAgent.DoesNotExist:
                    # Create agent configuration
                    agent_config = YouTubeFeedAgent.objects.create(
                        agent_user=agent_user,
                        name=f'{self.CHANNEL_NAME} YouTube Agent',
                        channel_url=self.CHANNEL_URL,
                        channel_id=channel_id,
                        channel_name=channel_name,
                        attribution_text=self.ATTRIBUTION_TEXT,
                        status=YouTubeFeedAgent.Status.ACTIVE,
                        settings={
                            'sync_interval_minutes': 120,  # Every 2 hours
                            'max_videos': max_videos,
                        },
                    )
                    self.stdout.write(self.style.SUCCESS(f'Created agent config for {self.CHANNEL_NAME}'))

            # Display summary
            self.stdout.write(self.style.SUCCESS('\nAI Daily Brief agent created successfully!'))
            self.stdout.write(f'\n  Agent username: {agent_username}')
            self.stdout.write(f'  Profile URL: /{agent_username}')
            self.stdout.write(f'  Channel: {agent_config.channel_name}')
            self.stdout.write(f'  Channel URL: {agent_config.channel_url}')
            self.stdout.write(f'  Status: {agent_config.status}')

            # Run initial sync if requested
            if run_sync:
                self.stdout.write('\nRunning initial sync...')
                results = YouTubeFeedSyncService.sync_agent(agent_config)
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
                self.stdout.write('\nTo sync videos now, run:')
                self.stdout.write(f'  python manage.py sync_youtube_feed_agents --agent-id {agent_config.id}')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\nError creating agent: {e}'))
            raise
