/**
 * Marketplace API Service
 *
 * Handles all marketplace-related API calls including:
 * - Creator account management
 * - Product CRUD operations
 * - YouTube import
 * - Orders and sales
 * - Public marketplace browsing
 */

import { api } from './api';
import type {
  CreatorAccount,
  CreatorDashboardStats,
  MarketplaceBrowseParams,
  MarketplaceBrowseResponse,
  Order,
  ProductAccess,
  ProductCreatePayload,
  ProductDetail,
  ProductListItem,
  ProductUpdatePayload,
  YouTubeImportRequest,
  YouTubeImportResponse,
} from '@/types/marketplace';

// =============================================================================
// Creator Account API
// =============================================================================

/**
 * Get the current user's creator account status
 */
export async function getCreatorAccount(): Promise<CreatorAccount | null> {
  try {
    const response = await api.get<CreatorAccount>('/marketplace/creator/');
    return response.data;
  } catch (error: unknown) {
    // 404 means no creator account exists
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Create or get a creator account for the current user
 */
export async function createCreatorAccount(): Promise<CreatorAccount> {
  const response = await api.post<CreatorAccount>('/marketplace/creator/');
  return response.data;
}

/**
 * Get creator dashboard statistics
 */
export async function getCreatorDashboard(): Promise<CreatorDashboardStats> {
  const response = await api.get<CreatorDashboardStats>('/marketplace/creator/dashboard/');
  return response.data;
}

// =============================================================================
// Product CRUD API
// =============================================================================

/**
 * List all products owned by the current user
 */
export async function listMyProducts(): Promise<ProductListItem[]> {
  const response = await api.get<ProductListItem[] | { results: ProductListItem[] }>('/marketplace/products/');
  // Handle both paginated and non-paginated responses
  const data = response.data;
  return Array.isArray(data) ? data : (data.results || []);
}

/**
 * Get a single product by ID (must be owned by current user)
 */
export async function getProduct(productId: number): Promise<ProductDetail> {
  const response = await api.get<ProductDetail>(`/marketplace/products/${productId}/`);
  return response.data;
}

/**
 * Create a new product
 */
export async function createProduct(payload: ProductCreatePayload): Promise<ProductDetail> {
  const response = await api.post<ProductDetail>('/marketplace/products/', payload);
  return response.data;
}

/**
 * Update an existing product
 */
export async function updateProduct(
  productId: number,
  payload: ProductUpdatePayload
): Promise<ProductDetail> {
  const response = await api.patch<ProductDetail>(`/marketplace/products/${productId}/`, payload);
  return response.data;
}

/**
 * Archive a product (soft delete)
 */
export async function archiveProduct(productId: number): Promise<void> {
  await api.delete(`/marketplace/products/${productId}/`);
}

/**
 * Publish a draft product to the marketplace
 */
export async function publishProduct(productId: number): Promise<ProductDetail> {
  const response = await api.post<ProductDetail>(`/marketplace/products/${productId}/publish/`);
  return response.data;
}

/**
 * Archive a published product (hide from marketplace)
 */
export async function unpublishProduct(productId: number): Promise<ProductDetail> {
  const response = await api.post<ProductDetail>(`/marketplace/products/${productId}/archive/`);
  return response.data;
}

// =============================================================================
// YouTube Import API
// =============================================================================

/**
 * Import a YouTube video and generate a course product
 */
export async function importFromYouTube(
  request: YouTubeImportRequest
): Promise<YouTubeImportResponse> {
  const response = await api.post<YouTubeImportResponse>('/marketplace/import/youtube/', request);
  return response.data;
}

// =============================================================================
// Orders & Sales API
// =============================================================================

/**
 * Get the current user's purchased products (library)
 */
export async function getMyLibrary(): Promise<ProductAccess[]> {
  const response = await api.get<ProductAccess[]>('/marketplace/library/');
  return response.data;
}

/**
 * Get sales/orders for the creator
 */
export async function getCreatorSales(status?: string): Promise<Order[]> {
  const params = status ? `?status=${status}` : '';
  const response = await api.get<Order[]>(`/marketplace/creator/sales/${params}`);
  return response.data;
}

// =============================================================================
// Public Marketplace API
// =============================================================================

/**
 * Browse published products in the marketplace
 */
export async function browseMarketplace(
  params?: MarketplaceBrowseParams
): Promise<MarketplaceBrowseResponse> {
  const searchParams = new URLSearchParams();

  if (params?.type) {
    searchParams.append('type', params.type);
  }
  if (params?.featured !== undefined) {
    searchParams.append('featured', params.featured.toString());
  }
  if (params?.creator) {
    searchParams.append('creator', params.creator);
  }
  if (params?.limit !== undefined) {
    searchParams.append('limit', params.limit.toString());
  }
  if (params?.offset !== undefined) {
    searchParams.append('offset', params.offset.toString());
  }

  const queryString = searchParams.toString();
  const url = queryString ? `/marketplace/browse/?${queryString}` : '/marketplace/browse/';

  const response = await api.get<MarketplaceBrowseResponse>(url);
  return response.data;
}

/**
 * Get public product details by creator username and slug
 */
export async function getPublicProduct(
  username: string,
  slug: string
): Promise<ProductDetail> {
  const response = await api.get<ProductDetail>(`/marketplace/${username}/${slug}/`);
  return response.data;
}

// =============================================================================
// Convenience Methods
// =============================================================================

/**
 * Check if the current user has a creator account
 */
export async function hasCreatorAccount(): Promise<boolean> {
  const account = await getCreatorAccount();
  return account !== null;
}

/**
 * Check if the current user's creator account is fully onboarded (Stripe ready)
 */
export async function isCreatorOnboarded(): Promise<boolean> {
  const account = await getCreatorAccount();
  return account?.isOnboarded ?? false;
}

// =============================================================================
// Stripe Connect API (Creator Onboarding)
// =============================================================================

export interface StripeConnectStatus {
  exists: boolean;
  accountId?: string;
  isOnboarded: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted?: boolean;
  requirements?: unknown;
}

export interface StripeOnboardingResponse {
  onboardingUrl: string;
  message: string;
}

export interface StripeDashboardResponse {
  dashboardUrl: string;
}

/**
 * Start Stripe Connect onboarding process
 * Returns a URL to redirect the user to Stripe's onboarding flow
 */
export async function startStripeOnboarding(
  returnUrl?: string,
  refreshUrl?: string
): Promise<StripeOnboardingResponse> {
  const response = await api.post<StripeOnboardingResponse>('/marketplace/connect/onboard/', {
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });
  return response.data;
}

/**
 * Check Stripe Connect account status
 */
export async function getStripeConnectStatus(): Promise<StripeConnectStatus> {
  const response = await api.get<StripeConnectStatus>('/marketplace/connect/onboard/');
  return response.data;
}

/**
 * Get link to Stripe Express dashboard
 */
export async function getStripeDashboardLink(): Promise<string> {
  const response = await api.get<StripeDashboardResponse>('/marketplace/connect/dashboard/');
  return response.data.dashboardUrl;
}

// =============================================================================
// Checkout API (Product Purchases)
// =============================================================================

export interface CheckoutResponse {
  clientSecret: string;
  orderId: number;
  amount: number;
  currency: string;
  platformFee: number;
  product: {
    id: number;
    title: string;
    creator: string;
  };
}

export interface OrderStatus {
  id: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  amountPaid: number;
  platformFee: number;
  creatorPayout: number;
  currency: string;
  createdAt: string;
  product: {
    id: number;
    title: string;
  };
  buyer?: string;
  hasAccess: boolean;
}

export interface FreeAccessResponse {
  success: boolean;
  message: string;
  productId: number;
}

/**
 * Create a checkout session for purchasing a product
 * Returns a client_secret for Stripe Elements
 */
export async function createProductCheckout(productId: number): Promise<CheckoutResponse> {
  const response = await api.post<CheckoutResponse>(`/marketplace/checkout/${productId}/`);
  return response.data;
}

/**
 * Get access to a free product
 */
export async function claimFreeProduct(productId: number): Promise<FreeAccessResponse> {
  const response = await api.post<FreeAccessResponse>(`/marketplace/checkout/${productId}/free/`);
  return response.data;
}

/**
 * Get order status
 */
export async function getOrderStatus(orderId: number): Promise<OrderStatus> {
  const response = await api.get<OrderStatus>(`/marketplace/orders/${orderId}/`);
  return response.data;
}

/**
 * Check if user has access to a product
 */
export async function hasProductAccess(productId: number): Promise<boolean> {
  try {
    const library = await getMyLibrary();
    return library.some(access => access.product?.id === productId);
  } catch {
    return false;
  }
}
