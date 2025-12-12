"""
Management command to backfill existing YouTube videos with isShort, isVertical, and duration data.

This updates the project content JSON to include isShort/isVertical flags and duration
for proper frontend rendering of YouTube Shorts and vertical videos vs regular videos.

Run with:
    python manage.py backfill_youtube_shorts

Or dry-run to see what would be updated:
    python manage.py backfill_youtube_shorts --dry-run

With API check for vertical video detection (uses YouTube API quota):
    python manage.py backfill_youtube_shorts --check-api
"""

import time

from django.core.management.base import BaseCommand

from core.integrations.youtube.service import YouTubeService
from core.integrations.youtube_feed_models import YouTubeFeedVideo


class Command(BaseCommand):
    help = 'Backfill YouTube videos with isShort, isVertical, and duration data in project content'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )
        parser.add_argument(
            '--check-api',
            action='store_true',
            help='Check YouTube API for vertical video detection (uses API quota)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        check_api = options['check_api']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))

        if check_api:
            self.stdout.write(self.style.WARNING('API CHECK ENABLED - Will use YouTube API quota'))
            youtube_service = YouTubeService(api_key=True)
        else:
            youtube_service = None

        videos = YouTubeFeedVideo.objects.select_related('project').all()
        total = videos.count()
        updated = 0
        shorts_count = 0
        vertical_count = 0

        self.stdout.write(f'Processing {total} YouTube videos...')

        for i, video in enumerate(videos):
            project = video.project
            content = project.content or {}
            duration = video.duration

            # Check if video is vertical via API (if enabled)
            is_vertical = False
            if check_api and youtube_service:
                try:
                    video_info = youtube_service.get_video_info(video.video_id)
                    is_vertical = video_info.get('is_vertical', False)
                    if is_vertical:
                        vertical_count += 1
                        self.stdout.write(f'  Found vertical video: {video.video_id}')
                    # Rate limit to avoid quota issues
                    if i > 0 and i % 10 == 0:
                        time.sleep(1)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'  API error for {video.video_id}: {e}'))

            # Determine if this is a Short using heuristics:
            # - Vertical video detected via API
            # - Under 90 seconds: definitely a Short
            # - 90-180 seconds with no/minimal description: likely a Short
            is_short = is_vertical  # Vertical videos display like Shorts
            if duration <= 90:
                is_short = True
            elif duration <= 180:
                description = video.youtube_metadata.get('description', '') if video.youtube_metadata else ''
                if len(description.strip()) < 50:
                    is_short = True

            if is_short:
                shorts_count += 1

            # Check if content already has the data
            video_meta = content.get('video', {})
            section_content = content.get('sections', [{}])[0].get('content', {}) if content.get('sections') else {}

            needs_update = (
                video_meta.get('isShort') != is_short
                or video_meta.get('isVertical') != is_vertical
                or video_meta.get('duration') != duration
                or section_content.get('isShort') != is_short
                or section_content.get('isVertical') != is_vertical
                or section_content.get('duration') != duration
            )

            if needs_update:
                if dry_run:
                    self.stdout.write(
                        f'  Would update: {video.video_id} - "{project.title[:40]}..." '
                        f'(isShort={is_short}, isVertical={is_vertical}, duration={duration}s)'
                    )
                else:
                    # Update video metadata in content
                    if 'video' not in content:
                        content['video'] = {}
                    content['video']['isShort'] = is_short
                    content['video']['isVertical'] = is_vertical
                    content['video']['duration'] = duration

                    # Update heroVideoUrl for shorts
                    if is_short:
                        content['heroVideoUrl'] = f'https://www.youtube.com/shorts/{video.video_id}'
                    else:
                        content['heroVideoUrl'] = f'https://www.youtube.com/watch?v={video.video_id}'

                    # Update section content if sections exist
                    if content.get('sections') and len(content['sections']) > 0:
                        if 'content' not in content['sections'][0]:
                            content['sections'][0]['content'] = {}
                        content['sections'][0]['content']['isShort'] = is_short
                        content['sections'][0]['content']['isVertical'] = is_vertical
                        content['sections'][0]['content']['duration'] = duration
                        if is_short:
                            content['sections'][0]['content']['url'] = (
                                f'https://www.youtube.com/shorts/{video.video_id}'
                            )
                        else:
                            content['sections'][0]['content']['url'] = (
                                f'https://www.youtube.com/watch?v={video.video_id}'
                            )

                    project.content = content
                    project.save(update_fields=['content'])

                updated += 1

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nDry run complete: {updated} videos would be updated '
                    f'({shorts_count} are Shorts, {vertical_count} detected as vertical via API)'
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nBackfill complete: {updated} videos updated '
                    f'({shorts_count} are Shorts, {vertical_count} detected as vertical via API)'
                )
            )
