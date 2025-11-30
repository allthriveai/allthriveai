"""
Service layer for project operations.
Separates business logic from agent nodes and API views.
"""

import logging
import re

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from core.projects.models import Project

logger = logging.getLogger(__name__)
User = get_user_model()


class ProjectService:
    """Service for creating and managing projects."""

    # Valid project types
    VALID_TYPES = ['github_repo', 'figma_design', 'image_collection', 'prompt', 'other']

    # URL patterns
    GITHUB_URL_PATTERN = re.compile(r'https?://github\.com/[\w-]+/[\w-]+')
    FIGMA_URL_PATTERN = re.compile(r'https?://(www\.)?figma\.com/(file|design)/[\w-]+')
    URL_PATTERN = re.compile(r'https?://[^\s]+')

    @classmethod
    def validate_project_data(
        cls, title: str, project_type: str, description: str | None = None
    ) -> tuple[bool, str | None]:
        """
        Validate project data.

        Returns:
            (is_valid, error_message)
        """
        # Validate title
        if not title or len(title.strip()) == 0:
            return False, 'Project title is required'

        if len(title) > 200:
            return False, 'Project title must be 200 characters or less'

        # Validate type
        if project_type not in cls.VALID_TYPES:
            return False, f'Invalid project type. Must be one of: {", ".join(cls.VALID_TYPES)}'

        # Validate description if provided
        if description and len(description) > 2000:
            return False, 'Project description must be 2000 characters or less'

        return True, None

    @classmethod
    def create_project(
        cls,
        user_id: int,
        title: str,
        project_type: str,
        description: str = '',
        is_showcase: bool = False,
        featured_image_url: str | None = None,
        content: dict | None = None,
        external_url: str = '',
    ) -> tuple[Project | None, str | None]:
        """
        Create a new project.

        Returns:
            (project, error_message)
        """
        try:
            # Get user
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return None, 'User not found'

            # Validate data
            is_valid, error = cls.validate_project_data(title, project_type, description)
            if not is_valid:
                return None, error

            # Create project
            project = Project.objects.create(
                user=user,
                title=title.strip(),
                description=description.strip() if description else '',
                type=project_type,  # Model field is 'type', not 'project_type'
                is_showcase=is_showcase,
                featured_image_url=featured_image_url or '',
                content=content or {},
                external_url=external_url or '',
            )

            logger.info(f'Created project {project.id} for user {user.id}: {title}')
            return project, None

        except ValidationError as e:
            logger.error(f'Validation error creating project: {e}', exc_info=True)
            return None, str(e)
        except Exception as e:
            logger.error(
                f'Error creating project for user_id={user_id}, title={title}, ' f'type={project_type}: {e}',
                exc_info=True,
            )
            return None, f'Failed to create project: {str(e)}'

    @classmethod
    def extract_urls_from_text(cls, text: str) -> list[str]:
        """Extract all URLs from text."""
        return cls.URL_PATTERN.findall(text)

    @classmethod
    def is_github_url(cls, url: str) -> bool:
        """Check if URL is a GitHub repository URL."""
        return bool(cls.GITHUB_URL_PATTERN.match(url))

    @classmethod
    def is_figma_url(cls, url: str) -> bool:
        """Check if URL is a Figma design URL."""
        return bool(cls.FIGMA_URL_PATTERN.match(url))

    @classmethod
    def infer_project_type_from_url(cls, url: str) -> str:
        """Infer project type from URL."""
        if cls.is_github_url(url):
            return 'github_repo'

        if cls.is_figma_url(url):
            return 'figma_design'

        # Check for image hosting services
        image_domains = ['imgur.com', 'instagram.com', 'pinterest.com', 'behance.net', 'dribbble.com']
        if any(domain in url.lower() for domain in image_domains):
            return 'image_collection'

        return 'other'

    @classmethod
    def map_user_input_to_type(cls, user_input: str) -> str:
        """Map user input to project type."""
        user_input = user_input.strip().lower()

        type_mapping = {
            # GitHub repo
            '1': 'github_repo',
            'github': 'github_repo',
            'github repository': 'github_repo',
            'code': 'github_repo',
            'repo': 'github_repo',
            'repository': 'github_repo',
            'software': 'github_repo',
            # Figma design
            '2': 'figma_design',
            'figma': 'figma_design',
            'figma design': 'figma_design',
            'design file': 'figma_design',
            'ui': 'figma_design',
            'ui design': 'figma_design',
            'mockup': 'figma_design',
            # Image collection
            '3': 'image_collection',
            'image': 'image_collection',
            'images': 'image_collection',
            'image collection': 'image_collection',
            'art': 'image_collection',
            'artwork': 'image_collection',
            'gallery': 'image_collection',
            # Prompt
            '4': 'prompt',
            'prompt': 'prompt',
            'prompts': 'prompt',
            'conversation': 'prompt',
            'ai': 'prompt',
            'ai prompt': 'prompt',
            # Other
            '5': 'other',
            'other': 'other',
        }

        return type_mapping.get(user_input, 'other')
