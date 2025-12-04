"""
Platform statistics views
"""

from django.contrib.auth import get_user_model
from django.db import models
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.projects.models import Project

User = get_user_model()


@api_view(['GET'])
@permission_classes([AllowAny])
def platform_stats(request):
    """
    Get platform-wide statistics
    Public endpoint for landing page
    """
    # Count active users (users who have logged in at least once)
    active_creators = User.objects.filter(last_login__isnull=False).count()

    # Count total published projects (not private and not archived)
    projects_shared = Project.objects.filter(is_private=False, is_archived=False).count()

    # Calculate total points from all users
    collective_points = User.objects.aggregate(total=models.Sum('total_points'))['total'] or 0

    return Response(
        {
            'active_creators': active_creators,
            'projects_shared': projects_shared,
            'collective_points': collective_points,
        }
    )
