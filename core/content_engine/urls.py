"""URL configuration for Content Engine API."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('ideas', views.ContentIdeaViewSet, basename='content-idea')
router.register('clips', views.ContentClipViewSet, basename='content-clip')
router.register('schedule', views.ScheduledPostViewSet, basename='scheduled-post')
router.register('brainstorm', views.BrainstormSessionViewSet, basename='brainstorm-session')
router.register('brand-voice', views.BrandVoiceViewSet, basename='brand-voice')

urlpatterns = [
    path('', include(router.urls)),
    path('calendar/', views.CalendarView.as_view(), name='content-calendar'),
    path('stats/', views.PipelineStatsView.as_view(), name='pipeline-stats'),
    path('strategy/', views.StrategyView.as_view(), name='content-strategy'),
]
