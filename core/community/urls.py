"""
URL configuration for Community Messaging API

All endpoints are prefixed with /api/v1/community/
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BlockView,
    DirectMessageViewSet,
    DMSuggestionsView,
    MessageViewSet,
    ModerationQueueViewSet,
    RoomViewSet,
    ThreadViewSet,
)

router = DefaultRouter()
router.register(r'rooms', RoomViewSet, basename='room')
router.register(r'dm', DirectMessageViewSet, basename='dm')
router.register(r'moderation', ModerationQueueViewSet, basename='moderation')

urlpatterns = [
    # DM suggestions - must come before router to avoid /dm/<id> matching
    path('dm/suggestions/', DMSuggestionsView.as_view(), name='dm-suggestions'),
    path('', include(router.urls)),
    # Nested routes for messages within rooms
    path(
        'rooms/<uuid:room_id>/messages/',
        MessageViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='room-messages',
    ),
    path(
        'rooms/<uuid:room_id>/messages/<uuid:pk>/',
        MessageViewSet.as_view(
            {
                'get': 'retrieve',
                'patch': 'partial_update',
                'delete': 'destroy',
            }
        ),
        name='room-message-detail',
    ),
    path(
        'rooms/<uuid:room_id>/messages/<uuid:pk>/react/',
        MessageViewSet.as_view({'post': 'react', 'delete': 'react'}),
        name='room-message-react',
    ),
    path(
        'rooms/<uuid:room_id>/messages/<uuid:pk>/report/',
        MessageViewSet.as_view({'post': 'report'}),
        name='room-message-report',
    ),
    # Nested routes for threads within rooms
    path(
        'rooms/<uuid:room_id>/threads/',
        ThreadViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='room-threads',
    ),
    path(
        'rooms/<uuid:room_id>/threads/<uuid:pk>/',
        ThreadViewSet.as_view(
            {
                'get': 'retrieve',
                'patch': 'partial_update',
                'delete': 'destroy',
            }
        ),
        name='room-thread-detail',
    ),
    # Block management
    path('block/', BlockView.as_view(), name='block'),
]
