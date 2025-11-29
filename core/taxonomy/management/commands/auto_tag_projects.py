"""
Management command to process existing projects for automatic personalization.

Usage:
    python manage.py auto_tag_projects [--user USERNAME] [--dry-run]

This command retroactively applies auto-tagging to existing projects,
detecting tools and generating UserTags with confidence scores.
"""

from django.core.management.base import BaseCommand
from django.db.models import Count

from core.projects.models import Project
from core.taxonomy.models import UserTag
from core.taxonomy.services import auto_tag_project


class Command(BaseCommand):
    help = 'Auto-tag existing projects to detect user tool preferences'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user',
            type=str,
            help='Process projects for specific user (username)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--limit',
            type=int,
            help='Limit number of projects to process',
        )

    def handle(self, *args, **options):
        username = options.get('user')
        dry_run = options.get('dry_run', False)
        limit = options.get('limit')

        self.stdout.write(self.style.SUCCESS('Starting auto-tag process...'))

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))

        # Get projects to process
        queryset = Project.objects.select_related('user').prefetch_related('tools')

        if username:
            queryset = queryset.filter(user__username=username)
            self.stdout.write(f'Filtering for user: {username}')

        if limit:
            queryset = queryset[:limit]
            self.stdout.write(f'Limiting to {limit} projects')

        project_count = queryset.count()
        self.stdout.write(f'Found {project_count} projects to process\n')

        # Track statistics
        processed = 0
        tools_detected = 0
        tags_created = 0
        errors = 0

        for project in queryset:
            try:
                self.stdout.write(f'Processing: {project.user.username}/{project.slug}')
                self.stdout.write(f'  Title: {project.title}')
                self.stdout.write(f'  Description: {(project.description or "")[:100]}...')

                if dry_run:
                    # Just show what would be detected
                    from core.taxonomy.services import extract_tools_from_project

                    tools = extract_tools_from_project(project)
                    if tools:
                        self.stdout.write(
                            self.style.SUCCESS(f'  Would detect {len(tools)} tools: {[t.name for t in tools]}')
                        )
                    else:
                        self.stdout.write('  No tools detected')
                else:
                    # Actually process
                    user_tags = auto_tag_project(project)
                    if user_tags:
                        tools_detected += len(user_tags)
                        tags_created += len([tag for tag in user_tags if tag])
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'  Detected {len(user_tags)} tools: {[tag.name for tag in user_tags if tag]}'
                            )
                        )
                    else:
                        self.stdout.write('  No tools detected')

                processed += 1
                self.stdout.write('')  # Blank line

            except Exception as e:
                errors += 1
                self.stdout.write(self.style.ERROR(f'  Error processing project: {e}'))
                self.stdout.write('')

        # Summary
        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(self.style.SUCCESS('Auto-tagging complete!'))
        self.stdout.write(f'Projects processed: {processed}')
        self.stdout.write(f'Tools detected: {tools_detected}')
        if not dry_run:
            self.stdout.write(f'Tags created/updated: {tags_created}')
        self.stdout.write(f'Errors: {errors}')

        # Show user summary
        if not dry_run and not username:
            self.stdout.write('\n' + '=' * 70)
            self.stdout.write('User Tag Summary:')

            users_with_tags = (
                UserTag.objects.filter(source=UserTag.Source.AUTO_PROJECT)
                .values('user__username')
                .annotate(tag_count=Count('id'))
                .order_by('-tag_count')[:10]
            )

            for user in users_with_tags:
                self.stdout.write(f'  {user["user__username"]}: {user["tag_count"]} tags')
