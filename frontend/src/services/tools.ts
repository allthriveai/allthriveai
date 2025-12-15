import type { Tool, ToolReview, PaginatedResponse } from '@/types/models';
import { api } from './api';

// Simple in-memory cache for prefetched tools
const toolCache = new Map<string, { data: Tool; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

// Bookmark response interfaces
export interface ToolBookmark {
  id: number;
  toolId: number;
  tool: Tool;
  createdAt: string;
}

export interface ToggleBookmarkResponse {
  bookmarked: boolean;
  bookmark?: ToolBookmark;
}

/**
 * Get list of all tools with optional filters
 */
export async function getTools(params?: {
  tool_type?: string;
  category?: string;
  company?: number;
  pricing_model?: string;
  has_free_tier?: boolean;
  is_featured?: boolean;
  is_verified?: boolean;
  search?: string;
  ordering?: string;
  page_size?: number;
}): Promise<PaginatedResponse<Tool>> {
  try {
    const response = await api.get('/tools/', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch tools:', error);
    throw error;
  }
}

/**
 * Get detailed information about a specific tool by slug
 * Uses cache if available and not expired
 */
export async function getToolBySlug(slug: string): Promise<Tool> {
  // Check cache first
  const cached = toolCache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await api.get(`/tools/${slug}/`);
    const tool = response.data;
    // Cache the result
    toolCache.set(slug, { data: tool, timestamp: Date.now() });
    return tool;
  } catch (error) {
    console.error(`Failed to fetch tool ${slug}:`, error);
    throw error;
  }
}

/**
 * Prefetch tool data on hover - fire and forget
 * This improves perceived performance by loading data before the user clicks
 */
export function prefetchTool(slug: string): void {
  // Skip if already cached and not expired
  const cached = toolCache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return;
  }

  // Fire and forget - don't await
  api.get(`/tools/${slug}/`).then((response) => {
    toolCache.set(slug, { data: response.data, timestamp: Date.now() });
  }).catch(() => {
    // Silently ignore prefetch failures
  });
}

/**
 * Get featured tools
 */
export async function getFeaturedTools(): Promise<Tool[]> {
  const response = await api.get('/tools/featured/');
  return response.data;
}

/**
 * Get available tool categories with counts
 */
export async function getToolCategories(): Promise<Array<{ value: string; label: string; count: number }>> {
  const response = await api.get('/tools/categories/');
  return response.data;
}

/**
 * Get available companies with tool counts
 */
export async function getToolCompanies(): Promise<Array<{ id: number; name: string; slug: string; count: number }>> {
  const response = await api.get('/tools/companies/');
  return response.data;
}

/**
 * Get reviews for a specific tool
 */
export async function getToolReviews(slug: string): Promise<PaginatedResponse<ToolReview>> {
  const response = await api.get(`/tools/${slug}/reviews/`);
  return response.data;
}

/**
 * Get similar tools based on category and tags
 */
export async function getSimilarTools(slug: string): Promise<Tool[]> {
  try {
    const response = await api.get(`/tools/${slug}/similar/`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch similar tools for ${slug}:`, error);
    // Return empty array instead of throwing - similar tools are optional
    return [];
  }
}

/**
 * Create a review for a tool
 */
export async function createToolReview(data: {
  tool: number;
  rating: number;
  title?: string;
  content?: string;
  pros?: string[];
  cons?: string[];
  use_case?: string;
}): Promise<ToolReview> {
  const response = await api.post('/tool-reviews/', data);
  return response.data;
}

/**
 * Mark a review as helpful
 */
export async function markReviewHelpful(reviewId: number): Promise<{ helpfulCount: number }> {
  const response = await api.post(`/tool-reviews/${reviewId}/mark_helpful/`);
  return response.data;
}

/**
 * Toggle bookmark for a tool
 */
export async function toggleToolBookmark(toolId: number): Promise<ToggleBookmarkResponse> {
  const response = await api.post('/tool-bookmarks/toggle/', { tool_id: toolId });
  return response.data;
}

/**
 * Get user's bookmarked tools
 */
export async function getMyToolBookmarks(): Promise<ToolBookmark[]> {
  const response = await api.get('/tool-bookmarks/');
  return response.data;
}
