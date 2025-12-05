"""URL routing for Weekly Challenges API."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core.challenges.views import ChallengeSubmissionViewSet, WeeklyChallengeViewSet

router = DefaultRouter()
router.register(r'challenges', WeeklyChallengeViewSet, basename='challenge')
router.register(r'submissions', ChallengeSubmissionViewSet, basename='submission')

urlpatterns = [
    path('', include(router.urls)),
]
