/**
 * Tests for billing service
 *
 * These tests verify billing API calls work correctly.
 * Billing is critical - these tests help prevent revenue loss.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the api module
vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Import after mocking
import { api } from './api';
import {
  getSubscriptionTiers,
  getSubscriptionStatus,
  createSubscription,
  createCheckoutSession,
  cancelSubscription,
  getTokenPackages,
  getTokenBalance,
  purchaseTokens,
  getInvoices,
  createPortalSession,
  getCreditPacks,
  getCreditPackStatus,
  subscribeToCreditPack,
  cancelCreditPack,
} from './billing';

describe('billing service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getSubscriptionTiers', () => {
    it('fetches available tiers', async () => {
      const mockTiers = [
        { slug: 'free', name: 'Free', priceMonthly: 0 },
        { slug: 'pro', name: 'Pro', priceMonthly: 29 },
      ];
      (api.get as any).mockResolvedValue({ data: mockTiers });

      const result = await getSubscriptionTiers();

      expect(api.get).toHaveBeenCalledWith('/billing/tiers/');
      expect(result).toEqual(mockTiers);
    });
  });

  describe('getSubscriptionStatus', () => {
    it('fetches user subscription status', async () => {
      const mockStatus = {
        isAuthenticated: true,
        hasActiveSubscription: true,
        tierName: 'Pro',
        tierSlug: 'pro',
        features: { marketplace: true, aiMentor: true },
      };
      (api.get as any).mockResolvedValue({ data: mockStatus });

      const result = await getSubscriptionStatus();

      expect(api.get).toHaveBeenCalledWith('/billing/status/');
      expect(result).toEqual(mockStatus);
    });
  });

  describe('createSubscription', () => {
    it('creates subscription with correct payload', async () => {
      const mockResponse = {
        subscription_id: 'sub_123',
        client_secret: 'pi_secret_abc',
        status: 'active',
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await createSubscription('pro', 'monthly');

      expect(api.post).toHaveBeenCalledWith('/billing/subscriptions/create/', {
        tier_slug: 'pro',
        billing_interval: 'monthly',
      });
      expect(result).toEqual({
        subscriptionId: 'sub_123',
        clientSecret: 'pi_secret_abc',
        status: 'active',
      });
    });

    it('handles annual billing interval', async () => {
      const mockResponse = {
        subscription_id: 'sub_456',
        client_secret: 'pi_secret_def',
        status: 'active',
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      await createSubscription('enterprise', 'annual');

      expect(api.post).toHaveBeenCalledWith('/billing/subscriptions/create/', {
        tier_slug: 'enterprise',
        billing_interval: 'annual',
      });
    });
  });

  describe('createCheckoutSession', () => {
    it('creates checkout session without credit pack', async () => {
      const mockResponse = {
        session_id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await createCheckoutSession(
        'pro',
        'monthly',
        'https://example.com/success',
        'https://example.com/cancel'
      );

      expect(api.post).toHaveBeenCalledWith('/billing/checkout/create/', {
        tier_slug: 'pro',
        billing_interval: 'monthly',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      });
      expect(result).toEqual({
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      });
    });

    it('creates checkout session with credit pack', async () => {
      const mockResponse = {
        session_id: 'cs_test_456',
        url: 'https://checkout.stripe.com/pay/cs_test_456',
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      await createCheckoutSession(
        'pro',
        'annual',
        'https://example.com/success',
        'https://example.com/cancel',
        5 // credit pack ID
      );

      expect(api.post).toHaveBeenCalledWith('/billing/checkout/create/', {
        tier_slug: 'pro',
        billing_interval: 'annual',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        credit_pack_id: 5,
      });
    });

    it('does not include credit_pack_id when null', async () => {
      (api.post as any).mockResolvedValue({ data: { session_id: 'cs_test', url: 'https://...' } });

      await createCheckoutSession(
        'pro',
        'monthly',
        'https://example.com/success',
        'https://example.com/cancel',
        null
      );

      const payload = (api.post as any).mock.calls[0][1];
      expect(payload).not.toHaveProperty('credit_pack_id');
    });
  });

  describe('cancelSubscription', () => {
    it('cancels at period end by default', async () => {
      const mockResponse = {
        subscriptionId: 'sub_123',
        status: 'active',
        cancelAtPeriodEnd: true,
        periodEnd: '2024-12-31T00:00:00Z',
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await cancelSubscription();

      expect(api.post).toHaveBeenCalledWith('/billing/subscriptions/cancel/', {
        immediate: false,
      });
      expect(result.cancelAtPeriodEnd).toBe(true);
    });

    it('cancels immediately when specified', async () => {
      const mockResponse = {
        subscriptionId: 'sub_123',
        status: 'canceled',
        cancelAtPeriodEnd: false,
        periodEnd: '2024-01-15T00:00:00Z',
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await cancelSubscription(true);

      expect(api.post).toHaveBeenCalledWith('/billing/subscriptions/cancel/', {
        immediate: true,
      });
      expect(result.status).toBe('canceled');
    });
  });

  describe('token packages', () => {
    it('fetches token packages', async () => {
      const mockPackages = [
        { slug: 'starter', tokenAmount: 1000, price: '9.99' },
        { slug: 'pro', tokenAmount: 5000, price: '39.99' },
      ];
      (api.get as any).mockResolvedValue({ data: mockPackages });

      const result = await getTokenPackages();

      expect(api.get).toHaveBeenCalledWith('/billing/packages/');
      expect(result).toEqual(mockPackages);
    });

    it('fetches token balance', async () => {
      const mockBalance = {
        balance: 500,
        totalPurchased: 1000,
        totalUsed: 500,
      };
      (api.get as any).mockResolvedValue({ data: mockBalance });

      const result = await getTokenBalance();

      expect(api.get).toHaveBeenCalledWith('/billing/tokens/balance/');
      expect(result).toEqual(mockBalance);
    });

    it('purchases tokens', async () => {
      const mockResponse = {
        purchase_id: 42,
        client_secret: 'pi_secret_token',
        amount: 999, // cents
        token_amount: 1000,
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await purchaseTokens('starter');

      expect(api.post).toHaveBeenCalledWith('/billing/tokens/purchase/', {
        package_slug: 'starter',
      });
      expect(result).toEqual({
        purchaseId: 42,
        clientSecret: 'pi_secret_token',
        amount: 999,
        tokenAmount: 1000,
      });
    });
  });

  describe('invoices', () => {
    it('fetches invoices with default limit', async () => {
      const mockInvoices = {
        invoices: [{ id: 'in_123', amountPaid: 2900 }],
        hasMore: false,
      };
      (api.get as any).mockResolvedValue({ data: mockInvoices });

      const result = await getInvoices();

      expect(api.get).toHaveBeenCalledWith('/billing/invoices/?limit=10');
      expect(result).toEqual(mockInvoices);
    });

    it('fetches invoices with custom limit', async () => {
      (api.get as any).mockResolvedValue({ data: { invoices: [], hasMore: false } });

      await getInvoices(50);

      expect(api.get).toHaveBeenCalledWith('/billing/invoices/?limit=50');
    });
  });

  describe('portal session', () => {
    it('creates portal session without return URL', async () => {
      const mockResponse = { url: 'https://billing.stripe.com/session/test' };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await createPortalSession();

      expect(api.post).toHaveBeenCalledWith('/billing/portal/', { return_url: undefined });
      expect(result.url).toBe('https://billing.stripe.com/session/test');
    });

    it('creates portal session with return URL', async () => {
      const mockResponse = { url: 'https://billing.stripe.com/session/test' };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      await createPortalSession('https://example.com/account');

      expect(api.post).toHaveBeenCalledWith('/billing/portal/', {
        return_url: 'https://example.com/account',
      });
    });
  });

  describe('credit packs', () => {
    it('fetches credit packs', async () => {
      const mockPacks = [
        { id: 1, name: 'Starter Pack', creditsPerMonth: 100, priceDollars: 10 },
        { id: 2, name: 'Pro Pack', creditsPerMonth: 500, priceDollars: 40 },
      ];
      (api.get as any).mockResolvedValue({ data: mockPacks });

      const result = await getCreditPacks();

      expect(api.get).toHaveBeenCalledWith('/billing/credit-packs/');
      expect(result).toEqual(mockPacks);
    });

    it('fetches credit pack status', async () => {
      const mockStatus = {
        hasCreditPack: true,
        creditPack: { id: 1, name: 'Starter' },
        creditPackBalance: 75,
      };
      (api.get as any).mockResolvedValue({ data: mockStatus });

      const result = await getCreditPackStatus();

      expect(api.get).toHaveBeenCalledWith('/billing/credit-pack/status/');
      expect(result).toEqual(mockStatus);
    });

    it('subscribes to credit pack', async () => {
      const mockResponse = {
        success: true,
        subscription_id: 'sub_credit_123',
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await subscribeToCreditPack(5);

      expect(api.post).toHaveBeenCalledWith('/billing/credit-pack/subscribe/', {
        credit_pack_id: 5,
      });
      expect(result).toEqual({
        success: true,
        subscriptionId: 'sub_credit_123',
      });
    });

    it('cancels credit pack', async () => {
      const mockResponse = {
        success: true,
        message: 'Credit pack subscription canceled',
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await cancelCreditPack();

      expect(api.post).toHaveBeenCalledWith('/billing/credit-pack/cancel/');
      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('propagates API errors', async () => {
      const error = new Error('Network error');
      (api.get as any).mockRejectedValue(error);

      await expect(getSubscriptionStatus()).rejects.toThrow('Network error');
    });

    it('handles 401 errors', async () => {
      const error = { response: { status: 401, data: { message: 'Unauthorized' } } };
      (api.get as any).mockRejectedValue(error);

      await expect(getSubscriptionStatus()).rejects.toEqual(error);
    });

    it('handles payment declined errors', async () => {
      const error = { response: { status: 402, data: { message: 'Card declined' } } };
      (api.post as any).mockRejectedValue(error);

      await expect(createSubscription('pro', 'monthly')).rejects.toEqual(error);
    });
  });
});
