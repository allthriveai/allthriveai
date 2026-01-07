"""
Clip Agent - Generates social media clips from user prompts.

This agent creates SocialClipContent JSON for animated 9:16 vertical videos
suitable for LinkedIn, YouTube Shorts, and Instagram Reels.
"""

from .agent import ClipAgent, ClipAgentState

__all__ = ['ClipAgent', 'ClipAgentState']
