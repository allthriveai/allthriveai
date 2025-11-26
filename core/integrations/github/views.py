"""API views for GitHub repository synchronization."""

import logging

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from services.github_rate_limiter import github_rate_limit
from services.github_sync_service import GitHubSyncService

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def github_sync_status(request):
    """Get GitHub sync status for the current user."""
    logger.info(f'GitHub sync status check for user {request.user.username} (id={request.user.id})')

    sync_service = GitHubSyncService(request.user)
    sync_status = sync_service.get_sync_status()

    logger.info(
        f'GitHub sync status retrieved for user {request.user.username}: '
        f'connected={sync_status.get("connected")}, synced_projects={sync_status.get("synced_projects", 0)}'
    )

    return Response({'success': True, 'data': sync_status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@github_rate_limit(action='repo_fetch')
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
    logger.info(
        f'GitHub sync triggered by user {request.user.username} (id={request.user.id}) '
        f'with options: auto_publish={request.data.get("auto_publish")}, '
        f'include_private={request.data.get("include_private")}, '
        f'min_stars={request.data.get("min_stars", 0)}'
    )

    sync_service = GitHubSyncService(request.user)

    if not sync_service.is_connected():
        logger.warning(f'GitHub sync failed for user {request.user.username}: not connected')
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
        logger.error(
            f'GitHub sync failed for user {request.user.username}: {result.get("error")}',
            extra={'user_id': request.user.id, 'error': result.get('error')},
        )
        return Response(
            {'success': False, 'error': result.get('error', 'Sync failed')},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    logger.info(
        f'GitHub sync completed for user {request.user.username}: '
        f'{result["created"]} created, {result["updated"]} updated, {result["skipped"]} skipped'
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
@github_rate_limit(action='repo_fetch')
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
@github_rate_limit(action='import')
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@github_rate_limit(action='repo_fetch')
def github_import_preview(request):
    """
    Get preview data for importing a GitHub repository.

    Fetches repo metadata, README, and generates tl;dr summary.

    Body parameters:
        - repo_full_name (str): Full repository name in format "owner/repo"

    Returns:
        Preview data including title, description, tldr, README, and metadata
    """
    repo_full_name = request.data.get('repo_full_name')

    logger.info(
        f'GitHub import preview requested by user {request.user.username} (id={request.user.id}) '
        f'for repository: {repo_full_name}'
    )

    if not repo_full_name:
        logger.warning(f'GitHub import preview failed for user {request.user.username}: missing repo_full_name')
        return Response({'success': False, 'error': 'repo_full_name is required'}, status=status.HTTP_400_BAD_REQUEST)

    sync_service = GitHubSyncService(request.user)

    if not sync_service.is_connected():
        logger.warning(f'GitHub import preview failed for user {request.user.username}: not connected')
        return Response(
            {'success': False, 'error': 'GitHub account not connected. Please connect your GitHub account first.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Get preview data
    preview = sync_service.get_import_preview(repo_full_name)

    if not preview:
        logger.error(
            f'Failed to fetch preview for repository {repo_full_name} for user {request.user.username}',
            extra={'user_id': request.user.id, 'repo': repo_full_name},
        )
        return Response(
            {'success': False, 'error': f'Failed to fetch preview for repository: {repo_full_name}'},
            status=status.HTTP_404_NOT_FOUND,
        )

    logger.info(
        f'GitHub import preview generated for user {request.user.username}: '
        f'repo={repo_full_name}, language={preview.get("language")}, stars={preview.get("stars")}'
    )

    return Response({'success': True, 'data': preview})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@github_rate_limit(action='import')
def github_import_confirm(request):
    """
    Confirm import and create project from GitHub repository.

    Body parameters:
        - repo_full_name (str): Full repository name in format "owner/repo"
        - preview_data (dict): Preview data from import_preview endpoint
        - title (str, optional): Override title from preview
        - tldr (str, optional): Override tl;dr from preview
        - auto_publish (bool, optional): Auto-publish the project (default: False)
        - add_to_showcase (bool, optional): Add to showcase (default: False)

    Returns:
        Created project data with redirect URL
    """
    repo_full_name = request.data.get('repo_full_name')
    preview_data = request.data.get('preview_data', {})

    logger.info(
        f'GitHub import confirm requested by user {request.user.username} (id={request.user.id}) '
        f'for repository: {repo_full_name}'
    )

    if not repo_full_name:
        logger.warning(f'GitHub import confirm failed for user {request.user.username}: missing repo_full_name')
        return Response({'success': False, 'error': 'repo_full_name is required'}, status=status.HTTP_400_BAD_REQUEST)

    sync_service = GitHubSyncService(request.user)

    if not sync_service.is_connected():
        logger.warning(f'GitHub import confirm failed for user {request.user.username}: not connected')
        return Response({'success': False, 'error': 'GitHub account not connected'}, status=status.HTTP_400_BAD_REQUEST)

    # Allow user to override title and tl;dr from preview
    title = request.data.get('title') or preview_data.get('title', 'Untitled')
    tldr = request.data.get('tldr') or preview_data.get('tldr', '')
    auto_publish = request.data.get('auto_publish', True)  # Default to published
    add_to_showcase = request.data.get('add_to_showcase', False)

    logger.info(
        f'Creating project from GitHub import for user {request.user.username}: '
        f'repo={repo_full_name}, title={title[:50]}, auto_publish={auto_publish}, add_to_showcase={add_to_showcase}'
    )

    # Build repo data structure for sync
    # Extract owner info from repo_full_name
    owner_name = repo_full_name.split('/')[0] if '/' in repo_full_name else ''

    repo_data = {
        'name': title,
        'full_name': repo_full_name,
        'description': tldr,  # Use tl;dr as description
        'html_url': preview_data.get('html_url', ''),
        'homepage': preview_data.get('homepage', ''),
        'language': preview_data.get('language', ''),
        'topics': preview_data.get('topics', []),
        'stargazers_count': preview_data.get('stars', 0),
        'forks_count': preview_data.get('forks', 0),
        'fork': preview_data.get('is_fork', False),
        'created_at': preview_data.get('created_at', ''),
        'updated_at': preview_data.get('updated_at', ''),
        'readme_content': preview_data.get('readme_content', ''),  # Pass README for image extraction
        'owner': {'login': owner_name},  # Basic owner info for avatar fallback
    }

    # Create project
    try:
        project, was_created = sync_service.sync_repository_to_project(
            repo_data, auto_publish=auto_publish, add_to_showcase=add_to_showcase
        )

        if not project:
            logger.error(
                f'Failed to create project from GitHub import for user {request.user.username}: '
                f'sync_repository_to_project returned None for {repo_full_name}',
                extra={'user_id': request.user.id, 'repo': repo_full_name},
            )
            return Response(
                {'success': False, 'error': 'Failed to create project'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Store README in project content if available
        if preview_data.get('readme_content'):
            content = project.content or {}
            content['readme_markdown'] = preview_data.get('readme_content', '')
            content['readme_html_url'] = preview_data.get('readme_html_url', '')
            project.content = content
            project.save(update_fields=['content'])
            logger.debug(f'Stored README content for project {project.slug}')

        # Award points for project creation (using unified points system)
        if was_created:
            try:
                request.user.add_points(
                    amount=10,  # PROJECT_CREATED points
                    activity_type='project_created',
                    description=f'Created project: {project.title}',
                )

                # Update lifetime counter
                request.user.lifetime_projects_created += 1
                request.user.save(update_fields=['lifetime_projects_created'])
                logger.info(f'Awarded 10 points to user {request.user.username} for project creation')
            except Exception as e:
                # Log but don't fail the import
                logger.error(
                    f'Failed to award points for project import: {e}',
                    exc_info=True,
                    extra={'user_id': request.user.id, 'project_id': project.id},
                )

        logger.info(
            f'Successfully {"created" if was_created else "updated"} project from GitHub import: '
            f'user={request.user.username}, repo={repo_full_name}, project_slug={project.slug}, '
            f'project_id={project.id}, auto_publish={auto_publish}'
        )

        return Response(
            {
                'success': True,
                'data': {
                    'project_id': str(project.id),
                    'project_slug': project.slug,
                    'username': request.user.username,
                    'redirect_url': f'/{request.user.username}/{project.slug}',
                    'was_created': was_created,
                    'message': f"Successfully imported '{title}' from GitHub",
                },
            },
            status=status.HTTP_201_CREATED if was_created else status.HTTP_200_OK,
        )

    except Exception as e:
        import traceback

        error_trace = traceback.format_exc()
        logger.error(
            f'Failed to import GitHub repository {repo_full_name} for user {request.user.username}: {e}\n{error_trace}',
            exc_info=True,
            extra={'user_id': request.user.id, 'repo': repo_full_name},
        )
        response_data = {
            'success': False,
            'error': f'Failed to import repository: {str(e)}',
            'traceback': error_trace if settings.DEBUG else '',
        }
        return Response(
            response_data,
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
