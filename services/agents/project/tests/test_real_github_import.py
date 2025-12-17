"""
Real end-to-end tests for GitHub project import via chat agent.

These tests make REAL API calls to:
- GitHub API (requires GitHub OAuth token)
- AI providers (Azure OpenAI/Anthropic)

Run with: pytest services/project_agent/tests/test_real_github_import.py -v -s

IMPORTANT: These tests cost money (AI API calls) and require:
1. A user with GitHub OAuth connected
2. Valid AI provider credentials in environment

The test uses https://github.com/AllieRays/storylane-qa-editor-agent as the test repo.
"""

import logging

import pytest
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()

# Test repository - owned by the test user
TEST_REPO_URL = 'https://github.com/AllieRays/storylane-qa-editor-agent'
TEST_REPO_OWNER = 'AllieRays'
TEST_REPO_NAME = 'storylane-qa-editor-agent'


@pytest.fixture
def github_user(db):
    """Get or create a user with GitHub OAuth connected.

    This fixture expects the user 'alliejones42' to exist with GitHub OAuth.
    In CI, you'd create a test user with a test token.
    """
    try:
        user = User.objects.get(username='alliejones42')
        return user
    except User.DoesNotExist:
        pytest.skip('Test user "alliejones42" not found. Create user with GitHub OAuth first.')


@pytest.fixture
def has_github_token(github_user):
    """Verify the user has a GitHub token."""
    from core.integrations.github.helpers import get_user_github_token

    token = get_user_github_token(github_user)
    if not token:
        pytest.skip('GitHub OAuth token not found for user. Connect GitHub in settings first.')
    return token


