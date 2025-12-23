"""
Learning Tutor agent for AI-powered learning assistance.

Provides tools for:
- Checking learning progress and skill levels
- Getting hints for quiz questions
- Explaining concepts from lessons
- Suggesting next quizzes or learning activities

Note: All chat now routes through the unified Ember agent.
The tools are imported and used by Ember.
"""

from .tools import LEARNING_TOOLS

__all__ = ['LEARNING_TOOLS']
