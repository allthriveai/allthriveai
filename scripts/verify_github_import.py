#!/usr/bin/env python
"""
Manual verification script for GitHub project import.

Run with: docker compose exec web python scripts/verify_github_import.py

This script tests the REAL GitHub import flow with your REAL user and OAuth token.
It validates all critical requirements:
1. Tool uses import_github_project (not create_project)
2. Categories are always assigned
3. AI-generated description is present
4. Hero image (featured_image_url) is set
5. Template v2 sections are generated (overview, features, tech_stack, etc.)
"""

import logging
import os
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django

django.setup()

from django.conf import settings  # noqa: E402
from django.contrib.auth import get_user_model  # noqa: E402
from services.project_agent.tools import import_github_project  # noqa: E402

from core.integrations.github.helpers import get_user_github_token  # noqa: E402
from core.projects.models import Project  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

User = get_user_model()

# Configuration
# Using a real repository that exists in the user's GitHub account
TEST_REPO_URL = 'https://github.com/AllieRays/redis-wellness'
TEST_USERNAME = 'alliejones42'


def verify_import():
    """Run full verification of GitHub import flow."""
    print('=' * 60)
    print('GITHUB IMPORT VERIFICATION')
    print('=' * 60)

    # 1. Get user
    try:
        user = User.objects.get(username=TEST_USERNAME)
        print(f'[OK] User found: {user.username} (id={user.id})')
    except User.DoesNotExist:
        print(f'[FAIL] User "{TEST_USERNAME}" not found')
        return False

    # 2. Check GitHub token
    token = get_user_github_token(user)
    if token:
        print('[OK] GitHub OAuth token found')
    else:
        print('[FAIL] No GitHub OAuth token. Connect GitHub in settings.')
        return False

    # 3. Clean up existing project
    deleted = Project.objects.filter(user=user, external_url=TEST_REPO_URL).delete()
    if deleted[0] > 0:
        print(f'[INFO] Deleted {deleted[0]} existing project(s) for cleanup')

    # 4. Run import
    print(f'\n[IMPORT] Starting import of {TEST_REPO_URL}...')
    print('This will make real API calls to GitHub and AI providers.')

    result = import_github_project.func(
        url=TEST_REPO_URL,
        is_showcase=True,
        is_private=False,
        state={
            'user_id': user.id,
            'username': user.username,
        },
    )

    if not result.get('success'):
        print(f'[FAIL] Import failed: {result.get("error")}')
        return False

    print('[OK] Import succeeded!')
    print(f'     Project ID: {result["project_id"]}')
    print(f'     URL: {result["url"]}')

    # 5. Validate created project
    print('\n[VALIDATION] Checking all required fields...\n')

    project = Project.objects.get(id=result['project_id'])
    all_passed = True

    # Check title
    if project.title:
        print(f'[OK] Title: {project.title}')
    else:
        print('[FAIL] Missing title')
        all_passed = False

    # Check description
    if project.description and len(project.description) > 20:
        print(f'[OK] Description ({len(project.description)} chars): {project.description[:100]}...')
    else:
        print(f'[FAIL] Description missing or too short: {project.description}')
        all_passed = False

    # Check categories (CRITICAL - must have at least one)
    categories = list(project.categories.all())
    if len(categories) >= 1:
        print(f'[OK] Categories: {[c.name for c in categories]}')
    else:
        print('[FAIL] No categories assigned!')
        all_passed = False

    # Check featured_image_url (for cards/sharing)
    if project.featured_image_url:
        print(f'[OK] Featured Image: {project.featured_image_url[:80]}...')
    else:
        print('[FAIL] Missing featured_image_url')
        all_passed = False

    # Check banner_url (should be empty for gradient)
    if not project.banner_url:
        print('[OK] Banner URL: (empty - gradient)')
    else:
        print(f'[WARN] Banner URL has value (should be empty): {project.banner_url}')

    # Check topics
    if project.topics:
        print(f'[OK] Topics: {project.topics}')
    else:
        print('[WARN] No topics assigned')

    # Check tools
    tools = list(project.tools.all())
    if tools:
        print(f'[OK] Tools: {[t.name for t in tools]}')
    else:
        print('[INFO] No tools matched (may be expected)')

    # Check template version (v2 is the new section-based format)
    content = project.content
    template_version = content.get('templateVersion')
    if template_version == 2:
        print(f'[OK] Template Version: {template_version} (section-based)')
    else:
        print(f'[FAIL] Expected templateVersion 2, got: {template_version}')
        all_passed = False

    # Check sections (replaces old blocks system)
    sections = content.get('sections', [])
    if len(sections) > 0:
        print(f'[OK] Sections: {len(sections)} sections')
        section_types = [s.get('type') for s in sections]
        print(f'     Section types: {section_types}')

        # Check for required sections
        required_sections = ['overview', 'features', 'tech_stack']
        enabled_types = [s.get('type') for s in sections if s.get('enabled', True)]
        for req in required_sections:
            if req in enabled_types:
                print(f'     [OK] Has {req} section')
            else:
                print(f'     [WARN] Missing {req} section')

        # Validate section content
        for section in sections[:3]:  # Check first 3 sections
            section_type = section.get('type')
            section_content = section.get('content', {})
            if section_content:
                print(f'     [OK] {section_type}: has content')
            else:
                print(f'     [WARN] {section_type}: empty content')
    else:
        print('[FAIL] No sections (AI template generation failed)')
        all_passed = False

    # Check GitHub metadata
    if content.get('github'):
        print('[OK] GitHub metadata present')
    else:
        print('[FAIL] Missing GitHub metadata in content')
        all_passed = False

    # Check tech stack
    if content.get('tech_stack'):
        print(f'[OK] Tech stack: {content["tech_stack"]}')
    else:
        print('[INFO] No tech stack detected')

    # Summary
    print('\n' + '=' * 60)
    if all_passed:
        print('ALL VALIDATIONS PASSED!')
        print(f'View project at: {settings.FRONTEND_URL}{result["url"]}')
    else:
        print('SOME VALIDATIONS FAILED - see above')
    print('=' * 60)

    return all_passed


if __name__ == '__main__':
    success = verify_import()
    sys.exit(0 if success else 1)
