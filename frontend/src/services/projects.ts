import { api } from './api';
import type { Project, ProjectPayload, PaginatedResponse, ProjectContent, ProjectType, Tool, Taxonomy } from '@/types/models';
import type { CompletedQuestInfo } from '@/contexts/QuestCompletionContext';

// Backend project response (before camelCase transform is applied)
interface ProjectApiResponse {
  id: number;
  username: string;
  userAvatarUrl?: string;
  title: string;
  slug: string;
  description?: string;
  type: ProjectType;
  isShowcased: boolean;
  isHighlighted?: boolean;
  isPrivate?: boolean;
  isArchived: boolean;
  isPromoted?: boolean;
  promotedAt?: string;
  bannerUrl?: string;
  featuredImageUrl?: string;
  externalUrl?: string;
  tools?: number[];
  toolsDetails?: Tool[];
  categories?: number[];
  categoriesDetails?: Taxonomy[];
  topics?: string[];
  tagsManuallyEdited?: boolean;
  heartCount?: number;
  isLikedByUser?: boolean;
  content?: ProjectContent;
  publishedDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Transform backend data to frontend Project type
 * Note: API interceptor already converts snake_case to camelCase,
 * so we just need to normalize the data structure
 */
function transformProject(data: ProjectApiResponse): Project {
  return {
    id: data.id,
    username: data.username,
    title: data.title,
    slug: data.slug,
    description: data.description || '',
    type: data.type,
    isShowcased: data.isShowcased,
    isHighlighted: data.isHighlighted ?? false,
    isPrivate: data.isPrivate ?? false,
    isArchived: data.isArchived,
    isPromoted: data.isPromoted ?? false,
    promotedAt: data.promotedAt,
    bannerUrl: data.bannerUrl,
    featuredImageUrl: data.featuredImageUrl || '',
    externalUrl: data.externalUrl || '',
    tools: Array.isArray(data.toolsDetails) && typeof data.toolsDetails[0] === 'object'
      ? data.toolsDetails.map((t: any) => t.id)
      : data.tools || [],
    toolsDetails: data.toolsDetails || [],
    categories: Array.isArray(data.categoriesDetails) && typeof data.categoriesDetails[0] === 'object'
      ? data.categoriesDetails.map((c: any) => c.id)
      : data.categories || [],
    categoriesDetails: data.categoriesDetails || [],
    topics: data.topics || [],
    tagsManuallyEdited: data.tagsManuallyEdited || false,
    heartCount: data.heartCount || 0,
    isLikedByUser: data.isLikedByUser || false,
    content: data.content || {},
    publishedDate: data.publishedDate,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Transform frontend payload
 * Note: API interceptor automatically converts camelCase to snake_case,
 * so we can just return the payload as-is
 */
function transformPayload(payload: ProjectPayload): ProjectPayload {
  return payload;
}

/**
 * Get all projects for the current user
 */
export async function listProjects(): Promise<Project[]> {
  const response = await api.get<PaginatedResponse<ProjectApiResponse>>('/me/projects/');
  return response.data.results.map(transformProject);
}

/**
 * Get a single project by ID
 */
export async function getProject(id: number): Promise<Project> {
  const response = await api.get<ProjectApiResponse>(`/me/projects/${id}/`);
  return transformProject(response.data);
}

/**
 * Get a project by username and slug
 * Uses the direct project detail endpoint
 */
export async function getProjectBySlug(username: string, slug: string): Promise<Project> {
  const response = await api.get<ProjectApiResponse>(`/users/${username}/projects/${slug}/`);
  return transformProject(response.data);
}

/**
 * Create a new project
 */
export async function createProject(payload: ProjectPayload): Promise<Project> {
  const backendPayload = transformPayload(payload);
  const response = await api.post<ProjectApiResponse>('/me/projects/', backendPayload);
  return transformProject(response.data);
}

/**
 * Extracted project data from URL scraping
 */
export interface ScrapedProjectData {
  title: string;
  description: string;
  tagline?: string | null;
  imageUrl?: string | null;
  creator?: string | null;
  organization?: string | null;
  topics?: string[] | null;
  features?: string[] | null;
  links?: Record<string, string> | null;
  license?: string | null;
  sourceUrl?: string | null;
}

/**
 * Scrape a URL and extract project data using AI
 *
 * This endpoint fetches any webpage and uses AI to extract
 * structured project information for creating a new project.
 */
export async function scrapeUrlForProject(url: string): Promise<ScrapedProjectData> {
  const response = await api.post<{ success: boolean; data: ScrapedProjectData }>(
    '/integrations/scrape-url/',
    { url }
  );
  return response.data.data;
}

/**
 * Update an existing project
 */
export async function updateProject(id: number, payload: Partial<ProjectPayload>): Promise<Project> {
  const backendPayload = transformPayload(payload as ProjectPayload);
  const response = await api.patch<ProjectApiResponse>(`/me/projects/${id}/`, backendPayload);
  return transformProject(response.data);
}

/**
 * Delete a project (owner only)
 */
export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/me/projects/${id}/`);
}

/**
 * Delete a project by ID (admins can delete any project)
 */
export async function deleteProjectById(id: number): Promise<void> {
  await api.delete(`/projects/${id}/delete/`);
}

/**
 * Bulk delete multiple projects
 */
export async function bulkDeleteProjects(projectIds: number[]): Promise<{ deletedCount: number; message: string }> {
  const response = await api.post<{ deletedCount: number; message: string }>('/me/projects/bulk-delete/', {
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
    showcase: ProjectApiResponse[];
    playground: ProjectApiResponse[];
  }>(`/users/${username}/projects/`);

  // Defensive coding: handle cases where response data might be malformed
  // This can happen with cached responses or unexpected API changes
  const showcase = Array.isArray(response.data?.showcase) ? response.data.showcase : [];
  const playground = Array.isArray(response.data?.playground) ? response.data.playground : [];

  return {
    showcase: showcase.map(transformProject),
    playground: playground.map(transformProject),
  };
}

/**
 * Toggle like/heart on a project
 * Returns the like status, heart count, and any completed quests triggered by this action
 */
export async function toggleProjectLike(projectId: number): Promise<{
  liked: boolean;
  heartCount: number;
  completedQuests?: CompletedQuestInfo[];
}> {
  const response = await api.post<{
    liked: boolean;
    heartCount: number;
    completedQuests?: CompletedQuestInfo[];
  }>(`/me/projects/${projectId}/toggle-like/`);
  return {
    liked: response.data.liked,
    heartCount: response.data.heartCount,
    completedQuests: response.data.completedQuests,
  };
}

/**
 * Get projects liked/hearted by a user
 */
export async function getLikedProjects(username: string): Promise<Project[]> {
  const response = await api.get<{ results: ProjectApiResponse[] }>(`/users/${username}/liked-projects/`);
  return response.data.results.map(transformProject);
}

/**
 * Get all clipped content for a user (hearted projects + external clipped projects)
 */
export async function getClippedProjects(username: string): Promise<Project[]> {
  const response = await api.get<{ results: ProjectApiResponse[] }>(`/users/${username}/clipped-projects/`);
  return response.data.results.map(transformProject);
}

/**
 * Delete a redirect for a project
 */
export async function deleteProjectRedirect(projectId: number, redirectId: number): Promise<void> {
  await api.delete(`/me/projects/${projectId}/redirects/${redirectId}/`);
}

/**
 * Update project tags (admin only)
 * Sets tags_manually_edited flag to prevent auto-tagging during resync
 */
export async function updateProjectTags(
  projectId: number,
  tags: {
    tools?: number[];
    categories?: number[];
    topics?: string[];
  }
): Promise<Project> {
  const response = await api.patch<ProjectApiResponse>(`/me/projects/${projectId}/update-tags/`, tags);
  return transformProject(response.data);
}

/**
 * Get all available tools
 * Uses page_size=200 to fetch all tools in a single request
 */
export async function getTools(): Promise<Tool[]> {
  const response = await api.get<{ results: Tool[] }>("/tools/?page_size=200");
  return response.data.results;
}

/**
 * Get all taxonomies (categories, tags, etc.)
 * Uses page_size=200 to fetch all taxonomies in a single request
 */
export async function getTaxonomies(type?: 'category' | 'tag'): Promise<Taxonomy[]> {
  const params = new URLSearchParams({ page_size: '200' });
  if (type) {
    params.set('taxonomy_type', type);
  }
  const response = await api.get<{ results: Taxonomy[] }>(`/taxonomies/?${params.toString()}`);
  return response.data.results;
}

/**
 * Set a project's featured image from a URL
 * Used by Nano Banana to set generated images as project featured images
 */
export async function setProjectFeaturedImage(projectId: number, imageUrl: string): Promise<Project> {
  const response = await api.patch<ProjectApiResponse>(`/me/projects/${projectId}/`, {
    featured_image_url: imageUrl,
  });
  return transformProject(response.data);
}

/**
 * Response from creating a project from an image generation session
 */
export interface CreateProjectFromImageResult {
  success: boolean;
  project: {
    id: number;
    slug: string;
    title: string;
    url: string;
  };
}

/**
 * Create a project from a Nano Banana image generation session
 * This creates a project with the final generated image as featured image
 * and includes an AI-generated creative journey summary
 */
export async function createProjectFromImageSession(
  sessionId: number,
  customTitle?: string
): Promise<CreateProjectFromImageResult> {
  const response = await api.post<CreateProjectFromImageResult>('/agents/create-project-from-image/', {
    session_id: sessionId,
    title: customTitle,
  });
  return response.data;
}

/**
 * Toggle project promotion status (admin only)
 * Promoted projects appear at the top of explore feeds
 */
export async function toggleProjectPromotion(projectId: number): Promise<{
  isPromoted: boolean;
  promotedAt: string | null;
}> {
  const response = await api.post<{
    success: boolean;
    data: {
      id: number;
      isPromoted: boolean;  // camelCase after API interceptor transform
      promotedAt: string | null;
    };
  }>(`/projects/${projectId}/toggle-promotion/`);
  return {
    isPromoted: response.data.data.isPromoted,
    promotedAt: response.data.data.promotedAt,
  };
}

/**
 * Toggle a project in the user's profile showcase (featured_projects section)
 * Adds or removes the project from the showcase section
 */
export async function toggleProjectInShowcase(projectId: number): Promise<{
  added: boolean;
  projectIds: number[];
}> {
  const response = await api.post<{
    added: boolean;
    projectIds: number[];
  }>('/me/profile-sections/toggle-project/', {
    project_id: projectId,
  });
  return {
    added: response.data.added,
    projectIds: response.data.projectIds,
  };
}

/**
 * Visual styles available for image regeneration
 */
export const VISUAL_STYLES = [
  { id: 'cyberpunk', name: 'Cyberpunk', description: 'Neon colors, digital aesthetics' },
  { id: 'dark_academia', name: 'Dark Academia', description: 'Moody, scholarly aesthetic' },
  { id: 'minimalist', name: 'Minimalist', description: 'Clean, simple design' },
  { id: 'retro_tech', name: 'Retro Tech', description: '80s/90s technology vibes' },
  { id: 'nature_tech', name: 'Nature Tech', description: 'Organic meets digital' },
] as const;

export type VisualStyle = typeof VISUAL_STYLES[number]['id'];

/**
 * Edit project content and regenerate images
 * Allowed for: project owner, admins, or impersonating admins
 * Used for curated articles and other content types
 */
export async function adminEditProject(
  projectId: number,
  updates: {
    title?: string;
    description?: string;
    regenerateImage?: boolean;
    visualStyle?: VisualStyle;
  }
): Promise<Project> {
  const response = await api.patch<ProjectApiResponse>(`/me/projects/${projectId}/admin-edit/`, {
    title: updates.title,
    description: updates.description,
    regenerate_image: updates.regenerateImage,
    visual_style: updates.visualStyle,
  });
  return transformProject(response.data);
}
