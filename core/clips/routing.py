"""
WebSocket routing for the clips app.
"""

from django.urls import path

from .consumers import ClipAgentConsumer

websocket_urlpatterns = [
    path('ws/clip/<str:session_id>/', ClipAgentConsumer.as_asgi()),
]
