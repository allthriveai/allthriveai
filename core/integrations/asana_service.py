"""
Asana service for bidirectional task sync.

This service handles:
- OAuth token management (refresh when expired)
- Syncing tasks from Asana to local cache
- Creating/updating/completing tasks in Asana
- Linking tasks to AllThrive content ideas
"""

import logging
from datetime import date, timedelta
from typing import Any

import requests
from django.conf import settings
from django.utils import timezone

from core.users.models import User

from .asana_models import AsanaIntegration, TaskCache

logger = logging.getLogger(__name__)


# Asana API endpoints
ASANA_API_BASE = 'https://app.asana.com/api/1.0'
ASANA_TOKEN_URL = 'https://app.asana.com/-/oauth_token'
ASANA_AUTHORIZE_URL = 'https://app.asana.com/-/oauth_authorize'


class AsanaError(Exception):
    """Base Asana error."""

    user_message = "Something went wrong with Asana. Please try again."


class AsanaTokenExpiredError(AsanaError):
    """Token needs refresh or user needs to reconnect."""

    user_message = "Your Asana connection expired. Please reconnect in Settings."


class AsanaRateLimitError(AsanaError):
    """Too many requests - Asana rate limit hit."""

    user_message = "Asana is rate-limiting us. Tasks will sync in a few minutes."


class AsanaPermissionError(AsanaError):
    """User doesn't have access to the requested resource."""

    user_message = "Can't access that Asana project. Check your permissions."


class AsanaNotConnectedError(AsanaError):
    """User hasn't connected their Asana account."""

    user_message = "Connect your Asana account in Settings to manage tasks."


