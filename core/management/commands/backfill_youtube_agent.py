"""
Management command to backfill YouTube videos for an agent from a specific date.

Run with:
    python manage.py backfill_youtube_agent --days 365
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.integrations.youtube.service import YouTubeService
from core.integrations.youtube_feed_models import YouTubeFeedAgent, YouTubeFeedVideo
from services.integrations.youtube_feed import YouTubeFeedSyncService


class Command(BaseCommand):
    help = 'Backfill YouTube videos for AI Daily Brief agent from a specific date'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=365,
            help='Number of days to look back (default: 365)',
        )
        parser.add_argument(
            '--agent-name',
            type=str,
            default='AI Daily Brief',
            help='Agent channel name to search for',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Only show what would be fetched, do not create projects',
        )

    def handle(self, *args, **options):
        days = options['days']
        agent_name = options['agent_name']
        dry_run = options['dry_run']

        # Find the agent
        agent = YouTubeFeedAgent.objects.filter(channel_name__icontains=agent_name).first()
        if not agent:
            self.stdout.write(self.style.ERROR(f'No agent found matching: {agent_name}'))
            return

        self.stdout.write(f'Found agent: {agent.name}')
        self.stdout.write(f'  Channel ID: {agent.channel_id}')
        self.stdout.write(f'  Looking back {days} days')

        # Calculate the date
        published_after = (timezone.now() - timedelta(days=days)).isoformat()
        self.stdout.write(f'  Published after: {published_after}')

        # Fetch videos from YouTube API
        service = YouTubeService(api_key=True)
        self.stdout.write('\nFetching videos from YouTube API...')

        try:
            data = service.get_channel_videos(
                channel_id=agent.channel_id,
                max_results=500,
                published_after=published_after,
            )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error fetching videos: {e}'))
            return

        video_ids = data.get('videos', [])
        self.stdout.write(self.style.SUCCESS(f'Found {len(video_ids)} videos from API'))

        if dry_run:
            self.stdout.write('\nDry run - not creating projects')
            for vid in video_ids[:10]:
                self.stdout.write(f'  - {vid}')
            if len(video_ids) > 10:
                self.stdout.write(f'  ... and {len(video_ids) - 10} more')
            return

        # Check which videos already exist
        existing_ids = set(YouTubeFeedVideo.objects.filter(video_id__in=video_ids).values_list('video_id', flat=True))
        new_video_ids = [vid for vid in video_ids if vid not in existing_ids]

        self.stdout.write(f'\n{len(existing_ids)} videos already exist')
        self.stdout.write(f'{len(new_video_ids)} new videos to process')

        if not new_video_ids:
            self.stdout.write(self.style.SUCCESS('No new videos to import'))
            return

        # Process new videos using the sync service
        self.stdout.write('\nProcessing new videos...')

        created = 0
        errors = 0

        for i, video_id in enumerate(new_video_ids):
            try:
                # Get video details
                video_info = service.get_video_info(video_id)

                # Use the sync service to create the project
                project = YouTubeFeedSyncService._create_video_project(agent, video_info)
                if project:
                    created += 1
                    self.stdout.write(f'  [{i+1}/{len(new_video_ids)}] Created: {project.title[:50]}...')
            except Exception as e:
                errors += 1
                self.stdout.write(self.style.ERROR(f'  [{i+1}/{len(new_video_ids)}] Error: {e}'))

            # Progress update every 50 videos
            if (i + 1) % 50 == 0:
                self.stdout.write(
                    f'\nProgress: {i+1}/{len(new_video_ids)} processed, ' f'{created} created, {errors} errors\n'
                )

        self.stdout.write(self.style.SUCCESS(f'\nComplete: {created} created, {errors} errors'))
