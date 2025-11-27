import { api } from './api';
import type { ApiResponse } from '@/types/api';

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
export interface TaskStatus {
  task_id: string;
  status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'RETRY';
  result?: {
    success: boolean;
    message?: string;
    project?: {
      id: number;
      title: string;
      slug: string;
      url: string;
    };
    error?: string;
    error_code?: string;
    suggestion?: string;
  };
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
  isShowcase: boolean = false,
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
      project?: any;
    }>('/integrations/import-from-url/', {
      url,
      is_showcase: isShowcase,
    });

    if (!response.data.success) {
      // Extract enhanced error information from response
      const errorData = response.data;
      const error: any = new Error(errorData.error || 'Failed to start import');
      if (errorData.errorCode) error.errorCode = errorData.errorCode;
      if (errorData.suggestion) error.suggestion = errorData.suggestion;
      if (errorData.project) error.project = errorData.project;
      throw error;
    }

    const taskId = response.data.taskId;  // Fields are at root level

    // Log platform detection for debugging
    if (response.data.platform) {
      console.log(`Auto-detected platform: ${response.data.platformDisplay || response.data.platform}`);
    }

    onProgress?.('🚀 Import queued successfully!');

    // Poll for completion
    const result = await pollTaskStatus(taskId, onProgress);

    if (!result.success) {
      const error: any = new Error(result.error || 'Import failed');
      if (result.suggestion) error.suggestion = result.suggestion;
      if (result.project) error.project = result.project;
      if (result.error_code) error.errorCode = result.error_code;
      throw error;
    }

    return {
      project_id: result.project!.id,
      slug: result.project!.slug,
      url: result.project!.url,
    };

  } catch (error: any) {
    console.error('Failed to import GitHub repo (async):', error);

    // If error already has enhanced properties (from manual throw), re-throw it
    if (error.errorCode || error.suggestion || error.project) {
      throw error;
    }

    // Extract enhanced error information from axios response
    const errorData: GitHubError = error.response?.data || {};
    const errorMessage = errorData.error || error.message || 'Failed to import repository';
    const suggestion = errorData.suggestion;
    const project = errorData.project;

    // Create enhanced error with additional context
    const enhancedError: any = new Error(errorMessage);
    if (suggestion) enhancedError.suggestion = suggestion;
    if (project) enhancedError.project = project;
    if (errorData.error_code) enhancedError.errorCode = errorData.error_code;

    throw enhancedError;
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
): Promise<{
  success: boolean;
  project_id: number;
  slug: string;
  url: string;
  error?: string;
}> {
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
        const error = status.result?.error || status.error || 'Import failed';
        const suggestion = status.result?.suggestion;

        // Throw enhanced error with all context
        const enhancedError: any = new Error(error);
        if (suggestion) enhancedError.suggestion = suggestion;
        if (status.result?.error_code) enhancedError.errorCode = status.result.error_code;
        if (status.result?.project) enhancedError.project = status.result.project;
        throw enhancedError;
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

    } catch (error: any) {
      if (error.response?.status === 404) {
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
  const timeoutError: any = new Error('Import is taking longer than expected. The project may still complete - please check your projects page.');
  timeoutError.suggestion = 'If this keeps happening, try a smaller repository first.';
  throw timeoutError;
}
