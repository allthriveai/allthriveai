"""
Tests for MemberContextService.

Run with: pytest services/agents/context/tests/ -v
"""

import pytest
from django.contrib.auth import get_user_model

from core.projects.models import Project
from core.taxonomy.models import Taxonomy
from services.agents.context.member_context import MemberContextService

User = get_user_model()


@pytest.fixture
def test_user(db):
    """Create a test user."""
    return User.objects.create_user(
        username='context_test_user',
        email='context_test@example.com',
        password='testpass123',
    )


@pytest.fixture
def category_taxonomy(db):
    """Create category taxonomy items for project tagging."""
    categories = []
    for name in ['AI Agents', 'Machine Learning', 'RAG']:
        cat = Taxonomy.objects.create(
            name=name,
            slug=name.lower().replace(' ', '-'),
            taxonomy_type='category',
            is_active=True,
        )
        categories.append(cat)
    return categories


class TestProjectTopicsInLearningContext:
    """Tests for project_topics in learning context."""

    def test_project_topics_returns_empty_list_for_user_without_projects(self, test_user):
        """User with no projects should have empty project_topics."""
        context = MemberContextService.get_context(test_user.id)

        assert context is not None
        assert 'project_topics' in context
        assert context['project_topics'] == []

    def test_project_topics_returns_category_names(self, test_user, category_taxonomy):
        """Project categories should appear in project_topics."""
        # Create a project with categories
        project = Project.objects.create(
            user=test_user,
            title='My AI Agent Project',
            slug='my-ai-agent-project',
        )
        project.categories.add(category_taxonomy[0])  # AI Agents
        project.categories.add(category_taxonomy[1])  # Machine Learning

        # Invalidate cache to get fresh data
        MemberContextService.invalidate_cache(test_user.id)
        context = MemberContextService.get_context(test_user.id)

        assert context is not None
        assert 'project_topics' in context
        assert 'AI Agents' in context['project_topics']
        assert 'Machine Learning' in context['project_topics']

    def test_project_topics_excludes_archived_projects(self, test_user, category_taxonomy):
        """Archived projects should not contribute to project_topics."""
        # Create an archived project
        project = Project.objects.create(
            user=test_user,
            title='Archived Project',
            slug='archived-project',
            is_archived=True,
        )
        project.categories.add(category_taxonomy[0])  # AI Agents

        # Invalidate cache
        MemberContextService.invalidate_cache(test_user.id)
        context = MemberContextService.get_context(test_user.id)

        assert context is not None
        assert 'AI Agents' not in context['project_topics']

    def test_project_topics_deduplicates_across_projects(self, test_user, category_taxonomy):
        """Same category on multiple projects should only appear once."""
        # Create two projects with same category
        project1 = Project.objects.create(
            user=test_user,
            title='Project One',
            slug='project-one',
        )
        project1.categories.add(category_taxonomy[0])  # AI Agents

        project2 = Project.objects.create(
            user=test_user,
            title='Project Two',
            slug='project-two',
        )
        project2.categories.add(category_taxonomy[0])  # AI Agents (same)

        # Invalidate cache
        MemberContextService.invalidate_cache(test_user.id)
        context = MemberContextService.get_context(test_user.id)

        assert context is not None
        # Should only appear once due to distinct()
        assert context['project_topics'].count('AI Agents') == 1

    def test_project_topics_limited_to_five(self, test_user, db):
        """Project topics should be limited to 5 items."""
        # Create 7 categories
        categories = []
        for i in range(7):
            cat = Taxonomy.objects.create(
                name=f'Category {i}',
                slug=f'category-{i}',
                taxonomy_type='category',
                is_active=True,
            )
            categories.append(cat)

        # Create a project with all 7 categories
        project = Project.objects.create(
            user=test_user,
            title='Multi-Category Project',
            slug='multi-category-project',
        )
        for cat in categories:
            project.categories.add(cat)

        # Invalidate cache
        MemberContextService.invalidate_cache(test_user.id)
        context = MemberContextService.get_context(test_user.id)

        assert context is not None
        assert len(context['project_topics']) <= 5

    def test_project_topics_excludes_projects_without_categories(self, test_user):
        """Projects without categories should not cause errors."""
        # Create a project without categories
        Project.objects.create(
            user=test_user,
            title='No Categories Project',
            slug='no-categories-project',
        )

        # Invalidate cache
        MemberContextService.invalidate_cache(test_user.id)
        context = MemberContextService.get_context(test_user.id)

        assert context is not None
        assert context['project_topics'] == []


class TestDefaultContext:
    """Tests for default context structure."""

    def test_default_context_includes_project_topics(self):
        """Default context should include empty project_topics."""
        default = MemberContextService._get_default_context()

        assert 'project_topics' in default
        assert default['project_topics'] == []


class TestGetContextNullUser:
    """Tests for null user handling."""

    def test_get_context_returns_none_for_null_user(self):
        """get_context should return None for null user_id."""
        context = MemberContextService.get_context(None)
        assert context is None
