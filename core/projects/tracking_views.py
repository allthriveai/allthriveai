"""API endpoints for tracking project views and clicks."""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Project, ProjectClick, ProjectView


def get_session_key(request):
    """Get or create session key for anonymous tracking."""
    if not request.session.session_key:
        request.session.create()
    return request.session.session_key or ''


def should_record_view(project, user, session_key, dedup_minutes=5):
    """Check if we should record a new view (dedupe within window)."""
    cutoff = timezone.now() - timedelta(minutes=dedup_minutes)

    # Build filter for user or session
    if user and user.is_authenticated:
        user_filter = Q(user=user)
    else:
        user_filter = Q(session_key=session_key, user__isnull=True)

    # Check for recent view
    recent_view = ProjectView.objects.filter(
        user_filter,
        project=project,
        created_at__gte=cutoff,
    ).exists()

    return not recent_view


@api_view(['POST'])
@permission_classes([AllowAny])
def track_project_view(request, project_id):
    """Record a project view.

    POST /api/v1/projects/<project_id>/track-view/

    Body:
        source: str - Where the view originated (explore, profile, direct, search, embed)

    Returns:
        201: View recorded
        200: View deduplicated (already viewed recently)
        404: Project not found
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    # Don't track views of private projects from non-owners
    if project.is_private:
        if not request.user.is_authenticated or request.user != project.user:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user if request.user.is_authenticated else None
    session_key = get_session_key(request)
    source = request.data.get('source', 'direct')

    # Validate source
    valid_sources = [choice[0] for choice in ProjectView.ViewSource.choices]
    if source not in valid_sources:
        source = 'direct'

    # Check deduplication
    if not should_record_view(project, user, session_key):
        return Response({'status': 'deduplicated'}, status=status.HTTP_200_OK)

    # Record the view
    ProjectView.objects.create(
        project=project,
        user=user,
        session_key=session_key,
        source=source,
    )

    return Response({'status': 'recorded'}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def track_project_click(request):
    """Record a click on a project card from a feed.

    POST /api/v1/projects/track-click/

    Body:
        project_id: int - The project that was clicked
        source: str - The feed where the click occurred
        position: int (optional) - Position in the feed (0-indexed)

    Returns:
        201: Click recorded
        400: Missing required fields
        404: Project not found
    """
    project_id = request.data.get('project_id')
    source = request.data.get('source')
    position = request.data.get('position')

    if not project_id:
        return Response({'error': 'project_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    if not source:
        return Response({'error': 'source is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Validate source
    valid_sources = [choice[0] for choice in ProjectClick.ClickSource.choices]
    if source not in valid_sources:
        return Response(
            {'error': f'Invalid source. Must be one of: {", ".join(valid_sources)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    # Don't track clicks on private projects
    if project.is_private:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user if request.user.is_authenticated else None
    session_key = get_session_key(request)

    # Record the click (no deduplication - each click counts)
    ProjectClick.objects.create(
        project=project,
        user=user,
        session_key=session_key,
        source=source,
        position=position,
    )

    return Response({'status': 'recorded'}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def track_batch_clicks(request):
    """Record multiple clicks in a single request (for batch tracking).

    POST /api/v1/projects/track-clicks/

    Body:
        clicks: list - Array of click objects with project_id, source, position

    Returns:
        201: Clicks recorded with count
        400: Invalid request
    """
    clicks = request.data.get('clicks', [])

    if not clicks or not isinstance(clicks, list):
        return Response({'error': 'clicks array is required'}, status=status.HTTP_400_BAD_REQUEST)

    if len(clicks) > 50:
        return Response({'error': 'Maximum 50 clicks per batch'}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user if request.user.is_authenticated else None
    session_key = get_session_key(request)
    valid_sources = [choice[0] for choice in ProjectClick.ClickSource.choices]

    # Get all project IDs and validate they exist
    project_ids = [c.get('project_id') for c in clicks if c.get('project_id')]
    projects = {p.id: p for p in Project.objects.filter(id__in=project_ids, is_private=False)}

    # Create click objects
    click_objects = []
    for click_data in clicks:
        project_id = click_data.get('project_id')
        source = click_data.get('source')
        position = click_data.get('position')

        if not project_id or not source:
            continue

        if source not in valid_sources:
            continue

        project = projects.get(project_id)
        if not project:
            continue

        click_objects.append(
            ProjectClick(
                project=project,
                user=user,
                session_key=session_key,
                source=source,
                position=position,
            )
        )

    # Bulk create
    if click_objects:
        ProjectClick.objects.bulk_create(click_objects)

    return Response(
        {'status': 'recorded', 'count': len(click_objects)},
        status=status.HTTP_201_CREATED,
    )
