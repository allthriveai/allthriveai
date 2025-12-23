"""
AI-powered taxonomy tagging service.

Provides automated content tagging using tiered AI models:
- 'tagging': Cheap models for bulk content (gpt-3.5-turbo)
- 'tagging_premium': Better models for high-value content (gpt-4o-mini)

Usage:
    from services.tagging import AITaggingService

    service = AITaggingService()
    result = service.tag_content(project, tier='bulk')
"""

from .service import AITaggingService

__all__ = ['AITaggingService']
