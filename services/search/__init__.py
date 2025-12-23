"""
Unified search service for multi-content-type discovery.

Provides:
- IntentRouter: Detect query intent to route to appropriate content types
- UnifiedSearchService: Weaviate-first search across all content types

Usage:
    from services.search import UnifiedSearchService, IntentRouter

    # Detect intent
    intent, content_types = IntentRouter.detect_intent("quiz about RAG")

    # Search with user context
    service = UnifiedSearchService()
    results = await service.search(
        query="beginner content about RAG",
        user_id=123,
        limit=20,
    )
"""

from .intent_router import IntentRouter
from .unified_search import UnifiedSearchService

__all__ = ['IntentRouter', 'UnifiedSearchService']
