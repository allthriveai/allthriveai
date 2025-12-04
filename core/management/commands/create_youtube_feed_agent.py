"""
Management command to create a YouTube feed agent user and configuration.

Run with:
    python manage.py create_youtube_feed_agent \
        --channel-url https://www.youtube.com/@AIDailyBrief \
        --source-name "AI Daily Brief"

Or with channel ID directly:
    python manage.py create_youtube_feed_agent \
        --channel-id UCxxxxxx \
        --source-name "AI Daily Brief"
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from core.integrations.youtube_feed_models import YouTubeFeedAgent
from core.users.models import User, UserRole
from services.integrations.youtube_feed import YouTubeFeedSyncService


class Command(BaseCommand):
    help = 'Create a YouTube channel feed curation agent'

    def add_arguments(self, parser):
        parser.add_argument(
            '--channel-url',
            type=str,
            required=False,
            help='YouTube channel URL (e.g., https://www.youtube.com/@AIDailyBrief)',
        )
        parser.add_argument(
            '--channel-id',
            type=str,
            required=False,
            help='YouTube channel ID (e.g., UCxxxxxx)',
        )
        parser.add_argument(
            '--source-name',
            type=str,
            required=True,
            help='Human-readable source name (e.g., "AI Daily Brief")',
        )
        parser.add_argument(
            '--sync',
            action='store_true',
            help='Run initial sync after creating agent',
        )
        parser.add_argument(
            '--max-videos',
            type=int,
            default=20,
            help='Maximum number of videos to sync (default: 20)',
        )
        parser.add_argument(
            '--attribution',
            type=str,
            default=(
                'All content is owned by the original creator. Visit their YouTube channel to support them directly.'
            ),
            help='Attribution text displayed on video projects',
        )

    def handle(self, *args, **options):
        channel_url = options.get('channel_url')
        channel_id = options.get('channel_id')
        source_name = options['source_name']
        run_sync = options['sync']
        max_videos = options['max_videos']
        attribution = options['attribution']

        if not channel_url and not channel_id:
            self.stdout.write(self.style.ERROR('Either --channel-url or --channel-id is required'))
            return

        # Generate agent username
        agent_username = f'{slugify(source_name)}-youtube-agent'
        agent_display_name = source_name

        self.stdout.write(f'Creating YouTube feed agent for {source_name}...')

        try:
            # Resolve channel ID from URL if needed
            if channel_url and not channel_id:
                self.stdout.write(f'Resolving channel from URL: {channel_url}')

                # Extract handle from URL
                if '/@' in channel_url:
                    handle = channel_url.split('/@')[1].split('/')[0].split('?')[0]
                    channel_info = YouTubeFeedSyncService.resolve_channel_id_from_handle(f'@{handle}')
                elif '/channel/' in channel_url:
                    channel_id = channel_url.split('/channel/')[1].split('/')[0].split('?')[0]
                    channel_info = None
                else:
                    self.stdout.write(self.style.ERROR(f'Unsupported channel URL format: {channel_url}'))
                    return

                if channel_info:
                    channel_id = channel_info['channel_id']
                    channel_name = channel_info['channel_name']
                    self.stdout.write(self.style.SUCCESS(f'  Found channel: {channel_name} ({channel_id})'))
                elif not channel_id:
                    self.stdout.write(self.style.ERROR('Could not resolve channel from URL'))
                    return
                else:
                    channel_name = source_name
            else:
                # Use provided channel_id, fetch name
                from core.integrations.youtube.service import YouTubeService

                service = YouTubeService(api_key=True)
                try:
                    info = service.get_channel_info(channel_id)
                    channel_name = info['title']
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Could not fetch channel info: {e}'))
                    channel_name = source_name

            # Set channel URL if not provided
            if not channel_url:
                channel_url = f'https://www.youtube.com/channel/{channel_id}'

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
                        last_name='YouTube Agent',
                        role=UserRole.AGENT,
                        tier='curation',  # Curation tier hides points/achievements on profile
                        bio=f'Automated curation agent for {source_name} YouTube channel. {attribution}',
                        avatar_url='/youtube-icon.svg',
                        is_active=True,
                    )
                    # Agents don't need passwords
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
                        name=f'{agent_display_name} YouTube Agent',
                        channel_url=channel_url,
                        channel_id=channel_id,
                        channel_name=channel_name,
                        attribution_text=attribution,
                        status=YouTubeFeedAgent.Status.ACTIVE,
                        settings={
                            'sync_interval_minutes': 120,  # 2 hours
                            'max_videos': max_videos,
                        },
                    )
                    self.stdout.write(self.style.SUCCESS(f'Created agent config for {source_name}'))

            # Display summary
            self.stdout.write(self.style.SUCCESS('\nYouTube feed agent created successfully!'))
            self.stdout.write(f'\n  Agent username: {agent_username}')
            self.stdout.write(f'  Profile URL: /{agent_username}')
            self.stdout.write(f'  Channel: {agent_config.channel_name}')
            self.stdout.write(f'  Channel ID: {agent_config.channel_id}')
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
                self.stdout.write('\nRun sync with: python manage.py sync_youtube_feed_agents')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\nError creating agent: {e}'))
            raise
