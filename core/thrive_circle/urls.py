"""URL configuration for Thrive Circle API."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ThriveCircleViewSet, XPActivityViewSet

router = DefaultRouter()
router.register(r'thrive-circle', ThriveCircleViewSet, basename='thrive-circle')
router.register(r'xp-activities', XPActivityViewSet, basename='xp-activities')

urlpatterns = [
    path('', include(router.urls)),
]
