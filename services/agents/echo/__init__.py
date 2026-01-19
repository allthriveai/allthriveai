"""
Echo Agent - Strategic content partner for creators.

Echo helps creators amplify their voice through strategic brainstorming,
hook generation, and content planning across Twitter, LinkedIn, and YouTube.
"""

from .prompts import ECHO_SYSTEM_PROMPT
from .state import EchoState

__all__ = [
    'EchoState',
    'ECHO_SYSTEM_PROMPT',
]
