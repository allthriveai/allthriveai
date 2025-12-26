"""
Discovery agent for conversational project exploration.

Provides tools for:
- Searching projects by query, category, or tags
- Getting personalized recommendations
- Finding similar projects
- Getting trending projects
- Explaining project details

Note: All chat now routes through the unified Ava agent.
The tools are imported and used by Ava.
"""

from .tools import DISCOVERY_TOOLS

__all__ = ['DISCOVERY_TOOLS']
