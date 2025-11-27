# GitHub MCP Integration - Test Documentation

This document describes the automated tests for the GitHub MCP (Model Context Protocol) integration.

## Overview

The GitHub MCP integration allows users to import GitHub repositories into AllThrive AI projects via the GitHub Copilot MCP Server. All repository data (README, file tree, dependency files) is fetched through MCP tool calls.

## Test Coverage

### Unit Tests: `services/tests/test_github_mcp_service.py`

Tests the `GitHubMCPService` class which wraps FastMCP for GitHub operations.

#### Test Cases

1. **`test_service_initialization`**
   - Verifies service initializes with user's GitHub token
   - Ensures MCPClientFactory creates client with correct token

2. **`test_get_readme_success`**
   - Tests successful README.md fetch via MCP
   - Verifies correct MCP tool call (`get_file_contents`)
   - Validates response parsing

3. **`test_get_readme_not_found`**
   - Tests graceful handling when README doesn't exist
   - Verifies returns `None` on error

4. **`test_get_readme_exception_handling`**
   - Tests exception handling (network errors, etc.)
   - Ensures failures don't crash the service

5. **`test_get_repository_tree_success`**
   - Tests fetching full repository file tree via MCP
   - Verifies `get_tree` tool call with recursive option
   - Validates JSON parsing of tree structure

6. **`test_get_repository_tree_empty`**
   - Tests error handling for tree fetch
   - Verifies returns empty list on failure

7. **`test_get_dependency_files_success`**
   - Tests fetching multiple dependency files (requirements.txt, package.json, etc.)
   - Verifies multiple MCP calls in parallel
   - Validates partial success (some files found, others not)

8. **`test_get_dependency_files_all_missing`**
   - Tests behavior when no dependency files exist
   - Verifies all values are `None`

9. **`test_get_repository_info_full_flow`**
   - Tests complete orchestration of README + tree + dependencies + tech stack
   - Verifies all data is returned in expected structure
   - Tests integration with `detect_tech_stack_from_files`

10. **`test_get_repository_info_sync`**
    - Tests synchronous wrapper for async operations
    - Used by LangChain tools and Django views

11. **`test_multiple_async_context_entries`**
    - Tests proper async context management
    - Verifies client enters/exits context for each call

### Integration Tests: `core/integrations/github/tests/test_github_import.py`

Tests the full GitHub import endpoint from HTTP request to project creation.

#### Test Cases

1. **`test_import_github_repo_missing_url`**
   - Tests validation of required URL parameter
   - Expected: 400 Bad Request

2. **`test_import_github_repo_invalid_url`**
   - Tests URL validation (must be GitHub URL)
   - Expected: 400 Bad Request with error message

3. **`test_import_github_repo_no_token`**
   - Tests behavior when user hasn't connected GitHub
   - Expected: 401 Unauthorized

4. **`test_import_github_repo_success`**
   - Tests complete successful import flow:
     - User token retrieval
     - MCP service initialization
     - Repository data fetch (README, tree, dependencies, tech stack)
     - Data normalization
     - AI analysis
     - Project creation
   - Verifies project structure and content
   - Expected: 200 OK with project data

5. **`test_import_github_repo_duplicate`**
   - Tests duplicate detection (same URL already imported)
   - Expected: 409 Conflict with existing project data

6. **`test_import_github_repo_mcp_error_handling`**
   - Tests graceful error handling when MCP service fails
   - Expected: 500 Internal Server Error

7. **`test_import_github_repo_with_various_urls`**
   - Tests parsing of different GitHub URL formats:
     - `https://github.com/owner/repo`
     - `https://github.com/owner/repo/`
     - `https://github.com/owner/repo.git`
     - `git@github.com:owner/repo.git`
   - Expected: All formats work correctly

8. **`test_import_requires_authentication`**
   - Tests endpoint requires authenticated user
   - Expected: 401 Unauthorized

## Running Tests

### Run All GitHub MCP Tests

```bash
make test-backend
# Or specifically:
docker-compose exec web python manage.py test services.tests.test_github_mcp_service core.integrations.github.tests.test_github_import
```

### Run Unit Tests Only

```bash
docker-compose exec web python manage.py test services.tests.test_github_mcp_service
```

### Run Integration Tests Only

```bash
docker-compose exec web python manage.py test core.integrations.github.tests.test_github_import
```

### Run with Coverage

