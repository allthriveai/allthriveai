"""
Management command to backfill lesson images for published learning paths.

This command finds published learning paths that are missing lesson images
and triggers image generation for them.

Run with:
    python manage.py backfill_lesson_images

Options:
    --dry-run: Show what would be done without generating images
    --limit N: Only process N paths (default: all)
"""

import logging

from django.core.management.base import BaseCommand

from core.learning_paths.models import SavedLearningPath
from core.learning_paths.tasks import generate_lesson_images_for_path

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Backfill lesson images for published learning paths that are missing them'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without generating images',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Limit the number of paths to process',
        )
        parser.add_argument(
            '--sync',
            action='store_true',
            help='Generate images synchronously (instead of via Celery)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        limit = options['limit']
        sync = options['sync']

        self.stdout.write(self.style.SUCCESS('\n' + '=' * 60))
        self.stdout.write(self.style.SUCCESS('  Backfill Lesson Images'))
        self.stdout.write(self.style.SUCCESS('=' * 60 + '\n'))

        # Find published paths
        paths = (
            SavedLearningPath.objects.filter(
                is_published=True,
                is_archived=False,
            )
            .select_related('user')
            .prefetch_related('lesson_images')
        )

        if limit:
            paths = paths[:limit]

        paths_needing_images = []

        for path in paths:
            curriculum = path.path_data.get('curriculum', []) if path.path_data else []
            ai_lessons = [item for item in curriculum if item.get('type') == 'ai_lesson']

            if not ai_lessons:
                continue

            # Get existing images for this path
            existing_orders = set(path.lesson_images.values_list('lesson_order', flat=True))
            needed_orders = {lesson.get('order', idx + 1) for idx, lesson in enumerate(ai_lessons)}

            missing_orders = needed_orders - existing_orders

            if missing_orders:
                paths_needing_images.append(
                    {
                        'path': path,
                        'total_lessons': len(ai_lessons),
                        'existing_images': len(existing_orders),
                        'missing_images': len(missing_orders),
                        'missing_orders': sorted(missing_orders),
                    }
                )

        self.stdout.write(f'Found {len(paths_needing_images)} paths needing image generation:\n')

        for item in paths_needing_images:
            path = item['path']
            self.stdout.write(
                f'  [{path.id}] "{path.title}" by @{path.user.username}\n'
                f'      Lessons: {item["total_lessons"]}, '
                f'Has images: {item["existing_images"]}, '
                f'Missing: {item["missing_images"]}\n'
            )

        if dry_run:
            self.stdout.write(self.style.WARNING('\n  DRY RUN - No images generated\n'))
            return

        if not paths_needing_images:
            self.stdout.write(self.style.SUCCESS('\n  All published paths have images!\n'))
            return

        # Confirm before proceeding
        self.stdout.write(f'\nWill generate images for {len(paths_needing_images)} paths.')

        generated = 0
        failed = 0

        for item in paths_needing_images:
            path = item['path']
            self.stdout.write(f'\nProcessing path {path.id}: "{path.title}"...')

            try:
                if sync:
                    # Generate synchronously (useful for debugging)
                    from core.learning_paths.tasks import generate_lesson_images_for_path as gen_images

                    result = gen_images(path.id, path.user_id)
                    if result.get('status') == 'success':
                        generated += 1
                        self.stdout.write(self.style.SUCCESS(f'  Generated {result.get("generated", 0)} images'))
                    else:
                        failed += 1
                        self.stdout.write(self.style.ERROR(f'  Failed: {result.get("reason", "unknown")}'))
                else:
                    # Queue via Celery
                    generate_lesson_images_for_path.delay(path.id, path.user_id)
                    generated += 1
                    self.stdout.write(self.style.SUCCESS('  Queued for generation'))

            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f'  Error: {e}'))

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(f'  Summary: {generated} queued/generated, {failed} failed')
        self.stdout.write('=' * 60 + '\n')
