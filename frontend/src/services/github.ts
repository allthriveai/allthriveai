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
  homepage: string;
  language: string;
  topics: string[];
  stars: number;
  forks: number;
  isFork: boolean;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * GitHub Import Preview Data
 */
export interface GitHubImportPreview {
  title: string;
  description: string;
  tldr: string;
  htmlUrl: string;
  homepage: string;
  language: string;
  topics: string[];
  stars: number;
  forks: number;
  isFork: boolean;
  createdAt: string;
  updatedAt: string;
  readmeContent: string;
  readmeHtmlUrl: string;
}

/**
 * Check if GitHub is connected for the current user
 */
export async function checkGitHubConnection(): Promise<boolean> {
  try {
    const response = await api.get<ApiResponse<{ connected: boolean }>>('/social/status/github/');
    console.log('GitHub status response:', response.data);

    // API returns { success: true, data: { connected: true, ... } }
    // OR direct { connected: true, ... } depending on response format
    const data = response.data.data || response.data;
    console.log('Parsed data:', data);
    console.log('Connected status:', data?.connected);

    return data?.connected ?? false;
  } catch (error) {
    console.error('Failed to check GitHub connection:', error);
    return false;
  }
}

/**
 * Fetch user's GitHub repositories
 */
export async function fetchGitHubRepos(includePrivate: boolean = false): Promise<GitHubRepository[]> {
  try {
    const response = await api.get<ApiResponse<{ repositories: any[]; count: number }>>(
      '/github/repos/',
      {
        params: { include_private: includePrivate },
      }
    );

    console.log('GitHub repos response:', response.data);
    const repos = response.data.data?.repositories || response.data.repositories || [];
    console.log('Parsed repos:', repos);
    return repos;
  } catch (error: any) {
    console.error('Failed to fetch GitHub repos:', error);

    // Handle rate limit errors specifically
    if (error.response?.status === 429) {
      const errorMessage = error.response?.data?.detail || 'Rate limit exceeded. Please try again later.';
      throw new Error(errorMessage);
    }

    throw error;
  }
}

/**
 * Get import preview for a repository
 */
export async function getImportPreview(repoFullName: string): Promise<GitHubImportPreview> {
  const response = await api.post<ApiResponse<GitHubImportPreview>>(
    '/github/import/preview/',
    { repo_full_name: repoFullName }
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to fetch preview');
  }

  return response.data.data as GitHubImportPreview;
}

/**
 * Confirm import and create project from GitHub repository
 */
export async function confirmImport(params: {
  repoFullName: string;
  previewData: GitHubImportPreview;
  title?: string;
  tldr?: string;
  autoPublish?: boolean;
  addToShowcase?: boolean;
}): Promise<{
  projectId: string;
  projectSlug: string;
  username: string;
  redirectUrl: string;
  wasCreated: boolean;
  message: string;
}> {
  const response = await api.post<ApiResponse<any>>('/github/import/confirm/', {
    repo_full_name: params.repoFullName,
    preview_data: params.previewData,
    title: params.title,
    tldr: params.tldr,
    auto_publish: params.autoPublish ?? true,
    add_to_showcase: params.addToShowcase ?? false,
  });

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to import repository');
  }

  return response.data.data;
}

/**
 * Get connection URL for GitHub OAuth
 */
export async function getGitHubConnectUrl(): Promise<string> {
  const response = await api.get<ApiResponse<{ authUrl: string }>>('/social/connect/github/');

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to get GitHub connect URL');
  }

  return response.data.data?.authUrl || '';
}
