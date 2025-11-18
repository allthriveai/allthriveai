"""URL configuration for allthrive-ai-django project."""
from django.contrib import admin
from django.urls import path, include, re_path
from django.http import HttpResponse
from core.auth_views import username_profile_view
from core.views import db_health

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/db/health/', db_health, name='db-health-unversioned'),
    path('db/health/', db_health, name='db-health-root'),
    # Versioned API namespace
    path('api/v1/', include('core.urls')),
    path('accounts/', include('allauth.urls')),
    path('', lambda request: HttpResponse('AllThrive AI is running. Visit /admin/ or /api/v1/')),
    # Username profile route - must be last to avoid conflicts
    re_path(r'^(?P<username>[a-zA-Z0-9_-]+)$', username_profile_view, name='username_profile'),
]
