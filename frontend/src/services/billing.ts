/**
 * Billing API Service
 *
 * Handles all billing and subscription operations
 */

import { api } from './api';

// Types
export interface SubscriptionTier {
  slug: string;
  name: string;
  description: string;
  tierType: string;
  priceMonthly: number;
  priceAnnual: number;
  trialPeriodDays: number;
  monthlyAiRequests: number;
  features: {
    marketplace: boolean;
    go1Courses: boolean;
    aiMentor: boolean;
    quests: boolean;
    circles: boolean;
    projects: boolean;
    creatorTools: boolean;
    analytics: boolean;
  };
}

export interface UserSubscription {
  id: number;
  tier: SubscriptionTier;
  status: string;
  isActive: boolean;
  isTrial: boolean;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  aiRequestsUsedThisMonth: number;
}

export interface TokenPackage {
  id: number;
  slug: string;
  name: string;
  packageType: string;
  tokenAmount: number;
  price: string;
  description: string;
  isActive: boolean;
  stripePriceId: string | null;
}

export interface TokenBalance {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
}

export interface SubscriptionStatus {
  isAuthenticated: boolean;
  hasActiveSubscription: boolean;
  isTrial: boolean;
  tierName: string;
  tierSlug: string;
  tierType: string;
  features: {
    marketplace: boolean;
    go1Courses: boolean;
    aiMentor: boolean;
    quests: boolean;
    circles: boolean;
    projects: boolean;
    creatorTools: boolean;
    analytics: boolean;
  };
  aiRequests: {
    limit: number;
    used: number;
    remaining: number | null;
  };
  tokens: {
    balance: number;
  };
  subscriptionStatus: string;
  currentPeriodEnd: string;
}

// API Calls

/**
 * Get all available subscription tiers
 */
export async function getSubscriptionTiers(): Promise<SubscriptionTier[]> {
  const response = await api.get('/billing/tiers/');
  return response.data;
}

/**
 * Get user's current subscription
 * Note: This endpoint doesn't exist yet - use getSubscriptionStatus() instead
 */
export async function getUserSubscription(): Promise<UserSubscription> {
  const response = await api.get('/billing/subscription/');
  return response.data;
}

/**
 * Get user's subscription status
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const response = await api.get('/billing/status/');
  return response.data;
}

/**
 * Create a new subscription
 */
export async function createSubscription(
  tierSlug: string,
  billingInterval: 'monthly' | 'annual'
): Promise<{
  subscriptionId: string;
  clientSecret: string;
  status: string;
}> {
  const response = await api.post('/billing/subscriptions/create/', {
    tierSlug,
    billingInterval,
  });
  return response.data;
}

/**
 * Update subscription to a different tier
 */
export async function updateSubscription(tierSlug: string): Promise<{
  subscriptionId: string;
  status: string;
  message: string;
}> {
  const response = await api.post('/billing/subscriptions/update/', {
    tierSlug,
  });
  return response.data;
}

/**
 * Cancel subscription (at end of period)
 */
export async function cancelSubscription(): Promise<{
  subscriptionId: string;
  status: string;
  message: string;
  currentPeriodEnd: string;
}> {
  const response = await api.post('/billing/subscriptions/cancel/');
  return response.data;
}

/**
 * Get all available token packages
 */
export async function getTokenPackages(): Promise<TokenPackage[]> {
  const response = await api.get('/billing/packages/');
  return response.data;
}

/**
 * Get user's token balance
 */
export async function getTokenBalance(): Promise<TokenBalance> {
  const response = await api.get('/billing/tokens/balance/');
  return response.data;
}

/**
 * Purchase tokens
 */
export async function purchaseTokens(packageSlug: string): Promise<{
  purchaseId: string;
  clientSecret: string;
  amount: number;
  tokens: number;
}> {
  const response = await api.post('/billing/tokens/purchase/', {
    packageSlug,
  });
  return response.data;
}

/**
 * Get token transaction history
 */
export async function getTokenTransactions(): Promise<any[]> {
  const response = await api.get('/billing/tokens/transactions/');
  return response.data;
}
