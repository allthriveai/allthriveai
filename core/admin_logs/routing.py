"""
WebSocket URL routing for admin log streaming.
"""

from django.urls import path

from .consumers import AdminLogConsumer

websocket_urlpatterns = [
    path('ws/admin/logs/', AdminLogConsumer.as_asgi()),
]
