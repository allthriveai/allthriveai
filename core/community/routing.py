"""
WebSocket URL routing for Community Messaging

Maps WebSocket URLs to their respective consumers:
- Room: Forum and circle chat messages
- DM: Direct messages
"""

from django.urls import path

from .consumers import CommunityRoomConsumer, DirectMessageConsumer

websocket_urlpatterns = [
    path('ws/community/room/<uuid:room_id>/', CommunityRoomConsumer.as_asgi()),
    path('ws/community/dm/<uuid:thread_id>/', DirectMessageConsumer.as_asgi()),
]
