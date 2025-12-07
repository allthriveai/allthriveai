"""
Discovery agent for conversational project exploration.

Provides tools for:
- Searching projects by query, category, or tags
- Getting personalized recommendations
- Finding similar projects
- Getting trending projects
- Explaining project details
"""

from .agent import stream_discovery_response
from .tools import DISCOVERY_TOOLS

__all__ = ['stream_discovery_response', 'DISCOVERY_TOOLS']
