"""Service for syncing GitHub repositories to user projects."""
import requests
import logging
from typing import List, Dict, Optional, Tuple
from django.utils import timezone
from django.utils.text import slugify
from core.models import Project
from core.social_models import SocialConnection, SocialProvider

logger = logging.getLogger(__name__)


class GitHubSyncService:
    """Service to sync GitHub repositories to AllThrive projects."""
    
    def __init__(self, user):
        """Initialize with a user."""
        self.user = user
        self.github_connection = self._get_github_connection()
    
    def _get_github_connection(self) -> Optional[SocialConnection]:
        """Get user's GitHub connection if exists."""
        try:
            return SocialConnection.objects.get(
                user=self.user,
                provider=SocialProvider.GITHUB,
                is_active=True
            )
        except SocialConnection.DoesNotExist:
            return None
    
    def is_connected(self) -> bool:
        """Check if user has GitHub connected."""
        return self.github_connection is not None
    
    def fetch_repositories(self, per_page: int = 100, include_private: bool = False) -> List[Dict]:
        """
        Fetch user's GitHub repositories.
        
        Args:
            per_page: Number of repos per page (max 100)
            include_private: Whether to include private repos
        
        Returns:
            List of repository dictionaries
        """
        if not self.github_connection:
            logger.warning(f"No GitHub connection for user {self.user.id}")
            return []
        
        access_token = self.github_connection.access_token
        
        # Check if token is expired
        if self.github_connection.is_token_expired():
            logger.warning(f"GitHub token expired for user {self.user.id}")
            return []
        
        repos = []
        page = 1
        
        try:
            while True:
                # Fetch repos from GitHub API
                headers = {
                    'Authorization': f'Bearer {access_token}',
                    'Accept': 'application/vnd.github.v3+json',
                }
                
                params = {
                    'per_page': per_page,
                    'page': page,
                    'sort': 'updated',
                    'direction': 'desc',
                    'type': 'all' if include_private else 'public',
                }
                
                response = requests.get(
                    'https://api.github.com/user/repos',
                    headers=headers,
                    params=params,
                    timeout=10
                )
                
                response.raise_for_status()
                page_repos = response.json()
                
                if not page_repos:
                    break
                
                repos.extend(page_repos)
                
                # GitHub API returns 100 max per page
                if len(page_repos) < per_page:
                    break
                
                page += 1
                
                # Safety limit - don't fetch more than 500 repos
                if len(repos) >= 500:
                    logger.warning(f"Hit repo limit (500) for user {self.user.id}")
                    break
            
            logger.info(f"Fetched {len(repos)} repositories for user {self.user.id}")
            return repos
            
        except requests.RequestException as e:
            logger.error(f"Failed to fetch GitHub repos for user {self.user.id}: {e}")
            return []
    
    def sync_repository_to_project(
        self,
        repo: Dict,
        auto_publish: bool = False,
        add_to_showcase: bool = False
    ) -> Tuple[Optional[Project], bool]:
        """
        Sync a single GitHub repository to a project.
        
        Args:
            repo: Repository data from GitHub API
            auto_publish: Whether to automatically publish the project
            add_to_showcase: Whether to add to user's showcase
        
        Returns:
            (project, was_created) tuple
        """
        repo_name = repo.get('name', '')
        repo_url = repo.get('html_url', '')
        
        if not repo_name or not repo_url:
            logger.warning(f"Invalid repo data: missing name or URL")
            return None, False
        
        # Check if project already exists
        slug = slugify(repo_name)
        existing_project = Project.objects.filter(
            user=self.user,
            slug=slug,
            type=Project.ProjectType.GITHUB_REPO
        ).first()
        
        if existing_project:
            # Update existing project
            self._update_project_from_repo(existing_project, repo)
            return existing_project, False
        
        # Create new project
        project = self._create_project_from_repo(
            repo,
            auto_publish=auto_publish,
            add_to_showcase=add_to_showcase
        )
        
        return project, True
    
    def _create_project_from_repo(
        self,
        repo: Dict,
        auto_publish: bool = False,
        add_to_showcase: bool = False
    ) -> Project:
        """Create a new project from GitHub repo data."""
        # Extract repo data
        name = repo.get('name', 'Untitled')
        description = repo.get('description', '')
        html_url = repo.get('html_url', '')
        homepage = repo.get('homepage', '')
        language = repo.get('language', '')
        topics = repo.get('topics', [])
        stars = repo.get('stargazers_count', 0)
        forks = repo.get('forks_count', 0)
        is_fork = repo.get('fork', False)
        created_at = repo.get('created_at', '')
        updated_at = repo.get('updated_at', '')
        
        # Build content structure
        content = {
            'github': {
                'url': html_url,
                'homepage': homepage,
                'language': language,
                'topics': topics,
                'stars': stars,
                'forks': forks,
                'is_fork': is_fork,
                'created_at': created_at,
                'updated_at': updated_at,
            },
            'blocks': [],
            'tags': topics[:10] if topics else [language] if language else [],
        }
        
        # Create project
        project = Project.objects.create(
            user=self.user,
            title=name,
            description=description[:500] if description else f"GitHub repository: {name}",
            type=Project.ProjectType.GITHUB_REPO,
            is_showcase=add_to_showcase,
            is_published=auto_publish,
            published_at=timezone.now() if auto_publish else None,
            content=content,
        )
        
        logger.info(f"Created project {project.id} from GitHub repo: {name}")
        return project
    
    def _update_project_from_repo(self, project: Project, repo: Dict) -> None:
        """Update existing project with latest repo data."""
        description = repo.get('description', '')
        homepage = repo.get('homepage', '')
        language = repo.get('language', '')
        topics = repo.get('topics', [])
        stars = repo.get('stargazers_count', 0)
        forks = repo.get('forks_count', 0)
        updated_at = repo.get('updated_at', '')
        
        # Update project description if changed
        if description and description != project.description:
            project.description = description[:500]
        
        # Update content
        content = project.content or {}
        github_data = content.get('github', {})
        
        github_data.update({
            'homepage': homepage,
            'language': language,
            'topics': topics,
            'stars': stars,
            'forks': forks,
            'updated_at': updated_at,
        })
        
        content['github'] = github_data
        content['tags'] = topics[:10] if topics else [language] if language else []
        
        project.content = content
        project.save()
        
        logger.info(f"Updated project {project.id} from GitHub repo")
    
    def sync_all_repositories(
        self,
        auto_publish: bool = False,
        add_to_showcase: bool = False,
        include_private: bool = False,
        include_forks: bool = True,
        min_stars: int = 0
    ) -> Dict[str, int]:
        """
        Sync all GitHub repositories to projects.
        
        Args:
            auto_publish: Whether to automatically publish new projects
            add_to_showcase: Whether to add new projects to showcase
            include_private: Whether to include private repos
            include_forks: Whether to include forked repos
            min_stars: Minimum star count to sync (0 = all)
        
        Returns:
            Dictionary with sync statistics
        """
        if not self.is_connected():
            return {
                'success': False,
                'error': 'GitHub not connected',
                'created': 0,
                'updated': 0,
                'skipped': 0,
            }
        
        repos = self.fetch_repositories(include_private=include_private)
        
        created_count = 0
        updated_count = 0
        skipped_count = 0
        
        for repo in repos:
            # Apply filters
            if not include_forks and repo.get('fork', False):
                skipped_count += 1
                continue
            
            if repo.get('stargazers_count', 0) < min_stars:
                skipped_count += 1
                continue
            
            # Sync repository
            project, was_created = self.sync_repository_to_project(
                repo,
                auto_publish=auto_publish,
                add_to_showcase=add_to_showcase
            )
            
            if project:
                if was_created:
                    created_count += 1
                else:
                    updated_count += 1
            else:
                skipped_count += 1
        
        logger.info(
            f"GitHub sync complete for user {self.user.id}: "
            f"{created_count} created, {updated_count} updated, {skipped_count} skipped"
        )
        
        return {
            'success': True,
            'created': created_count,
            'updated': updated_count,
            'skipped': skipped_count,
            'total_repos': len(repos),
        }
    
    def get_sync_status(self) -> Dict:
        """Get current sync status."""
        if not self.is_connected():
            return {
                'connected': False,
                'synced_projects': 0,
                'github_username': None,
            }
        
        synced_count = Project.objects.filter(
            user=self.user,
            type=Project.ProjectType.GITHUB_REPO
        ).count()
        
        return {
            'connected': True,
            'synced_projects': synced_count,
            'github_username': self.github_connection.provider_username,
            'last_connected': self.github_connection.updated_at.isoformat(),
        }
