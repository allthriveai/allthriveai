"""URL configuration for Thrive Circle API.

Note: Most thrive_circle endpoints are registered directly in core/urls.py
via the me_router for /me/ scoped endpoints. Admin endpoints are also
registered directly in core/urls.py under /admin/circles/.

This file is kept for potential future use but is not currently included
in the main URL configuration.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CircleViewSet,
    PointActivityViewSet,
    QuestCategoryViewSet,
    SideQuestViewSet,
    ThriveCircleViewSet,
)

router = DefaultRouter()
router.register(r'thrive-circle', ThriveCircleViewSet, basename='thrive-circle')
router.register(r'point-activities', PointActivityViewSet, basename='point-activities')
router.register(r'side-quests', SideQuestViewSet, basename='side-quests')
router.register(r'quest-categories', QuestCategoryViewSet, basename='quest-categories')
router.register(r'circles', CircleViewSet, basename='circles')

urlpatterns = [
    path('', include(router.urls)),
]
