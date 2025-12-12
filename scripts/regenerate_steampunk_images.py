#!/usr/bin/env python
"""
Script to regenerate all images for dr-james-okonkwo with steampunk theme.
Run via: python scripts/regenerate_steampunk_images.py
"""

import os
import sys
import time

import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

# Django setup must come before other imports
from core.projects.models import Project  # noqa: E402
from core.users.models import User  # noqa: E402
from services.ai.provider import AIProvider  # noqa: E402
from services.integrations.rss.sync import VISUAL_STYLE_PROMPTS  # noqa: E402
from services.storage import get_storage_service  # noqa: E402


def main():
    username = 'dr-james-okonkwo'
    visual_style = 'dark_academia'  # Steampunk theme

    user = User.objects.get(username=username)
    projects = list(Project.objects.filter(user=user, is_private=False).order_by('-created_at'))

    print(f'User: {user.username} (id={user.id})')
    print(f'Visual style: {visual_style} (Steampunk)')
    print(f'Found {len(projects)} projects to process')
    print()

    ai = AIProvider(provider='gemini')
    storage = get_storage_service()
    style_prompt = VISUAL_STYLE_PROMPTS[visual_style]

    success_count = 0
    error_count = 0

    for i, project in enumerate(projects):
        print(f'[{i+1}/{len(projects)}] Processing: {project.title[:50]}...')

        title = project.title or ''
        description = (project.description or '')[:500]
        topics = project.topics or []
        topics_str = ', '.join(topics[:5]) if topics else ''

        prompt = f"""Create a hero image for this AI/tech article. \
The image MUST visually represent the article's topic.

ARTICLE: "{title}"
{"CONTEXT: " + description if description else ""}
{"TOPICS: " + topics_str if topics_str else ""}

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

        try:
            image_bytes, mime_type, _text = ai.generate_image(prompt=prompt, timeout=120)

            if not image_bytes:
                print('  No image generated')
                error_count += 1
                continue

            ext_map = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'}
            extension = ext_map.get(mime_type, 'png')

            url, error = storage.upload_file(
                file_data=image_bytes,
                filename=f'hero-{project.slug}-steampunk.{extension}',
                content_type=mime_type or 'image/png',
                folder='article-heroes',
                is_public=True,
            )

            if error:
                print(f'  Upload failed: {error}')
                error_count += 1
                continue

            project.featured_image_url = url
            project.save(update_fields=['featured_image_url', 'updated_at'])
            print(f'  Done: {url[:80]}...')
            success_count += 1

            # Rate limiting between generations
            if i < len(projects) - 1:
                time.sleep(2)

        except Exception as e:
            print(f'  Error: {e}')
            error_count += 1
            import traceback

            traceback.print_exc()

    print()
    print(f'Complete: {success_count} succeeded, {error_count} failed')


if __name__ == '__main__':
    main()
