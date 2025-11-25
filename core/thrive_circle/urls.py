"""URL configuration for Thrive Circle API."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PointActivityViewSet, SideQuestViewSet, ThriveCircleViewSet

router = DefaultRouter()
router.register(r'thrive-circle', ThriveCircleViewSet, basename='thrive-circle')
router.register(r'point-activities', PointActivityViewSet, basename='point-activities')
router.register(r'side-quests', SideQuestViewSet, basename='side-quests')

urlpatterns = [
    path('', include(router.urls)),
]
