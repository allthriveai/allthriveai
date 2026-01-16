/**
 * API service for Listings (The Collective - Asks & Offers)
 */

import { api } from './api';
import type { PaginatedResponse } from '@/types/models';
import type {
  Listing,
  ListingCard,
  ListingPayload,
  ListingComment,
  ListingVersion,
  ToggleResponse,
} from '@/types/listings';

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get paginated list of listings with optional filters
 */
export async function getListings(params?: {
  intent?: 'ask' | 'offer';
  listingType?: string;
  category?: string;
  username?: string;
  available?: boolean;
  paid?: boolean;
  page?: number;
  search?: string;
  ordering?: string;
}): Promise<PaginatedResponse<ListingCard>> {
  const response = await api.get<PaginatedResponse<ListingCard>>('/listings/', { params });
  return response.data;
}

/**
 * Get a single listing by ID
 */
export async function getListing(id: number, source?: string): Promise<Listing> {
  const params = source ? { source } : undefined;
  const response = await api.get<Listing>(`/listings/${id}/`, { params });
  return response.data;
}

/**
 * Get a listing by username and slug
 */
export async function getListingBySlug(username: string, slug: string): Promise<Listing> {
  // First get the listing ID from the user's listings
  const response = await api.get<PaginatedResponse<ListingCard>>('/listings/', {
    params: { username, slug },
  });

  if (response.data.results.length === 0) {
    throw new Error('Listing not found');
  }

  // Fetch full listing details
  return getListing(response.data.results[0].id);
}

/**
 * Create a new listing
 */
export async function createListing(payload: ListingPayload): Promise<Listing> {
  const response = await api.post<Listing>('/listings/', payload);
  return response.data;
}

/**
 * Update an existing listing
 */
export async function updateListing(id: number, payload: ListingPayload): Promise<Listing> {
  const response = await api.patch<Listing>(`/listings/${id}/`, payload);
  return response.data;
}

/**
 * Delete a listing
 */
export async function deleteListing(id: number): Promise<void> {
  await api.delete(`/listings/${id}/`);
}

// ============================================================================
// Publishing Actions
// ============================================================================

/**
 * Publish a draft listing
 */
export async function publishListing(id: number): Promise<Listing> {
  const response = await api.post<Listing>(`/listings/${id}/publish/`);
  return response.data;
}

/**
 * Archive a listing (soft delete)
 */
export async function archiveListing(id: number): Promise<{ archived: boolean }> {
  const response = await api.post<{ archived: boolean }>(`/listings/${id}/archive/`);
  return response.data;
}

// ============================================================================
// Engagement Actions
// ============================================================================

/**
 * Toggle heart on a listing
 */
export async function toggleListingHeart(id: number): Promise<ToggleResponse> {
  const response = await api.post<ToggleResponse>(`/listings/${id}/heart/`);
  return response.data;
}

/**
 * Toggle save/bookmark on a listing
 */
export async function toggleListingSave(id: number, note?: string): Promise<ToggleResponse> {
  const response = await api.post<ToggleResponse>(`/listings/${id}/save/`, { note });
  return response.data;
}

// ============================================================================
// Comments
// ============================================================================

/**
 * Get comments for a listing
 */
export async function getListingComments(listingId: number): Promise<ListingComment[]> {
  const response = await api.get<ListingComment[]>(`/listings/${listingId}/comments/`);
  return response.data;
}

/**
 * Add a comment to a listing
 */
export async function addListingComment(
  listingId: number,
  body: string,
  parentId?: number
): Promise<ListingComment> {
  const response = await api.post<ListingComment>(`/listings/${listingId}/comments/`, {
    body,
    parent: parentId,
  });
  return response.data;
}

// ============================================================================
// Version History
// ============================================================================

/**
 * Get version history for a listing
 */
export async function getListingVersions(listingId: number): Promise<ListingVersion[]> {
  const response = await api.get<ListingVersion[]>(`/listings/${listingId}/versions/`);
  return response.data;
}

// ============================================================================
// User-specific Listings
// ============================================================================

/**
 * Get all listings for a specific user
 */
export async function getUserListings(username: string): Promise<ListingCard[]> {
  const response = await api.get<ListingCard[]>(`/users/${username}/listings/`);
  return response.data;
}

/**
 * Get asks for a specific user
 */
export async function getUserAsks(username: string): Promise<ListingCard[]> {
  const response = await api.get<ListingCard[]>(`/users/${username}/listings/asks/`);
  return response.data;
}

/**
 * Get offers for a specific user
 */
export async function getUserOffers(username: string): Promise<ListingCard[]> {
  const response = await api.get<ListingCard[]>(`/users/${username}/listings/offers/`);
  return response.data;
}

// ============================================================================
// Listing Types (Taxonomy)
// ============================================================================

/**
 * Get all listing types
 */
export async function getListingTypes(): Promise<
  Array<{
    id: number;
    name: string;
    slug: string;
    description: string;
  }>
> {
  const response = await api.get('/taxonomies/', {
    params: { taxonomy_type: 'listing_type', is_active: true },
  });
  return response.data.results || response.data;
}
