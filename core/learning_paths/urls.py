"""URL configuration for Learning Paths."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'me/learning-paths', views.MyLearningPathsViewSet, basename='my-learning-paths')
router.register(r'concepts', views.ConceptViewSet, basename='concepts')
router.register(r'me/concept-mastery', views.UserConceptMasteryViewSet, basename='my-concept-mastery')

urlpatterns = [
    path('', include(router.urls)),
    path('users/<str:username>/learning-paths/', views.UserLearningPathsView.as_view(), name='user-learning-paths'),
    path(
        'users/<str:username>/learning-paths/<str:slug>/',
        views.UserLearningPathBySlugView.as_view(),
        name='user-learning-path-by-slug',
    ),
    path('learning-paths/topics/', views.AllTopicsView.as_view(), name='all-topics'),
    path('learning-paths/<str:slug>/', views.LearningPathBySlugView.as_view(), name='learning-path-by-slug'),
    # New learning endpoints
    path('me/learner-profile/', views.LearnerProfileView.as_view(), name='learner-profile'),
    path('me/learning-events/', views.LearningEventsView.as_view(), name='learning-events'),
    path('me/learning-stats/', views.LearningStatsView.as_view(), name='learning-stats'),
    # Structured learning path endpoints
    path('me/structured-path/', views.StructuredPathView.as_view(), name='structured-path'),
    path('me/learning-setup/', views.LearningSetupView.as_view(), name='learning-setup'),
    path('learning/projects/', views.ProjectLearningView.as_view(), name='learning-projects'),
    path(
        'learning/projects/<int:project_id>/used/',
        views.RecordProjectLearningView.as_view(),
        name='record-project-learning',
    ),
    # Toggle learning eligibility for project (owner/admin only)
    path(
        'projects/<int:project_id>/toggle-learning-eligible/',
        views.ToggleLearningEligibilityView.as_view(),
        name='toggle-learning-eligible',
    ),
    # Feedback endpoints - Human feedback loops
    path(
        'me/feedback/conversation/',
        views.ConversationFeedbackView.as_view(),
        name='conversation-feedback',
    ),
    path(
        'me/feedback/proactive-offers/',
        views.ProactiveOfferResponseView.as_view(),
        name='proactive-offer-response',
    ),
    path(
        'me/feedback/content-helpfulness/',
        views.ContentHelpfulnessView.as_view(),
        name='content-helpfulness',
    ),
    path(
        'me/feedback/goal-checkins/',
        views.GoalCheckInView.as_view(),
        name='goal-checkins',
    ),
    path(
        'me/feedback/summary/',
        views.FeedbackSummaryView.as_view(),
        name='feedback-summary',
    ),
    # Saved learning paths - Path library
    path(
        'me/saved-paths/',
        views.SavedLearningPathsView.as_view(),
        name='saved-paths',
    ),
    path(
        'me/saved-paths/<str:slug>/',
        views.SavedLearningPathDetailView.as_view(),
        name='saved-path-detail',
    ),
    path(
        'me/saved-paths/<str:slug>/activate/',
        views.ActivateSavedPathView.as_view(),
        name='activate-saved-path',
    ),
    # Lesson image endpoint - on-demand image generation
    path(
        'me/saved-paths/<str:slug>/lessons/<int:order>/image/',
        views.LessonImageView.as_view(),
        name='lesson-image',
    ),
]
