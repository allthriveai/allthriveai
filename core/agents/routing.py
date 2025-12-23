"""
WebSocket URL routing for AllThrive AI

Maps WebSocket URLs to their respective consumers:
- Chat: Real-time AI conversation streaming
- Battles: Real-time prompt battle events and matchmaking
"""

from django.urls import path

from core.battles.routing import websocket_urlpatterns as battle_urlpatterns
from core.community.routing import websocket_urlpatterns as community_urlpatterns
from core.monitoring.consumers import HealthCheckConsumer

from .consumers import ChatConsumer

websocket_urlpatterns = (
    [
        path('ws/health/', HealthCheckConsumer.as_asgi()),  # Health check endpoint (no auth required)
        path('ws/chat/<str:conversation_id>/', ChatConsumer.as_asgi()),
    ]
    + battle_urlpatterns
    + community_urlpatterns
)