@pytest.mark.django_db(transaction=True)
class TestRealGitHubImportFlow:
    """
    Real end-to-end tests for GitHub import.

    These tests validate the MOST IMPORTANT feature of the application:
    - Users paste a GitHub URL in chat
    - Agent uses import_github_project tool
    - Project is created with ALL required fields populated
    """

    def test_import_github_project_tool_directly(self, github_user, has_github_token):
        """
        Test import_github_project tool directly with real API calls.

        This validates:
        1. Tool executes successfully with real GitHub API
        2. AI analysis runs and produces metadata
        3. Project is created with all required fields
        """
        from core.projects.models import Project
        from services.agents.project.tools import import_github_project

        # Clean up any existing project for this repo
        Project.objects.filter(user=github_user, external_url=TEST_REPO_URL).delete()

        # Call the tool function directly with state (simulates what the agent's tool_node does)
        # Note: We call the .func directly because 'state' is injected by tool_node, not via schema
        result = import_github_project.func(
            url=TEST_REPO_URL,
            is_showcase=True,
            is_private=False,
            state={
                'user_id': github_user.id,
                'username': github_user.username,
            },
        )

        logger.info(f'Import result: {result}')

        # Validate tool succeeded
        assert result['success'] is True, f'Import failed: {result.get("error")}'
        assert 'project_id' in result
        assert 'url' in result
        assert 'slug' in result

        # Fetch the created project
        project = Project.objects.get(id=result['project_id'])

        # === VALIDATE ALL REQUIRED FIELDS ===

        # 1. Basic metadata
        assert project.title, 'Project must have a title'
        assert project.slug, 'Project must have a slug'
        assert project.external_url == TEST_REPO_URL, 'External URL must match'
        assert project.type == 'github_repo', 'Type must be github_repo'

        # 2. AI-generated description
        assert project.description, 'Project must have an AI-generated description'
        assert len(project.description) > 20, f'Description too short: {project.description}'
        logger.info(f'Description: {project.description}')

        # 3. CATEGORY - MUST have at least one
        categories = list(project.categories.all())
        assert len(categories) >= 1, 'Project MUST have at least one category'
        logger.info(f'Categories: {[c.name for c in categories]}')

        # 4. HERO IMAGE - featured_image_url for cards/sharing
        # Note: banner_url is intentionally left empty (frontend renders gradient)
        assert project.featured_image_url, 'Project must have a featured_image_url for cards/sharing'
        # Should be a valid URL
        assert project.featured_image_url.startswith(
            'http'
        ), f'Invalid featured_image_url: {project.featured_image_url}'
        logger.info(f'Featured image: {project.featured_image_url}')
        logger.info(f'Banner URL: {project.banner_url or "(empty - gradient)"}')

        # 5. AI-ENRICHED CONTENT - blocks must exist
        content = project.content
        assert isinstance(content, dict), 'Content must be a dict'
        assert 'blocks' in content, 'Content must have blocks'
        blocks = content.get('blocks', [])
        assert len(blocks) > 0, 'Content must have at least one block (AI-enriched details)'
        logger.info(f'Content blocks: {len(blocks)}')

        # 6. Topics (tags from GitHub + AI)
        assert project.topics, 'Project should have topics'
        logger.info(f'Topics: {project.topics}')

        # 7. GitHub metadata in content
        assert 'github' in content, 'Content must have github metadata'
        github_data = content['github']
        assert github_data.get('name') == TEST_REPO_NAME, 'GitHub name must match'
        assert github_data.get('owner') == TEST_REPO_OWNER, 'GitHub owner must match'

        # 8. Tech stack should be detected
        tech_stack = content.get('tech_stack', {})
        logger.info(f'Tech stack: {tech_stack}')

        # Log full success summary
        logger.info('=' * 60)
        logger.info('IMPORT VALIDATION PASSED')
        logger.info(f'  Title: {project.title}')
        logger.info(f'  Description: {project.description[:100]}...')
        logger.info(f'  Categories: {[c.name for c in categories]}')
        logger.info(f'  Topics: {project.topics}')
        logger.info(f'  Hero Image: {project.featured_image_url}')
        logger.info(f'  Content Blocks: {len(blocks)}')
        logger.info(f'  URL: {result["url"]}')
        logger.info('=' * 60)

    def test_ai_analysis_generates_compelling_description(self, github_user, has_github_token):
        """
        Test that AI generates a compelling, marketing-style description.

        The description should be:
        - More than just the GitHub description
        - Written in engaging, portfolio-style language
        - Between 50-500 characters
        """
        from core.integrations.github.ai_analyzer import analyze_github_repo
        from core.integrations.github.helpers import get_user_github_token, normalize_github_repo_data
        from core.integrations.github.service import GitHubService

        token = get_user_github_token(github_user)
        github_service = GitHubService(token)

        # Fetch real repo data
        repo_files = github_service.get_repository_info_sync(TEST_REPO_OWNER, TEST_REPO_NAME)
        repo_summary = normalize_github_repo_data(TEST_REPO_OWNER, TEST_REPO_NAME, TEST_REPO_URL, repo_files)

        # Run AI analysis
        analysis = analyze_github_repo(
            repo_data=repo_summary,
            readme_content=repo_files.get('readme', ''),
        )

        description = analysis.get('description', '')

        # Validate description quality
        assert description, 'AI must generate a description'
        assert len(description) >= 50, f'Description too short ({len(description)} chars): {description}'
        assert len(description) <= 500, f'Description too long ({len(description)} chars)'

        # Should be different from raw GitHub description
        github_desc = repo_summary.get('description', '')
        if github_desc:
            assert description != github_desc, 'AI should enhance, not copy, GitHub description'

        logger.info(f'AI Description ({len(description)} chars): {description}')

    def test_ai_assigns_appropriate_category(self, github_user, has_github_token):
        """
        Test that AI assigns appropriate categories based on repo content.

        For a QA/testing agent repo, should assign categories like:
        - 9: Developer & Coding
        - 7: Workflows & Automation
        - 13: AI Agents & Multi-Tool
        """
        from core.integrations.github.ai_analyzer import analyze_github_repo
        from core.integrations.github.helpers import get_user_github_token, normalize_github_repo_data
        from core.integrations.github.service import GitHubService

        token = get_user_github_token(github_user)
        github_service = GitHubService(token)

        repo_files = github_service.get_repository_info_sync(TEST_REPO_OWNER, TEST_REPO_NAME)
        repo_summary = normalize_github_repo_data(TEST_REPO_OWNER, TEST_REPO_NAME, TEST_REPO_URL, repo_files)

        analysis = analyze_github_repo(
            repo_data=repo_summary,
            readme_content=repo_files.get('readme', ''),
        )

        category_ids = analysis.get('category_ids', [])

        # Must have at least one category
        assert len(category_ids) >= 1, 'AI must assign at least one category'

        # Categories should be valid IDs (1-15)
        for cat_id in category_ids:
            assert 1 <= cat_id <= 15, f'Invalid category ID: {cat_id}'

        # For this agent/automation repo, should have relevant categories
        relevant_categories = {7, 9, 13}  # Workflows, Developer, AI Agents
        has_relevant = any(cat_id in relevant_categories for cat_id in category_ids)

        logger.info(f'AI assigned categories: {category_ids}')
        if not has_relevant:
            logger.warning(f'Expected one of {relevant_categories}, got {category_ids}')

    def test_readme_blocks_are_ai_enriched(self, github_user, has_github_token):
        """
        Test that README content is transformed into portfolio-style blocks.

        Blocks should:
        - Be structured (type, content, style)
        - Have AI-rewritten content (not raw markdown)
        - Filter out technical/installation sections
        """
        from core.integrations.github.ai_analyzer import analyze_github_repo
        from core.integrations.github.helpers import get_user_github_token, normalize_github_repo_data
        from core.integrations.github.service import GitHubService

        token = get_user_github_token(github_user)
        github_service = GitHubService(token)

        repo_files = github_service.get_repository_info_sync(TEST_REPO_OWNER, TEST_REPO_NAME)
        repo_summary = normalize_github_repo_data(TEST_REPO_OWNER, TEST_REPO_NAME, TEST_REPO_URL, repo_files)

        # Only run if README exists
        readme = repo_files.get('readme', '')
        if not readme:
            pytest.skip('No README found in repo')

        analysis = analyze_github_repo(
            repo_data=repo_summary,
            readme_content=readme,
        )

        blocks = analysis.get('readme_blocks', [])

        # Must have blocks
        assert len(blocks) > 0, 'Must generate content blocks from README'

        # Validate block structure
        for i, block in enumerate(blocks):
            assert 'type' in block, f'Block {i} missing type'
            assert block['type'] in [
                'text',
                'image',
                'imageGrid',
                'code_snippet',
                'mermaid',
                'columns',
                'badgeRow',
            ], f'Block {i} has invalid type: {block["type"]}'

        # Should have text blocks with content
        text_blocks = [b for b in blocks if b.get('type') == 'text']
        assert len(text_blocks) > 0, 'Must have at least one text block'

        # Text blocks should have content
        for block in text_blocks:
            if block.get('style') == 'body':
                assert block.get('content'), f'Text block missing content: {block}'

        logger.info(f'Generated {len(blocks)} content blocks')
        logger.info(f'Block types: {[b["type"] for b in blocks]}')

    def test_hero_image_selection(self, github_user, has_github_token):
        """
        Test that hero image is properly selected from repo assets.

        Priority order:
        1. README images (screenshots, demos)
        2. Repository logo/banner from assets folder
        3. GitHub-generated social image (fallback)
        """
        from core.integrations.github.ai_analyzer import analyze_github_repo
        from core.integrations.github.helpers import get_user_github_token, normalize_github_repo_data
        from core.integrations.github.service import GitHubService

        token = get_user_github_token(github_user)
        github_service = GitHubService(token)

        repo_files = github_service.get_repository_info_sync(TEST_REPO_OWNER, TEST_REPO_NAME)
        repo_summary = normalize_github_repo_data(TEST_REPO_OWNER, TEST_REPO_NAME, TEST_REPO_URL, repo_files)

        analysis = analyze_github_repo(
            repo_data=repo_summary,
            readme_content=repo_files.get('readme', ''),
        )

        hero_image = analysis.get('hero_image', '')

        # Must have a hero image
        assert hero_image, 'Must have a hero image'
        assert hero_image.startswith('http'), f'Hero image must be a URL: {hero_image}'

        # Should be either a raw GitHub URL or opengraph URL
        valid_sources = [
            'raw.githubusercontent.com',
            'opengraph.githubassets.com',
            'github.com',
        ]
        has_valid_source = any(source in hero_image for source in valid_sources)
        assert has_valid_source, f'Hero image from unexpected source: {hero_image}'

        logger.info(f'Hero image: {hero_image}')