class AsanaService:
    """
    Bidirectional Asana sync service.

    This service is designed to run in sync mode (for Celery workers).
    For async consumers, wrap calls in sync_to_async.
    """

    def __init__(self, user: User):
        self.user = user

        # Get or raise if not connected
        try:
            self.integration = user.asana_integration
        except AsanaIntegration.DoesNotExist:
            raise AsanaNotConnectedError("Asana not connected for this user")

        # Ensure token is valid
        self._ensure_valid_token()

    def _ensure_valid_token(self):
        """Refresh token if expired."""
        if self.integration.is_token_expired():
            self._refresh_access_token()

    def _refresh_access_token(self):
        """Use refresh token to get new access token."""
        if not self.integration.refresh_token:
            raise AsanaTokenExpiredError("No refresh token available - reconnect required")

        try:
            response = requests.post(
                ASANA_TOKEN_URL,
                data={
                    'grant_type': 'refresh_token',
                    'client_id': settings.ASANA_CLIENT_ID,
                    'client_secret': settings.ASANA_CLIENT_SECRET,
                    'refresh_token': self.integration.refresh_token,
                },
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()

            # Update tokens
            self.integration.access_token = data['access_token']
            if 'refresh_token' in data:
                self.integration.refresh_token = data['refresh_token']

            # Set expiration (Asana tokens expire in ~1 hour)
            expires_in = data.get('expires_in', 3600)
            self.integration.token_expires_at = timezone.now() + timedelta(seconds=expires_in)
            self.integration.save()

            logger.info(f"Refreshed Asana token for user {self.user.id}")

        except requests.RequestException as e:
            logger.error(f"Failed to refresh Asana token for user {self.user.id}: {e}")
            raise AsanaTokenExpiredError("Failed to refresh token - reconnect required")

    def _make_request(self, method: str, endpoint: str, **kwargs) -> dict[str, Any]:
        """Make an authenticated request to the Asana API."""
        url = f"{ASANA_API_BASE}{endpoint}"
        headers = {
            'Authorization': f'Bearer {self.integration.access_token}',
            'Accept': 'application/json',
        }

        try:
            response = requests.request(
                method,
                url,
                headers=headers,
                timeout=30,
                **kwargs,
            )

            # Handle rate limiting
            if response.status_code == 429:
                retry_after = response.headers.get('Retry-After', 60)
                logger.warning(f"Asana rate limit hit for user {self.user.id}, retry after {retry_after}s")
                raise AsanaRateLimitError(f"Rate limited, retry after {retry_after}s")

            # Handle auth errors
            if response.status_code == 401:
                # Try to refresh token once
                self._refresh_access_token()
                # Retry the request
                headers['Authorization'] = f'Bearer {self.integration.access_token}'
                response = requests.request(method, url, headers=headers, timeout=30, **kwargs)

            # Handle forbidden
            if response.status_code == 403:
                raise AsanaPermissionError("Permission denied for this resource")

            response.raise_for_status()
            return response.json()

        except requests.RequestException as e:
            logger.error(f"Asana API error for user {self.user.id}: {e}")
            raise AsanaError(f"Asana API error: {e}")

    def get_workspaces(self) -> list[dict]:
        """Get user's Asana workspaces."""
        data = self._make_request('GET', '/workspaces')
        return data.get('data', [])

    def get_projects(self, workspace_gid: str) -> list[dict]:
        """Get projects in a workspace."""
        data = self._make_request(
            'GET',
            f'/workspaces/{workspace_gid}/projects',
            params={'opt_fields': 'name,archived'},
        )
        # Filter out archived projects
        return [p for p in data.get('data', []) if not p.get('archived')]

    def sync_tasks(self) -> list[TaskCache]:
        """
        Pull tasks from Asana and update local cache.

        Returns the list of updated TaskCache objects.
        """
        workspace_gid = self.integration.workspace_gid
        project_gid = self.integration.project_gid

        # Build query params
        params = {
            'assignee': 'me',
            'workspace': workspace_gid,
            'opt_fields': 'name,notes,completed,due_on,memberships.project.name',
        }

        # Filter to specific project if set
        if project_gid:
            params['project'] = project_gid

        try:
            data = self._make_request('GET', '/tasks', params=params)
            tasks = data.get('data', [])

            # Track which tasks we've seen (for soft delete)
            seen_gids = set()
            updated_tasks = []

            for task_data in tasks:
                gid = task_data['gid']
                seen_gids.add(gid)

                # Get project info from memberships
                project_info = {}
                memberships = task_data.get('memberships', [])
                if memberships:
                    project_info = {
                        'project_gid': memberships[0].get('project', {}).get('gid', ''),
                        'project_name': memberships[0].get('project', {}).get('name', ''),
                    }

                # Parse due date
                due_date = None
                if task_data.get('due_on'):
                    try:
                        due_date = date.fromisoformat(task_data['due_on'])
                    except ValueError:
                        pass

                # Upsert task
                task, created = TaskCache.objects.update_or_create(
                    user=self.user,
                    asana_gid=gid,
                    defaults={
                        'title': task_data.get('name', ''),
                        'notes': task_data.get('notes', ''),
                        'completed': task_data.get('completed', False),
                        'due_date': due_date,
                        'project_gid': project_info.get('project_gid', ''),
                        'project_name': project_info.get('project_name', ''),
                        'is_deleted': False,
                    },
                )
                updated_tasks.append(task)

            # Soft delete tasks that are no longer in Asana
            TaskCache.objects.filter(user=self.user, is_deleted=False).exclude(asana_gid__in=seen_gids).update(
                is_deleted=True
            )

            # Mark sync success
            self.integration.mark_sync_success()

            logger.info(f"Synced {len(updated_tasks)} tasks from Asana for user {self.user.id}")
            return updated_tasks

        except AsanaError:
            raise
        except Exception as e:
            error_msg = str(e)
            self.integration.mark_sync_error(error_msg)
            logger.error(f"Failed to sync Asana tasks for user {self.user.id}: {e}")
            raise AsanaError(f"Failed to sync tasks: {e}")

    def create_task(
        self,
        title: str,
        notes: str = '',
        due_date: date | None = None,
        project_gid: str | None = None,
    ) -> TaskCache:
        """
        Create a task in Asana and cache locally.

        Args:
            title: Task title
            notes: Task notes/description
            due_date: Optional due date
            project_gid: Optional project to add task to (defaults to integration's project)

        Returns:
            The created TaskCache object
        """
        # Use integration's project if not specified
        target_project = project_gid or self.integration.project_gid

        # Build task data
        task_data: dict[str, Any] = {
            'name': title,
            'notes': notes,
            'assignee': 'me',
            'workspace': self.integration.workspace_gid,
        }

        if due_date:
            task_data['due_on'] = due_date.isoformat()

        if target_project:
            task_data['projects'] = [target_project]

        try:
            data = self._make_request('POST', '/tasks', json={'data': task_data})
            created = data.get('data', {})

            # Cache locally
            task = TaskCache.objects.create(
                user=self.user,
                asana_gid=created['gid'],
                title=title,
                notes=notes,
                completed=False,
                due_date=due_date,
                project_gid=target_project or '',
                project_name=self.integration.project_name if target_project == self.integration.project_gid else '',
            )

            logger.info(f"Created Asana task '{title}' for user {self.user.id}")
            return task

        except AsanaError:
            raise
        except Exception as e:
            logger.error(f"Failed to create Asana task for user {self.user.id}: {e}")
            raise AsanaError(f"Failed to create task: {e}")

    def update_task(
        self,
        task: TaskCache,
        title: str | None = None,
        notes: str | None = None,
        due_date: date | None = None,
        completed: bool | None = None,
    ) -> TaskCache:
        """
        Update a task in Asana and local cache.

        Args:
            task: The TaskCache object to update
            title: New title (optional)
            notes: New notes (optional)
            due_date: New due date (optional, pass False to clear)
            completed: New completion status (optional)

        Returns:
            The updated TaskCache object
        """
        # Build update data
        update_data: dict[str, Any] = {}

        if title is not None:
            update_data['name'] = title
            task.title = title

        if notes is not None:
            update_data['notes'] = notes
            task.notes = notes

        if due_date is not None:
            update_data['due_on'] = due_date.isoformat() if due_date else None
            task.due_date = due_date if due_date else None

        if completed is not None:
            update_data['completed'] = completed
            task.completed = completed

        if not update_data:
            return task  # Nothing to update

        try:
            self._make_request('PUT', f'/tasks/{task.asana_gid}', json={'data': update_data})
            task.save()

            logger.info(f"Updated Asana task '{task.title}' for user {self.user.id}")
            return task

        except AsanaError:
            raise
        except Exception as e:
            logger.error(f"Failed to update Asana task for user {self.user.id}: {e}")
            raise AsanaError(f"Failed to update task: {e}")

    def complete_task(self, task: TaskCache) -> TaskCache:
        """Mark a task as complete in Asana and local cache."""
        return self.update_task(task, completed=True)

    def uncomplete_task(self, task: TaskCache) -> TaskCache:
        """Mark a task as incomplete in Asana and local cache."""
        return self.update_task(task, completed=False)

    def delete_task(self, task: TaskCache) -> None:
        """
        Delete a task from Asana and local cache.

        Note: This is a hard delete - the task is removed from Asana entirely.
        """
        try:
            self._make_request('DELETE', f'/tasks/{task.asana_gid}')
            task.delete()

            logger.info(f"Deleted Asana task '{task.title}' for user {self.user.id}")

        except AsanaError:
            raise
        except Exception as e:
            logger.error(f"Failed to delete Asana task for user {self.user.id}: {e}")
            raise AsanaError(f"Failed to delete task: {e}")


def get_authorization_url(state: str) -> str:
    """
    Generate the Asana OAuth authorization URL.

    Args:
        state: Random state string for CSRF protection

    Returns:
        The authorization URL to redirect the user to
    """
    params = {
        'client_id': settings.ASANA_CLIENT_ID,
        'redirect_uri': settings.ASANA_REDIRECT_URI,
        'response_type': 'code',
        'state': state,
        # Request access to user's workspaces and tasks
        'scope': 'default',
    }

    query = '&'.join(f'{k}={v}' for k, v in params.items())
    return f'{ASANA_AUTHORIZE_URL}?{query}'


def exchange_code_for_tokens(code: str) -> dict[str, Any]:
    """
    Exchange OAuth authorization code for access and refresh tokens.

    Args:
        code: The authorization code from the callback

    Returns:
        Dict with access_token, refresh_token, expires_in, etc.
    """
    try:
        response = requests.post(
            ASANA_TOKEN_URL,
            data={
                'grant_type': 'authorization_code',
                'client_id': settings.ASANA_CLIENT_ID,
                'client_secret': settings.ASANA_CLIENT_SECRET,
                'redirect_uri': settings.ASANA_REDIRECT_URI,
                'code': code,
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    except requests.RequestException as e:
        logger.error(f"Failed to exchange Asana code: {e}")
        raise AsanaError(f"Failed to connect to Asana: {e}")
