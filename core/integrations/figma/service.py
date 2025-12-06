"""Figma API service for fetching design data."""

import logging

import requests

from .constants import FIGMA_API_BASE_URL, FIGMA_API_TIMEOUT

logger = logging.getLogger(__name__)


class FigmaService:
    """Service for interacting with the Figma REST API."""

    def __init__(self, access_token: str):
        """Initialize with user's Figma access token."""
        self.access_token = access_token
        self.headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json',
        }

    def _make_request(self, endpoint: str, params: dict = None) -> dict:
        """Make authenticated request to Figma API."""
        url = f'{FIGMA_API_BASE_URL}{endpoint}'
        try:
            response = requests.get(
                url,
                headers=self.headers,
                params=params,
                timeout=FIGMA_API_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f'Figma API HTTP error: {e} - {response.text if response else ""}')
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f'Figma API request error: {e}')
            raise

    def get_current_user(self) -> dict:
        """Get current authenticated user info."""
        return self._make_request('/me')

    def get_user_files(self, team_id: str | None = None) -> list:
        """
        Get files accessible to the user.

        Note: Figma API requires team_id to list files. If not provided,
        we'll need to get teams first then list files per team.
        """
        if team_id:
            data = self._make_request(f'/teams/{team_id}/projects')
            return data.get('projects', [])

        # If no team_id, get user's teams first
        teams = self.get_user_teams()
        all_files = []

        for team in teams:
            try:
                projects = self._make_request(f'/teams/{team["id"]}/projects')
                for project in projects.get('projects', []):
                    files = self.get_project_files(project['id'])
                    for file in files:
                        file['team_id'] = team['id']
                        file['team_name'] = team['name']
                        file['project_id'] = project['id']
                        file['project_name'] = project['name']
                        all_files.append(file)
            except Exception as e:
                logger.warning(f'Error fetching files for team {team.get("id")}: {e}')
                continue

        return all_files

    def get_user_teams(self) -> list:
        """Get teams the user belongs to."""
        # The /me endpoint includes team_id for personal projects
        user = self.get_current_user()
        teams = []

        # Get user's teams (if they have any)
        # Note: This may require enterprise scopes for full team access
        if 'teams' in user:
            teams = user['teams']

        return teams

    def get_project_files(self, project_id: str) -> list:
        """Get files in a project."""
        data = self._make_request(f'/projects/{project_id}/files')
        return data.get('files', [])

    def get_file(self, file_key: str, depth: int = 1) -> dict:
        """
        Get file metadata and document structure.

        Args:
            file_key: The file's unique key from URL
            depth: How deep to traverse the document tree (default 1)
        """
        params = {'depth': depth}
        return self._make_request(f'/files/{file_key}', params)

    def get_file_metadata(self, file_key: str) -> dict:
        """Get just the file metadata without document structure."""
        # Using depth=0 returns minimal data
        return self._make_request(f'/files/{file_key}', {'depth': 0})

    def get_file_nodes(self, file_key: str, node_ids: list) -> dict:
        """Get specific nodes from a file."""
        params = {'ids': ','.join(node_ids)}
        return self._make_request(f'/files/{file_key}/nodes', params)

    def get_file_images(
        self,
        file_key: str,
        node_ids: list = None,
        scale: float = 2,
        format: str = 'png',
    ) -> dict:
        """
        Export images from a file.

        Args:
            file_key: The file's unique key
            node_ids: List of node IDs to export (if None, exports all pages)
            scale: Image scale (1-4)
            format: Image format ('png', 'jpg', 'svg', 'pdf')
        """
        params = {
            'scale': scale,
            'format': format,
        }
        if node_ids:
            params['ids'] = ','.join(node_ids)

        return self._make_request(f'/images/{file_key}', params)

    def get_file_components(self, file_key: str) -> dict:
        """Get components in a file."""
        return self._make_request(f'/files/{file_key}/components')

    def get_file_styles(self, file_key: str) -> dict:
        """Get styles in a file."""
        return self._make_request(f'/files/{file_key}/styles')

    def get_file_versions(self, file_key: str) -> dict:
        """Get version history for a file."""
        return self._make_request(f'/files/{file_key}/versions')

    def get_file_comments(self, file_key: str) -> dict:
        """Get comments on a file."""
        return self._make_request(f'/files/{file_key}/comments')

    def get_team_components(self, team_id: str) -> dict:
        """Get published components for a team."""
        return self._make_request(f'/teams/{team_id}/components')

    def get_team_styles(self, team_id: str) -> dict:
        """Get published styles for a team."""
        return self._make_request(f'/teams/{team_id}/styles')

    def get_recent_files(self) -> list:
        """
        Get user's recently viewed files.

        Note: This endpoint may not be available in all API versions.
        Falls back to getting files from projects.
        """
        try:
            # Try to get recent files if endpoint exists
            data = self._make_request('/me/files')
            return data.get('files', [])
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                # Endpoint doesn't exist, fall back to project files
                logger.info('Recent files endpoint not available, using project files')
                return self.get_user_files()
            raise
