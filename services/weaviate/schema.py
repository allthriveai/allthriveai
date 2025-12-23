"""
Weaviate schema definitions for personalization and learning intelligence collections.

Content Collections:
- Project: Content embeddings for semantic search and recommendations
- UserProfile: User preference vectors for personalization
- Tool: Tool similarity search
- Quiz: Quiz semantic search
- MicroLesson: Micro-lesson semantic search
- Game: Game discovery

Learning Intelligence Collections:
- KnowledgeState: User knowledge per concept for semantic gap detection
- LearningGap: Detected confusion/struggle patterns for proactive help
- Concept: Semantic graph of learnable concepts for path generation
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
    MICRO_LESSON_COLLECTION = 'MicroLesson'
    GAME_COLLECTION = 'Game'

    # Learning intelligence collections
    KNOWLEDGE_STATE_COLLECTION = 'KnowledgeState'
    LEARNING_GAP_COLLECTION = 'LearningGap'
    CONCEPT_COLLECTION = 'Concept'

    # Content metadata taxonomy properties shared across content types
    # These correspond to the ContentMetadataMixin and taxonomy fields
    CONTENT_METADATA_PROPERTIES = [
        {
            'name': 'content_type_name',
            'dataType': ['text'],
            'description': 'Content format (article, video, code-repo, course, etc.)',
            'indexFilterable': True,
            'indexSearchable': True,
        },
        {
            'name': 'time_investment_name',
            'dataType': ['text'],
            'description': 'Time to consume (quick, short, medium, deep-dive)',
            'indexFilterable': True,
            'indexSearchable': False,
        },
        {
            'name': 'difficulty_taxonomy_name',
            'dataType': ['text'],
            'description': 'Content difficulty level (beginner, intermediate, advanced)',
            'indexFilterable': True,
            'indexSearchable': False,
        },
        {
            'name': 'pricing_taxonomy_name',
            'dataType': ['text'],
            'description': 'Pricing tier (free, freemium, paid)',
            'indexFilterable': True,
            'indexSearchable': False,
        },
    ]

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
                    'name': 'weaviate_uuid',
                    'dataType': ['text'],
                    'description': 'Stable UUID for cross-referencing',
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
                # Content metadata taxonomy fields (from ContentMetadataMixin)
                {
                    'name': 'content_type_name',
                    'dataType': ['text'],
                    'description': 'Content format (article, video, code-repo, course, etc.)',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'time_investment_name',
                    'dataType': ['text'],
                    'description': 'Time to consume (quick, short, medium, deep-dive)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'difficulty_taxonomy_name',
                    'dataType': ['text'],
                    'description': 'Content difficulty level (beginner, intermediate, advanced)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'pricing_taxonomy_name',
                    'dataType': ['text'],
                    'description': 'Pricing tier (free, freemium, paid)',
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
                    'name': 'weaviate_uuid',
                    'dataType': ['text'],
                    'description': 'Stable UUID for cross-referencing',
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
                    'name': 'weaviate_uuid',
                    'dataType': ['text'],
                    'description': 'Stable UUID for cross-referencing',
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
                # Content metadata taxonomy fields (from ContentMetadataMixin)
                {
                    'name': 'content_type_name',
                    'dataType': ['text'],
                    'description': 'Content format (article, video, code-repo, course, etc.)',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'time_investment_name',
                    'dataType': ['text'],
                    'description': 'Time to consume (quick, short, medium, deep-dive)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'difficulty_taxonomy_name',
                    'dataType': ['text'],
                    'description': 'Content difficulty level (beginner, intermediate, advanced)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'pricing_taxonomy_name',
                    'dataType': ['text'],
                    'description': 'Pricing tier (free, freemium, paid)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
            ],
        }

    @classmethod
    def get_micro_lesson_schema(cls) -> dict:
        """
        Schema for MicroLesson collection.

        Stores micro-lesson embeddings for semantic search across
        conversational learning content.
        """
        return {
            'class': cls.MICRO_LESSON_COLLECTION,
            'description': 'MicroLesson embeddings for semantic search',
            'vectorizer': 'none',
            'properties': [
                {
                    'name': 'lesson_id',
                    'dataType': ['int'],
                    'description': 'Django MicroLesson model ID',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'weaviate_uuid',
                    'dataType': ['text'],
                    'description': 'Stable UUID for cross-referencing',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'title',
                    'dataType': ['text'],
                    'description': 'Lesson title',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'combined_text',
                    'dataType': ['text'],
                    'description': 'Combined text for keyword search (title + content)',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'concept_name',
                    'dataType': ['text'],
                    'description': 'Name of the concept this lesson teaches',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'concept_topic',
                    'dataType': ['text'],
                    'description': 'Topic the concept belongs to',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'lesson_type',
                    'dataType': ['text'],
                    'description': 'Type of lesson (explanation, example, practice, tip)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'difficulty',
                    'dataType': ['text'],
                    'description': 'Difficulty level (beginner, intermediate, advanced)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'estimated_minutes',
                    'dataType': ['int'],
                    'description': 'Estimated reading/completion time',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'is_ai_generated',
                    'dataType': ['boolean'],
                    'description': 'Whether this was AI-generated vs curated',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'quality_score',
                    'dataType': ['number'],
                    'description': 'Quality score from feedback (0.0-1.0)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'is_active',
                    'dataType': ['boolean'],
                    'description': 'Whether lesson is active',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'created_at',
                    'dataType': ['date'],
                    'description': 'Lesson creation timestamp',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
            ],
        }

    @classmethod
    def get_game_schema(cls) -> dict:
        """
        Schema for Game collection.

        Stores game embeddings for semantic search and discovery.
        Games are static content (Context Snake, Ethics Defender, Prompt Battle).
        """
        return {
            'class': cls.GAME_COLLECTION,
            'description': 'Game embeddings for search and discovery',
            'vectorizer': 'none',
            'properties': [
                {
                    'name': 'game_id',
                    'dataType': ['text'],
                    'description': 'Game identifier (context_snake, ethics_defender, prompt_battle)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'weaviate_uuid',
                    'dataType': ['text'],
                    'description': 'Stable UUID for cross-referencing',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'title',
                    'dataType': ['text'],
                    'description': 'Game title',
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
                    'description': 'Game description and how to play',
                    'indexFilterable': False,
                    'indexSearchable': True,
                },
                {
                    'name': 'learning_outcomes',
                    'dataType': ['text[]'],
                    'description': 'What players learn from the game',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'topic_tags',
                    'dataType': ['text[]'],
                    'description': 'Related topics/concepts',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'difficulty',
                    'dataType': ['text'],
                    'description': 'Game difficulty level',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'url',
                    'dataType': ['text'],
                    'description': 'Frontend route to the game',
                    'indexFilterable': False,
                    'indexSearchable': False,
                },
                {
                    'name': 'player_count',
                    'dataType': ['int'],
                    'description': 'Number of players who played',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'content_type_name',
                    'dataType': ['text'],
                    'description': 'Content type (always "Game")',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
            ],
        }

    # =========================================================================
    # Learning Intelligence Collections
    # =========================================================================

    @classmethod
    def get_knowledge_state_schema(cls) -> dict:
        """
        Schema for KnowledgeState collection.

        Stores semantic representation of user's knowledge per concept.
        Synced from UserConceptMastery for semantic gap detection.

        Enables queries like:
        - "What concepts similar to X does this user NOT know?"
        - "Find users with similar knowledge profiles"
        """
        return {
            'class': cls.KNOWLEDGE_STATE_COLLECTION,
            'description': 'User knowledge state per concept for semantic gap detection',
            'vectorizer': 'none',
            'properties': [
                {
                    'name': 'user_id',
                    'dataType': ['int'],
                    'description': 'Django User model ID',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'concept_id',
                    'dataType': ['int'],
                    'description': 'Django Concept model ID',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'concept_name',
                    'dataType': ['text'],
                    'description': 'Name of the concept',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'topic_slug',
                    'dataType': ['text'],
                    'description': 'Topic taxonomy slug',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'mastery_level',
                    'dataType': ['text'],
                    'description': 'Mastery level (unknown, aware, learning, practicing, proficient, expert)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'mastery_score',
                    'dataType': ['number'],
                    'description': 'Mastery score 0.0-1.0',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'understanding_text',
                    'dataType': ['text'],
                    'description': 'Text used for embedding generation (concept + mastery context)',
                    'indexFilterable': False,
                    'indexSearchable': True,
                },
                {
                    'name': 'times_practiced',
                    'dataType': ['int'],
                    'description': 'Number of times concept was practiced',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'last_practiced',
                    'dataType': ['date'],
                    'description': 'Last practice timestamp',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'next_review_at',
                    'dataType': ['date'],
                    'description': 'Next spaced repetition review timestamp',
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
    def get_learning_gap_schema(cls) -> dict:
        """
        Schema for LearningGap collection.

        Stores detected confusion/struggle patterns from conversations.
        Used to track learning gaps over time and enable proactive help.

        Enables queries like:
        - "You struggled with X before, want me to explain?"
        - "What topics are users commonly confused about?"
        """
        return {
            'class': cls.LEARNING_GAP_COLLECTION,
            'description': 'Detected learning gaps from conversation patterns',
            'vectorizer': 'none',
            'properties': [
                {
                    'name': 'gap_id',
                    'dataType': ['text'],
                    'description': 'Unique gap identifier (UUID)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'user_id',
                    'dataType': ['int'],
                    'description': 'Django User model ID',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'concept_name',
                    'dataType': ['text'],
                    'description': 'Name of the concept with detected gap',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'topic_slug',
                    'dataType': ['text'],
                    'description': 'Topic taxonomy slug',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'gap_type',
                    'dataType': ['text'],
                    'description': 'Type of gap (confusion, prerequisite, practice, retention)',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'confidence',
                    'dataType': ['number'],
                    'description': 'Confidence score 0.0-1.0',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'evidence_summary',
                    'dataType': ['text'],
                    'description': 'Summary of evidence for this gap (no raw messages)',
                    'indexFilterable': False,
                    'indexSearchable': True,
                },
                {
                    'name': 'detected_at',
                    'dataType': ['date'],
                    'description': 'When the gap was detected',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'addressed',
                    'dataType': ['boolean'],
                    'description': 'Whether the gap has been addressed',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'addressed_at',
                    'dataType': ['date'],
                    'description': 'When the gap was addressed',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
            ],
        }

    @classmethod
    def get_concept_schema(cls) -> dict:
        """
        Schema for Concept collection.

        Stores semantic embeddings of learnable concepts for path generation.
        Synced from core.learning_paths.Concept model.

        Enables queries like:
        - "What concept should they learn next?"
        - "Find concepts semantically similar to X"
        - "What are the prerequisites for this concept?"
        """
        return {
            'class': cls.CONCEPT_COLLECTION,
            'description': 'Semantic graph of learnable concepts',
            'vectorizer': 'none',
            'properties': [
                {
                    'name': 'concept_id',
                    'dataType': ['int'],
                    'description': 'Django Concept model ID',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'weaviate_uuid',
                    'dataType': ['text'],
                    'description': 'Stable UUID for cross-referencing',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'name',
                    'dataType': ['text'],
                    'description': 'Concept name',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'description',
                    'dataType': ['text'],
                    'description': 'Concept description',
                    'indexFilterable': False,
                    'indexSearchable': True,
                },
                {
                    'name': 'topic_slug',
                    'dataType': ['text'],
                    'description': 'Topic taxonomy slug',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'topic_name',
                    'dataType': ['text'],
                    'description': 'Topic taxonomy name',
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
                    'name': 'prerequisite_names',
                    'dataType': ['text[]'],
                    'description': 'Names of prerequisite concepts',
                    'indexFilterable': True,
                    'indexSearchable': True,
                },
                {
                    'name': 'unlocks_names',
                    'dataType': ['text[]'],
                    'description': 'Names of concepts this unlocks',
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
                    'name': 'combined_text',
                    'dataType': ['text'],
                    'description': 'Combined text for keyword search',
                    'indexFilterable': False,
                    'indexSearchable': True,
                },
                {
                    'name': 'is_active',
                    'dataType': ['boolean'],
                    'description': 'Whether concept is active',
                    'indexFilterable': True,
                    'indexSearchable': False,
                },
                {
                    'name': 'created_at',
                    'dataType': ['date'],
                    'description': 'Concept creation timestamp',
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
            cls.get_micro_lesson_schema(),
            cls.get_game_schema(),
            # Learning intelligence collections
            cls.get_knowledge_state_schema(),
            cls.get_learning_gap_schema(),
            cls.get_concept_schema(),
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
