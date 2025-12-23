"""
Lesson Persistence Service.

Handles converting AI-generated lessons into Project records
when users view them for the first time.
"""

import hashlib
import logging
from typing import TypedDict

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.text import slugify

logger = logging.getLogger(__name__)
User = get_user_model()


class PersistedLessonResult(TypedDict):
    """Result of persisting an AI lesson."""

    project_id: int
    slug: str
    url: str
    already_existed: bool


class LessonPersistenceService:
    """
    Service to persist AI-generated lessons as Project records.

    Lessons are owned by Ember (the learning agent) and marked with is_lesson=True.
    Content is hashed to avoid duplicate persistence.
    """

    EMBER_USERNAME = 'ember'

    @classmethod
    def get_ember_user(cls) -> User:
        """Get the Ember agent user."""
        from core.users.models import UserRole

        try:
            return User.objects.get(username=cls.EMBER_USERNAME, role=UserRole.AGENT)
        except User.DoesNotExist as err:
            raise ValueError('Ember user not found. Run: python manage.py create_ember') from err

    @classmethod
    def content_hash(cls, lesson_content: dict) -> str:
        """Generate hash of lesson content for deduplication."""
        # Hash key fields that define uniqueness
        hash_input = f"{lesson_content.get('summary', '')}{lesson_content.get('explanation', '')}"
        return hashlib.sha256(hash_input.encode()).hexdigest()[:32]

    @classmethod
    def persist_ai_lesson(
        cls,
        title: str,
        lesson_content: dict,
        topic: str,
        difficulty: str,
        estimated_minutes: int,
        user: User | None = None,
        saved_path_id: int | None = None,
        lesson_order: int | None = None,
    ) -> PersistedLessonResult:
        """
        Persist an AI-generated lesson as a Project.

        Args:
            title: Lesson title (e.g., "What is RAG?")
            lesson_content: AILessonContent dict from lesson_generator
            topic: Topic slug (e.g., "rag", "langchain")
            difficulty: Difficulty level (beginner, intermediate, advanced)
            estimated_minutes: Estimated time to complete
            user: User who triggered the lesson generation (for usage tracking)
            saved_path_id: ID of SavedLearningPath (for linking)
            lesson_order: Order in curriculum (for linking)

        Returns:
            PersistedLessonResult with project info
        """
        from core.learning_paths.models import ProjectLearningMetadata
        from core.projects.models import Project
        from core.taxonomy.models import Taxonomy

        ember = cls.get_ember_user()

        # Generate content hash for deduplication
        content_hash = cls.content_hash(lesson_content)

        # Check for existing lesson with same content
        existing = Project.objects.filter(
            user=ember,
            content__content_hash=content_hash,
        ).first()

        if existing:
            logger.info(f'Found existing lesson project: {existing.id}')
            return PersistedLessonResult(
                project_id=existing.id,
                slug=existing.slug,
                url=f'/{ember.username}/{existing.slug}',
                already_existed=True,
            )

        # Build structured content for the Project
        project_content = {
            'content_hash': content_hash,
            'lesson_data': lesson_content,
            'generated_at': timezone.now().isoformat(),
            'source_path_id': saved_path_id,
            'source_lesson_order': lesson_order,
            'blocks': cls._build_lesson_blocks(lesson_content),
        }

        # Generate unique slug
        base_slug = slugify(title)[:150]
        slug = base_slug
        counter = 1
        while Project.objects.filter(user=ember, slug=slug).exists():
            slug = f'{base_slug}-{counter}'
            counter += 1

        # Get difficulty taxonomy
        difficulty_taxonomy = Taxonomy.objects.filter(
            slug=difficulty,
            taxonomy_type='difficulty',
            is_active=True,
        ).first()

        # Get topic taxonomy
        topic_taxonomy = Taxonomy.objects.filter(
            slug=slugify(topic),
            taxonomy_type='topic',
            is_active=True,
        ).first()

        # Get content type taxonomy for AI-generated lesson
        lesson_content_type = Taxonomy.objects.filter(
            slug='ai-lesson',
            taxonomy_type='content_type',
            is_active=True,
        ).first()

        # Create the Project
        project = Project.objects.create(
            user=ember,
            title=title,
            slug=slug,
            description=lesson_content.get('summary', ''),
            type=Project.ProjectType.OTHER,
            content=project_content,
            is_private=False,  # Lessons are public
            is_showcased=False,  # Don't show on Ember's profile
            is_archived=False,
            difficulty_taxonomy=difficulty_taxonomy,
            content_type_taxonomy=lesson_content_type,
            published_date=timezone.now(),
        )

        # Add topic if found
        if topic_taxonomy:
            project.topics.add(topic_taxonomy)

        # Create or update learning metadata with is_lesson=True
        metadata, _ = ProjectLearningMetadata.objects.get_or_create(
            project=project,
            defaults={
                'is_lesson': True,
                'is_learning_eligible': True,
                'complexity_level': difficulty or 'intermediate',
                'learning_summary': lesson_content.get('summary', ''),
                'key_techniques': lesson_content.get('key_concepts', []),
            },
        )
        if not metadata.is_lesson:
            metadata.is_lesson = True
            metadata.save(update_fields=['is_lesson', 'updated_at'])

        logger.info(
            f'Created lesson project: {project.id}',
            extra={
                'project_id': project.id,
                'title': title,
                'topic': topic,
                'content_hash': content_hash,
            },
        )

        return PersistedLessonResult(
            project_id=project.id,
            slug=project.slug,
            url=f'/{ember.username}/{project.slug}',
            already_existed=False,
        )

    @classmethod
    def _build_lesson_blocks(cls, lesson_content: dict) -> list[dict]:
        """Build structured content blocks from lesson content."""
        blocks = []

        # Summary block
        if lesson_content.get('summary'):
            blocks.append({'type': 'text', 'content': f"**Overview:** {lesson_content['summary']}"})

        # Key concepts block
        if lesson_content.get('key_concepts'):
            concepts_md = '**Key Concepts:**\n' + '\n'.join(f'- {c}' for c in lesson_content['key_concepts'])
            blocks.append({'type': 'text', 'content': concepts_md})

        # Main explanation
        if lesson_content.get('explanation'):
            blocks.append({'type': 'text', 'content': lesson_content['explanation']})

        # Mermaid diagram
        if lesson_content.get('mermaid_diagram'):
            blocks.append({'type': 'mermaid', 'content': lesson_content['mermaid_diagram']})

        # Examples
        for example in lesson_content.get('examples', []):
            example_md = f"### {example.get('title', 'Example')}\n"
            example_md += example.get('description', '')
            if example.get('code'):
                example_md += f"\n```\n{example['code']}\n```"
            blocks.append({'type': 'text', 'content': example_md})

        # Practice prompt
        if lesson_content.get('practice_prompt'):
            blocks.append({'type': 'text', 'content': f"**Try This:** {lesson_content['practice_prompt']}"})

        return blocks
