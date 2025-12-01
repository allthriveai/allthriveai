"""
Weaviate vector database integration for personalized content discovery.

This module provides:
- Client wrapper with retry logic and fallback
- Connection pool for high-concurrency environments
- Schema definitions for Project, UserProfile, and Tool collections
- Embedding generation utilities
- Sync tasks for keeping Weaviate in sync with Django models
"""

from .client import (
    WeaviateClient,
    WeaviateConnectionPool,
    get_connection_pool,
    get_weaviate_client,
)
from .embeddings import EmbeddingService, get_embedding_service
from .schema import WeaviateSchema

__all__ = [
    'WeaviateClient',
    'WeaviateConnectionPool',
    'WeaviateSchema',
    'get_weaviate_client',
    'get_connection_pool',
    'EmbeddingService',
    'get_embedding_service',
]
