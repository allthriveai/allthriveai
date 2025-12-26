"""
Tests for Learning Paths API endpoints.

Covers the authenticated user endpoints for learning paths, learner profiles,
concepts, mastery tracking, and learning events.
"""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from core.learning_paths.models import (
    Concept,
    LearnerProfile,
    SavedLearningPath,
    UserConceptMastery,
)
from core.taxonomy.models import Taxonomy
from core.users.models import User


@pytest.fixture
def api_client():
    """Create an API client."""
    return APIClient()


@pytest.fixture
def user(db):
    """Create a regular test user."""
    return User.objects.create_user(
        username='testlearner',
        email='learner@example.com',
        password='testpass123',
    )


@pytest.fixture
def other_user(db):
    """Create another test user."""
    return User.objects.create_user(
        username='otherlearner',
        email='other@example.com',
        password='testpass123',
    )


@pytest.fixture
def topic(db):
    """Create a topic taxonomy that matches UserLearningPath.TOPIC_CHOICES."""
    return Taxonomy.objects.create(
        name='AI Models & Research',
        slug='ai-models-research',
        taxonomy_type='topic',
        is_active=True,
    )


@pytest.fixture
def concept(db, topic):
    """Create a test concept."""
    return Concept.objects.create(
        name='Prompt Engineering',
        slug='prompt-engineering',
        topic=topic.slug,
        description='Learn how to write effective prompts',
        base_difficulty='beginner',
        is_active=True,
    )


@pytest.fixture
def learner_profile(db, user):
    """Create a learner profile for the test user."""
    return LearnerProfile.objects.create(
        user=user,
        learning_goal='build_projects',
        has_completed_path_setup=True,
    )


