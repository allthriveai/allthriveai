from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.quizzes.models import Quiz, QuizAttempt, QuizQuestion

User = get_user_model()


class QuizAPITestCase(TestCase):
    """Test suite for Quiz API endpoints"""

    def setUp(self):
        """Set up test data"""
        self.client = APIClient()

        # Create test user
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

        # Create test quiz
        self.quiz = Quiz.objects.create(
            title='Test Quiz',
            slug='test-quiz',
            description='A test quiz',
            difficulty='beginner',
            estimated_time=5,
            is_published=True,
            created_by=self.user,
        )

        # Create test questions
        self.question1 = QuizQuestion.objects.create(
            quiz=self.quiz,
            question='Is testing important?',
            type='true_false',
            correct_answer='true',
            explanation='Yes, testing is crucial for quality software.',
            order=1,
        )

        self.question2 = QuizQuestion.objects.create(
            quiz=self.quiz,
            question='What is 2 + 2?',
            type='multiple_choice',
            correct_answer='4',
            options=['2', '3', '4', '5'],
            explanation='2 + 2 equals 4',
            order=2,
        )

    def test_list_quizzes(self):
        """Test listing all published quizzes"""
        response = self.client.get('/api/v1/quizzes/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['title'], 'Test Quiz')

    def test_get_quiz_by_slug(self):
        """Test retrieving a quiz by slug"""
        response = self.client.get(f'/api/v1/quizzes/{self.quiz.slug}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Test Quiz')
        self.assertEqual(response.data['slug'], 'test-quiz')

    def test_start_quiz_requires_authentication(self):
        """Test that starting a quiz requires authentication"""
        response = self.client.post(f'/api/v1/quizzes/{self.quiz.slug}/start/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_start_quiz_authenticated(self):
        """Test starting a quiz when authenticated"""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f'/api/v1/quizzes/{self.quiz.slug}/start/')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('attempt_id', response.data)
        self.assertIn('questions', response.data)
        self.assertEqual(len(response.data['questions']), 2)

        # Verify questions don't include correct answers
        for question in response.data['questions']:
            self.assertNotIn('correct_answer', question)

    def test_submit_answer_correct(self):
        """Test submitting a correct answer"""
        self.client.force_authenticate(user=self.user)

        # Start quiz
        start_response = self.client.post(f'/api/v1/quizzes/{self.quiz.slug}/start/')
        attempt_id = start_response.data['attempt_id']

        # Submit correct answer
        response = self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(self.question1.id), 'answer': 'true', 'time_spent': 5},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['correct'])
        self.assertIn('explanation', response.data)

    def test_submit_answer_incorrect(self):
        """Test submitting an incorrect answer"""
        self.client.force_authenticate(user=self.user)

        # Start quiz
        start_response = self.client.post(f'/api/v1/quizzes/{self.quiz.slug}/start/')
        attempt_id = start_response.data['attempt_id']

        # Submit incorrect answer
        response = self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(self.question1.id), 'answer': 'false', 'time_spent': 3},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['correct'])
        self.assertIn('correct_answer', response.data)

    def test_complete_quiz(self):
        """Test completing a quiz"""
        self.client.force_authenticate(user=self.user)

        # Start quiz
        start_response = self.client.post(f'/api/v1/quizzes/{self.quiz.slug}/start/')
        attempt_id = start_response.data['attempt_id']

        # Answer questions
        self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(self.question1.id), 'answer': 'true', 'time_spent': 5},
        )

        self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(self.question2.id), 'answer': '4', 'time_spent': 7},
        )

        # Complete quiz
        response = self.client.post(f'/api/v1/me/quiz-attempts/{attempt_id}/complete/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['score'], 2)
        self.assertEqual(response.data['total_questions'], 2)
        self.assertEqual(response.data['percentage_score'], 100.0)

    def test_quiz_search(self):
        """Test searching quizzes"""
        response = self.client.get('/api/v1/quizzes/?search=Test')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_quiz_filter_by_difficulty(self):
        """Test filtering quizzes by difficulty"""
        response = self.client.get('/api/v1/quizzes/?difficulty=beginner')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_unpublished_quiz_not_visible(self):
        """Test that unpublished quizzes are not returned"""
        unpublished = Quiz.objects.create(
            title='Unpublished Quiz',
            slug='unpublished-quiz',
            description='Should not appear',
            difficulty='beginner',
            estimated_time=5,
            is_published=False,
            created_by=self.user,
        )

        response = self.client.get('/api/v1/quizzes/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)  # Only published quiz

    def test_quiz_stats(self):
        """Test getting quiz statistics"""
        self.client.force_authenticate(user=self.user)

        # Complete a quiz first
        start_response = self.client.post(f'/api/v1/quizzes/{self.quiz.slug}/start/')
        attempt_id = start_response.data['attempt_id']

        self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(self.question1.id), 'answer': 'true', 'time_spent': 5},
        )

        self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(self.question2.id), 'answer': '3', 'time_spent': 5},
        )

        self.client.post(f'/api/v1/me/quiz-attempts/{attempt_id}/complete/')

        # Get stats
        response = self.client.get('/api/v1/me/quiz-attempts/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_attempts'], 1)
        self.assertIn('average_score', response.data)
        self.assertIn('topic_breakdown', response.data)


