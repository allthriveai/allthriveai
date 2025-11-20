"""API views for GitHub repository synchronization."""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from services.github_sync_service import GitHubSyncService


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def github_sync_status(request):
    """Get GitHub sync status for the current user."""
    sync_service = GitHubSyncService(request.user)
    sync_status = sync_service.get_sync_status()

    return Response({'success': True, 'data': sync_status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def github_sync_trigger(request):
    """
    Trigger GitHub repository sync.

    Body parameters:
        - auto_publish (bool): Auto-publish synced repos as projects
        - add_to_showcase (bool): Add synced projects to showcase
        - include_private (bool): Include private repositories
        - include_forks (bool): Include forked repositories
        - min_stars (int): Minimum star count to sync
    """
    sync_service = GitHubSyncService(request.user)

    if not sync_service.is_connected():
        return Response(
            {'success': False, 'error': 'GitHub account not connected. Please connect your GitHub account first.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Get sync options from request
    auto_publish = request.data.get('auto_publish', False)
    add_to_showcase = request.data.get('add_to_showcase', False)
    include_private = request.data.get('include_private', False)
    include_forks = request.data.get('include_forks', True)
    min_stars = request.data.get('min_stars', 0)

    # Perform sync
    result = sync_service.sync_all_repositories(
        auto_publish=auto_publish,
        add_to_showcase=add_to_showcase,
        include_private=include_private,
        include_forks=include_forks,
        min_stars=min_stars,
    )

    if not result.get('success'):
        return Response(
            {'success': False, 'error': result.get('error', 'Sync failed')},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {
            'success': True,
            'data': {
                'created': result['created'],
                'updated': result['updated'],
                'skipped': result['skipped'],
                'total_repos': result['total_repos'],
                'message': f'Synced {result["total_repos"]} repositories: '
                f'{result["created"]} created, {result["updated"]} updated, '
                f'{result["skipped"]} skipped',
            },
        }
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def github_repos_list(request):
    """List user's GitHub repositories (without syncing)."""
    sync_service = GitHubSyncService(request.user)

    if not sync_service.is_connected():
        return Response({'success': False, 'error': 'GitHub account not connected'}, status=status.HTTP_400_BAD_REQUEST)

    include_private = request.query_params.get('include_private', 'false').lower() == 'true'

    repos = sync_service.fetch_repositories(include_private=include_private)

    # Format repo data for frontend
    repo_list = []
    for repo in repos:
        repo_list.append(
            {
                'name': repo.get('name'),
                'full_name': repo.get('full_name'),
                'description': repo.get('description'),
                'html_url': repo.get('html_url'),
                'homepage': repo.get('homepage'),
                'language': repo.get('language'),
                'topics': repo.get('topics', []),
                'stars': repo.get('stargazers_count', 0),
                'forks': repo.get('forks_count', 0),
                'is_fork': repo.get('fork', False),
                'is_private': repo.get('private', False),
                'created_at': repo.get('created_at'),
                'updated_at': repo.get('updated_at'),
            }
        )

    return Response({'success': True, 'data': {'repositories': repo_list, 'count': len(repo_list)}})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def github_sync_single_repo(request):
    """
    Sync a single GitHub repository by name.

    Body parameters:
        - repo_name (str): Repository name
        - auto_publish (bool): Auto-publish as project
        - add_to_showcase (bool): Add to showcase
    """
    repo_name = request.data.get('repo_name')

    if not repo_name:
        return Response({'success': False, 'error': 'repo_name is required'}, status=status.HTTP_400_BAD_REQUEST)

    sync_service = GitHubSyncService(request.user)

    if not sync_service.is_connected():
        return Response({'success': False, 'error': 'GitHub account not connected'}, status=status.HTTP_400_BAD_REQUEST)

    # Fetch all repos and find the requested one
    repos = sync_service.fetch_repositories()
    repo = next((r for r in repos if r.get('name') == repo_name), None)

    if not repo:
        return Response(
            {'success': False, 'error': f'Repository "{repo_name}" not found'}, status=status.HTTP_404_NOT_FOUND
        )

    # Sync the repository
    auto_publish = request.data.get('auto_publish', False)
    add_to_showcase = request.data.get('add_to_showcase', False)

    project, was_created = sync_service.sync_repository_to_project(
        repo, auto_publish=auto_publish, add_to_showcase=add_to_showcase
    )

    if not project:
        return Response(
            {'success': False, 'error': 'Failed to sync repository'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return Response(
        {
            'success': True,
            'data': {
                'project_id': project.id,
                'project_slug': project.slug,
                'was_created': was_created,
                'message': f"Repository '{repo_name}' {'created' if was_created else 'updated'} as project",
            },
        }
    )