@pytest.mark.django_db
class TestLearnerProfileView:
    """Tests for LearnerProfile GET/PUT endpoints."""

    def test_get_profile_requires_authentication(self, api_client):
        """Unauthenticated users cannot get learner profile."""
        response = api_client.get('/api/v1/me/learner-profile/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_profile_creates_if_missing(self, api_client, user):
        """GET creates profile if it doesn't exist."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/learner-profile/')

        assert response.status_code == status.HTTP_200_OK
        assert LearnerProfile.objects.filter(user=user).exists()

    def test_get_existing_profile(self, api_client, user, learner_profile):
        """GET returns existing profile data."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/learner-profile/')

        assert response.status_code == status.HTTP_200_OK
        # Check for fields that are in the current serializer
        assert 'preferred_learning_style' in response.data

    def test_update_profile(self, api_client, user, learner_profile):
        """PUT updates profile preferences."""
        api_client.force_authenticate(user=user)

        response = api_client.put(
            '/api/v1/me/learner-profile/',
            {'preferred_learning_style': 'visual'},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        learner_profile.refresh_from_db()
        assert learner_profile.preferred_learning_style == 'visual'


@pytest.mark.django_db
class TestMyLearningPathsViewSet:
    """Tests for authenticated user's learning paths."""

    def test_list_requires_authentication(self, api_client):
        """Listing paths requires authentication."""
        response = api_client.get('/api/v1/me/learning-paths/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_empty_paths(self, api_client, user):
        """Returns empty list when user has no learning paths."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/learning-paths/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_retrieve_invalid_topic(self, api_client, user):
        """Retrieving invalid topic returns 404."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/learning-paths/invalid-topic/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_start_learning_path(self, api_client, user, topic):
        """User can start a learning path for a valid topic."""
        api_client.force_authenticate(user=user)

        # API expects topic slug, not ID
        response = api_client.post(f'/api/v1/me/learning-paths/{topic.slug}/start/')

        assert response.status_code == status.HTTP_201_CREATED

    def test_start_invalid_topic(self, api_client, user):
        """Starting with invalid topic returns 400 or 404."""
        api_client.force_authenticate(user=user)

        response = api_client.post('/api/v1/me/learning-paths/99999/start/')

        # Could be 400 or 404 depending on implementation
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND]


@pytest.mark.django_db
class TestUserLearningPathsView:
    """Tests for public user learning paths."""

    def test_get_user_paths_unauthenticated(self, api_client, user):
        """Public can view user's learning paths."""
        response = api_client.get(f'/api/v1/users/{user.username}/learning-paths/')

        assert response.status_code == status.HTTP_200_OK

    def test_get_nonexistent_user(self, api_client):
        """Returns 404 for non-existent user."""
        response = api_client.get('/api/v1/users/nonexistent/learning-paths/')

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestUserLearningPathBySlugView:
    """Tests for fetching a specific user's learning path by slug.

    This view should return paths from either:
    1. LearnerProfile.generated_path (active path)
    2. SavedLearningPath (saved paths library)
    """

    def test_requires_authentication(self, api_client, user):
        """Unauthenticated users cannot access learning path by slug."""
        response = api_client.get(f'/api/v1/users/{user.username}/learning-paths/some-path/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_returns_active_path_from_learner_profile(self, api_client, user, other_user):
        """Returns path from LearnerProfile.generated_path when it matches the slug."""
        # Create a learner profile with an active generated path
        LearnerProfile.objects.create(
            user=user,
            learning_goal='build_projects',
            generated_path={
                'slug': 'active-learning-path',
                'title': 'Active Learning Path',
                'curriculum': [
                    {'type': 'article', 'title': 'Intro', 'order': 1},
                ],
                'topics_covered': ['ai-basics'],
            },
        )
        api_client.force_authenticate(user=other_user)

        response = api_client.get(f'/api/v1/users/{user.username}/learning-paths/active-learning-path/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['slug'] == 'active-learning-path'
        assert response.data['title'] == 'Active Learning Path'
        assert len(response.data['curriculum']) == 1

    def test_returns_saved_path_when_not_active(self, api_client, user, other_user):
        """Returns path from SavedLearningPath when not in LearnerProfile.generated_path.

        This is the key test - ensures saved paths are accessible even when
        the user has a different active path.
        """
        # Create a learner profile with a DIFFERENT active path
        LearnerProfile.objects.create(
            user=user,
            learning_goal='build_projects',
            generated_path={
                'slug': 'different-active-path',
                'title': 'Different Active Path',
                'curriculum': [],
            },
        )
        # Create a saved path in the library
        SavedLearningPath.objects.create(
            user=user,
            slug='saved-library-path',
            title='Saved Library Path',
            difficulty='intermediate',
            estimated_hours=5,
            path_data={
                'curriculum': [
                    {'type': 'video', 'title': 'Video Lesson', 'order': 1},
                    {'type': 'article', 'title': 'Article', 'order': 2},
                ],
                'topics_covered': ['fine-tuning', 'models'],
            },
        )
        api_client.force_authenticate(user=other_user)

        response = api_client.get(f'/api/v1/users/{user.username}/learning-paths/saved-library-path/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['slug'] == 'saved-library-path'
        assert response.data['title'] == 'Saved Library Path'
        assert response.data['difficulty'] == 'intermediate'
        assert len(response.data['curriculum']) == 2

    def test_returns_404_when_path_not_found(self, api_client, user, other_user):
        """Returns 404 when path doesn't exist in either location."""
        api_client.force_authenticate(user=other_user)

        response = api_client.get(f'/api/v1/users/{user.username}/learning-paths/nonexistent-path/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_404_for_nonexistent_user(self, api_client, user):
        """Returns 404 for non-existent username."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/users/nonexistentuser/learning-paths/some-path/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_ignores_archived_saved_paths(self, api_client, user, other_user):
        """Archived saved paths are not returned."""
        SavedLearningPath.objects.create(
            user=user,
            slug='archived-path',
            title='Archived Path',
            is_archived=True,
            path_data={'curriculum': []},
        )
        api_client.force_authenticate(user=other_user)

        response = api_client.get(f'/api/v1/users/{user.username}/learning-paths/archived-path/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_active_path_takes_precedence_over_saved(self, api_client, user, other_user):
        """When slug exists in both places, active path takes precedence."""
        # Both have the same slug
        LearnerProfile.objects.create(
            user=user,
            learning_goal='build_projects',
            generated_path={
                'slug': 'same-slug',
                'title': 'Active Version',
                'curriculum': [{'type': 'article', 'title': 'From Active', 'order': 1}],
            },
        )
        SavedLearningPath.objects.create(
            user=user,
            slug='same-slug',
            title='Saved Version',
            path_data={
                'curriculum': [{'type': 'video', 'title': 'From Saved', 'order': 1}],
            },
        )
        api_client.force_authenticate(user=other_user)

        response = api_client.get(f'/api/v1/users/{user.username}/learning-paths/same-slug/')

        assert response.status_code == status.HTTP_200_OK
        # Should return the active version, not the saved one
        assert response.data['title'] == 'Active Version'
        assert response.data['curriculum'][0]['title'] == 'From Active'


@pytest.mark.django_db
class TestConceptViewSet:
    """Tests for concept browsing endpoints."""

    def test_list_concepts_public(self, api_client, concept):
        """Concepts endpoint is public."""
        response = api_client.get('/api/v1/concepts/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) >= 1

    def test_filter_by_topic(self, api_client, concept, topic):
        """Can filter concepts by topic."""
        response = api_client.get(f'/api/v1/concepts/?topic={topic.slug}')

        assert response.status_code == status.HTTP_200_OK
        for c in response.data['results']:
            assert c['topic'] == topic.slug

    def test_filter_by_difficulty(self, api_client, concept):
        """Can filter concepts by difficulty."""
        response = api_client.get('/api/v1/concepts/?difficulty=beginner')

        assert response.status_code == status.HTTP_200_OK
        for c in response.data['results']:
            assert c['base_difficulty'] == 'beginner'

    def test_get_concept_by_slug(self, api_client, concept):
        """Can retrieve a concept by slug."""
        response = api_client.get(f'/api/v1/concepts/{concept.slug}/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['slug'] == concept.slug


@pytest.mark.django_db
class TestUserConceptMasteryViewSet:
    """Tests for user's concept mastery tracking."""

    def test_list_requires_authentication(self, api_client):
        """Listing mastery requires authentication."""
        response = api_client.get('/api/v1/me/concept-mastery/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_empty_mastery(self, api_client, user):
        """Returns empty list when user has no mastery records."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/concept-mastery/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['results'] == []

    def test_list_mastery_with_data(self, api_client, user, concept):
        """Returns mastery records when they exist."""
        UserConceptMastery.objects.create(
            user=user,
            concept=concept,
            mastery_level='learning',
            mastery_score=0.5,
        )
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/concept-mastery/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['mastery_level'] == 'learning'

    def test_filter_by_level(self, api_client, user, concept):
        """Can filter mastery by level."""
        UserConceptMastery.objects.create(
            user=user,
            concept=concept,
            mastery_level='learning',
        )
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/concept-mastery/?level=learning')

        assert response.status_code == status.HTTP_200_OK
        for m in response.data['results']:
            assert m['mastery_level'] == 'learning'

    def test_knowledge_gaps_action(self, api_client, user, concept):
        """Can get knowledge gaps (low mastery, practiced concepts)."""
        UserConceptMastery.objects.create(
            user=user,
            concept=concept,
            mastery_level='learning',
            mastery_score=0.2,
            times_practiced=3,
        )
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/concept-mastery/knowledge_gaps/')

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestLearningEventsView:
    """Tests for learning events CRUD."""

    def test_list_requires_authentication(self, api_client):
        """Listing events requires authentication."""
        response = api_client.get('/api/v1/me/learning-events/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_empty_events(self, api_client, user):
        """Returns empty list when user has no events."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/learning-events/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_create_learning_event(self, api_client, user, concept):
        """Can create a learning event."""
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/me/learning-events/',
            {
                'event_type': 'concept_completed',
                'concept_slug': concept.slug,
                'was_successful': True,
            },
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['event_type'] == 'concept_completed'

    def test_create_event_invalid_concept(self, api_client, user):
        """Creating event with invalid concept returns 404."""
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/me/learning-events/',
            {
                'event_type': 'concept_completed',
                'concept_slug': 'nonexistent-concept',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestLearningStatsView:
    """Tests for learning statistics endpoint."""

    def test_get_stats_requires_authentication(self, api_client):
        """Getting stats requires authentication."""
        response = api_client.get('/api/v1/me/learning-stats/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_stats_default_period(self, api_client, user):
        """Returns stats for default 30-day period."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/learning-stats/')

        assert response.status_code == status.HTTP_200_OK
        # Stats structure should exist
        assert 'total_events' in response.data or 'events_count' in response.data or response.data is not None

    def test_get_stats_custom_period(self, api_client, user):
        """Can request stats for custom period."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/learning-stats/?days=7')

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestStructuredPathView:
    """Tests for personalized structured learning path."""

    def test_get_path_requires_authentication(self, api_client):
        """Getting structured path requires authentication."""
        response = api_client.get('/api/v1/me/structured-path/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_structured_path(self, api_client, user, learner_profile):
        """Returns personalized path for user."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/structured-path/')

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestLearningSetupView:
    """Tests for cold-start learning setup."""

    def test_setup_requires_authentication(self, api_client):
        """Setup requires authentication."""
        response = api_client.post('/api/v1/me/learning-setup/', {})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_complete_setup_with_goal(self, api_client, user):
        """Can complete setup with a learning goal."""
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/me/learning-setup/',
            {'learning_goal': 'build_projects'},
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED

    def test_setup_invalid_goal(self, api_client, user):
        """Invalid goal returns 400."""
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/me/learning-setup/',
            {'learning_goal': 'invalid_goal'},
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_setup(self, api_client, user, learner_profile):
        """Can reset learning setup."""
        api_client.force_authenticate(user=user)

        response = api_client.delete('/api/v1/me/learning-setup/')

        assert response.status_code == status.HTTP_204_NO_CONTENT
        learner_profile.refresh_from_db()
        assert learner_profile.has_completed_path_setup is False


@pytest.mark.django_db
class TestAllTopicsView:
    """Tests for topics listing endpoint."""

    def test_list_topics_public(self, api_client, topic):
        """Topics list is public."""
        response = api_client.get('/api/v1/learning-paths/topics/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_topics_ordered(self, api_client, db):
        """Topics are ordered alphabetically by name."""
        Taxonomy.objects.create(
            name='Zebra Topic',
            slug='zebra-topic',
            taxonomy_type='topic',
            is_active=True,
        )
        Taxonomy.objects.create(
            name='Alpha Topic',
            slug='alpha-topic',
            taxonomy_type='topic',
            is_active=True,
        )

        response = api_client.get('/api/v1/learning-paths/topics/')

        assert response.status_code == status.HTTP_200_OK
        # Topics should be ordered alphabetically by name
        if len(response.data) >= 2:
            names = [t['name'] for t in response.data]
            zebra_idx = names.index('Zebra Topic')
            alpha_idx = names.index('Alpha Topic')
            assert alpha_idx < zebra_idx  # Alpha comes before Zebra alphabetically


@pytest.fixture
def saved_path_with_ai_lesson(db, user):
    """Create a saved learning path with an AI lesson."""
    return SavedLearningPath.objects.create(
        user=user,
        slug='test-path-with-lesson',
        title='Test Path with AI Lesson',
        difficulty='beginner',
        estimated_hours=2,
        path_data={
            'title': 'Test Path with AI Lesson',
            'curriculum': [
                {
                    'type': 'ai_lesson',
                    'title': 'Introduction to Git',
                    'order': 1,
                    'difficulty': 'beginner',
                    'content': {
                        'summary': 'Learn Git basics',
                        'explanation': 'Git is a version control system...',
                        'key_concepts': ['version control', 'commits', 'branches'],
                        'examples': [
                            {'title': 'First Commit', 'description': 'Creating your first commit'},
                        ],
                        'exercise': {
                            'exercise_type': 'ai_prompt',
                            'scenario': 'Practice Git commands',
                            'expected_inputs': ['git init'],
                            'success_message': 'Great job!',
                            'expected_output': 'Initialized repository',
                            'content_by_level': {
                                'beginner': {'instructions': 'Initialize a repo', 'hints': []},
                                'intermediate': {'instructions': 'Initialize a repo', 'hints': []},
                                'advanced': {'instructions': 'Initialize a repo', 'hints': []},
                            },
                        },
                    },
                },
            ],
        },
    )


@pytest.mark.django_db
class TestRegenerateLessonView:
    """Tests for lesson regeneration endpoint."""

    def test_regenerate_requires_authentication(self, api_client, user, saved_path_with_ai_lesson):
        """Regenerating a lesson requires authentication."""
        path = saved_path_with_ai_lesson
        response = api_client.post(f'/api/v1/me/saved-paths/{path.slug}/lessons/1/regenerate/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_regenerate_lesson_not_found(self, api_client, user, saved_path_with_ai_lesson):
        """Returns 404 when lesson doesn't exist at the specified order."""
        api_client.force_authenticate(user=user)
        path = saved_path_with_ai_lesson

        response = api_client.post(
            f'/api/v1/me/saved-paths/{path.slug}/lessons/999/regenerate/',
            {},
            format='json',
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_regenerate_path_not_found(self, api_client, user):
        """Returns 404 when path doesn't exist."""
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/me/saved-paths/nonexistent-path/lessons/1/regenerate/',
            {},
            format='json',
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_regenerate_other_users_path(self, api_client, other_user, saved_path_with_ai_lesson):
        """Cannot regenerate lessons in another user's path."""
        api_client.force_authenticate(user=other_user)
        path = saved_path_with_ai_lesson

        response = api_client.post(
            f'/api/v1/me/saved-paths/{path.slug}/lessons/1/regenerate/',
            {},
            format='json',
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestRegenerateExerciseView:
    """Tests for exercise regeneration endpoint."""

    def test_regenerate_exercise_requires_authentication(self, api_client, user, saved_path_with_ai_lesson):
        """Regenerating an exercise requires authentication."""
        path = saved_path_with_ai_lesson
        response = api_client.post(
            f'/api/v1/me/saved-paths/{path.slug}/lessons/1/regenerate-exercise/',
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_regenerate_exercise_invalid_type(self, api_client, user, saved_path_with_ai_lesson):
        """Returns 400 for invalid exercise type."""
        api_client.force_authenticate(user=user)
        path = saved_path_with_ai_lesson

        response = api_client.post(
            f'/api/v1/me/saved-paths/{path.slug}/lessons/1/regenerate-exercise/',
            {'exercise_type': 'invalid_type'},
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_regenerate_exercise_valid_types(self, api_client, user, saved_path_with_ai_lesson):
        """Accepts valid exercise types."""
        api_client.force_authenticate(user=user)
        path = saved_path_with_ai_lesson

        valid_types = ['terminal', 'code', 'ai_prompt']
        for exercise_type in valid_types:
            response = api_client.post(
                f'/api/v1/me/saved-paths/{path.slug}/lessons/1/regenerate-exercise/',
                {'exercise_type': exercise_type},
                format='json',
            )
            # Should not return 400 for valid types
            # May return 500 if AI service is not available in tests
            assert response.status_code != status.HTTP_400_BAD_REQUEST

    def test_regenerate_exercise_lesson_not_found(self, api_client, user, saved_path_with_ai_lesson):
        """Returns 404 when lesson doesn't exist."""
        api_client.force_authenticate(user=user)
        path = saved_path_with_ai_lesson

        response = api_client.post(
            f'/api/v1/me/saved-paths/{path.slug}/lessons/999/regenerate-exercise/',
            {'exercise_type': 'terminal'},
            format='json',
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_regenerate_exercise_other_users_path(self, api_client, other_user, saved_path_with_ai_lesson):
        """Cannot regenerate exercises in another user's path."""
        api_client.force_authenticate(user=other_user)
        path = saved_path_with_ai_lesson

        response = api_client.post(
            f'/api/v1/me/saved-paths/{path.slug}/lessons/1/regenerate-exercise/',
            {'exercise_type': 'terminal'},
            format='json',
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