@pytest.mark.django_db(transaction=True)
class TestAgentStreamingWithRealImport:
    """
    Test the full agent streaming flow with real GitHub import.

    This tests the complete user journey:
    1. User sends GitHub URL in chat
    2. Agent processes and calls import_github_project
    3. Project is created with all fields
    4. Response is streamed back
    """

    @pytest.mark.asyncio
    async def test_full_agent_flow_creates_project(self, github_user, has_github_token):
        """
        Test complete agent flow from message to project creation.

        Simulates:
        1. User sends "https://github.com/AllieRays/storylane-qa-editor-agent"
        2. Agent detects URL and decides to import
        3. import_github_project tool is called
        4. Project is created with all required fields
        """
        from core.projects.models import Project
        from services.agents.project.agent import stream_agent_response

        # Clean up any existing project
        await sync_to_async(Project.objects.filter(user=github_user, external_url=TEST_REPO_URL).delete)()

        # Collect all events from the stream
        events = []
        project_created = False
        project_url = None

        async for event in stream_agent_response(
            user_message=f'{TEST_REPO_URL}\n\nPlease import this to my Showcase.',
            user_id=github_user.id,
            username=github_user.username,
            session_id='test-real-import-session',
        ):
            events.append(event)
            logger.info(f'Event: {event["type"]} - {event}')

            if event['type'] == 'tool_end' and event.get('tool') == 'import_github_project':
                if event.get('output', {}).get('success'):
                    project_created = True
                    project_url = event['output'].get('url')

            if event['type'] == 'error':
                pytest.fail(f'Agent error: {event.get("message")}')

        # Validate tool was called
        tool_starts = [e for e in events if e['type'] == 'tool_start']
        tool_ends = [e for e in events if e['type'] == 'tool_end']

        # Should have called import_github_project
        import_calls = [e for e in tool_starts if e.get('tool') == 'import_github_project']
        assert (
            len(import_calls) >= 1
        ), f'Agent should call import_github_project. Tool calls: {[e.get("tool") for e in tool_starts]}'

        # Project should be created
        assert project_created, 'Project should be created by import_github_project'
        assert project_url, 'Should have project URL'

        # Validate the created project
        project = await sync_to_async(Project.objects.get)(user=github_user, external_url=TEST_REPO_URL)

        # All required fields must be populated
        assert project.title
        assert project.description
        assert project.featured_image_url
        # Note: banner_url intentionally empty (gradient)

        categories = await sync_to_async(list)(project.categories.all())
        assert len(categories) >= 1, 'Must have at least one category'

        assert project.content.get('blocks'), 'Must have content blocks'

        logger.info('=' * 60)
        logger.info('FULL AGENT FLOW TEST PASSED')
        logger.info(f'  Project: {project.title}')
        logger.info(f'  URL: {project_url}')
        logger.info(f'  Events collected: {len(events)}')
        logger.info('=' * 60)


