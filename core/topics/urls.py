"""URL configuration for topics admin API."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AdminTopicViewSet

router = DefaultRouter()
router.register(r'', AdminTopicViewSet, basename='admin-topic')

urlpatterns = [
    path('', include(router.urls)),
]
