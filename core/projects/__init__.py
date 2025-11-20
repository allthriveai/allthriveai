"""Projects domain - User project management and showcase.

This domain handles all project-related functionality including creating,
editing, and displaying user projects in their profiles.
"""

from .models import CommentVote, Project, ProjectComment, ProjectQuerySet
from .serializers import ProjectSerializer
from .views import ProjectViewSet, public_user_projects

__all__ = [
    # Models
    'Project',
    'ProjectQuerySet',
    'ProjectComment',
    'CommentVote',
    # Views
    'ProjectViewSet',
    'public_user_projects',
    # Serializers
    'ProjectSerializer',
]
