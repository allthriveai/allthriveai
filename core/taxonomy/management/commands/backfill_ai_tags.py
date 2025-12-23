"""
Management command to backfill AI-generated taxonomy tags.

Uses the services/tagging AITaggingService to tag content that hasn't
been tagged yet or has stale tags.

Usage:
    # Tag all untagged content
    python manage.py backfill_ai_tags

    # Tag specific content type
    python manage.py backfill_ai_tags --type project

    # Use premium tier for better quality
    python manage.py backfill_ai_tags --tier premium

    # Force retag even if already tagged
    python manage.py backfill_ai_tags --force

    # Also sync to Weaviate
    python manage.py backfill_ai_tags --sync-weaviate

    # Dry run (show what would be done)
    python manage.py backfill_ai_tags --dry-run
"""

from django.core.management.base import BaseCommand
from django.db.models import Q


class Command(BaseCommand):
    help = 'Backfill AI-generated taxonomy tags for content'

    def add_arguments(self, parser):
        parser.add_argument(
            '--type',
            type=str,
            choices=['project', 'quiz', 'tool', 'micro_lesson', 'all'],
            default='all',
            help='Content type to tag (default: all)',
        )
        parser.add_argument(
            '--tier',
            type=str,
            choices=['bulk', 'premium'],
            default='bulk',
            help='AI model tier: bulk (cheaper) or premium (better quality)',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Maximum items to process (default: 100)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force retag even if already tagged',
        )
        parser.add_argument(
            '--sync-weaviate',
            action='store_true',
            help='Also sync tagged content to Weaviate',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--async',
            action='store_true',
            dest='use_async',
            help='Queue tasks to Celery instead of processing synchronously',
        )

    def handle(self, *args, **options):
        content_type = options['type']
        tier = options['tier']
        limit = options['limit']
        force = options['force']
        sync_weaviate = options['sync_weaviate']
        dry_run = options['dry_run']
        use_async = options['use_async']

        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('AI Taxonomy Backfill'))
        self.stdout.write(self.style.SUCCESS('=' * 70))

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made\n'))

        # Determine which types to process
        types_to_process = ['project', 'quiz', 'tool', 'micro_lesson'] if content_type == 'all' else [content_type]

        self.stdout.write(f'Content types: {", ".join(types_to_process)}')
        self.stdout.write(f'Tier: {tier}')
        self.stdout.write(f'Limit per type: {limit}')
        self.stdout.write(f'Force retag: {force}')
        self.stdout.write(f'Sync to Weaviate: {sync_weaviate}')
        self.stdout.write(f'Async (Celery): {use_async}\n')

        total_processed = 0
        total_success = 0
        total_errors = 0

        for ctype in types_to_process:
            self.stdout.write(self.style.HTTP_INFO(f'\n--- Processing {ctype}s ---'))

            if use_async:
                count = self._process_async(ctype, tier, limit, force, dry_run)
                self.stdout.write(f'Queued {count} {ctype} items for async tagging')
            else:
                processed, success, errors = self._process_sync(ctype, tier, limit, force, sync_weaviate, dry_run)
                total_processed += processed
                total_success += success
                total_errors += errors

        # Summary
        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(self.style.SUCCESS('Backfill complete!'))
        if not use_async:
            self.stdout.write(f'Total processed: {total_processed}')
            self.stdout.write(f'Successful: {total_success}')
            self.stdout.write(f'Errors: {total_errors}')

    def _get_model_and_queryset(self, content_type: str, force: bool, limit: int):
        """Get the model class and queryset for a content type."""
        if content_type == 'project':
            from core.projects.models import Project

            queryset = Project.objects.filter(is_private=False, is_archived=False)
            model = Project
        elif content_type == 'quiz':
            from core.quizzes.models import Quiz

            queryset = Quiz.objects.filter(is_published=True)
            model = Quiz
        elif content_type == 'tool':
            from core.tools.models import Tool

            queryset = Tool.objects.filter(is_active=True)
            model = Tool
        elif content_type == 'micro_lesson':
            from core.learning_paths.models import MicroLesson

            queryset = MicroLesson.objects.filter(is_active=True)
            model = MicroLesson
        else:
            raise ValueError(f'Unknown content type: {content_type}')

        # Filter to untagged if not forcing
        if not force:
            queryset = queryset.filter(Q(ai_tag_metadata__isnull=True) | Q(ai_tag_metadata={}))

        return model, queryset[:limit]

    def _process_async(self, content_type: str, tier: str, limit: int, force: bool, dry_run: bool) -> int:
        """Queue content for async tagging via Celery."""
        from services.tagging.tasks import batch_tag_content

        _, queryset = self._get_model_and_queryset(content_type, force, limit)
        content_ids = list(queryset.values_list('pk', flat=True))

        if not content_ids:
            self.stdout.write(f'No untagged {content_type}s found')
            return 0

        if dry_run:
            self.stdout.write(f'Would queue {len(content_ids)} {content_type}s for tagging')
            return len(content_ids)

        batch_tag_content.delay(
            content_type=content_type,
            content_ids=content_ids,
            tier=tier,
            force=force,
        )
        return len(content_ids)

    def _process_sync(
        self,
        content_type: str,
        tier: str,
        limit: int,
        force: bool,
        sync_weaviate: bool,
        dry_run: bool,
    ) -> tuple[int, int, int]:
        """Process content synchronously."""
        from services.tagging import AITaggingService

        _, queryset = self._get_model_and_queryset(content_type, force, limit)
        items = list(queryset)

        if not items:
            self.stdout.write(f'No untagged {content_type}s found')
            return 0, 0, 0

        self.stdout.write(f'Found {len(items)} {content_type}s to process')

        service = AITaggingService()
        processed = 0
        success = 0
        errors = 0

        for item in items:
            title = getattr(item, 'title', getattr(item, 'name', str(item.pk)))
            self.stdout.write(f'  Processing: {title[:50]}...' if len(title) > 50 else f'  Processing: {title}')

            if dry_run:
                self.stdout.write(self.style.SUCCESS('    Would tag (dry run)'))
                processed += 1
                continue

            try:
                # Check if should retag
                if not service.should_retag(item, force=force):
                    self.stdout.write('    Skipped (already tagged)')
                    continue

                # Tag content
                result = service.tag_content(item, tier=tier)

                if not result.success:
                    self.stdout.write(self.style.ERROR(f'    Failed: {result.error}'))
                    errors += 1
                    continue

                # Apply tags
                applied = service.apply_tags(item, result, source='ai')

                if applied:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'    Tagged with confidence {result.average_confidence:.2f} '
                            f'(model: {result.model_used}, tokens: {result.tokens_used})'
                        )
                    )
                    success += 1

                    # Sync to Weaviate if requested
                    if sync_weaviate:
                        self._sync_to_weaviate(content_type, item.pk)
                else:
                    self.stdout.write(self.style.WARNING('    Failed to apply tags'))
                    errors += 1

                processed += 1

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'    Error: {e}'))
                errors += 1

        return processed, success, errors

    def _sync_to_weaviate(self, content_type: str, content_id):
        """Sync content to Weaviate after tagging."""
        try:
            if content_type == 'project':
                from services.weaviate.tasks import sync_project_to_weaviate

                sync_project_to_weaviate.delay(int(content_id))
            elif content_type == 'quiz':
                from services.weaviate.tasks import sync_quiz_to_weaviate

                sync_quiz_to_weaviate.delay(str(content_id))
            elif content_type == 'tool':
                from services.weaviate.tasks import sync_tool_to_weaviate

                sync_tool_to_weaviate.delay(int(content_id))
            elif content_type == 'micro_lesson':
                from services.weaviate.tasks import sync_micro_lesson_to_weaviate

                sync_micro_lesson_to_weaviate.delay(int(content_id))

            self.stdout.write('    Queued for Weaviate sync')

        except Exception as e:
            self.stdout.write(self.style.WARNING(f'    Weaviate sync failed: {e}'))
