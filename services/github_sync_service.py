"""Service for syncing GitHub repositories to user projects."""

import base64
import logging

import requests
from allauth.socialaccount.models import SocialAccount, SocialToken
from django.utils import timezone
from django.utils.text import slugify

from core.projects.models import Project
from core.social.models import SocialConnection, SocialProvider
from services.ai_provider import AIProvider
from services.github_rate_limiter import github_api_call_with_retry

logger = logging.getLogger(__name__)


class GitHubSyncService:
    """Service to sync GitHub repositories to AllThrive projects."""

    def __init__(self, user):
        """Initialize with a user."""
        self.user = user
        self.access_token = self._get_access_token()
        self._github_connection = self._get_github_connection()
        self._social_account = self._get_social_account()

    def _get_social_account(self):
        """Get django-allauth SocialAccount if exists."""
        try:
            return SocialAccount.objects.get(user=self.user, provider='github')
        except SocialAccount.DoesNotExist:
            return None

    def _get_github_connection(self) -> SocialConnection | None:
        """Get SocialConnection if exists."""
        try:
            return SocialConnection.objects.get(user=self.user, provider=SocialProvider.GITHUB, is_active=True)
        except SocialConnection.DoesNotExist:
            return None

    @property
    def github_connection(self):
        """Get the GitHub connection object (prioritize SocialConnection, fall back to SocialAccount)."""
        if self._github_connection:
            return self._github_connection
        # Return a mock object with SocialAccount data for compatibility
        if self._social_account:

            class SocialAccountWrapper:
                def __init__(self, social_account, access_token):
                    self.provider_username = social_account.extra_data.get('login', social_account.uid)
                    self.updated_at = social_account.last_login or social_account.date_joined
                    self.access_token = access_token

                def is_token_expired(self):
                    return False  # allauth handles token refresh

            return SocialAccountWrapper(self._social_account, self.access_token)
        return None

    def _get_access_token(self) -> str | None:
        """Get GitHub access token from either allauth or SocialConnection."""
        # First try django-allauth (for users who signed up with GitHub)
        try:
            social_account = SocialAccount.objects.get(user=self.user, provider='github')
            social_token = SocialToken.objects.get(account=social_account)
            return social_token.token
        except (SocialAccount.DoesNotExist, SocialToken.DoesNotExist):
            pass

        # Fall back to SocialConnection (for users who connected GitHub separately)
        try:
            connection = SocialConnection.objects.get(user=self.user, provider=SocialProvider.GITHUB, is_active=True)
            return connection.access_token  # This uses the property that decrypts the token
        except SocialConnection.DoesNotExist:
            return None

    def is_connected(self) -> bool:
        """Check if user has GitHub connected."""
        return self.access_token is not None

    @github_api_call_with_retry()
    def fetch_repositories(self, per_page: int = 100, include_private: bool = False) -> list[dict]:
        """
        Fetch user's GitHub repositories.

        Args:
            per_page: Number of repos per page (max 100)
            include_private: Whether to include private repos

        Returns:
            List of repository dictionaries
        """
        if not self.access_token:
            logger.warning(f'No GitHub connection for user {self.user.id}')
            return []

        repos = []
        page = 1

        try:
            while True:
                # Fetch repos from GitHub API
                headers = {
                    'Authorization': f'Bearer {self.access_token}',
                    'Accept': 'application/vnd.github.v3+json',
                }

                params = {
                    'per_page': per_page,
                    'page': page,
                    'sort': 'updated',
                    'direction': 'desc',
                    'type': 'all' if include_private else 'public',
                }

                response = requests.get('https://api.github.com/user/repos', headers=headers, params=params, timeout=10)

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
                    logger.warning(f'Hit repo limit (500) for user {self.user.id}')
                    break

            logger.info(f'Fetched {len(repos)} repositories for user {self.user.id}')
            return repos

        except requests.RequestException as e:
            logger.error(f'Failed to fetch GitHub repos for user {self.user.id}: {e}')
            return []

    @github_api_call_with_retry()
    def fetch_repository_readme(self, owner: str, repo: str) -> dict | None:
        """
        Fetch README content from a GitHub repository.

        Args:
            owner: Repository owner username
            repo: Repository name

        Returns:
            Dictionary with 'content' (decoded markdown) and 'html_url' or None if README doesn't exist
        """
        if not self.github_connection:
            logger.warning(f'No GitHub connection for user {self.user.id}')
            return None

        access_token = self.github_connection.access_token

        # Check if token is expired
        if self.github_connection.is_token_expired():
            logger.warning(f'GitHub token expired for user {self.user.id}')
            return None

        try:
            # Fetch README from GitHub API
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/vnd.github.v3+json',
            }

            response = requests.get(f'https://api.github.com/repos/{owner}/{repo}/readme', headers=headers, timeout=10)

            # README might not exist (404 is okay)
            if response.status_code == 404:
                logger.info(f'No README found for {owner}/{repo}')
                return None

            response.raise_for_status()
            data = response.json()

            # Decode base64 content
            encoded_content = data.get('content', '')
            if encoded_content:
                decoded_content = base64.b64decode(encoded_content).decode('utf-8')
                return {'content': decoded_content, 'html_url': data.get('html_url', '')}

            return None

        except requests.RequestException as e:
            logger.error(f'Failed to fetch README for {owner}/{repo}: {e}')
            return None
        except Exception as e:
            logger.error(f'Error decoding README for {owner}/{repo}: {e}')
            return None

    def extract_first_image_from_readme(self, readme_content: str) -> str | None:
        """
        Extract the first valid image URL from README markdown.

        Args:
            readme_content: The README markdown content

        Returns:
            First image URL found, or None if no images exist
        """
        if not readme_content:
            return None

        import re

        # Regex patterns for markdown images
        # Pattern 1: ![alt](url)
        markdown_pattern = r'!\[([^\]]*)\]\(([^\)]+)\)'
        # Pattern 2: <img src="url" />
        html_pattern = r'<img[^>]+src=["\']([^"\']+)["\']'

        # Try markdown syntax first
        markdown_matches = re.findall(markdown_pattern, readme_content)
        if markdown_matches:
            for _alt, url in markdown_matches:
                # Skip badges and small icons (common patterns)
                url_lower = url.lower()
                # Skip shields.io, badges, and other non-content images
                if any(
                    skip in url_lower
                    for skip in [
                        'img.shields.io',
                        'badge',
                        'shield',
                        'icon',
                        'logo.svg',
                        'star',
                        'badge.fury.io',
                        'travis-ci.org',
                        'codecov.io',
                    ]
                ):
                    continue
                # Skip relative URLs without a clear image extension
                if not url.startswith(('http://', 'https://')):
                    continue
                # Prefer images with clear extensions
                if any(ext in url_lower for ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp']):
                    return url

        # Try HTML syntax
        html_matches = re.findall(html_pattern, readme_content)
        if html_matches:
            for url in html_matches:
                url_lower = url.lower()
                # Skip shields.io, badges, and other non-content images
                if any(
                    skip in url_lower
                    for skip in [
                        'img.shields.io',
                        'badge',
                        'shield',
                        'icon',
                        'logo.svg',
                        'star',
                        'badge.fury.io',
                        'travis-ci.org',
                        'codecov.io',
                    ]
                ):
                    continue
                if not url.startswith(('http://', 'https://')):
                    continue
                if any(ext in url_lower for ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp']):
                    return url

        # Return first markdown image even without extension if we found nothing else
        # (but still skip badges)
        if markdown_matches:
            for _alt, url in markdown_matches:
                url_lower = url.lower()
                if 'img.shields.io' in url_lower or 'badge' in url_lower:
                    continue
                if url.startswith(('http://', 'https://')):
                    return url

        # Return first HTML image even without extension (but still skip badges)
        if html_matches:
            for url in html_matches:
                url_lower = url.lower()
                if 'img.shields.io' in url_lower or 'badge' in url_lower:
                    continue
                if url.startswith(('http://', 'https://')):
                    return url

        return None

    def generate_tldr_from_readme(self, readme_content: str, repo_name: str = '') -> str:
        """
        Generate a concise tl;dr summary from README content using AI.

        Args:
            readme_content: The README markdown content
            repo_name: Optional repository name for context

        Returns:
            2-3 sentence summary, or first paragraph as fallback
        """
        if not readme_content:
            return ''

        # Truncate very long READMEs (use first 2000 chars for summary)
        content_preview = readme_content[:2000]

        try:
            ai = AIProvider()

            system_message = (
                'You are a technical writer creating concise project summaries. '
                'Generate a clear, engaging 2-3 sentence summary that explains what the project does '
                'and why someone would use it. Focus on the key value proposition.'
            )

            prompt = f'Summarize this GitHub repository README:\n\n{content_preview}'
            if repo_name:
                prompt = f'Repository: {repo_name}\n\n{prompt}'

            tldr = ai.complete(
                prompt=prompt,
                system_message=system_message,
                temperature=0.7,
                max_tokens=150,
            )

            return tldr.strip()

        except Exception as e:
            logger.error(f'Failed to generate tl;dr with AI: {e}')

            # Fallback: Extract first paragraph from README
            lines = readme_content.split('\n')
            paragraphs = []
            current_para = []

            for line in lines:
                line = line.strip()
                # Skip headers, images, badges
                if line.startswith('#') or line.startswith('!') or line.startswith('[!'):
                    continue
                if line:
                    current_para.append(line)
                elif current_para:
                    paragraphs.append(' '.join(current_para))
                    current_para = []
                    if len(paragraphs) >= 1:  # Just need first paragraph
                        break

            if paragraphs:
                return paragraphs[0][:500]  # Limit to 500 chars

            return f'{repo_name} - A GitHub repository' if repo_name else 'A GitHub repository'

    @github_api_call_with_retry()
    def get_import_preview(self, repo_full_name: str) -> dict | None:
        """
        Get preview data for importing a repository (repo metadata + README + tl;dr).

        Args:
            repo_full_name: Full repository name in format "owner/repo"

        Returns:
            Dictionary with all preview data or None if fetch fails
        """
        if not self.github_connection:
            logger.warning(f'No GitHub connection for user {self.user.id}')
            return None

        access_token = self.github_connection.access_token

        # Check if token is expired
        if self.github_connection.is_token_expired():
            logger.warning(f'GitHub token expired for user {self.user.id}')
            return None

        try:
            # Split owner and repo
            parts = repo_full_name.split('/')
            if len(parts) != 2:
                logger.error(f'Invalid repo format: {repo_full_name}. Expected owner/repo')
                return None

            owner, repo = parts[0], parts[1]

            # Fetch repository metadata
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/vnd.github.v3+json',
            }

            response = requests.get(f'https://api.github.com/repos/{owner}/{repo}', headers=headers, timeout=10)
            response.raise_for_status()
            repo_data = response.json()

            # Fetch README
            readme_data = self.fetch_repository_readme(owner, repo)
            readme_content = readme_data.get('content', '') if readme_data else ''

            # Generate tl;dr from README
            tldr = ''
            if readme_content:
                tldr = self.generate_tldr_from_readme(readme_content, repo_data.get('name', ''))

            # If no README or tl;dr generation failed, use repo description
            if not tldr:
                tldr = repo_data.get('description', '') or f"A GitHub repository: {repo_data.get('name', '')}"

            # Extract first image from README for preview
            readme_image_url = None
            if readme_content:
                readme_image_url = self.extract_first_image_from_readme(readme_content)

            # Build preview data
            preview = {
                'title': repo_data.get('name', 'Untitled'),
                'description': repo_data.get('description', ''),
                'tldr': tldr,
                'html_url': repo_data.get('html_url', ''),
                'homepage': repo_data.get('homepage', ''),
                'language': repo_data.get('language', ''),
                'topics': repo_data.get('topics', []),
                'stars': repo_data.get('stargazers_count', 0),
                'forks': repo_data.get('forks', 0),
                'is_fork': repo_data.get('fork', False),
                'created_at': repo_data.get('created_at', ''),
                'updated_at': repo_data.get('updated_at', ''),
                'readme_content': readme_content,
                'readme_html_url': readme_data.get('html_url', '') if readme_data else '',
                'readme_image_url': readme_image_url,  # First extracted image from README
            }

            logger.info(f'Generated import preview for {repo_full_name}')
            return preview

        except requests.RequestException as e:
            logger.error(f'Failed to fetch repo data for {repo_full_name}: {e}')
            return None
        except Exception as e:
            logger.error(f'Error generating import preview for {repo_full_name}: {e}')
            return None

    def sync_repository_to_project(
        self, repo: dict, auto_publish: bool = False, add_to_showcase: bool = False
    ) -> tuple[Project | None, bool]:
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
            logger.warning('Invalid repo data: missing name or URL')
            return None, False

        # Check if project already exists
        slug = slugify(repo_name)
        existing_project = Project.objects.filter(
            user=self.user, slug=slug, type=Project.ProjectType.GITHUB_REPO
        ).first()

        if existing_project:
            # Update existing project
            self._update_project_from_repo(existing_project, repo)
            return existing_project, False

        # Create new project
        project = self._create_project_from_repo(repo, auto_publish=auto_publish, add_to_showcase=add_to_showcase)

        return project, True

    def _create_project_from_repo(
        self, repo: dict, auto_publish: bool = False, add_to_showcase: bool = False
    ) -> Project:
        """Create a new project from GitHub repo data."""
        from core.taxonomy.models import Taxonomy

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
        owner = repo.get('owner', {})
        readme_content = repo.get('readme_content', '')

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

        # Banner image: Random gradient background
        # Featured image (hero): README → GitHub screenshot → Owner avatar
        import secrets

        from core.projects.constants import DEFAULT_BANNER_IMAGES

        # Assign random gradient banner
        banner_url = secrets.choice(DEFAULT_BANNER_IMAGES)
        featured_image_url = ''

        # Try to extract image from README first (best quality, project-specific)
        readme_image_url = None
        if readme_content:
            readme_image_url = self.extract_first_image_from_readme(readme_content)

        # Set featured image (hero display) with priority: README > GitHub screenshot > Owner avatar
        if readme_image_url:
            featured_image_url = readme_image_url
            logger.info(f'Using README image for hero display: {readme_image_url[:100]}')
        elif html_url:
            # GitHub's social preview image (auto-generated) as fallback
            featured_image_url = f"https://opengraph.githubassets.com/1/{html_url.replace('https://github.com/', '')}"
            logger.debug('Using GitHub OpenGraph image for hero display')
        elif owner and owner.get('avatar_url'):
            featured_image_url = owner.get('avatar_url')
            logger.debug('Using owner avatar for hero display')

        # Truncate description intelligently (avoid mid-word cuts)
        if description and len(description) > 500:
            # Find last space before 500 chars
            truncated = description[:500]
            last_space = truncated.rfind(' ')
            if last_space > 400:  # Only use space if it's reasonably close to limit
                description = truncated[:last_space].rstrip()
            else:
                description = truncated.rstrip()
        elif not description:
            description = f'GitHub repository: {name}'

        # Create project with auto-populated fields
        project = Project.objects.create(
            user=self.user,
            title=name,
            description=description,
            type=Project.ProjectType.GITHUB_REPO,
            external_url=html_url,  # Auto-populate GitHub URL
            banner_url=banner_url,  # Random gradient background
            featured_image_url=featured_image_url,  # Hero image (README/GitHub/Avatar)
            is_showcase=add_to_showcase,
            is_published=auto_publish,
            published_at=timezone.now() if auto_publish else None,
            content=content,
        )

        # Auto-select categories from GitHub repo topics
        # Add to both categories (if they exist in taxonomy) and user_tags
        user_tags = []
        if topics:
            # Find or create matching Taxonomy categories
            for topic_name in topics[:10]:  # Limit to 10 topics
                # Try to find existing category (case-insensitive)
                category_taxonomy = Taxonomy.objects.filter(
                    taxonomy_type='category', name__iexact=topic_name, is_active=True
                ).first()

                if category_taxonomy:
                    project.categories.add(category_taxonomy)
                    logger.debug(f'Added existing category "{topic_name}" to project {project.id}')
                else:
                    # Add to user_tags if not a predefined category
                    user_tags.append(topic_name)

            # Save user_tags
            if user_tags:
                project.user_tags = user_tags
                project.save(update_fields=['user_tags'])
                logger.info(f'Added {len(user_tags)} GitHub topics as user_tags to project {project.id}')

        logger.info(
            f'Created project {project.id} from GitHub repo: {name} '
            f'(external_url={html_url}, topics={len(topics)}, featured_image={bool(featured_image_url)})'
        )
        return project

    def _update_project_from_repo(self, project: Project, repo: dict) -> None:
        """Update existing project with latest repo data."""
        description = repo.get('description', '')
        homepage = repo.get('homepage', '')
        language = repo.get('language', '')
        topics = repo.get('topics', [])
        stars = repo.get('stargazers_count', 0)
        forks = repo.get('forks_count', 0)
        updated_at = repo.get('updated_at', '')

        # Update project description if changed (with intelligent truncation)
        if description and description != project.description:
            if len(description) > 500:
                # Find last space before 500 chars
                truncated = description[:500]
                last_space = truncated.rfind(' ')
                if last_space > 400:
                    description = truncated[:last_space].rstrip()
                else:
                    description = truncated.rstrip()
            project.description = description

        # Update content
        content = project.content or {}
        github_data = content.get('github', {})

        github_data.update(
            {
                'homepage': homepage,
                'language': language,
                'topics': topics,
                'stars': stars,
                'forks': forks,
                'updated_at': updated_at,
            }
        )

        content['github'] = github_data
        content['tags'] = topics[:10] if topics else [language] if language else []

        project.content = content
        project.save()

        logger.info(f'Updated project {project.id} from GitHub repo')

    def sync_all_repositories(
        self,
        auto_publish: bool = False,
        add_to_showcase: bool = False,
        include_private: bool = False,
        include_forks: bool = True,
        min_stars: int = 0,
    ) -> dict[str, int]:
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
                repo, auto_publish=auto_publish, add_to_showcase=add_to_showcase
            )

            if project:
                if was_created:
                    created_count += 1
                else:
                    updated_count += 1
            else:
                skipped_count += 1

        logger.info(
            f'GitHub sync complete for user {self.user.id}: '
            f'{created_count} created, {updated_count} updated, {skipped_count} skipped'
        )

        return {
            'success': True,
            'created': created_count,
            'updated': updated_count,
            'skipped': skipped_count,
            'total_repos': len(repos),
        }

    def get_sync_status(self) -> dict:
        """Get current sync status."""
        if not self.is_connected():
            return {
                'connected': False,
                'synced_projects': 0,
                'github_username': None,
            }

        synced_count = Project.objects.filter(user=self.user, type=Project.ProjectType.GITHUB_REPO).count()

        return {
            'connected': True,
            'synced_projects': synced_count,
            'github_username': self.github_connection.provider_username,
            'last_connected': self.github_connection.updated_at.isoformat(),
        }
