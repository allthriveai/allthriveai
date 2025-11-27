"""
Tests for GitHub MCP Service

Tests the GitHubMCPService which uses FastMCP to interact with GitHub's MCP server.
"""

import json
from unittest.mock import AsyncMock, Mock, patch

from django.test import TestCase

from services.github_mcp_service import GitHubMCPService


class GitHubMCPServiceTestCase(TestCase):
    """Test cases for GitHubMCPService."""

    def setUp(self):
        """Set up test fixtures."""
        self.test_token = 'test_github_token_12345'
        self.test_owner = 'testowner'
        self.test_repo = 'testrepo'

    @patch('services.github_mcp_service.MCPClientFactory')
    def test_service_initialization(self, mock_factory_class):
        """Test service initializes with user token."""
        mock_factory = Mock()
        mock_client = Mock()
        mock_factory.create_github_client.return_value = mock_client
        mock_factory_class.return_value = mock_factory

        service = GitHubMCPService(self.test_token)

        # Verify client was created with user token
        mock_factory.create_github_client.assert_called_once_with(user_token=self.test_token)
        self.assertEqual(service.client, mock_client)

    @patch('services.github_mcp_service.MCPClientFactory')
    async def test_get_readme_success(self, mock_factory_class):
        """Test successful README fetch via MCP."""
        # Mock the factory and client
        mock_factory = Mock()
        mock_client = AsyncMock()
        mock_factory.create_github_client.return_value = mock_client
        mock_factory_class.return_value = mock_factory

        # Mock successful MCP response
        readme_content = '# Test Repository\n\nThis is a test README.'
        mock_client.call_tool.return_value = {'isError': False, 'content': [{'text': readme_content}]}
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        service = GitHubMCPService(self.test_token)
        result = await service.get_readme(self.test_owner, self.test_repo)

        # Verify result
        self.assertEqual(result, readme_content)

        # Verify MCP tool was called correctly
        mock_client.call_tool.assert_called_once_with(
            'get_file_contents', {'owner': self.test_owner, 'repo': self.test_repo, 'path': 'README.md'}
        )

    @patch('services.github_mcp_service.MCPClientFactory')
    async def test_get_readme_not_found(self, mock_factory_class):
        """Test README fetch returns None when file not found."""
        mock_factory = Mock()
        mock_client = AsyncMock()
        mock_factory.create_github_client.return_value = mock_client
        mock_factory_class.return_value = mock_factory

        # Mock error response (file not found)
        mock_client.call_tool.return_value = {'isError': True, 'error': 'File not found'}
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        service = GitHubMCPService(self.test_token)
        result = await service.get_readme(self.test_owner, self.test_repo)

        self.assertIsNone(result)

    @patch('services.github_mcp_service.MCPClientFactory')
    async def test_get_readme_exception_handling(self, mock_factory_class):
        """Test README fetch handles exceptions gracefully."""
        mock_factory = Mock()
        mock_client = AsyncMock()
        mock_factory.create_github_client.return_value = mock_client
        mock_factory_class.return_value = mock_factory

        # Mock exception during MCP call
        mock_client.call_tool.side_effect = Exception('Network error')
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        service = GitHubMCPService(self.test_token)
        result = await service.get_readme(self.test_owner, self.test_repo)

        self.assertIsNone(result)

    @patch('services.github_mcp_service.MCPClientFactory')
    async def test_get_repository_tree_success(self, mock_factory_class):
        """Test successful repository tree fetch via MCP."""
        mock_factory = Mock()
        mock_client = AsyncMock()
        mock_factory.create_github_client.return_value = mock_client
        mock_factory_class.return_value = mock_factory

        # Mock tree response
        tree_data = {
            'tree': [
                {'path': 'README.md', 'type': 'blob', 'size': 1024},
                {'path': 'src/main.py', 'type': 'blob', 'size': 2048},
                {'path': 'requirements.txt', 'type': 'blob', 'size': 512},
            ]
        }
        mock_client.call_tool.return_value = {'isError': False, 'content': [{'text': json.dumps(tree_data)}]}
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        service = GitHubMCPService(self.test_token)
        result = await service.get_repository_tree(self.test_owner, self.test_repo)

        # Verify result
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]['path'], 'README.md')
        self.assertEqual(result[1]['path'], 'src/main.py')

        # Verify MCP tool was called correctly
        mock_client.call_tool.assert_called_once_with(
            'get_tree', {'owner': self.test_owner, 'repo': self.test_repo, 'tree_sha': 'HEAD', 'recursive': True}
        )

    @patch('services.github_mcp_service.MCPClientFactory')
    async def test_get_repository_tree_empty(self, mock_factory_class):
        """Test repository tree returns empty list on error."""
        mock_factory = Mock()
        mock_client = AsyncMock()
        mock_factory.create_github_client.return_value = mock_client
        mock_factory_class.return_value = mock_factory

        # Mock error response
        mock_client.call_tool.return_value = {'isError': True, 'error': 'Repository not found'}
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        service = GitHubMCPService(self.test_token)
        result = await service.get_repository_tree(self.test_owner, self.test_repo)

        self.assertEqual(result, [])

    @patch('services.github_mcp_service.MCPClientFactory')
    async def test_get_dependency_files_success(self, mock_factory_class):
        """Test successful dependency files fetch via MCP."""
        mock_factory = Mock()
        mock_client = AsyncMock()
        mock_factory.create_github_client.return_value = mock_client
        mock_factory_class.return_value = mock_factory

        # Mock responses for different dependency files
        def mock_call_tool(tool_name, params):
            if params['path'] == 'requirements.txt':
                return {'isError': False, 'content': [{'text': 'django==4.2.0\ncelery==5.3.0'}]}
            elif params['path'] == 'package.json':
                return {'isError': False, 'content': [{'text': '{"dependencies": {"react": "^18.0.0"}}'}]}
            else:
                return {'isError': True, 'error': 'File not found'}

        mock_client.call_tool.side_effect = mock_call_tool
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        service = GitHubMCPService(self.test_token)
        result = await service.get_dependency_files(self.test_owner, self.test_repo)

        # Verify results
        self.assertIn('requirements.txt', result)
        self.assertIn('package.json', result)
        self.assertEqual(result['requirements.txt'], 'django==4.2.0\ncelery==5.3.0')
        self.assertEqual(result['package.json'], '{"dependencies": {"react": "^18.0.0"}}')
        # Files not found should be None
        self.assertIsNone(result['go.mod'])

    @patch('services.github_mcp_service.MCPClientFactory')
    async def test_get_dependency_files_all_missing(self, mock_factory_class):
        """Test dependency files when none exist."""
        mock_factory = Mock()
        mock_client = AsyncMock()
        mock_factory.create_github_client.return_value = mock_client
        mock_factory_class.return_value = mock_factory

        # All files return error
        mock_client.call_tool.return_value = {'isError': True}
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        service = GitHubMCPService(self.test_token)
        result = await service.get_dependency_files(self.test_owner, self.test_repo)

        # All files should be None
        for value in result.values():
            self.assertIsNone(value)

    @patch('services.github_mcp_service.detect_tech_stack_from_files')
    @patch('services.github_mcp_service.MCPClientFactory')
    async def test_get_repository_info_full_flow(self, mock_factory_class, mock_detect_tech):
        """Test full repository info fetch orchestration."""
        mock_factory = Mock()
        mock_client = AsyncMock()
        mock_factory.create_github_client.return_value = mock_client
        mock_factory_class.return_value = mock_factory

        # Mock README
        readme_content = '# Test Repo'

        # Mock tree
        tree_data = {'tree': [{'path': 'src/main.py', 'type': 'blob'}, {'path': 'requirements.txt', 'type': 'blob'}]}

        # Mock dependencies
        deps = {'requirements.txt': 'django==4.2.0'}

        # Configure mock responses based on tool name
        def mock_call_tool(tool_name, params):
            if tool_name == 'get_file_contents':
                if params['path'] == 'README.md':
                    return {'isError': False, 'content': [{'text': readme_content}]}
                elif params['path'] == 'requirements.txt':
                    return {'isError': False, 'content': [{'text': 'django==4.2.0'}]}
                else:
                    return {'isError': True}
            elif tool_name == 'get_tree':
                return {'isError': False, 'content': [{'text': json.dumps(tree_data)}]}
            return {'isError': True}

        mock_client.call_tool.side_effect = mock_call_tool
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        # Mock tech stack detection
        mock_detect_tech.return_value = {'languages': {'Python': 'primary'}, 'frameworks': ['Django'], 'tools': []}

        service = GitHubMCPService(self.test_token)
        result = await service.get_repository_info(self.test_owner, self.test_repo)

        # Verify result structure
        self.assertIn('readme', result)
        self.assertIn('tree', result)
        self.assertIn('dependencies', result)
        self.assertIn('tech_stack', result)

        # Verify content
        self.assertEqual(result['readme'], readme_content)
        self.assertEqual(len(result['tree']), 2)
        self.assertEqual(result['dependencies']['requirements.txt'], 'django==4.2.0')
        self.assertEqual(result['tech_stack']['languages']['Python'], 'primary')

        # Verify tech stack detection was called with correct args
        mock_detect_tech.assert_called_once()

    @patch('services.github_mcp_service.MCPClientFactory')
    def test_get_repository_info_sync(self, mock_factory_class):
        """Test synchronous wrapper for get_repository_info."""
        mock_factory = Mock()
        mock_client = AsyncMock()
        mock_factory.create_github_client.return_value = mock_client
        mock_factory_class.return_value = mock_factory

        # Setup minimal mocks for async operations
        mock_client.call_tool.return_value = {'isError': True}
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        service = GitHubMCPService(self.test_token)

        with patch('services.github_mcp_service.detect_tech_stack_from_files') as mock_detect:
            mock_detect.return_value = {'languages': {}, 'frameworks': [], 'tools': []}
            result = service.get_repository_info_sync(self.test_owner, self.test_repo)

        # Verify it returns a dict (async ran successfully)
        self.assertIsInstance(result, dict)
        self.assertIn('readme', result)
        self.assertIn('tree', result)

    @patch('services.github_mcp_service.MCPClientFactory')
    async def test_multiple_async_context_entries(self, mock_factory_class):
        """Test that service properly enters/exits async context for each call."""
        mock_factory = Mock()
        mock_client = AsyncMock()
        mock_factory.create_github_client.return_value = mock_client
        mock_factory_class.return_value = mock_factory

        enter_count = 0
        exit_count = 0

        async def track_enter(*args):
            nonlocal enter_count
            enter_count += 1
            return mock_client

        async def track_exit(*args):
            nonlocal exit_count
            exit_count += 1

        mock_client.__aenter__ = track_enter
        mock_client.__aexit__ = track_exit
        mock_client.call_tool.return_value = {'isError': True}

        service = GitHubMCPService(self.test_token)

        # Make multiple calls
        await service.get_readme(self.test_owner, self.test_repo)
        await service.get_repository_tree(self.test_owner, self.test_repo)

        # Verify context was entered/exited for each call
        self.assertEqual(enter_count, 2)
        self.assertEqual(exit_count, 2)
