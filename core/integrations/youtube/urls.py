"""URL configuration for YouTube integration API."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core.integrations.youtube.views import ContentSourceViewSet, YouTubeViewSet

router = DefaultRouter()
router.register(r'youtube', YouTubeViewSet, basename='youtube')
router.register(r'content-sources', ContentSourceViewSet, basename='content-source')

app_name = 'youtube'

urlpatterns = [
    path('', include(router.urls)),
]
