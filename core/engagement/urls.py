"""URL patterns for engagement tracking API."""

from django.urls import path

from core.engagement import views

urlpatterns = [
    # Batch endpoint for multiple events
    path('batch/', views.batch_engagement_events, name='batch_engagement_events'),
    # Individual tracking endpoints
    path('view-milestone/', views.track_view_milestone, name='track_view_milestone'),
    path('time-spent/', views.track_time_spent, name='track_time_spent'),
    path('scroll-depth/', views.track_scroll_depth, name='track_scroll_depth'),
]
