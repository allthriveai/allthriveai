"""Admin API views for invitation request management."""

import logging

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.permissions import IsAdminRole
from core.users.invitation_models import InvitationRequest
from core.users.invitation_views import send_approval_email

User = get_user_model()

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAdminRole])
def list_invitations(request):
    """List invitation requests with optional filtering.

    Query params:
        status: Filter by status (pending, approved, rejected)
        search: Search by name or email
        page: Page number (1-indexed)
        page_size: Items per page (default 20, max 100)

    Returns:
        200: List of invitations with pagination info
    """
    # Get query params
    status_filter = request.query_params.get('status', '').lower()
    search = request.query_params.get('search', '').strip()
    page = int(request.query_params.get('page', 1))
    page_size = min(int(request.query_params.get('page_size', 20)), 100)

    # Build queryset
    queryset = InvitationRequest.objects.select_related('reviewed_by').order_by('-created_at')

    # Apply filters
    if status_filter in ['pending', 'approved', 'rejected']:
        queryset = queryset.filter(status=status_filter)

    if search:
        from django.db.models import Q

        queryset = queryset.filter(Q(name__icontains=search) | Q(email__icontains=search))

    # Pagination
    total = queryset.count()
    offset = (page - 1) * page_size
    invitations = queryset[offset : offset + page_size]

    # Look up users by email for approved invitations to get login info
    invitation_emails = [inv.email for inv in invitations if inv.status == 'approved']
    users_by_email = {}
    if invitation_emails:
        users = User.objects.filter(email__in=invitation_emails).values('email', 'last_login', 'date_joined')
        users_by_email = {u['email']: u for u in users}

    # Serialize
    data = []
    for inv in invitations:
        inv_data = {
            'id': inv.id,
            'email': inv.email,
            'name': inv.name,
            'reason': inv.reason,
            'excitedFeatures': inv.get_excited_features_display(),
            'desiredIntegrations': inv.get_desired_integrations_display(),
            'status': inv.status,
            'createdAt': inv.created_at.isoformat(),
            'reviewedAt': inv.reviewed_at.isoformat() if inv.reviewed_at else None,
            'reviewedBy': inv.reviewed_by.username if inv.reviewed_by else None,
            'reviewNotes': inv.review_notes,
            'adminNotes': inv.admin_notes,
            'approvalEmailSentAt': inv.approval_email_sent_at.isoformat() if inv.approval_email_sent_at else None,
        }

        # Add user signup/login info for approved invitations
        if inv.status == 'approved' and inv.email in users_by_email:
            user_info = users_by_email[inv.email]
            inv_data['userSignedUp'] = True
            inv_data['userJoinedAt'] = user_info['date_joined'].isoformat() if user_info['date_joined'] else None
            inv_data['userLastLogin'] = user_info['last_login'].isoformat() if user_info['last_login'] else None
        elif inv.status == 'approved':
            inv_data['userSignedUp'] = False
            inv_data['userJoinedAt'] = None
            inv_data['userLastLogin'] = None

        data.append(inv_data)

    return Response(
        {
            'invitations': data,
            'pagination': {
                'page': page,
                'pageSize': page_size,
                'total': total,
                'totalPages': (total + page_size - 1) // page_size,
            },
        }
    )


@api_view(['GET'])
@permission_classes([IsAdminRole])
def invitation_stats(request):
    """Get invitation request statistics.

    Returns:
        200: Counts by status
    """
    stats = InvitationRequest.objects.values('status').annotate(count=Count('id'))

    # Convert to dict with defaults
    counts = {
        'pending': 0,
        'approved': 0,
        'rejected': 0,
        'total': 0,
    }

    for stat in stats:
        counts[stat['status']] = stat['count']
        counts['total'] += stat['count']

    return Response(counts)


