"""
Management command to regenerate battle images from saved prompts.
Uses the same image generation pipeline as the battle system.
"""

import logging
import time

from django.core.management.base import BaseCommand

from core.battles.models import BattleSubmission
from services.ai.provider import AIProvider
from services.integrations.storage.storage_service import get_storage_service

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Regenerate battle images from saved prompts'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be regenerated without actually doing it',
        )
        parser.add_argument(
            '--submission-id',
            type=int,
            help='Only regenerate a specific submission ID',
        )
        parser.add_argument(
            '--battle-id',
            type=int,
            help='Only regenerate submissions for a specific battle ID',
        )
        parser.add_argument(
            '--user',
            type=str,
            help='Only regenerate submissions for a specific username',
        )
        parser.add_argument(
            '--delay',
            type=float,
            default=2.0,
            help='Delay in seconds between image generations (default: 2.0)',
        )
        parser.add_argument(
            '--skip-existing',
            action='store_true',
            help='Skip submissions that still have working images',
        )
        parser.add_argument(
            '--limit',
            type=int,
            help='Limit number of submissions to process',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Regenerate all submissions (not just S3 URLs)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        submission_id = options.get('submission_id')
        battle_id = options.get('battle_id')
        username = options.get('user')
        delay = options['delay']
        _ = options['skip_existing']  # Reserved for future use
        limit = options.get('limit')
        regenerate_all = options['all']

        # Build query
        submissions = (
            BattleSubmission.objects.filter(generated_output_url__isnull=False)
            .exclude(generated_output_url='')
            .select_related('battle', 'user')
        )

        # Filter by S3 URLs (the ones we lost) unless --all is specified
        if not regenerate_all:
            submissions = submissions.filter(generated_output_url__contains='allthrive-media')

        if submission_id:
            submissions = submissions.filter(id=submission_id)

        if battle_id:
            submissions = submissions.filter(battle_id=battle_id)

        if username:
            submissions = submissions.filter(user__username=username)

        submissions = submissions.order_by('-submitted_at')

        if limit:
            submissions = submissions[:limit]

        submission_list = list(submissions)
        self.stdout.write(f'Found {len(submission_list)} submissions with S3 images to regenerate')
        self.stdout.write('')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No images will be generated'))
            self.stdout.write('')
            for sub in submission_list:
                self.stdout.write(f'  [{sub.id}] Battle #{sub.battle_id}: {sub.user.username}')
                self.stdout.write(f'      Prompt: {sub.prompt_text[:60]}...')
                self.stdout.write(f'      Old URL: {sub.generated_output_url[:60]}...')
            return

        # Initialize services
        ai = AIProvider(provider='gemini')
        storage = get_storage_service()

        success_count = 0
        error_count = 0

        for i, submission in enumerate(submission_list):
            self.stdout.write(
                f'[{i + 1}/{len(submission_list)}] Processing submission {submission.id} '
                f'(Battle #{submission.battle_id}, {submission.user.username})...'
            )
            self.stdout.write(f'  Prompt: {submission.prompt_text[:80]}...')

            try:
                # Generate image using the saved prompt
                image_bytes, mime_type, _text = ai.generate_image(prompt=submission.prompt_text, timeout=120)

                if not image_bytes:
                    self.stdout.write(self.style.WARNING('  No image generated'))
                    error_count += 1
                    continue

                # Determine file extension
                ext_map = {
                    'image/png': 'png',
                    'image/jpeg': 'jpg',
                    'image/webp': 'webp',
                }
                extension = ext_map.get(mime_type, 'png')

                # Upload to S3 with same folder structure
                import uuid

                filename = f'{uuid.uuid4()}.{extension}'
                folder = f'battles/user_{submission.user_id}'

                url, error = storage.upload_file(
                    file_data=image_bytes,
                    filename=filename,
                    content_type=mime_type or 'image/png',
                    folder=folder,
                    is_public=True,
                )

                if error:
                    self.stdout.write(self.style.ERROR(f'  Upload failed: {error}'))
                    error_count += 1
                    continue

                # Update submission with new URL
                submission.generated_output_url = url
                submission.save(update_fields=['generated_output_url'])

                self.stdout.write(self.style.SUCCESS(f'  Done: {url}'))
                success_count += 1

                # Rate limiting
                if i < len(submission_list) - 1:
                    time.sleep(delay)

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  Error: {e}'))
                error_count += 1
                logger.exception(f'Error regenerating image for submission {submission.id}')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Complete: {success_count} succeeded, {error_count} failed'))