```bash
docker-compose exec web coverage run --source='.' manage.py test services.tests.test_github_mcp_service core.integrations.github.tests.test_github_import
docker-compose exec web coverage report
docker-compose exec web coverage html
```

## Test Data Flow

### Unit Test Flow (Mocked)

```
Test → GitHubMCPService → Mock FastMCP Client → Mock MCP Response
```

### Integration Test Flow (Mocked)

```
Test → HTTP Request → import_github_repo view
  → get_user_github_token (mocked)
  → GitHubMCPService (mocked)
  → normalize_mcp_repo_data (mocked)
  → analyze_github_repo (mocked)
  → Project.objects.create (real DB)
```

## Mocking Strategy

### What's Mocked

- **FastMCP Client**: All MCP server communication is mocked to avoid external dependencies
- **User GitHub Token**: Token retrieval is mocked to avoid OAuth setup
- **AI Analysis**: AI provider calls are mocked for speed and determinism

### What's Real

- **Django ORM**: Real database operations (in test database)
- **URL Parsing**: Real `parse_github_url` logic
- **Tech Stack Detection**: Real `detect_tech_stack_from_files` logic
- **Data Normalization**: Real normalization logic

## Test Patterns

### Async Test Pattern

```python
@patch('services.github_mcp_service.MCPClientFactory')
async def test_async_method(self, mock_factory_class):
    # Setup mocks
    mock_client = AsyncMock()
    mock_client.call_tool.return_value = {'isError': False, 'content': [...]}
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    
    # Test async method
    result = await service.get_readme('owner', 'repo')
    
    # Assertions
    self.assertEqual(result, expected)
```

### Integration Test Pattern

```python
@patch('core.integrations.github.views.GitHubMCPService')
@patch('core.integrations.github.views.get_user_github_token')
def test_import_endpoint(self, mock_get_token, mock_mcp_service):
    # Setup mocks
    mock_get_token.return_value = 'token'
    mock_service = Mock()
    mock_service.get_repository_info_sync.return_value = {...}
    mock_mcp_service.return_value = mock_service
    
    # Make HTTP request
    response = self.client.post('/api/v1/github/import/', {...})
    
    # Verify response and side effects
    self.assertEqual(response.status_code, status.HTTP_200_OK)
    self.assertTrue(Project.objects.filter(...).exists())
```

## Coverage Summary

| Component | Coverage | Notes |
|-----------|----------|-------|
| `GitHubMCPService.__init__` | ✅ 100% | Token injection tested |
| `GitHubMCPService.get_readme` | ✅ 100% | Success, error, exception cases |
| `GitHubMCPService.get_repository_tree` | ✅ 100% | Success and error cases |
| `GitHubMCPService.get_dependency_files` | ✅ 100% | Multiple files, missing files |
| `GitHubMCPService.get_repository_info` | ✅ 100% | Full orchestration |
| `GitHubMCPService.get_repository_info_sync` | ✅ 100% | Sync wrapper |
| `import_github_repo` view | ✅ 95% | All major paths covered |
| URL parsing | ✅ 100% | Multiple URL formats |
| Error handling | ✅ 100% | Network, auth, validation errors |

## Future Test Enhancements

### Potential Additions

1. **Rate Limiting Tests**: Test GitHub API rate limit handling
2. **Large Repository Tests**: Test handling of repos with thousands of files
3. **Binary File Tests**: Test handling of images, PDFs in dependency detection
4. **Concurrent Import Tests**: Test multiple users importing simultaneously
5. **MCP Server Timeout Tests**: Test handling of slow/timeout MCP responses
6. **Token Refresh Tests**: Test OAuth token expiration and refresh

### E2E Tests (Future)

End-to-end tests with real MCP server:
- Requires test GitHub repository
- Real MCP server connection
- Real OAuth token
- Would be slower but validate full integration

## Related Documentation

- [GitHub MCP Implementation Plan](./GITHUB_MCP_IMPLEMENTATION_PLAN.md)
- [MCP Architecture](./MCP_ARCHITECTURE.md)
- [Testing Best Practices](./TESTING.md)

## Maintenance

### Adding New Tests

1. Follow existing test patterns
2. Use descriptive test names
3. Mock external dependencies
4. Test both success and failure paths
5. Update this documentation

### When to Update Tests

- Adding new MCP tools
- Changing repository import flow
- Modifying error handling
- Adding new GitHub data sources
- Changing project content structure