@api_view(['POST'])
@permission_classes([IsAdminRole])
def approve_invitation(request, invitation_id):
    """Approve an invitation request and send approval email.

    Args:
        invitation_id: ID of the invitation to approve

    Body:
        notes: Optional review notes

    Returns:
        200: Success with invitation data
        404: Invitation not found
        400: Already processed
    """
    try:
        invitation = InvitationRequest.objects.get(id=invitation_id)
    except InvitationRequest.DoesNotExist:
        return Response(
            {'error': 'Invitation not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if invitation.status != InvitationRequest.Status.PENDING:
        return Response(
            {'error': f'Invitation already {invitation.status}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    notes = request.data.get('notes', '')

    # Approve the invitation
    invitation.status = InvitationRequest.Status.APPROVED
    invitation.reviewed_by = request.user
    invitation.review_notes = notes
    invitation.reviewed_at = timezone.now()
    invitation.save(update_fields=['status', 'reviewed_by', 'review_notes', 'reviewed_at', 'updated_at'])

    # Send approval email
    try:
        send_approval_email(invitation)
        email_sent = True
    except Exception as e:
        logger.error(f'Failed to send approval email for invitation {invitation_id}: {e}')
        email_sent = False

    logger.info(f'Invitation {invitation_id} approved by {request.user.username}')

    return Response(
        {
            'success': True,
            'emailSent': email_sent,
            'invitation': {
                'id': invitation.id,
                'email': invitation.email,
                'name': invitation.name,
                'status': invitation.status,
                'reviewedAt': invitation.reviewed_at.isoformat(),
                'reviewedBy': request.user.username,
            },
        }
    )


@api_view(['POST'])
@permission_classes([IsAdminRole])
def reject_invitation(request, invitation_id):
    """Reject an invitation request.

    Args:
        invitation_id: ID of the invitation to reject

    Body:
        notes: Optional review notes (recommended for rejections)

    Returns:
        200: Success with invitation data
        404: Invitation not found
        400: Already processed
    """
    try:
        invitation = InvitationRequest.objects.get(id=invitation_id)
    except InvitationRequest.DoesNotExist:
        return Response(
            {'error': 'Invitation not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if invitation.status != InvitationRequest.Status.PENDING:
        return Response(
            {'error': f'Invitation already {invitation.status}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    notes = request.data.get('notes', '')

    # Reject the invitation
    invitation.status = InvitationRequest.Status.REJECTED
    invitation.reviewed_by = request.user
    invitation.review_notes = notes
    invitation.reviewed_at = timezone.now()
    invitation.save(update_fields=['status', 'reviewed_by', 'review_notes', 'reviewed_at', 'updated_at'])

    logger.info(f'Invitation {invitation_id} rejected by {request.user.username}')

    return Response(
        {
            'success': True,
            'invitation': {
                'id': invitation.id,
                'email': invitation.email,
                'name': invitation.name,
                'status': invitation.status,
                'reviewedAt': invitation.reviewed_at.isoformat(),
                'reviewedBy': request.user.username,
            },
        }
    )


@api_view(['POST'])
@permission_classes([IsAdminRole])
def bulk_approve_invitations(request):
    """Bulk approve multiple invitation requests.

    Body:
        ids: List of invitation IDs to approve
        notes: Optional review notes (applied to all)

    Returns:
        200: Summary of results
    """
    ids = request.data.get('ids', [])
    notes = request.data.get('notes', '')

    if not ids:
        return Response(
            {'error': 'No invitation IDs provided'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    approved = 0
    failed = 0
    emails_sent = 0

    invitations = InvitationRequest.objects.filter(
        id__in=ids,
        status=InvitationRequest.Status.PENDING,
    )

    for invitation in invitations:
        try:
            invitation.status = InvitationRequest.Status.APPROVED
            invitation.reviewed_by = request.user
            invitation.review_notes = notes
            invitation.reviewed_at = timezone.now()
            invitation.save(update_fields=['status', 'reviewed_by', 'review_notes', 'reviewed_at', 'updated_at'])

            try:
                send_approval_email(invitation)
                emails_sent += 1
            except Exception as e:
                logger.error(f'Failed to send approval email for invitation {invitation.id}: {e}')

            approved += 1

        except Exception as e:
            logger.error(f'Failed to approve invitation {invitation.id}: {e}')
            failed += 1

    logger.info(f'Bulk approved {approved} invitations by {request.user.username}')

    return Response(
        {
            'approved': approved,
            'failed': failed,
            'emailsSent': emails_sent,
        }
    )


@api_view(['POST'])
@permission_classes([IsAdminRole])
def bulk_reject_invitations(request):
    """Bulk reject multiple invitation requests.

    Body:
        ids: List of invitation IDs to reject
        notes: Optional review notes (applied to all)

    Returns:
        200: Summary of results
    """
    ids = request.data.get('ids', [])
    notes = request.data.get('notes', '')

    if not ids:
        return Response(
            {'error': 'No invitation IDs provided'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    rejected = InvitationRequest.objects.filter(
        id__in=ids,
        status=InvitationRequest.Status.PENDING,
    ).update(
        status=InvitationRequest.Status.REJECTED,
        reviewed_by=request.user,
        review_notes=notes,
        reviewed_at=timezone.now(),
    )

    logger.info(f'Bulk rejected {rejected} invitations by {request.user.username}')

    return Response(
        {
            'rejected': rejected,
        }
    )


@api_view(['POST'])
@permission_classes([IsAdminRole])
def resend_approval_email(request, invitation_id):
    """Resend approval email for an approved invitation.

    Args:
        invitation_id: ID of the invitation

    Returns:
        200: Success
        404: Invitation not found
        400: Not approved or email already sent
    """
    try:
        invitation = InvitationRequest.objects.get(id=invitation_id)
    except InvitationRequest.DoesNotExist:
        return Response(
            {'error': 'Invitation not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if invitation.status != InvitationRequest.Status.APPROVED:
        return Response(
            {'error': 'Can only resend email for approved invitations'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if invitation.approval_email_sent_at:
        return Response(
            {'error': 'Email already sent', 'sentAt': invitation.approval_email_sent_at.isoformat()},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        send_approval_email(invitation)
        logger.info(f'Resent approval email for invitation {invitation_id} by {request.user.username}')
        return Response(
            {
                'success': True,
                'approvalEmailSentAt': invitation.approval_email_sent_at.isoformat(),
            }
        )
    except Exception as e:
        logger.error(f'Failed to resend approval email for invitation {invitation_id}: {e}')
        return Response(
            {'error': f'Failed to send email: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['PATCH'])
@permission_classes([IsAdminRole])
def update_invitation_notes(request, invitation_id):
    """Update admin notes for an invitation.

    Args:
        invitation_id: ID of the invitation

    Body:
        adminNotes: The new admin notes text

    Returns:
        200: Success with updated invitation data
        404: Invitation not found
    """
    try:
        invitation = InvitationRequest.objects.get(id=invitation_id)
    except InvitationRequest.DoesNotExist:
        return Response(
            {'error': 'Invitation not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    admin_notes = request.data.get('adminNotes', '')
    invitation.admin_notes = admin_notes
    invitation.save(update_fields=['admin_notes', 'updated_at'])

    logger.info(f'Updated admin notes for invitation {invitation_id} by {request.user.username}')

    return Response(
        {
            'success': True,
            'invitation': {
                'id': invitation.id,
                'adminNotes': invitation.admin_notes,
            },
        }
    )
