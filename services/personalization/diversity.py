"""
Feed diversity utilities for limiting posts per user/agent.

Ensures explore feeds show varied content by limiting how many posts
from the same user appear on each page.
"""

from collections import defaultdict
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.db.models import QuerySet

    from core.projects.models import Project

# Maximum posts from a single user per page
DEFAULT_MAX_PER_USER = 3


def apply_user_diversity(
    projects: 'list[Project] | QuerySet[Project]',
    max_per_user: int = DEFAULT_MAX_PER_USER,
    page_size: int = 30,
) -> list:
    """
    Apply user diversity to a list of projects.

    Interleaves posts from different users while limiting how many posts
    from the same user appear in the results. This prevents feeds from
    being dominated by prolific posters or automated agents.

    Algorithm:
    1. Group projects by user
    2. Round-robin through users, taking one project at a time
    3. Stop taking from a user once they hit max_per_user
    4. Continue until page_size is reached

    Args:
        projects: QuerySet or list of Project objects (should be pre-ordered)
        max_per_user: Maximum posts per user in final result
        page_size: Target number of results

    Returns:
        List of Project objects with user diversity applied
    """
    # Convert QuerySet to list if needed
    project_list = list(projects) if hasattr(projects, '__iter__') else [projects]

    if not project_list:
        return []

    # Group projects by user_id, maintaining order within each group
    user_projects: dict[int, list] = defaultdict(list)
    for project in project_list:
        user_projects[project.user_id].append(project)

    # Round-robin through users to build diverse result
    result = []
    user_counts: dict[int, int] = defaultdict(int)

    # Keep track of which users still have projects to offer
    active_users = list(user_projects.keys())

    while len(result) < page_size and active_users:
        users_exhausted = []

        for user_id in active_users:
            if len(result) >= page_size:
                break

            # Skip if user has hit their limit
            if user_counts[user_id] >= max_per_user:
                users_exhausted.append(user_id)
                continue

            # Get next project from this user
            user_list = user_projects[user_id]
            if user_list:
                project = user_list.pop(0)
                result.append(project)
                user_counts[user_id] += 1

                # Mark user as exhausted if no more projects
                if not user_list:
                    users_exhausted.append(user_id)
            else:
                users_exhausted.append(user_id)

        # Remove exhausted users
        for user_id in users_exhausted:
            if user_id in active_users:
                active_users.remove(user_id)

    return result


def diversify_queryset(
    queryset: 'QuerySet[Project]',
    page: int = 1,
    page_size: int = 30,
    max_per_user: int = DEFAULT_MAX_PER_USER,
) -> tuple[list, int]:
    """
    Apply diversity to a queryset with pagination support.

    Fetches extra projects to account for user limiting, then applies
    diversity algorithm.

    Args:
        queryset: Pre-filtered and ordered QuerySet
        page: Page number (1-indexed)
        page_size: Results per page
        max_per_user: Maximum posts per user per page

    Returns:
        Tuple of (list of projects, total count estimate)
    """
    # Fetch more than needed to account for diversity filtering
    # We need enough projects to fill a page after limiting per-user
    # Fetch 3x page_size to have enough variety
    fetch_size = page_size * 3
    start_idx = (page - 1) * page_size

    # For pagination, we need to skip previously shown content
    # But with diversity, this is complex - we approximate by fetching more
    projects = list(queryset[start_idx : start_idx + fetch_size])

    # Apply diversity
    diverse_projects = apply_user_diversity(
        projects,
        max_per_user=max_per_user,
        page_size=page_size,
    )

    # Get total count (approximate - diversity makes exact count complex)
    total_count = queryset.count()

    return diverse_projects, total_count
