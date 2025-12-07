import { api } from './api';
import type { ApiResponse } from '@/types/api';
import type { Project } from '@/types/models';

/**
 * Enhanced error with additional context for imports
 */
export class ImportError extends Error {
  errorCode?: string;
  suggestion?: string;
  project?: Project;

  constructor(message: string, options?: { errorCode?: string; suggestion?: string; project?: Project }) {
    super(message);
    this.name = 'ImportError';
    this.errorCode = options?.errorCode;
    this.suggestion = options?.suggestion;
    this.project = options?.project;
  }
}

/**
 * GitHub Repository type
 */
export interface GitHubRepository {
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  language: string;
  stars: number;
  forks: number;
  isPrivate: boolean;
  updatedAt: string;
}

/**
 * Fetch user's GitHub repositories
 */
export async function fetchGitHubRepos(): Promise<GitHubRepository[]> {
  try {
    const response = await api.get<ApiResponse<{ repositories: GitHubRepository[]; count: number }>>(
      '/github/repos/'
    );

    const repos = response.data.data?.repositories || [];
    return repos;
  } catch (error: any) {
    console.error('Failed to fetch GitHub repos:', error);

    // Handle specific error cases
    if (error.response?.status === 401) {
      throw new Error('Please connect your GitHub account first.');
    }

    if (error.response?.status === 429) {
      const errorMessage = error.response?.data?.error || 'Rate limit exceeded. Please try again later.';
      throw new Error(errorMessage);
    }

    throw new Error(error.response?.data?.error || 'Failed to fetch GitHub repositories');
  }
}

/**
 * Check if GitHub is connected for the current user
 */
export async function checkGitHubConnection(): Promise<boolean> {
  try {
    const response = await api.get<ApiResponse<{ connected: boolean }>>('/social/status/github/');
    const data = response.data.data || response.data;
    return data?.connected ?? false;
  } catch (error) {
    console.error('Failed to check GitHub connection:', error);
    return false;
  }
}

/**
 * Enhanced error response type
 */
export interface GitHubError {
  error: string;
  error_code?: string;
  suggestion?: string;
  project?: {
    id: number;
    title: string;
    slug: string;
    url: string;
  };
}

/**
 * Task status response type
 */
export interface TaskResultProject {
  id: number;
  title: string;
  slug: string;
  url: string;
}

export interface TaskResult {
  success: boolean;
  message?: string;
  project?: TaskResultProject;
  project_id?: number;
  slug?: string;
  url?: string;
  error?: string;
  error_code?: string;
  suggestion?: string;
}

export interface TaskStatus {
  task_id: string;
  status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'RETRY';
  result?: TaskResult;
  error?: string;
}

/**
 * Import a GitHub repository as a portfolio project.
 *
 * This queues the import as a background task and returns immediately.
 * Polls for task completion and returns the final result.
 */
export async function importGitHubRepoAsync(
  url: string,
  isShowcased: boolean = false,
  onProgress?: (status: string) => void
): Promise<{
  project_id: number;
  slug: string;
  url: string;
}> {
  try {
    // Queue the background task using generic integration endpoint
    const response = await api.post<{
      success: boolean;
      taskId: string;  // At root level after camelCase transform
      platform?: string;
      platformDisplay?: string;
      message: string;
      detail?: string;
      statusUrl: string;
      error?: string;
      errorCode?: string;
      suggestion?: string;
      project?: Project;
    }>('/integrations/import-from-url/', {
      url,
      is_showcase: isShowcased,
    });

    if (!response.data.success) {
      // Extract enhanced error information from response
      const errorData = response.data;
      throw new ImportError(errorData.error || 'Failed to start import', {
        errorCode: errorData.errorCode,
        suggestion: errorData.suggestion,
        project: errorData.project,
      });
    }

    const taskId = response.data.taskId;  // Fields are at root level

    // Platform detection happens silently

    onProgress?.('🚀 Import queued successfully!');

    // Poll for completion
    const result = await pollTaskStatus(taskId, onProgress);

    if (!result.success) {
      throw new ImportError(result.error || 'Import failed', {
        suggestion: result.suggestion,
        project: result.project,
        errorCode: result.error_code,
      });
    }

    return {
      project_id: result.project!.id,
      slug: result.project!.slug,
      url: result.project!.url,
    };

  } catch (error: unknown) {
    console.error('Failed to import GitHub repo (async):', error);

    // If error is already an ImportError, re-throw it
    if (error instanceof ImportError) {
      throw error;
    }

    // Handle axios errors
    const axiosError = error as { response?: { status?: number; data?: GitHubError }; message?: string };

    // Handle rate limiting (429) specially
    if (axiosError.response?.status === 429) {
      throw new ImportError("You've reached the import limit", {
        suggestion: 'You can import up to 20 projects per hour. Please wait a few minutes and try again.',
        errorCode: 'RATE_LIMIT_EXCEEDED',
      });
    }

    // Extract enhanced error information from axios response
    const errorData: GitHubError = axiosError.response?.data || {};
    const errorMessage = errorData.error || axiosError.message || 'Failed to import repository';

    throw new ImportError(errorMessage, {
      suggestion: errorData.suggestion,
      project: errorData.project,
      errorCode: errorData.error_code,
    });
  }
}

/**
 * Poll task status until completion
 */
async function pollTaskStatus(
  taskId: string,
  onProgress?: (status: string) => void,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<TaskResult> {
  let attempts = 0;
  let lastStatus = '';

  while (attempts < maxAttempts) {
    try {
      const response = await api.get<TaskStatus>(`/integrations/tasks/${taskId}/`);
      const status = response.data;

      if (status.status === 'SUCCESS') {
        onProgress?.('✨ Creating your beautiful portfolio...');
        return status.result!;
      }

      if (status.status === 'FAILURE') {
        const errorMessage = status.result?.error || status.error || 'Import failed';
        throw new ImportError(errorMessage, {
          suggestion: status.result?.suggestion,
          errorCode: status.result?.error_code,
        });
      }

      // Determine status message based on task state
      let statusMessage = '';
      if (status.status === 'STARTED') {
        statusMessage = '🔍 Analyzing project structure...';
      } else if (status.status === 'RETRY') {
        statusMessage = '🔄 Retrying...';
      } else {
        // PENDING
        statusMessage = '⏳ Queued - starting analysis...';
      }

      // Only report status changes to avoid spam
      if (statusMessage !== lastStatus) {
        onProgress?.(statusMessage);
        lastStatus = statusMessage;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;

    } catch (error: unknown) {
      // Re-throw ImportError as-is
      if (error instanceof ImportError) {
        throw error;
      }

      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        // Task not found yet, wait and retry
        const initMessage = '⚡ Starting import...';
        if (initMessage !== lastStatus) {
          onProgress?.(initMessage);
          lastStatus = initMessage;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        attempts++;
        continue;
      }
      throw error;
    }
  }

  // Timeout after maxAttempts
  throw new ImportError('Import is taking longer than expected. The project may still complete - please check your projects page.', {
    suggestion: 'If this keeps happening, try a smaller repository first.',
    errorCode: 'TIMEOUT',
  });
}
