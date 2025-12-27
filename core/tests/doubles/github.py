"""
Fake GitHub Service for Testing

Provides a test double that implements the same interface as GitHubService
without making real API calls.
"""

from typing import Protocol


class GitHubServiceProtocol(Protocol):
    """Protocol defining the GitHub service interface."""

    async def get_readme(self, owner: str, repo: str) -> str | None:
        """Fetch README.md contents."""
        ...

    async def get_repository_tree(self, owner: str, repo: str) -> list[dict]:
        """Fetch repository file tree."""
        ...

    async def get_file_contents(self, owner: str, repo: str, path: str) -> str | None:
        """Fetch file contents."""
        ...

    async def get_dependency_files(self, owner: str, repo: str) -> dict[str, str | None]:
        """Fetch common dependency files."""
        ...

    async def get_repository_info(self, owner: str, repo: str) -> dict:
        """Fetch complete repository information."""
        ...

    async def verify_repo_access(self, owner: str, repo: str) -> bool:
        """Verify the authenticated user owns or has contributed to a repository."""
        ...


class FakeGitHubService:
    """
    Fake GitHub service for testing.

    Allows setting up predetermined responses for each method.
    By default, returns reasonable empty/successful responses.

    Usage:
        fake = FakeGitHubService()

        # Set custom responses
        fake.set_readme('# My Project\nDescription here.')
        fake.set_tree([{'path': 'src/main.py', 'type': 'blob'}])
        fake.set_repo_access(True)

        # Use in tests
        readme = await fake.get_readme('owner', 'repo')
        assert readme == '# My Project\nDescription here.'

        # Simulate errors
        fake.set_error('get_readme', GitHubAPIError('Rate limited'))
    """

    def __init__(self, user_token: str = 'fake-token'):  # noqa: S107
        """Initialize with optional fake token."""
        self.token = user_token

        # Default responses
        self._readme: str | None = None
        self._tree: list[dict] = []
        self._files: dict[str, str | None] = {}
        self._dependency_files: dict[str, str | None] = {
            'package.json': None,
            'requirements.txt': None,
            'Pipfile': None,
            'go.mod': None,
            'Cargo.toml': None,
            'pom.xml': None,
            'Gemfile': None,
        }
        self._repo_access: bool = True
        self._tech_stack: list[str] = []

        # Error simulation
        self._errors: dict[str, Exception] = {}

        # Call tracking for verification
        self.calls: list[tuple[str, tuple]] = []

    # ===== Response Configuration =====

    def set_readme(self, content: str | None) -> 'FakeGitHubService':
        """Set the README content to return."""
        self._readme = content
        return self

    def set_tree(self, tree: list[dict]) -> 'FakeGitHubService':
        """Set the repository tree to return."""
        self._tree = tree
        return self

    def set_file_contents(self, path: str, content: str | None) -> 'FakeGitHubService':
        """Set contents for a specific file path."""
        self._files[path] = content
        return self

    def set_dependency_files(self, files: dict[str, str | None]) -> 'FakeGitHubService':
        """Set dependency files mapping."""
        self._dependency_files.update(files)
        return self

    def set_repo_access(self, has_access: bool) -> 'FakeGitHubService':
        """Set whether repo access verification passes."""
        self._repo_access = has_access
        return self

    def set_tech_stack(self, technologies: list[str]) -> 'FakeGitHubService':
        """Set the detected tech stack."""
        self._tech_stack = technologies
        return self

    def set_error(self, method: str, error: Exception) -> 'FakeGitHubService':
        """Set an error to raise for a specific method."""
        self._errors[method] = error
        return self

    def clear_error(self, method: str) -> 'FakeGitHubService':
        """Clear any error set for a method."""
        self._errors.pop(method, None)
        return self

    # ===== Preset Configurations =====

    def with_python_project(self) -> 'FakeGitHubService':
        """Configure as a typical Python project."""
        return (
            self.set_readme('# Python Project\nA sample Python application.')
            .set_tree(
                [
                    {'path': 'src/__init__.py', 'type': 'blob'},
                    {'path': 'src/main.py', 'type': 'blob'},
                    {'path': 'tests/test_main.py', 'type': 'blob'},
                    {'path': 'requirements.txt', 'type': 'blob'},
                    {'path': 'README.md', 'type': 'blob'},
                ]
            )
            .set_dependency_files(
                {
                    'requirements.txt': 'django>=4.0\ncelery>=5.0\nredis>=4.0\n',
                }
            )
            .set_tech_stack(['Python', 'Django', 'Celery', 'Redis'])
        )

    def with_react_project(self) -> 'FakeGitHubService':
        """Configure as a typical React/TypeScript project."""
        return (
            self.set_readme('# React App\nA modern React application.')
            .set_tree(
                [
                    {'path': 'src/App.tsx', 'type': 'blob'},
                    {'path': 'src/index.tsx', 'type': 'blob'},
                    {'path': 'src/components/Header.tsx', 'type': 'blob'},
                    {'path': 'package.json', 'type': 'blob'},
                    {'path': 'tsconfig.json', 'type': 'blob'},
                    {'path': 'README.md', 'type': 'blob'},
                ]
            )
            .set_dependency_files(
                {
                    'package.json': '{"dependencies": {"react": "^18.0.0", "typescript": "^5.0.0"}}',
                }
            )
            .set_tech_stack(['TypeScript', 'React', 'Vite'])
        )

    def with_no_access(self) -> 'FakeGitHubService':
        """Configure as repository user doesn't have access to."""
        return self.set_repo_access(False)

    # ===== Service Interface Implementation =====

    def _track_call(self, method: str, *args) -> None:
        """Track method calls for verification."""
        self.calls.append((method, args))

    def _check_error(self, method: str) -> None:
        """Raise any configured error for this method."""
        if method in self._errors:
            raise self._errors[method]

    async def get_readme(self, owner: str, repo: str) -> str | None:
        """Return configured README content."""
        self._track_call('get_readme', owner, repo)
        self._check_error('get_readme')
        return self._readme

    async def get_repository_tree(self, owner: str, repo: str) -> list[dict]:
        """Return configured repository tree."""
        self._track_call('get_repository_tree', owner, repo)
        self._check_error('get_repository_tree')
        return self._tree

    async def get_file_contents(self, owner: str, repo: str, path: str) -> str | None:
        """Return configured file contents."""
        self._track_call('get_file_contents', owner, repo, path)
        self._check_error('get_file_contents')
        return self._files.get(path)

    async def get_dependency_files(self, owner: str, repo: str) -> dict[str, str | None]:
        """Return configured dependency files."""
        self._track_call('get_dependency_files', owner, repo)
        self._check_error('get_dependency_files')
        return self._dependency_files.copy()

    async def get_repository_info(self, owner: str, repo: str) -> dict:
        """Return complete repository information."""
        self._track_call('get_repository_info', owner, repo)
        self._check_error('get_repository_info')
        return {
            'readme': self._readme or '',
            'tree': self._tree,
            'dependencies': self._dependency_files,
            'tech_stack': self._tech_stack,
        }

    def get_repository_info_sync(self, owner: str, repo: str) -> dict:
        """Synchronous wrapper for get_repository_info."""
        import asyncio

        return asyncio.run(self.get_repository_info(owner, repo))

    async def verify_repo_access(self, owner: str, repo: str) -> bool:
        """Return configured access status."""
        self._track_call('verify_repo_access', owner, repo)
        self._check_error('verify_repo_access')
        return self._repo_access

    def verify_repo_access_sync(self, owner: str, repo: str) -> bool:
        """Synchronous wrapper for verify_repo_access."""
        import asyncio

        return asyncio.run(self.verify_repo_access(owner, repo))

    # ===== Test Helpers =====

    def assert_called(self, method: str, times: int | None = None) -> None:
        """Assert a method was called, optionally a specific number of times."""
        matching_calls = [c for c in self.calls if c[0] == method]
        if times is not None:
            assert len(matching_calls) == times, (
                f'Expected {method} to be called {times} times, ' f'but was called {len(matching_calls)} times'
            )
        else:
            assert len(matching_calls) > 0, f'Expected {method} to be called at least once'

    def assert_not_called(self, method: str) -> None:
        """Assert a method was never called."""
        matching_calls = [c for c in self.calls if c[0] == method]
        assert (
            len(matching_calls) == 0
        ), f'Expected {method} to not be called, but was called {len(matching_calls)} times'

    def reset_calls(self) -> None:
        """Clear the call history."""
        self.calls.clear()
