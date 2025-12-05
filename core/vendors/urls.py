"""
Vendor Analytics URL Configuration
"""

from django.urls import path

from . import views

app_name = 'vendors'

urlpatterns = [
    # Vendor Dashboard (authenticated vendors only)
    path('vendor/tools/', views.vendor_tools_list, name='vendor-tools-list'),
    path('vendor/tools/<int:tool_id>/analytics/', views.vendor_tool_analytics, name='vendor-tool-analytics'),
    # Public Tracking (used by frontend)
    path('analytics/impressions/', views.track_impressions, name='track-impressions'),
    path('analytics/engagements/', views.track_engagement, name='track-engagement'),
]
