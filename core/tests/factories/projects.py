"""
Project Factory

Factory for creating test projects with unique slugs.
"""

import factory
from factory.django import DjangoModelFactory

from core.projects.models import Project

from .users import UserFactory


class ProjectFactory(DjangoModelFactory):
    """Factory for creating test projects."""

    class Meta:
        model = Project

    # Required fields with sequences for uniqueness
    title = factory.Sequence(lambda n: f'Test Project {n}')
    slug = factory.Sequence(lambda n: f'test-project-{n}')
    description = factory.Faker('paragraph')

    # Foreign keys
    creator = factory.SubFactory(UserFactory)

    # Defaults
    project_type = Project.ProjectType.OTHER
    visibility = 'public'
    is_featured = False

    class Params:
        # Traits for common test scenarios
        github = factory.Trait(
            project_type=Project.ProjectType.GITHUB_REPO,
            source_url=factory.Sequence(lambda n: f'https://github.com/test/repo-{n}'),
        )
        figma = factory.Trait(
            project_type=Project.ProjectType.FIGMA_DESIGN,
            source_url=factory.Sequence(lambda n: f'https://figma.com/file/test-{n}'),
        )
        video = factory.Trait(
            project_type=Project.ProjectType.VIDEO,
            source_url=factory.Sequence(lambda n: f'https://youtube.com/watch?v=test{n}'),
        )
        featured = factory.Trait(
            is_featured=True,
        )
        private = factory.Trait(
            visibility='private',
        )
