"""
Sitemap configuration for AllThrive AI
Generates XML sitemaps for search engine crawling with production-grade optimizations.

Features:
- Pagination for large datasets (Google's 50,000 URL limit per sitemap)
- Query optimization with select_related() and only()
- Error handling for database failures
- Redis caching for performance
- Protocol-aware (http in dev, https in production)
"""

import logging

from django.conf import settings
from django.contrib.sitemaps import Sitemap
from django.core.cache import cache
from django.db import DatabaseError

logger = logging.getLogger(__name__)


class StaticViewSitemap(Sitemap):
    """Sitemap for static pages."""

    priority = 0.8
    changefreq = 'weekly'
    protocol = 'https' if not settings.DEBUG else 'http'
    limit = 100  # Static pages are small

    def items(self):
        """Return list of static page URL names."""
        return [
            'home',
            'about',
            'explore',
            'learn',
            'tools',
        ]

    def location(self, item):
        """Return the URL path for each item."""
        # These are frontend routes, not Django views
        url_map = {
            'home': '/',
            'about': '/about',
            'explore': '/explore',
            'learn': '/learn',
            'tools': '/tools',
        }
        return url_map.get(item, '/')


class ProjectSitemap(Sitemap):
    """Sitemap for public project pages with scalability optimizations."""

    priority = 0.7
    changefreq = 'daily'
    protocol = 'https' if not settings.DEBUG else 'http'
    limit = 5000  # Google recommends max 50,000 URLs per sitemap

    def items(self):
        """Return queryset of public projects with caching and error handling."""
        cache_key = 'sitemap_projects_v1'

        try:
            # Try to get from cache first
            cached_projects = cache.get(cache_key)
            if cached_projects is not None:
                return cached_projects

            from core.projects.models import Project

            # Only include truly public projects
            # Only include public showcased projects in sitemap
            projects = list(
                Project.objects.filter(
                    is_private=False,
                    is_archived=False,
                    is_showcased=True,
                )
                .select_related(
                    'user'  # Optimize N+1 queries
                )
                .only(
                    'id',
                    'slug',
                    'updated_at',
                    'user__username',  # Only fetch needed fields
                )
                .order_by('-updated_at')[: self.limit]
            )

            # Cache for 1 hour
            cache.set(cache_key, projects, 3600)
            return projects

        except DatabaseError as e:
            logger.error(f'Database error in ProjectSitemap: {e}', exc_info=True)
            return []  # Return empty list to prevent 500 error
        except Exception as e:
            logger.error(f'Unexpected error in ProjectSitemap: {e}', exc_info=True)
            return []

    def lastmod(self, obj):
        """Return last modification date."""
        return obj.updated_at

    def location(self, obj):
        """Return the URL path for each project."""
        # Use username/slug pattern for SEO-friendly URLs
        return f'/@{obj.user.username}/{obj.slug}'


class UserProfileSitemap(Sitemap):
    """Sitemap for public user profile pages with scalability optimizations."""

    priority = 0.6
    changefreq = 'weekly'
    protocol = 'https' if not settings.DEBUG else 'http'
    limit = 5000

    def items(self):
        """Return queryset of active users with caching and error handling."""
        cache_key = 'sitemap_profiles_v1'

        try:
            # Try cache first
            cached_profiles = cache.get(cache_key)
            if cached_profiles is not None:
                return cached_profiles

            from core.users.models import User

            # Only include active users who opted-in to public profiles
            # Respects user privacy - users can opt-out in settings
            # Exclude guest users from sitemap
            profiles = list(
                User.objects.filter(
                    is_active=True,
                    is_profile_public=True,  # Privacy: Only users who want to be discovered
                    is_guest=False,  # Exclude temporary guest accounts
                )
                .only(
                    'username',
                    'date_joined',
                    'is_profile_public',  # Minimal fields
                )
                .order_by('-date_joined')[: self.limit]
            )

            # Cache for 2 hours (profiles change less frequently)
            cache.set(cache_key, profiles, 7200)
            return profiles

        except DatabaseError as e:
            logger.error(f'Database error in UserProfileSitemap: {e}', exc_info=True)
            return []
        except Exception as e:
            logger.error(f'Unexpected error in UserProfileSitemap: {e}', exc_info=True)
            return []

    def lastmod(self, obj):
        """Return last modification date."""
        # User model doesn't have updated_at, use date_joined
        return obj.date_joined

    def location(self, obj):
        """Return the URL path for each user profile."""
        return f'/@{obj.username}'


class ToolSitemap(Sitemap):
    """Sitemap for AI tool directory pages with scalability optimizations."""

    priority = 0.7
    changefreq = 'monthly'
    protocol = 'https' if not settings.DEBUG else 'http'
    limit = 5000

    def items(self):
        """Return queryset of active tools with caching and error handling."""
        cache_key = 'sitemap_tools_v1'

        try:
            # Try cache first
            cached_tools = cache.get(cache_key)
            if cached_tools is not None:
                return cached_tools

            from core.tools.models import Tool

            tools = list(
                Tool.objects.filter(
                    is_active=True,
                )
                .only(
                    'slug',
                    'updated_at',
                    'created_at',  # Minimal fields
                )
                .order_by('-created_at')[: self.limit]
            )

            # Cache for 4 hours (tools change rarely)
            cache.set(cache_key, tools, 14400)
            return tools

        except DatabaseError as e:
            logger.error(f'Database error in ToolSitemap: {e}', exc_info=True)
            return []
        except Exception as e:
            logger.error(f'Unexpected error in ToolSitemap: {e}', exc_info=True)
            return []

    def lastmod(self, obj):
        """Return last modification date."""
        return obj.updated_at

    def location(self, obj):
        """Return the URL path for each tool."""
        return f'/tools/{obj.slug}'