class QuizModelTestCase(TestCase):
    """Test suite for Quiz models"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

        self.quiz = Quiz.objects.create(
            title='Model Test Quiz',
            slug='model-test-quiz',
            description='Testing models',
            difficulty='intermediate',
            estimated_time=10,
            is_published=True,
            created_by=self.user,
        )

    def test_quiz_creation(self):
        """Test quiz model creation"""
        self.assertEqual(self.quiz.title, 'Model Test Quiz')
        self.assertEqual(self.quiz.difficulty, 'intermediate')
        self.assertTrue(self.quiz.is_published)

    def test_quiz_question_count(self):
        """Test question_count property"""
        self.assertEqual(self.quiz.question_count, 0)

        QuizQuestion.objects.create(
            quiz=self.quiz,
            question='Test question?',
            type='true_false',
            correct_answer='true',
            explanation='Test explanation',
            order=1,
        )

        self.assertEqual(self.quiz.question_count, 1)

    def test_quiz_attempt_percentage_score(self):
        """Test percentage_score property on QuizAttempt"""
        attempt = QuizAttempt.objects.create(quiz=self.quiz, user=self.user, score=8, total_questions=10)

        self.assertEqual(attempt.percentage_score, 80.0)

    def test_quiz_attempt_is_completed(self):
        """Test is_completed property"""
        from django.utils import timezone

        attempt = QuizAttempt.objects.create(quiz=self.quiz, user=self.user, score=5, total_questions=5)

        self.assertFalse(attempt.is_completed)

        attempt.completed_at = timezone.now()
        attempt.save()

        self.assertTrue(attempt.is_completed)


class QuizEdgeCasesTestCase(TestCase):
    """Test suite for edge cases and error conditions"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

        self.quiz = Quiz.objects.create(
            title='Edge Case Quiz',
            slug='edge-case-quiz',
            description='Testing edge cases',
            difficulty='beginner',
            estimated_time=5,
            is_published=True,
            created_by=self.user,
        )

        self.question = QuizQuestion.objects.create(
            quiz=self.quiz,
            question='Test question?',
            type='true_false',
            correct_answer='true',
            explanation='Test',
            order=1,
        )

    def test_duplicate_answer_rejected(self):
        """Test that answering the same question twice is rejected"""
        self.client.force_authenticate(user=self.user)

        start_response = self.client.post(f'/api/v1/quizzes/{self.quiz.slug}/start/')
        attempt_id = start_response.data['attempt_id']

        # Submit answer once
        response1 = self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(self.question.id), 'answer': 'true', 'time_spent': 5},
        )
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        # Try to submit again - should be rejected
        response2 = self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(self.question.id), 'answer': 'false', 'time_spent': 5},
        )
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been answered', response2.data['error'])

    def test_negative_time_spent(self):
        """Test validation of negative time_spent values"""
        self.client.force_authenticate(user=self.user)

        start_response = self.client.post(f'/api/v1/quizzes/{self.quiz.slug}/start/')
        attempt_id = start_response.data['attempt_id']

        response = self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(self.question.id), 'answer': 'true', 'time_spent': -5},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_very_long_answer_string(self):
        """Test handling of extremely long answer strings"""
        self.client.force_authenticate(user=self.user)

        start_response = self.client.post(f'/api/v1/quizzes/{self.quiz.slug}/start/')
        attempt_id = start_response.data['attempt_id']

        long_answer = 'a' * 10000
        response = self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(self.question.id), 'answer': long_answer, 'time_spent': 5},
        )
        # Should still work, just be marked incorrect
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_invalid_question_id(self):
        """Test submitting answer for non-existent question"""
        self.client.force_authenticate(user=self.user)

        start_response = self.client.post(f'/api/v1/quizzes/{self.quiz.slug}/start/')
        attempt_id = start_response.data['attempt_id']

        response = self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': '00000000-0000-0000-0000-000000000000', 'answer': 'true', 'time_spent': 5},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_answer_after_completion(self):
        """Test that answers cannot be submitted after quiz is completed"""
        self.client.force_authenticate(user=self.user)

        start_response = self.client.post(f'/api/v1/quizzes/{self.quiz.slug}/start/')
        attempt_id = start_response.data['attempt_id']

        # Answer and complete
        self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(self.question.id), 'answer': 'true', 'time_spent': 5},
        )
        self.client.post(f'/api/v1/me/quiz-attempts/{attempt_id}/complete/')

        # Try to add another question and answer it
        question2 = QuizQuestion.objects.create(
            quiz=self.quiz,
            question='Another question?',
            type='true_false',
            correct_answer='false',
            explanation='Test',
            order=2,
        )

        response = self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(question2.id), 'answer': 'false', 'time_spent': 5},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_special_characters_in_answer(self):
        """Test handling of special characters in answers"""
        self.client.force_authenticate(user=self.user)

        start_response = self.client.post(f'/api/v1/quizzes/{self.quiz.slug}/start/')
        attempt_id = start_response.data['attempt_id']

        special_answer = '<script>alert("xss")</script>'
        response = self.client.post(
            f'/api/v1/me/quiz-attempts/{attempt_id}/answer/',
            {'question_id': str(self.question.id), 'answer': special_answer, 'time_spent': 5},
        )
        # Should sanitize and process without error
        self.assertEqual(response.status_code, status.HTTP_200_OK)
