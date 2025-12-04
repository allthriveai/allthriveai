"""
WebSocket URL routing for Prompt Battles.

Maps WebSocket URLs to their respective consumers for:
- Real-time battle events
- Matchmaking queue management
"""

from django.urls import path

from .consumers import BattleConsumer, MatchmakingConsumer

websocket_urlpatterns = [
    path('ws/battle/<int:battle_id>/', BattleConsumer.as_asgi()),
    path('ws/matchmaking/', MatchmakingConsumer.as_asgi()),
]
