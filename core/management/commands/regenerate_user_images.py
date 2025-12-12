"""
Management command to regenerate featured images for a user's projects.
Uses the visual style system from RSS feed sync.
"""

import logging
import time

from django.core.management.base import BaseCommand, CommandError

from core.projects.models import Project
from core.users.models import User
from services.ai.provider import AIProvider
from services.integrations.rss.sync import VISUAL_STYLE_PROMPTS
from services.integrations.storage.storage_service import get_storage_service

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Regenerate featured images for all projects belonging to a user'

    def add_arguments(self, parser):
        parser.add_argument(
            'username',
            type=str,
            help='Username of the user whose project images should be regenerated',
        )
        parser.add_argument(
            '--style',
            type=str,
            default='dark_academia',
            choices=list(VISUAL_STYLE_PROMPTS.keys()),
            help='Visual style for generated images (default: dark_academia/steampunk)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be regenerated without actually doing it',
        )
        parser.add_argument(
            '--project-id',
            type=int,
            help='Only regenerate image for a specific project ID',
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
            help='Skip projects that already have a featured image',
        )

    def handle(self, *args, **options):
        username = options['username']
        visual_style = options['style']
        dry_run = options['dry_run']
        project_id = options.get('project_id')
        delay = options['delay']
        skip_existing = options['skip_existing']

        # Find user
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist as e:
            raise CommandError(f'User "{username}" not found') from e

        self.stdout.write(f'User: {user.username} (id={user.id})')
        self.stdout.write(f'Visual style: {visual_style}')
        self.stdout.write('')

        # Get projects
        projects = Project.objects.filter(user=user, is_private=False).order_by('-created_at')

        if project_id:
            projects = projects.filter(id=project_id)
            if not projects.exists():
                raise CommandError(f'Project {project_id} not found for user {username}')

        if skip_existing:
            projects = projects.filter(featured_image_url__isnull=True) | projects.filter(featured_image_url='')

        project_list = list(projects)
        self.stdout.write(f'Found {len(project_list)} projects to process')
        self.stdout.write('')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No images will be generated'))
            self.stdout.write('')
            for project in project_list:
                self.stdout.write(f'  Would regenerate: [{project.id}] {project.title[:60]}')
            return

        # Initialize services
        ai = AIProvider(provider='gemini')
        storage = get_storage_service()

        # Get style prompt
        style_prompt = VISUAL_STYLE_PROMPTS.get(visual_style, VISUAL_STYLE_PROMPTS['dark_academia'])

        success_count = 0
        error_count = 0

        for i, project in enumerate(project_list):
            self.stdout.write(f'[{i + 1}/{len(project_list)}] Processing: {project.title[:50]}...')

            try:
                # Build prompt
                title = project.title or ''
                description = (project.description or '')[:500]
                topics = project.topics or []

                prompt = f"""Create a hero image for this AI/tech article. \
The image MUST visually represent the article's topic.

ARTICLE: "{title}"
{f'CONTEXT: {description}' if description else ''}
{f'TOPICS: {", ".join(topics[:5])}' if topics else ''}

STEP 1 - UNDERSTAND THE TOPIC:
First, identify what this article is actually about \
(AI alignment, machine learning, coding, security, etc.) \
and create imagery that represents THAT topic.

STEP 2 - APPLY VISUAL STYLE:
Render the topic-relevant imagery using this aesthetic:
{style_prompt}

CRITICAL REQUIREMENTS:
1. The image MUST relate to the article's subject matter
2. Apply the visual style as an artistic treatment on the topic imagery
3. FORMAT: VERTICAL 9:16 aspect ratio (portrait mode)
4. AVOID: No text overlays, no human faces, no company logos"""

                # Generate image
                image_bytes, mime_type, _text = ai.generate_image(prompt=prompt, timeout=120)

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

                # Upload to S3
                url, error = storage.upload_file(
                    file_data=image_bytes,
                    filename=f'hero-{project.slug}-regenerated.{extension}',
                    content_type=mime_type or 'image/png',
                    folder='article-heroes',
                    is_public=True,
                )

                if error:
                    self.stdout.write(self.style.ERROR(f'  Upload failed: {error}'))
                    error_count += 1
                    continue

                # Update project
                project.featured_image_url = url
                project.save(update_fields=['featured_image_url', 'updated_at'])

                self.stdout.write(self.style.SUCCESS(f'  Done: {url[:80]}...'))
                success_count += 1

                # Rate limiting
                if i < len(project_list) - 1:
                    time.sleep(delay)

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  Error: {e}'))
                error_count += 1
                logger.exception(f'Error regenerating image for project {project.id}')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Complete: {success_count} succeeded, {error_count} failed'))
