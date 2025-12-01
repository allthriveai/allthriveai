"""
WebSocket URL routing for AllThrive AI chat

Maps WebSocket URLs to their respective consumers.
"""

from django.urls import path

from .consumers import ChatConsumer

websocket_urlpatterns = [
    path('ws/chat/<str:conversation_id>/', ChatConsumer.as_asgi()),
]
