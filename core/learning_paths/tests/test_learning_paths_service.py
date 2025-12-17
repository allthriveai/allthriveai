"""
Tests for Learning Paths Service.

Tests quiz topic mapping and learning path updates.
"""

from django.test import TestCase
from django.utils import timezone

from core.learning_paths.models import UserLearningPath
from core.quizzes.models import Quiz, QuizAttempt
from core.users.models import User
from services.gamification.learning_paths import (
    LearningPathService,
)


class QuizTopicMappingTestCase(TestCase):
    """Tests for quiz topic to learning path topic mapping."""

    def setUp(self):
        """Set up test data."""
        self.service = LearningPathService()

    def test_maps_prompt_engineering_to_prompts_templates(self):
        """Test that 'Prompt Engineering' maps correctly."""
        result = self.service.map_quiz_topic_to_path_topic('Prompt Engineering')
        self.assertEqual(result, 'prompts-templates')

    def test_maps_ai_frameworks_to_ai_agents(self):
        """Test that 'AI Frameworks' maps correctly."""
        result = self.service.map_quiz_topic_to_path_topic('AI Frameworks')
        self.assertEqual(result, 'ai-agents-multitool')

    def test_maps_chain_of_thought_to_prompts_templates(self):
        """Test that 'chain-of-thought' maps correctly."""
        result = self.service.map_quiz_topic_to_path_topic('chain-of-thought')
        self.assertEqual(result, 'prompts-templates')

    def test_maps_few_shot_learning_to_prompts_templates(self):
        """Test that 'few-shot learning' maps correctly."""
        result = self.service.map_quiz_topic_to_path_topic('few-shot learning')
        self.assertEqual(result, 'prompts-templates')

    def test_maps_langchain_to_ai_agents(self):
        """Test that 'langchain' maps correctly."""
        result = self.service.map_quiz_topic_to_path_topic('langchain')
        self.assertEqual(result, 'ai-agents-multitool')

    def test_maps_langgraph_to_ai_agents(self):
        """Test that 'langgraph' maps correctly."""
        result = self.service.map_quiz_topic_to_path_topic('langgraph')
        self.assertEqual(result, 'ai-agents-multitool')

    def test_maps_crewai_to_ai_agents(self):
        """Test that 'crewai' maps correctly."""
        result = self.service.map_quiz_topic_to_path_topic('crewai')
        self.assertEqual(result, 'ai-agents-multitool')

    def test_maps_autogen_to_ai_agents(self):
        """Test that 'autogen' maps correctly."""
        result = self.service.map_quiz_topic_to_path_topic('autogen')
        self.assertEqual(result, 'ai-agents-multitool')

    def test_maps_multi_agent_systems_to_ai_agents(self):
        """Test that 'multi-agent systems' maps correctly."""
        result = self.service.map_quiz_topic_to_path_topic('multi-agent systems')
        self.assertEqual(result, 'ai-agents-multitool')

    def test_maps_llm_to_ai_models_research(self):
        """Test that 'llm' maps correctly."""
        result = self.service.map_quiz_topic_to_path_topic('llm')
        self.assertEqual(result, 'ai-models-research')

    def test_maps_ai_best_practices_to_ai_models_research(self):
        """Test that 'ai best practices' maps correctly."""
        result = self.service.map_quiz_topic_to_path_topic('ai best practices')
        self.assertEqual(result, 'ai-models-research')

    def test_case_insensitive_mapping(self):
        """Test that mapping is case insensitive."""
        # Various case variations should all work
        self.assertEqual(
            self.service.map_quiz_topic_to_path_topic('PROMPT ENGINEERING'),
            'prompts-templates',
        )
        self.assertEqual(
            self.service.map_quiz_topic_to_path_topic('LangChain'),
            'ai-agents-multitool',
        )
        self.assertEqual(
            self.service.map_quiz_topic_to_path_topic('LLM'),
            'ai-models-research',
        )

    def test_strips_whitespace(self):
        """Test that leading/trailing whitespace is stripped."""
        result = self.service.map_quiz_topic_to_path_topic('  prompt engineering  ')
        self.assertEqual(result, 'prompts-templates')

    def test_returns_none_for_unknown_topic(self):
        """Test that unknown topics return None."""
        result = self.service.map_quiz_topic_to_path_topic('unknown topic xyz')
        self.assertIsNone(result)

    def test_returns_none_for_empty_topic(self):
        """Test that empty string returns None."""
        result = self.service.map_quiz_topic_to_path_topic('')
        self.assertIsNone(result)

    def test_returns_none_for_none_topic(self):
        """Test that None input returns None."""
        result = self.service.map_quiz_topic_to_path_topic(None)
        self.assertIsNone(result)


