"""
WebSocket URL routing for AllThrive AI

Maps WebSocket URLs to their respective consumers:
- Chat: Real-time AI conversation streaming
- Battles: Real-time prompt battle events and matchmaking
"""

from django.urls import path

from core.battles.routing import websocket_urlpatterns as battle_urlpatterns

from .consumers import ChatConsumer

websocket_urlpatterns = [
    path('ws/chat/<str:conversation_id>/', ChatConsumer.as_asgi()),
] + battle_urlpatterns
