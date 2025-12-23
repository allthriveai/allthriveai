"""URL configuration for allthrive-ai-django project."""

from django.conf import settings
from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.sitemaps.views import sitemap
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from core.sitemaps import ProjectSitemap, StaticViewSitemap, ToolSitemap, UserProfileSitemap
from core.views.core_views import ai_plugin_manifest, db_health, robots_txt
from core.views.crawler_views import (
    about_view,
    battle_invite_view,
    battle_share_view,
    explore_view,
    homepage_view,
    profile_view,
    project_detail_view,
    tools_directory_view,
)

# Sitemap configuration
sitemaps = {
    'static': StaticViewSitemap,
    'projects': ProjectSitemap,
    'profiles': UserProfileSitemap,
    'tools': ToolSitemap,
}

urlpatterns = [
    path('thrive-manage/', admin.site.urls),  # Obscured admin URL to reduce automated attacks
    path('db/health/', db_health, name='db-health-root'),
    # Prometheus metrics endpoint
    path('metrics', include('django_prometheus.urls')),
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
    # Public pages with crawler support
    path('', homepage_view, name='homepage'),
    path('about', about_view, name='about'),
    path('explore', explore_view, name='explore'),
    path('tools', tools_directory_view, name='tools'),
    # Battle invite links with crawler support (for link previews in iMessage, WhatsApp, etc.)
    path('battle/invite/<str:token>', battle_invite_view, name='battle_invite'),
    # Battle share page with OG tags for social media (LinkedIn, Facebook, Twitter)
    path('battles/<int:battle_id>/share', battle_share_view, name='battle_share'),
    # User profiles and projects with crawler support
    re_path(r'^@(?P<username>[a-zA-Z0-9_-]+)/(?P<slug>[a-zA-Z0-9_-]+)$', project_detail_view, name='project_detail'),
    re_path(r'^@(?P<username>[a-zA-Z0-9_-]+)$', profile_view, name='profile'),
    # Fallback for old username format (without @)
    re_path(r'^(?P<username>[a-zA-Z0-9_-]+)$', profile_view, name='username_profile'),
]

# Serve media files in development with range request support
if settings.DEBUG:
    from core.views.media_views import serve_media_with_range

    urlpatterns.append(path('media/<path:path>', serve_media_with_range, name='media'))

# API Documentation - only available in DEBUG mode or to staff in production
# In production, staff must be logged into Django admin first to access
if settings.DEBUG:
    # Development: No authentication required
    urlpatterns += [
        path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
        path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
        path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    ]
else:
    # Production: Require staff authentication (login via /thrive-manage/ first)
    urlpatterns += [
        path('api/schema/', staff_member_required(SpectacularAPIView.as_view()), name='schema'),
        path('api/docs/', staff_member_required(SpectacularSwaggerView.as_view(url_name='schema')), name='swagger-ui'),
        path('api/redoc/', staff_member_required(SpectacularRedocView.as_view(url_name='schema')), name='redoc'),
    ]