class LearningPathServiceTestCase(TestCase):
    """Tests for LearningPathService core functionality."""

    def setUp(self):
        """Set up test data."""
        self.service = LearningPathService()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

    def test_get_or_create_path_creates_new_path(self):
        """Test that get_or_create_path creates a new learning path."""
        path = self.service.get_or_create_path(self.user, 'prompts-templates')

        self.assertIsNotNone(path)
        self.assertEqual(path.user, self.user)
        self.assertEqual(path.topic, 'prompts-templates')
        self.assertEqual(path.current_skill_level, 'beginner')

    def test_get_or_create_path_returns_existing_path(self):
        """Test that get_or_create_path returns existing path."""
        # Create first
        path1 = self.service.get_or_create_path(self.user, 'prompts-templates')

        # Get again
        path2 = self.service.get_or_create_path(self.user, 'prompts-templates')

        self.assertEqual(path1.id, path2.id)

    def test_get_user_paths_excludes_empty_by_default(self):
        """Test that get_user_paths excludes paths with no progress."""
        # Create empty path
        self.service.get_or_create_path(self.user, 'prompts-templates')

        paths = self.service.get_user_paths(self.user)
        self.assertEqual(len(paths), 0)

    def test_get_user_paths_includes_empty_when_requested(self):
        """Test that get_user_paths includes empty paths when include_empty=True."""
        self.service.get_or_create_path(self.user, 'prompts-templates')

        paths = self.service.get_user_paths(self.user, include_empty=True)
        self.assertEqual(len(paths), 1)


class QuizCompletionLearningPathTestCase(TestCase):
    """Tests for learning path updates on quiz completion."""

    def setUp(self):
        """Set up test data."""
        self.service = LearningPathService()
        self.user = User.objects.create_user(
            username='quizuser',
            email='quiz@example.com',
            password='testpass123',
        )
        # Create a quiz with a mapped topic
        self.quiz = Quiz.objects.create(
            title='Test Prompt Engineering Quiz',
            topic='Prompt Engineering',
            description='Test quiz',
            difficulty='beginner',
            estimated_time=10,
            is_published=True,
            created_by=self.user,
        )

    def test_update_path_on_quiz_completion_creates_path(self):
        """Test that completing a quiz creates a learning path."""
        # Create quiz attempt
        attempt = QuizAttempt.objects.create(
            user=self.user,
            quiz=self.quiz,
            score=8,
            total_questions=10,
            completed_at=timezone.now(),
        )

        # Get the mapped topic
        mapped_topic = self.service.map_quiz_topic_to_path_topic(self.quiz.topic)
        self.assertEqual(mapped_topic, 'prompts-templates')

        # Update path
        path = self.service.update_path_on_quiz_completion(self.user, mapped_topic, attempt)

        self.assertIsNotNone(path)
        self.assertEqual(path.topic, 'prompts-templates')
        self.assertGreater(path.topic_points, 0)

    def test_update_path_on_perfect_score_gives_bonus(self):
        """Test that perfect quiz score gives bonus points via signal."""
        # Create quiz attempt with perfect score
        # The signal will fire on create and update the learning path
        QuizAttempt.objects.create(
            user=self.user,
            quiz=self.quiz,
            score=10,
            total_questions=10,
            completed_at=timezone.now(),
        )

        # Get the path that was created by the signal
        mapped_topic = self.service.map_quiz_topic_to_path_topic(self.quiz.topic)
        path = UserLearningPath.objects.get(user=self.user, topic=mapped_topic)

        # Perfect score should give quiz_completed + quiz_perfect_score
        # 20 + 30 = 50 points
        self.assertEqual(path.topic_points, 50)
