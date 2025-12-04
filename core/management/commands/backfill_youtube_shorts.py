"""
Management command to backfill existing YouTube videos with isShort and duration data.

This updates the project content JSON to include isShort flag and duration
for proper frontend rendering of YouTube Shorts vs regular videos.

Run with:
    python manage.py backfill_youtube_shorts

Or dry-run to see what would be updated:
    python manage.py backfill_youtube_shorts --dry-run
"""

from django.core.management.base import BaseCommand

from core.integrations.youtube_feed_models import YouTubeFeedVideo


class Command(BaseCommand):
    help = 'Backfill YouTube videos with isShort and duration data in project content'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))

        videos = YouTubeFeedVideo.objects.select_related('project').all()
        total = videos.count()
        updated = 0
        shorts_count = 0

        self.stdout.write(f'Processing {total} YouTube videos...')

        for video in videos:
            project = video.project
            content = project.content or {}
            duration = video.duration

            # Determine if this is a Short using heuristics:
            # - Under 90 seconds: definitely a Short
            # - 90-180 seconds with no/minimal description: likely a Short
            is_short = False
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
                or video_meta.get('duration') != duration
                or section_content.get('isShort') != is_short
                or section_content.get('duration') != duration
            )

            if needs_update:
                if dry_run:
                    self.stdout.write(
                        f'  Would update: {video.video_id} - "{project.title[:40]}..." '
                        f'(isShort={is_short}, duration={duration}s)'
                    )
                else:
                    # Update video metadata in content
                    if 'video' not in content:
                        content['video'] = {}
                    content['video']['isShort'] = is_short
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
                self.style.SUCCESS(f'\nDry run complete: {updated} videos would be updated ({shorts_count} are Shorts)')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f'\nBackfill complete: {updated} videos updated ({shorts_count} are Shorts)')
            )
