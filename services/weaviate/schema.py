"""
Weaviate schema definitions for personalization collections.

Collections:
- Project: Content embeddings for semantic search and recommendations
- UserProfile: User preference vectors for personalization
- Tool: Tool similarity search
"""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import weaviate

logger = logging.getLogger(__name__)


class WeaviateSchema:
    """Manages Weaviate collection schemas for personalization."""

    # Collection names
    PROJECT_COLLECTION = 'Project'
    USER_PROFILE_COLLECTION = 'UserProfile'
    TOOL_COLLECTION = 'Tool'
    QUIZ_COLLECTION = 'Quiz'

    @classmethod
    def get_project_schema(cls) -> dict:
        """
        Schema for Project collection.

        Stores project embeddings for content-based recommendations
        and semantic search.
        """
        return {
            'class': cls.PROJECT_COLLECTION,
            'description': 'Project content embeddings for recommendations',
            'vectorizer': 'none',  # We provide our own embeddings
            'properties': [
                {
                    'name': 'project_id',
                    'dataType': ['int'],
                    'description': 'Django Project model ID',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'combined_text',
                    'dataType': ['text'],
                    'description': 'Combined text for keyword search (title + description + topics)',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'title',
                    'dataType': ['text'],
                    'description': 'Project title',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'tool_names',
                    'dataType': ['text[]'],
                    'description': 'Names of tools used in the project',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'category_names',
                    'dataType': ['text[]'],
                    'description': 'Category names (from taxonomy)',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'topics',
                    'dataType': ['text[]'],
                    'description': 'Topic tags',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'owner_id',
                    'dataType': ['int'],
                    'description': 'User ID of project owner',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'owner_username',
                    'dataType': ['text'],
                    'description': 'Username of project owner (for search)',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'engagement_velocity',
                    'dataType': ['number'],
                    'description': 'Rate of engagement acceleration for trending',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'like_count',
                    'dataType': ['int'],
                    'description': 'Total likes count',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'view_count',
                    'dataType': ['int'],
                    'description': 'Total view count',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'is_private',
                    'dataType': ['boolean'],
                    'description': 'Whether project is private (only owner can see)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'is_archived',
                    'dataType': ['boolean'],
                    'description': 'Whether project is archived',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'promotion_score',
                    'dataType': ['number'],
                    'description': 'Quality signal from admin promotions (0-1 scale, decays over time)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'was_promoted',
                    'dataType': ['boolean'],
                    'description': 'Whether project was ever promoted (for quality training)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'created_at',
                    'dataType': ['date'],
                    'description': 'Project creation timestamp',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'updated_at',
                    'dataType': ['date'],
                    'description': 'Last update timestamp',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
            ],
        }

    @classmethod
    def get_user_profile_schema(cls) -> dict:
        """
        Schema for UserProfile collection.

        Stores user preference vectors built from:
        - UserTag confidence scores
        - Behavioral signals (likes, views, interactions)
        - Profile data (bio, interests)

        Privacy Controls:
        - allow_similarity_matching: User consent for collaborative filtering
        - preference_text: NOT stored (only used for embedding generation)
        - Only aggregated interests stored, no raw behavioral data
        """
        return {
            'class': cls.USER_PROFILE_COLLECTION,
            'description': 'User preference vectors for personalization',
            'vectorizer': 'none',
            'properties': [
                {
                    'name': 'user_id',
                    'dataType': ['int'],
                    'description': 'Django User model ID',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                # NOTE: preference_text removed - sensitive data should not be stored
                # Embeddings are generated from text but text is not persisted
                {
                    'name': 'tool_interests',
                    'dataType': ['text[]'],
                    'description': 'Tools the user is interested in (aggregated, non-PII)',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'category_interests',
                    'dataType': ['text[]'],
                    'description': 'Categories the user is interested in (aggregated, non-PII)',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'topic_interests',
                    'dataType': ['text[]'],
                    'description': 'Topics the user is interested in (aggregated, non-PII)',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'interaction_count',
                    'dataType': ['int'],
                    'description': 'Total interaction count (for cold-start detection)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'like_count',
                    'dataType': ['int'],
                    'description': 'Total likes given',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'allow_similarity_matching',
                    'dataType': ['boolean'],
                    'description': 'User consent for collaborative filtering (find similar users)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'updated_at',
                    'dataType': ['date'],
                    'description': 'Last profile vector update',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
            ],
        }

    @classmethod
    def get_tool_schema(cls) -> dict:
        """
        Schema for Tool collection.

        Stores tool embeddings for similarity search and
        recommendation diversification.
        """
        return {
            'class': cls.TOOL_COLLECTION,
            'description': 'Tool embeddings for similarity search',
            'vectorizer': 'none',
            'properties': [
                {
                    'name': 'tool_id',
                    'dataType': ['int'],
                    'description': 'Django Tool model ID (TaxonomyNode)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'name',
                    'dataType': ['text'],
                    'description': 'Tool name',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'description',
                    'dataType': ['text'],
                    'description': 'Tool description',
                    'indexFilterable': False,
                    'indexSearchable': True,
                },
                {
                    'name': 'category',
                    'dataType': ['text'],
                    'description': 'Tool category',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'use_cases',
                    'dataType': ['text[]'],
                    'description': 'Common use cases for this tool',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'related_tools',
                    'dataType': ['text[]'],
                    'description': 'Names of related tools',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'project_count',
                    'dataType': ['int'],
                    'description': 'Number of projects using this tool',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
            ],
        }

    @classmethod
    def get_quiz_schema(cls) -> dict:
        """
        Schema for Quiz collection.

        Stores quiz embeddings for semantic search across
        learning content.
        """
        return {
            'class': cls.QUIZ_COLLECTION,
            'description': 'Quiz embeddings for semantic search',
            'vectorizer': 'none',
            'properties': [
                {
                    'name': 'quiz_id',
                    'dataType': ['text'],  # UUID stored as text
                    'description': 'Django Quiz model UUID',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'title',
                    'dataType': ['text'],
                    'description': 'Quiz title',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'combined_text',
                    'dataType': ['text'],
                    'description': 'Combined text for keyword search (title + description + topics)',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'description',
                    'dataType': ['text'],
                    'description': 'Quiz description',
                    'indexFilterable': False,
                    'indexSearchable': True,
                },
                {
                    'name': 'topic',
                    'dataType': ['text'],
                    'description': 'Main topic of the quiz',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'topics',
                    'dataType': ['text[]'],
                    'description': 'Topic tags',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'difficulty',
                    'dataType': ['text'],
                    'description': 'Difficulty level (beginner, intermediate, advanced)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'tool_names',
                    'dataType': ['text[]'],
                    'description': 'Names of tools covered in the quiz',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'category_names',
                    'dataType': ['text[]'],
                    'description': 'Category names',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'question_count',
                    'dataType': ['int'],
                    'description': 'Number of questions in the quiz',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'is_published',
                    'dataType': ['boolean'],
                    'description': 'Whether quiz is published',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'created_at',
                    'dataType': ['date'],
                    'description': 'Quiz creation timestamp',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
            ],
        }

    @classmethod
    def get_all_schemas(cls) -> list[dict]:
        """Get all collection schemas."""
        return [
            cls.get_project_schema(),
            cls.get_user_profile_schema(),
            cls.get_tool_schema(),
            cls.get_quiz_schema(),
        ]

    @classmethod
    def create_all_collections(cls, client: 'weaviate.Client') -> dict[str, bool]:
        """
        Create all collections in Weaviate.

        Args:
            client: Weaviate client instance

        Returns:
            Dict mapping collection name to creation success status
        """
        results = {}

        for schema in cls.get_all_schemas():
            collection_name = schema['class']
            try:
                # Check if collection already exists
                if client.schema.exists(collection_name):
                    logger.info(f'Collection {collection_name} already exists')
                    results[collection_name] = True
                    continue

                # Create the collection
                client.schema.create_class(schema)
                logger.info(f'Created collection: {collection_name}')
                results[collection_name] = True

            except Exception as e:
                logger.error(f'Failed to create collection {collection_name}: {e}')
                results[collection_name] = False

        return results

    @classmethod
    def delete_all_collections(cls, client: 'weaviate.Client') -> dict[str, bool]:
        """
        Delete all collections from Weaviate.

        Args:
            client: Weaviate client instance

        Returns:
            Dict mapping collection name to deletion success status
        """
        results = {}

        for schema in cls.get_all_schemas():
            collection_name = schema['class']
            try:
                if client.schema.exists(collection_name):
                    client.schema.delete_class(collection_name)
                    logger.info(f'Deleted collection: {collection_name}')
                results[collection_name] = True

            except Exception as e:
                logger.error(f'Failed to delete collection {collection_name}: {e}')
                results[collection_name] = False

        return results
