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
 * Import a GitHub repository as a portfolio project
 */
export async function importGitHubRepo(url: string, isShowcase: boolean = false): Promise<{
  project_id: number;
  slug: string;
  url: string;
}> {
  try {
    const response = await api.post<ApiResponse<{
      project_id: number;
      slug: string;
      url: string;
    }>>('/github/import/', {
      url,
      is_showcase: isShowcase,
    });

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to import repository');
    }

    return response.data.data!;
  } catch (error: any) {
    console.error('Failed to import GitHub repo:', error);

    // Handle specific error cases
    if (error.response?.status === 409) {
      throw new Error(error.response?.data?.error || 'Repository already imported');
    }

    if (error.response?.status === 401) {
      throw new Error('Please connect your GitHub account first.');
    }

    throw new Error(error.response?.data?.error || 'Failed to import repository');
  }
}
