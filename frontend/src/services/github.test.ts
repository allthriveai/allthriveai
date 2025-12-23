/**
 * Unit tests for GitHub service functions.
 *
 * CRITICAL: These tests ensure the GitHub integration works correctly.
 * They cover repository fetching, connection checking, and import flow.
 *
 * Run with: npm test -- --run github.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchGitHubRepos,
  checkGitHubConnection,
  importGitHubRepoAsync,
  getGitHubAppInstallUrl,
  GitHubInstallationNeededError,
  ImportError,
  type GitHubRepository,
} from './github';
import { api } from './api';

// Mock the api module
vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock the error handler to prevent console noise
vi.mock('@/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

describe('GitHub Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('checkGitHubConnection', () => {
    it('should return true when GitHub is connected', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: { data: { connected: true } },
      });

      const result = await checkGitHubConnection();

      expect(result).toBe(true);
      expect(api.get).toHaveBeenCalledWith('/social/status/github/');
    });

    it('should return false when GitHub is not connected', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: { data: { connected: false } },
      });

      const result = await checkGitHubConnection();

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

      const result = await checkGitHubConnection();

      expect(result).toBe(false);
    });

    it('should handle response at root level', async () => {
      // Some endpoints return data at root level instead of nested
      vi.mocked(api.get).mockResolvedValue({
        data: { connected: true },
      });

      const result = await checkGitHubConnection();

      expect(result).toBe(true);
    });
  });

  describe('fetchGitHubRepos', () => {
    const mockRepos: GitHubRepository[] = [
      {
        name: 'test-repo',
        fullName: 'testuser/test-repo',
        description: 'A test repository',
        htmlUrl: 'https://github.com/testuser/test-repo',
        language: 'TypeScript',
        stars: 10,
        forks: 2,
        isPrivate: false,
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    it('should return repositories on success', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: {
          data: {
            repositories: mockRepos,
            count: 1,
          },
        },
      });

      const result = await fetchGitHubRepos();

      expect(result).toEqual(mockRepos);
      expect(api.get).toHaveBeenCalledWith('/github/repos/');
    });

    it('should return empty array when no repositories', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: {
          data: {
            repositories: [],
            count: 0,
          },
        },
      });

      const result = await fetchGitHubRepos();

      expect(result).toEqual([]);
    });

    it('should throw GitHubInstallationNeededError when installation required', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: {
          needsInstallation: true,
          installUrl: 'https://github.com/apps/all-thrive-ai/installations/new',
          error: 'Please install the All Thrive AI app',
        },
      });

      await expect(fetchGitHubRepos()).rejects.toThrow(GitHubInstallationNeededError);
    });

    it('should include install URL in GitHubInstallationNeededError', async () => {
      const installUrl = 'https://github.com/apps/all-thrive-ai/installations/new';
      vi.mocked(api.get).mockResolvedValue({
        data: {
          needsInstallation: true,
          installUrl,
        },
      });

      try {
        await fetchGitHubRepos();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubInstallationNeededError);
        expect((error as GitHubInstallationNeededError).installUrl).toBe(installUrl);
      }
    });

    it('should throw error on 401 unauthorized', async () => {
      vi.mocked(api.get).mockRejectedValue({
        response: { status: 401 },
      });

      await expect(fetchGitHubRepos()).rejects.toThrow('connect your GitHub account');
    });

    it('should throw error on 429 rate limit', async () => {
      vi.mocked(api.get).mockRejectedValue({
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded. Please try again later.' },
        },
      });

      await expect(fetchGitHubRepos()).rejects.toThrow('Rate limit exceeded');
    });

    it('should throw generic error on other failures', async () => {
      vi.mocked(api.get).mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
      });

      await expect(fetchGitHubRepos()).rejects.toThrow('Internal server error');
    });
  });

  describe('getGitHubAppInstallUrl', () => {
    it('should return install URL on success', async () => {
      const expectedUrl = 'https://github.com/apps/all-thrive-ai/installations/new';
      vi.mocked(api.get).mockResolvedValue({
        data: {
          data: {
            installUrl: expectedUrl,
            appSlug: 'all-thrive-ai',
          },
        },
      });

      const result = await getGitHubAppInstallUrl();

      expect(result).toBe(expectedUrl);
    });

    it('should return default URL on error', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

      const result = await getGitHubAppInstallUrl();

      expect(result).toBe('https://github.com/apps/all-thrive-ai/installations/new');
    });
  });

  describe('importGitHubRepoAsync', () => {
    it('should successfully queue import and return project info', async () => {
      // Mock initial import request
      vi.mocked(api.post).mockResolvedValue({
        data: {
          success: true,
          taskId: 'task-123',
          message: 'Importing testuser/testrepo...',
          statusUrl: '/api/integrations/tasks/task-123',
        },
      });

      // Mock task status polling - first pending, then success
      vi.mocked(api.get)
        .mockResolvedValueOnce({
          data: {
            taskId: 'task-123',
            status: 'PENDING',
          },
        })
        .mockResolvedValueOnce({
          data: {
            taskId: 'task-123',
            status: 'SUCCESS',
            result: {
              success: true,
              project: {
                id: 42,
                title: 'Test Repo',
                slug: 'test-repo',
                url: '/testuser/test-repo',
              },
            },
          },
        });

      const result = await importGitHubRepoAsync('https://github.com/testuser/testrepo', false);

      expect(result.projectId).toBe(42);
      expect(result.slug).toBe('test-repo');
      expect(api.post).toHaveBeenCalledWith('/integrations/import-from-url/', {
        url: 'https://github.com/testuser/testrepo',
        is_showcase: false,
      });
    });

    it('should call onProgress callback with status updates', async () => {
      vi.mocked(api.post).mockResolvedValue({
        data: {
          success: true,
          taskId: 'task-123',
        },
      });

      vi.mocked(api.get).mockResolvedValue({
        data: {
          taskId: 'task-123',
          status: 'SUCCESS',
          result: {
            success: true,
            project: { id: 1, slug: 'test', url: '/test' },
          },
        },
      });

      const onProgress = vi.fn();
      await importGitHubRepoAsync('https://github.com/user/repo', false, onProgress);

      expect(onProgress).toHaveBeenCalled();
    });

    it('should throw ImportError when import fails to start', async () => {
      vi.mocked(api.post).mockResolvedValue({
        data: {
          success: false,
          error: 'Repository not found',
          errorCode: 'NOT_FOUND',
        },
      });

      await expect(
        importGitHubRepoAsync('https://github.com/user/nonexistent')
      ).rejects.toThrow(ImportError);
    });

    it('should throw ImportError with suggestion when available', async () => {
      vi.mocked(api.post).mockResolvedValue({
        data: {
          success: false,
          error: 'Repository already imported',
          errorCode: 'DUPLICATE_IMPORT',
          suggestion: 'View your existing project instead.',
        },
      });

      try {
        await importGitHubRepoAsync('https://github.com/user/repo');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ImportError);
        expect((error as ImportError).suggestion).toBe('View your existing project instead.');
      }
    });

    it('should throw ImportError on rate limit (429)', async () => {
      vi.mocked(api.post).mockRejectedValue({
        response: { status: 429 },
      });

      try {
        await importGitHubRepoAsync('https://github.com/user/repo');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ImportError);
        expect((error as ImportError).errorCode).toBe('RATE_LIMIT_EXCEEDED');
      }
    });

    it('should throw ImportError when task fails', async () => {
      vi.mocked(api.post).mockResolvedValue({
        data: {
          success: true,
          taskId: 'task-123',
        },
      });

      vi.mocked(api.get).mockResolvedValue({
        data: {
          taskId: 'task-123',
          status: 'FAILURE',
          result: {
            success: false,
            error: 'Failed to analyze repository',
          },
        },
      });

      await expect(importGitHubRepoAsync('https://github.com/user/repo')).rejects.toThrow(
        'Failed to analyze repository'
      );
    });

    it('should handle task timeout', async () => {
      vi.mocked(api.post).mockResolvedValue({
        data: {
          success: true,
          taskId: 'task-123',
        },
      });

      // Always return PENDING
      vi.mocked(api.get).mockResolvedValue({
        data: {
          taskId: 'task-123',
          status: 'PENDING',
        },
      });

      // Use short timeout for test
      await expect(
        importGitHubRepoAsync('https://github.com/user/repo')
      ).rejects.toThrow('taking longer than expected');
    }, 150000); // Long timeout for this test
  });

  describe('GitHubInstallationNeededError', () => {
    it('should store install URL', () => {
      const error = new GitHubInstallationNeededError(
        'Install required',
        'https://github.com/apps/test/installations/new'
      );

      expect(error.message).toBe('Install required');
      expect(error.installUrl).toBe('https://github.com/apps/test/installations/new');
      expect(error.name).toBe('GitHubInstallationNeededError');
    });
  });

  describe('ImportError', () => {
    it('should store error details', () => {
      const error = new ImportError('Import failed', {
        errorCode: 'DUPLICATE_IMPORT',
        suggestion: 'Check existing projects',
      });

      expect(error.message).toBe('Import failed');
      expect(error.errorCode).toBe('DUPLICATE_IMPORT');
      expect(error.suggestion).toBe('Check existing projects');
      expect(error.name).toBe('ImportError');
    });

    it('should work without optional parameters', () => {
      const error = new ImportError('Simple error');

      expect(error.message).toBe('Simple error');
      expect(error.errorCode).toBeUndefined();
      expect(error.suggestion).toBeUndefined();
    });
  });
});
