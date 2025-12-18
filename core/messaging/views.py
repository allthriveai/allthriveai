"""Views for messaging API."""

import logging

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.projects.models import Project

from .models import (
    ConnectionRequest,
    DirectMessage,
    DirectMessageThread,
    MessageReport,
    UserBlock,
)
from .serializers import (
    ConnectionRequestCreateSerializer,
    ConnectionRequestSerializer,
    DirectMessageCreateSerializer,
    DirectMessageSerializer,
    DirectMessageThreadSerializer,
    MessageReportCreateSerializer,
    MessageReportSerializer,
    UserBlockCreateSerializer,
    UserBlockSerializer,
)

logger = logging.getLogger(__name__)


class MessagingPagination(PageNumberPagination):
    """Pagination for messaging lists."""

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ConnectionRequestViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """ViewSet for connection requests (received by current user).

    Only supports list and retrieve - create is done via project endpoint,
    and update/delete are not allowed (only accept/decline actions).
    """

    serializer_class = ConnectionRequestSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = MessagingPagination

    def get_queryset(self):
        """Return connection requests received by current user."""
        return (
            ConnectionRequest.objects.filter(recipient=self.request.user)
            .select_related('requester', 'recipient', 'project', 'project__user')
            .order_by('-created_at')
        )

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept a connection request and create message thread."""
        connection_request = self.get_object()

        if connection_request.recipient != request.user:
            return Response(
                {'error': 'You can only accept requests sent to you.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if connection_request.status != ConnectionRequest.Status.PENDING:
            return Response(
                {'error': f'Request is already {connection_request.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if expired
        if connection_request.expires_at < timezone.now():
            connection_request.status = ConnectionRequest.Status.EXPIRED
            connection_request.save(update_fields=['status', 'updated_at'])
            return Response(
                {'error': 'This request has expired.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        thread = connection_request.accept()

        logger.info(
            'Connection request accepted',
            extra={
                'request_id': connection_request.id,
                'requester': connection_request.requester.username,
                'recipient': request.user.username,
                'thread_id': thread.id,
            },
        )

        return Response(
            {
                'status': 'accepted',
                'thread_id': thread.id,
                'message': 'Connection accepted! You can now message each other.',
            }
        )

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """Decline a connection request."""
        connection_request = self.get_object()

        if connection_request.recipient != request.user:
            return Response(
                {'error': 'You can only decline requests sent to you.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if connection_request.status != ConnectionRequest.Status.PENDING:
            return Response(
                {'error': f'Request is already {connection_request.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        connection_request.decline()

        logger.info(
            'Connection request declined',
            extra={
                'request_id': connection_request.id,
                'requester': connection_request.requester.username,
                'recipient': request.user.username,
            },
        )

        return Response(
            {
                'status': 'declined',
                'message': 'Connection request declined.',
            }
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_contact_request(request, project_id):
    """Create a contact request for a project.

    POST /api/v1/projects/{id}/contact-request/
    """
    project = get_object_or_404(Project, id=project_id)

    # Validation checks
    if project.user == request.user:
        return Response(
            {'error': 'You cannot send a contact request to yourself.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not project.contact_enabled:
        return Response(
            {'error': 'Contact requests are not enabled for this project.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not project.user.allow_contact_requests:
        return Response(
            {'error': 'This user is not accepting contact requests.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check if blocked
    if UserBlock.either_blocked(request.user, project.user):
        return Response(
            {'error': 'Unable to send contact request.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check for existing pending request
    existing = ConnectionRequest.objects.filter(
        requester=request.user,
        project=project,
        status=ConnectionRequest.Status.PENDING,
    ).exists()

    if existing:
        return Response(
            {'error': 'You already have a pending request for this project.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check for existing thread (already connected)
    existing_thread = (
        DirectMessageThread.objects.filter(participants=request.user).filter(participants=project.user).exists()
    )

    if existing_thread:
        return Response(
            {'error': 'You are already connected with this user.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = ConnectionRequestCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    connection_request = ConnectionRequest.objects.create(
        requester=request.user,
        recipient=project.user,
        project=project,
        intro_message=serializer.validated_data['intro_message'],
    )

    logger.info(
        'Contact request created',
        extra={
            'request_id': connection_request.id,
            'requester': request.user.username,
            'recipient': project.user.username,
            'project_id': project.id,
        },
    )

    return Response(
        ConnectionRequestSerializer(connection_request).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sent_connection_requests(request):
    """Get connection requests sent by current user.

    GET /api/v1/me/connection-requests/sent/
    """
    requests = (
        ConnectionRequest.objects.filter(requester=request.user)
        .select_related('requester', 'recipient', 'project', 'project__user')
        .order_by('-created_at')
    )

    serializer = ConnectionRequestSerializer(requests, many=True)
    return Response(serializer.data)


class DirectMessageThreadViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for message threads (inbox)."""

    serializer_class = DirectMessageThreadSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = MessagingPagination

    def get_queryset(self):
        """Return threads for current user."""
        return (
            DirectMessageThread.objects.for_user(self.request.user)
            .select_related('originating_project', 'last_message_sender')
            .prefetch_related('participants')
        )

    def get_serializer_context(self):
        """Add request to serializer context."""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Get messages in a thread.

        GET /api/v1/me/messages/threads/{id}/messages/
        """
        thread = self.get_object()

        # Verify user is participant
        if not thread.participants.filter(id=request.user.id).exists():
            return Response(
                {'error': 'You are not a participant in this thread.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        messages = (
            thread.messages.filter(
                moderation_status__in=[
                    DirectMessage.ModerationStatus.APPROVED,
                    DirectMessage.ModerationStatus.PENDING,
                ]
            )
            .select_related('sender')
            .order_by('created_at')
        )

        serializer = DirectMessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        """Send a message to a thread.

        POST /api/v1/me/messages/threads/{id}/messages/
        """
        thread = self.get_object()

        # Verify user is participant
        if not thread.participants.filter(id=request.user.id).exists():
            return Response(
                {'error': 'You are not a participant in this thread.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check if blocked
        other_participant = thread.get_other_participant(request.user)
        if other_participant and UserBlock.either_blocked(request.user, other_participant):
            return Response(
                {'error': 'Unable to send message.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = DirectMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message = DirectMessage.objects.create(
            thread=thread,
            sender=request.user,
            content=serializer.validated_data['content'],
        )

        logger.info(
            'Message sent',
            extra={
                'thread_id': thread.id,
                'sender': request.user.username,
                'message_id': message.id,
            },
        )

        return Response(
            DirectMessageSerializer(message, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark all messages in thread as read.

        POST /api/v1/me/messages/threads/{id}/mark-read/
        """
        thread = self.get_object()

        # Verify user is participant
        if not thread.participants.filter(id=request.user.id).exists():
            return Response(
                {'error': 'You are not a participant in this thread.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Mark unread messages from other users as read
        updated = (
            thread.messages.filter(read_at__isnull=True).exclude(sender=request.user).update(read_at=timezone.now())
        )

        return Response(
            {
                'status': 'ok',
                'messages_marked_read': updated,
            }
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_message(request, message_id):
    """Report a message for moderation.

    POST /api/v1/me/messages/{id}/report/
    """
    message = get_object_or_404(DirectMessage, id=message_id)

    # Verify user is participant in the thread
    if not message.thread.participants.filter(id=request.user.id).exists():
        return Response(
            {'error': 'You are not a participant in this thread.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Cannot report own messages
    if message.sender == request.user:
        return Response(
            {'error': 'You cannot report your own messages.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check for existing report
    if MessageReport.objects.filter(message=message, reporter=request.user).exists():
        return Response(
            {'error': 'You have already reported this message.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = MessageReportCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    report = MessageReport.objects.create(
        message=message,
        reporter=request.user,
        reason=serializer.validated_data['reason'],
        description=serializer.validated_data.get('description', ''),
    )

    logger.info(
        'Message reported',
        extra={
            'report_id': report.id,
            'message_id': message.id,
            'reporter': request.user.username,
            'reason': report.reason,
        },
    )

    return Response(
        MessageReportSerializer(report).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def block_user(request, user_id):
    """Block a user.

    POST /api/v1/users/{id}/block/
    """
    from core.users.models import User

    blocked_user = get_object_or_404(User, id=user_id)

    if blocked_user == request.user:
        return Response(
            {'error': 'You cannot block yourself.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check if already blocked
    if UserBlock.is_blocked(request.user, blocked_user):
        return Response(
            {'error': 'User is already blocked.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = UserBlockCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    block = UserBlock.objects.create(
        blocker=request.user,
        blocked=blocked_user,
        reason=serializer.validated_data.get('reason', ''),
    )

    logger.info(
        'User blocked',
        extra={
            'blocker': request.user.username,
            'blocked': blocked_user.username,
        },
    )

    return Response(
        UserBlockSerializer(block).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def unblock_user(request, user_id):
    """Unblock a user.

    DELETE /api/v1/users/{id}/block/
    """
    from core.users.models import User

    blocked_user = get_object_or_404(User, id=user_id)

    block = UserBlock.objects.filter(
        blocker=request.user,
        blocked=blocked_user,
    ).first()

    if not block:
        return Response(
            {'error': 'User is not blocked.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    block.delete()

    logger.info(
        'User unblocked',
        extra={
            'blocker': request.user.username,
            'unblocked': blocked_user.username,
        },
    )

    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_blocked_users(request):
    """List users blocked by current user.

    GET /api/v1/me/blocked-users/
    """
    blocks = UserBlock.objects.filter(blocker=request.user).select_related('blocked').order_by('-created_at')

    serializer = UserBlockSerializer(blocks, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count(request):
    """Get total unread message count for current user.

    GET /api/v1/me/messages/unread-count/
    """
    count = (
        DirectMessage.objects.filter(
            thread__participants=request.user,
            read_at__isnull=True,
        )
        .exclude(sender=request.user)
        .count()
    )

    return Response({'unread_count': count})
