"""
WebSocket URL routing for Prompt Battles.

Maps WebSocket URLs to their respective consumers for:
- Real-time battle events
- Matchmaking queue management
- Battle notifications (for receiving invitations)
"""

from django.urls import path

from .consumers import BattleConsumer, BattleNotificationConsumer, MatchmakingConsumer

websocket_urlpatterns = [
    path('ws/battle/<int:battle_id>/', BattleConsumer.as_asgi()),
    path('ws/matchmaking/', MatchmakingConsumer.as_asgi()),
    path('ws/battle-notifications/', BattleNotificationConsumer.as_asgi()),
]
