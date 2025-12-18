"""URL configuration for messaging app."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ConnectionRequestViewSet,
    DirectMessageThreadViewSet,
    list_blocked_users,
    report_message,
    sent_connection_requests,
    unread_count,
)

# Router for viewsets
router = DefaultRouter()
router.register(
    r'connection-requests',
    ConnectionRequestViewSet,
    basename='connection-request',
)
router.register(
    r'threads',
    DirectMessageThreadViewSet,
    basename='message-thread',
)

urlpatterns = [
    # Connection request endpoints
    path('connection-requests/sent/', sent_connection_requests, name='sent_connection_requests'),
    # Message thread endpoints
    path(
        'threads/<int:pk>/messages/',
        DirectMessageThreadViewSet.as_view({'get': 'messages', 'post': 'send_message'}),
        name='thread_messages',
    ),
    path(
        'threads/<int:pk>/mark-read/',
        DirectMessageThreadViewSet.as_view({'post': 'mark_read'}),
        name='thread_mark_read',
    ),
    # Message report endpoint
    path('messages/<int:message_id>/report/', report_message, name='report_message'),
    # Unread count
    path('unread-count/', unread_count, name='unread_count'),
    # Blocked users
    path('blocked-users/', list_blocked_users, name='blocked_users'),
]

# Add router URLs
urlpatterns += router.urls
