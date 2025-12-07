import { api } from './api';
import type { ApiResponse } from '@/types/api';
import type { Project } from '@/types/models';

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
    console.error('Failed to fetch GitLab projects:', error);

    // Handle specific error cases
    if (error.response?.status === 401) {
      throw new Error('Please connect your GitLab account first.');
    }

    if (error.response?.status === 429) {
      const errorMessage = error.response?.data?.error || 'Rate limit exceeded. Please try again later.';
      throw new Error(errorMessage);
    }

    throw new Error(error.response?.data?.error || 'Failed to fetch GitLab projects');
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
    console.error('Failed to check GitLab connection:', error);
    return false;
  }
}
