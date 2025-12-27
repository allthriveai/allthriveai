"""Views package for core app."""

from . import ai_analytics_views
from .core_views import ai_health, client_logs, csp_report, db_health

__all__ = ['ai_analytics_views', 'ai_health', 'client_logs', 'csp_report', 'db_health']
