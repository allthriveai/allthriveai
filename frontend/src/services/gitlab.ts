import { api } from './api';
import type { ApiResponse } from '@/types/api';
import type { Project } from '@/types/models';
import { logError } from '@/utils/errorHandler';

/**
 * Enhanced error with additional context for imports
 */
export class GitLabImportError extends Error {
  errorCode?: string;
  suggestion?: string;
  project?: Project;

  constructor(message: string, options?: { errorCode?: string; suggestion?: string; project?: Project }) {
    super(message);
    this.name = 'GitLabImportError';
    this.errorCode = options?.errorCode;
    this.suggestion = options?.suggestion;
    this.project = options?.project;
  }
}

/**
 * GitLab Project type (matching GitHub format for compatibility)
 */
export interface GitLabProject {
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  language: string;
  stars: number;
  forks: number;
  isPrivate: boolean;
  updatedAt: string;
  // GitLab-specific fields
  namespace?: string;
  avatarUrl?: string;
}

/**
 * Fetch user's GitLab projects
 */
export async function fetchGitLabProjects(): Promise<GitLabProject[]> {
  try {
    const response = await api.get<ApiResponse<{ repositories: GitLabProject[]; count: number }>>(
      '/gitlab/projects/'
    );

    const projects = response.data.data?.repositories || [];
    return projects;
  } catch (error: any) {
    logError('gitlab.fetchGitLabProjects', error);

    // Handle ApiError objects (transformed by axios interceptor)
    if (error.statusCode === 401) {
      throw new Error('Please connect your GitLab account first.');
    }

    if (error.statusCode === 403) {
      throw new Error(
        error.error ||
          'Your GitLab token does not have permission to list projects. Please reconnect GitLab.'
      );
    }

    if (error.statusCode === 429) {
      const errorMessage = error.error || 'Rate limit exceeded. Please try again later.';
      throw new Error(errorMessage);
    }

    // Handle the error message from ApiError or fall back
    throw new Error(error.error || error.message || 'Failed to fetch GitLab projects');
  }
}

/**
 * Check if GitLab is connected for the current user
 */
export async function checkGitLabConnection(): Promise<boolean> {
  try {
    const response = await api.get<ApiResponse<{ connected: boolean }>>('/social/status/gitlab/');
    const data = response.data.data || response.data;
    return data?.connected ?? false;
  } catch (error) {
    logError('gitlab.checkGitLabConnection', error);
    return false;
  }
}
