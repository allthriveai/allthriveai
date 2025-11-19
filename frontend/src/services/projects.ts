import { api } from './api';
import type { Project, ProjectPayload, PaginatedResponse } from '@/types/models';
import type { ApiResponse } from '@/types/api';

/**
 * Transform backend data to frontend Project type
 * Note: API interceptor already converts snake_case to camelCase,
 * so we just need to normalize the data structure
 */
function transformProject(data: any): Project {
  return {
    id: data.id,
    username: data.username,
    title: data.title,
    slug: data.slug,
    description: data.description || '',
    type: data.type,
    isShowcase: data.isShowcase,
    isArchived: data.isArchived,
    isPublished: data.isPublished ?? false,
    publishedAt: data.publishedAt,
    thumbnailUrl: data.thumbnailUrl,
    content: data.content || {},
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Transform frontend payload
 * Note: API interceptor automatically converts camelCase to snake_case,
 * so we can just return the payload as-is
 */
function transformPayload(payload: ProjectPayload): any {
  return payload;
}

/**
 * Get all projects for the current user
 */
export async function listProjects(): Promise<Project[]> {
  const response = await api.get<PaginatedResponse<any>>('/me/projects/');
  return response.data.results.map(transformProject);
}

/**
 * Get a single project by ID
 */
export async function getProject(id: number): Promise<Project> {
  const response = await api.get<any>(`/me/projects/${id}/`);
  return transformProject(response.data);
}

/**
 * Get a project by username and slug
 */
export async function getProjectBySlug(username: string, slug: string): Promise<Project> {
  // For now, we'll list all projects and filter
  // TODO: Add dedicated backend endpoint for /{username}/{slug}
  const projects = await listProjects();
  const project = projects.find(p => p.username === username && p.slug === slug);
  if (!project) {
    throw new Error('Project not found');
  }
  return project;
}

/**
 * Create a new project
 */
export async function createProject(payload: ProjectPayload): Promise<Project> {
  const backendPayload = transformPayload(payload);
  const response = await api.post<any>('/me/projects/', backendPayload);
  return transformProject(response.data);
}

/**
 * Update an existing project
 */
export async function updateProject(id: number, payload: Partial<ProjectPayload>): Promise<Project> {
  const backendPayload = transformPayload(payload as ProjectPayload);
  const response = await api.patch<any>(`/me/projects/${id}/`, backendPayload);
  return transformProject(response.data);
}

/**
 * Delete a project
 */
export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/me/projects/${id}/`);
}

/**
 * Bulk delete multiple projects
 */
export async function bulkDeleteProjects(projectIds: number[]): Promise<{ deleted_count: number; message: string }> {
  const response = await api.post<{ deleted_count: number; message: string }>('/me/projects/bulk-delete/', {
    project_ids: projectIds,
  });
  return response.data;
}

/**
 * Get projects for a specific user (showcase and playground)
 * For logged-out users, only returns showcase projects.
 * For logged-in users viewing their own profile, returns all projects.
 */
export async function getUserProjects(username: string): Promise<{
  showcase: Project[];
  playground: Project[];
}> {
  // Use the public endpoint that returns showcase for everyone,
  // and all projects for authenticated users viewing their own profile
  const response = await api.get<{
    showcase: any[];
    playground: any[];
  }>(`/users/${username}/projects/`);

  return {
    showcase: response.data.showcase.map(transformProject),
    playground: response.data.playground.map(transformProject),
  };
}
