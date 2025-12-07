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
  currentPeriodStart?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface Invoice {
  id: string;
  number: string | null;
  amount_paid: number | null;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  created: number;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
}

export interface InvoicesResponse {
  invoices: Invoice[];
  has_more: boolean;
}

export interface PortalSessionResponse {
  url: string;
}

export interface TokenTransaction {
  id: number;
  transactionType: 'purchase' | 'usage' | 'refund' | 'bonus';
  amount: number;
  balanceAfter: number;
  description: string;
  aiProvider: string | null;
  aiModel: string | null;
  createdAt: string;
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
    // Backend expects snake_case
    tier_slug: tierSlug,
    billing_interval: billingInterval,
  });
  // Backend returns snake_case, transform to camelCase
  const data = response.data;
  return {
    subscriptionId: data.subscription_id,
    clientSecret: data.client_secret,
    status: data.status,
  };
}

/**
 * Create a Stripe Checkout Session
 */
export async function createCheckoutSession(
  tierSlug: string,
  billingInterval: 'monthly' | 'annual',
  successUrl: string,
  cancelUrl: string
): Promise<{
  sessionId: string;
  url: string;
}> {
  const response = await api.post('/billing/checkout/create/', {
    tier_slug: tierSlug,
    billing_interval: billingInterval,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return {
    sessionId: response.data.session_id,
    url: response.data.url,
  };
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
 * Cancel subscription
 * @param immediate - If true, cancel immediately. If false (default), cancel at end of billing period.
 */
export async function cancelSubscription(immediate = false): Promise<{
  subscription_id: string;
  status: string;
  cancel_at_period_end: boolean;
  period_end: string;
}> {
  const response = await api.post('/billing/subscriptions/cancel/', { immediate });
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
  purchaseId: number;
  clientSecret: string;
  amount: number;
  tokenAmount: number;
}> {
  const response = await api.post('/billing/tokens/purchase/', {
    package_slug: packageSlug, // Backend expects snake_case
  });
  // Transform response from snake_case to camelCase
  const data = response.data;
  return {
    purchaseId: data.purchase_id,
    clientSecret: data.client_secret,
    amount: data.amount,
    tokenAmount: data.token_amount,
  };
}

/**
 * Get token transaction history
 */
export async function getTokenTransactions(): Promise<TokenTransaction[]> {
  const response = await api.get('/billing/tokens/transactions/');
  return response.data;
}

/**
 * Get invoices from Stripe
 */
export async function getInvoices(limit = 10): Promise<InvoicesResponse> {
  const response = await api.get(`/billing/invoices/?limit=${limit}`);
  return response.data;
}

/**
 * Create a Stripe Customer Portal session for managing payment methods
 */
export async function createPortalSession(returnUrl?: string): Promise<PortalSessionResponse> {
  const response = await api.post('/billing/portal/', { return_url: returnUrl });
  return response.data;
}

/**
 * Reactivate a canceled subscription (if still in the grace period)
 * This clears the cancel_at_period_end flag
 */
export async function reactivateSubscription(): Promise<{
  subscription_id: string;
  status: string;
}> {
  // Reactivating is done by updating to the same tier with cancel_at_period_end=false
  // We'll use the update endpoint which clears the cancellation
  const response = await api.post('/billing/subscriptions/update/', {});
  return response.data;
}