@pytest.mark.django_db(transaction=True)
class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_import_fails_for_non_owned_repo(self, github_user, has_github_token):
        """
        Test that importing a repo you don't own fails with clear message.
        """
        from services.agents.project.tools import import_github_project

        # Try to import a repo not owned by the user
        result = import_github_project.func(
            url='https://github.com/torvalds/linux',  # Famous repo user doesn't own
            is_showcase=True,
            is_private=False,
            state={
                'user_id': github_user.id,
                'username': github_user.username,
            },
        )

        # Should fail with ownership error
        assert result['success'] is False
        assert (
            'own or have contributed to' in result.get('error', '').lower()
            or 'not appear to be associated' in result.get('error', '').lower()
        ), f'Expected ownership error, got: {result.get("error")}'

        logger.info(f'Ownership check correctly rejected: {result.get("error")}')

    @pytest.mark.django_db
    def test_import_fails_without_github_token(self):
        """
        Test that import fails gracefully when user has no GitHub token.
        """
        # Create a unique test user without GitHub OAuth
        import uuid

        from services.agents.project.tools import import_github_project

        unique_suffix = str(uuid.uuid4())[:8]
        user_no_github = User.objects.create_user(
            username=f'no_github_{unique_suffix}',
            email=f'nogithub_{unique_suffix}@example.com',
            password='testpass123',
        )

        try:
            # Call tool function directly with state
            result = import_github_project.func(
                url=TEST_REPO_URL,
                is_showcase=True,
                is_private=False,
                state={
                    'user_id': user_no_github.id,
                    'username': user_no_github.username,
                },
            )

            assert result['success'] is False
            error_lower = result.get('error', '').lower()
            # Should mention GitHub not connected
            assert 'github' in error_lower, f'Expected GitHub error, got: {result.get("error")}'

            logger.info(f'No token check correctly rejected: {result.get("error")}')
        finally:
            # Cleanup
            user_no_github.delete()

    def test_duplicate_import_fails(self, github_user, has_github_token):
        """
        Test that importing the same repo twice fails with duplicate error.
        """
        from django.db import IntegrityError

        from core.projects.models import Project
        from services.agents.project.tools import import_github_project

        # Clean up first
        Project.objects.filter(user=github_user, external_url=TEST_REPO_URL).delete()

        # First import should succeed
        result1 = import_github_project.func(
            url=TEST_REPO_URL,
            is_showcase=True,
            is_private=False,
            state={
                'user_id': github_user.id,
                'username': github_user.username,
            },
        )
        assert result1['success'] is True

        # Second import should fail (duplicate external_url)
        try:
            result2 = import_github_project.func(
                url=TEST_REPO_URL,
                is_showcase=True,
                is_private=False,
                state={
                    'user_id': github_user.id,
                    'username': github_user.username,
                },
            )
            # If no exception, should have error in result
            if result2.get('success'):
                pytest.fail('Second import should fail as duplicate')
        except IntegrityError:
            pass  # Expected - duplicate external_url

        logger.info('Duplicate import correctly prevented')

    @pytest.mark.django_db
    def test_clip_github_repo_user_does_not_own(self):
        """
        Test that users can CLIP any public GitHub repo they don't own.

        SCENARIO: User wants to clip https://github.com/jlowin/fastmcp as a clipping
        EXPECTED: Success - creates a clipped project without requiring GitHub OAuth
        PREVIOUS BUG: Would fail with "repository does not appear to be associated with your GitHub account"
        """
        import uuid

        from core.projects.models import Project
        from services.agents.project.tools import scrape_webpage_for_project

        # Create a user WITHOUT GitHub OAuth connected
        unique_suffix = str(uuid.uuid4())[:8]
        user_no_github = User.objects.create_user(
            username=f'clipper_{unique_suffix}',
            email=f'clipper_{unique_suffix}@example.com',
            password='testpass123',
        )

        # The repo to clip - user does NOT own this
        clip_url = 'https://github.com/jlowin/fastmcp'

        try:
            # Clean up any existing project
            Project.objects.filter(user=user_no_github, external_url=clip_url).delete()

            # Use scrape_webpage_for_project with is_owned=False (clipping)
            result = scrape_webpage_for_project.func(
                url=clip_url,
                is_showcase=False,  # Clippings typically not showcased
                is_private=False,
                is_owned=False,  # This is a CLIPPING, not their own work
                state={
                    'user_id': user_no_github.id,
                    'username': user_no_github.username,
                },
            )

            # Should succeed - no GitHub OAuth needed for clipping
            assert result['success'] is True, f'Clipping should succeed, got error: {result.get("error")}'
            assert 'project_id' in result
            assert 'url' in result

            # Verify the project was created correctly
            project = Project.objects.get(id=result['project_id'])
            assert project.type == 'clipped', f'Project type should be "clipped", got: {project.type}'
            assert project.external_url == clip_url
            assert project.user == user_no_github

            logger.info('=' * 60)
            logger.info('CLIPPING TEST PASSED')
            logger.info(f'  User WITHOUT GitHub OAuth successfully clipped: {clip_url}')
            logger.info(f'  Project type: {project.type}')
            logger.info(f'  Project title: {project.title}')
            logger.info('=' * 60)

        finally:
            # Cleanup
            Project.objects.filter(user=user_no_github).delete()
            user_no_github.delete()

    def test_import_github_as_owned_requires_verification(self, github_user, has_github_token):
        """
        Test that importing a GitHub repo as OWNED (for playground/showcase) requires verification.

        SCENARIO: User claims they own https://github.com/torvalds/linux
        EXPECTED: Fails - ownership verification rejects it
        """
        from services.agents.project.tools import import_github_project

        # Try to import a famous repo claiming ownership
        result = import_github_project.func(
            url='https://github.com/torvalds/linux',
            is_showcase=True,
            is_private=False,
            is_owned=True,  # Claiming ownership!
            state={
                'user_id': github_user.id,
                'username': github_user.username,
            },
        )

        # Should fail with ownership error
        assert result['success'] is False
        error_msg = result.get('error', '').lower()
        assert (
            'own or have contributed to' in error_msg or 'not appear to be associated' in error_msg
        ), f'Expected ownership error, got: {result.get("error")}'

        logger.info(f'Ownership verification correctly rejected: {result.get("error")}')
