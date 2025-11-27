"""URL configuration for allthrive-ai-django project."""

from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.http import HttpResponse
from django.urls import include, path, re_path

from core.auth.views import username_profile_view
from core.sitemaps import ProjectSitemap, StaticViewSitemap, ToolSitemap, UserProfileSitemap
from core.views.core_views import ai_plugin_manifest, db_health, robots_txt

# Sitemap configuration
sitemaps = {
    'static': StaticViewSitemap,
    'projects': ProjectSitemap,
    'profiles': UserProfileSitemap,
    'tools': ToolSitemap,
}

urlpatterns = [
    path('admin/', admin.site.urls),
    path('db/health/', db_health, name='db-health-root'),
    # SEO and Privacy
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),
    path(
        'sitemap-<section>.xml',
        sitemap,
        {'sitemaps': sitemaps},
        name='django.contrib.sitemaps.views.sitemap_section',
    ),
    path('robots.txt', robots_txt, name='robots_txt'),
    path('.well-known/ai-plugin.json', ai_plugin_manifest, name='ai_plugin_manifest'),
    # Versioned API namespace
    path('api/v1/', include('core.urls')),
    path('accounts/', include('allauth.urls')),
    path('', lambda request: HttpResponse('AllThrive AI is running. Visit /admin/ or /api/v1/')),
    # Username profile route - must be last to avoid conflicts
    re_path(r'^(?P<username>[a-zA-Z0-9_-]+)$', username_profile_view, name='username_profile'),
]
