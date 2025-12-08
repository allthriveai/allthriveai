import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { Modal } from '@/components/ui/Modal';
import { BuyTokensModal } from '@/components/billing';
import {
  getSubscriptionStatus,
  getTokenBalance,
  getInvoices,
  cancelSubscription,
  reactivateSubscription,
  createPortalSession,
} from '@/services/billing';
import type { SubscriptionStatus, TokenBalance, Invoice } from '@/services/billing';
import type { ApiError } from '@/types/api';

// Status badge component
function StatusBadge({ status, cancelAtPeriodEnd }: { status?: string; cancelAtPeriodEnd?: boolean }) {
  if (cancelAtPeriodEnd) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
        Canceling
      </span>
    );
  }

  const statusStyles: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    trialing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    canceled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    past_due: 'bg-red-500/20 text-red-400 border-red-500/30',
    incomplete: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  const safeStatus = status || 'active';
  const style = statusStyles[safeStatus] || statusStyles.active;

  const formatStatus = (s: string) => {
    if (s === 'active') return 'Active';
    return s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ');
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {formatStatus(safeStatus)}
    </span>
  );
}

// Subscription Card component
function SubscriptionCard({
  subscription,
  onCancelClick,
  onUpgradeClick,
  onManagePayment,
  onReactivateClick,
  isReactivating,
  isManagingPayment,
}: {
  subscription: SubscriptionStatus | null;
  onCancelClick: () => void;
  onUpgradeClick: () => void;
  onManagePayment: () => void;
  onReactivateClick: () => void;
  isReactivating: boolean;
  isManagingPayment: boolean;
}) {
  if (!subscription) {
    return (
      <div className="glass-strong rounded p-6 border border-white/20">
        <div className="animate-pulse">
          <div className="h-6 w-32 bg-slate-700 rounded mb-4"></div>
          <div className="h-4 w-48 bg-slate-700 rounded mb-2"></div>
          <div className="h-4 w-40 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  const isFree = subscription.tierType === 'free';
  const isCanceling = subscription.cancelAtPeriodEnd;
  const hasStripeCustomer = subscription.hasStripeCustomer ?? false;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="glass-strong rounded p-6 border border-white/20">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-1">
            Current Plan
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-slate-100">{subscription.tierName}</span>
            {!isFree && (
              <StatusBadge
                status={subscription.subscriptionStatus}
                cancelAtPeriodEnd={isCanceling}
              />
            )}
          </div>
        </div>
      </div>

      {isCanceling && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-400">
                  Your subscription will end on {formatDate(subscription.currentPeriodEnd)}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  You'll continue to have access until then.
                </p>
              </div>
            </div>
            <button
              onClick={onReactivateClick}
              disabled={isReactivating}
              className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
              {isReactivating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Reactivating...
                </>
              ) : (
                'Keep Subscription'
              )}
            </button>
          </div>
        </div>
      )}

      {!isFree && subscription.currentPeriodEnd && (
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Current period ends</span>
            <span className="text-slate-200">{formatDate(subscription.currentPeriodEnd)}</span>
          </div>
          {subscription.aiRequests && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">AI requests this month</span>
              <span className="text-slate-200">
                {subscription.aiRequests.used.toLocaleString()} / {subscription.aiRequests.limit === -1 ? 'Unlimited' : subscription.aiRequests.limit.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {isFree ? (
          <button
            onClick={onUpgradeClick}
            className="px-4 py-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-lg font-medium hover:from-primary-600 hover:to-accent-600 transition-all"
          >
            Upgrade Plan
          </button>
        ) : (
          <>
            <button
              onClick={onUpgradeClick}
              className="px-4 py-2 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-lg font-medium hover:bg-primary-500/30 transition-all"
            >
              Change Plan
            </button>
            {hasStripeCustomer && (
              <>
                <button
                  onClick={onManagePayment}
                  disabled={isManagingPayment}
                  className="px-4 py-2 bg-slate-700/50 text-slate-300 border border-slate-600 rounded-lg font-medium hover:bg-slate-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isManagingPayment ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Opening...
                    </>
                  ) : (
                    'Manage Payment'
                  )}
                </button>
                {!isCanceling && (
                  <button
                    onClick={onCancelClick}
                    className="px-4 py-2 text-slate-400 hover:text-red-400 transition-colors text-sm"
                  >
                    Cancel Subscription
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Token Balance Card component
function TokenBalanceCard({
  balance,
  onBuyTokens,
}: {
  balance: TokenBalance | null;
  onBuyTokens: () => void;
}) {
  if (!balance) {
    return (
      <div className="glass-strong rounded p-6 border border-white/20">
        <div className="animate-pulse">
          <div className="h-6 w-32 bg-slate-700 rounded mb-4"></div>
          <div className="h-8 w-24 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded p-6 border border-white/20">
      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
        Token Balance
      </h3>
      <div className="mb-4">
        <div className="text-3xl font-bold text-slate-100 mb-1">
          {balance.balance.toLocaleString()}
        </div>
        <div className="text-sm text-slate-400">tokens remaining</div>
      </div>
      <div className="text-sm text-slate-400 mb-4">
        Total used: {balance.totalUsed.toLocaleString()}
      </div>
      <button
        onClick={onBuyTokens}
        className="w-full px-4 py-2 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-lg font-medium hover:bg-primary-500/30 transition-all"
      >
        Buy More Tokens
      </button>
    </div>
  );
}

// Invoice List component
function InvoiceList({ invoices, loading }: { invoices: Invoice[]; loading: boolean }) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatAmount = (amount: number | null | undefined, currency: string) => {
    // Handle null, undefined, or NaN amounts (e.g., free trials)
    const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    const safeCurrency = currency || 'usd';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency.toUpperCase(),
    }).format(safeAmount / 100);
  };

  if (loading) {
    return (
      <div className="glass-strong rounded p-6 border border-white/20">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
          Invoices
        </h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded p-6 border border-white/20">
      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
        Invoices
      </h3>
      {invoices.length === 0 ? (
        <p className="text-slate-400 text-sm">No invoices yet</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0"
            >
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-300">{formatDate(invoice.created)}</span>
                <span className="text-sm font-medium text-slate-100">
                  {formatAmount(invoice.amount_paid, invoice.currency)}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    invoice.status === 'paid'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : invoice.status === 'open'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-slate-500/20 text-slate-400'
                  }`}
                >
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </span>
              </div>
              {invoice.invoice_pdf && (
                <a
                  href={invoice.invoice_pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Cancel Subscription Modal
function CancelSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  periodEnd,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  periodEnd: string;
  isLoading: boolean;
}) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'the end of your billing period';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel Subscription" className="max-w-lg">
      <div className="space-y-4">
        <p className="text-slate-300">
          Are you sure you want to cancel your subscription?
        </p>
        <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-slate-300">
              You'll continue to have access until <strong className="text-slate-100">{formatDate(periodEnd)}</strong>
            </p>
          </div>
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-slate-300">
              After that, you'll be downgraded to the free tier
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-slate-700/50 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-all disabled:opacity-50"
          >
            Keep Subscription
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-medium hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Canceling...
              </>
            ) : (
              'Cancel Subscription'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function BillingSettingsPage() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [buyTokensModalOpen, setBuyTokensModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusData, balanceData] = await Promise.all([
        getSubscriptionStatus(),
        getTokenBalance(),
      ]);
      setSubscription(statusData);
      setTokenBalance(balanceData);
    } catch (err) {
      console.error('Failed to load billing data:', err);
      setError('Failed to load billing information. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    try {
      setInvoicesLoading(true);
      const data = await getInvoices(10);
      setInvoices(data.invoices);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadInvoices();
  }, [loadData, loadInvoices]);

  const handleCancelSubscription = async () => {
    try {
      setCancelLoading(true);
      await cancelSubscription(false); // Cancel at period end
      setCancelModalOpen(false);
      await loadData(); // Refresh data
    } catch (err) {
      const errorMessage = (err as ApiError)?.error || 'Failed to cancel subscription. Please try again.';
      console.error('Failed to cancel subscription:', errorMessage);
      setError(errorMessage);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleManagePayment = async () => {
    try {
      setPortalLoading(true);
      setError(null);
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (err) {
      const errorMessage = (err as ApiError)?.error || 'Failed to open payment management. Please try again.';
      console.error('Failed to open payment portal:', errorMessage);
      setError(errorMessage);
      setPortalLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setReactivateLoading(true);
      setError(null);
      await reactivateSubscription();
      await loadData(); // Refresh data
    } catch (err) {
      const errorMessage = (err as ApiError)?.error || 'Failed to reactivate subscription. Please try again.';
      console.error('Failed to reactivate subscription:', errorMessage);
      setError(errorMessage);
    } finally {
      setReactivateLoading(false);
    }
  };

  const handleUpgrade = () => {
    window.location.href = '/pricing';
  };

  const handleBuyTokens = () => {
    setBuyTokensModalOpen(true);
  };

  const handleTokenPurchaseSuccess = async () => {
    // Refresh token balance after successful purchase
    await loadData();
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          <div className="max-w-2xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Billing & Subscription
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Manage your subscription, payment methods, and view invoices
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="space-y-6">
                <div className="glass-strong rounded p-6 border border-white/20 animate-pulse">
                  <div className="h-6 w-32 bg-slate-700 rounded mb-4"></div>
                  <div className="h-8 w-48 bg-slate-700 rounded mb-4"></div>
                  <div className="h-4 w-64 bg-slate-700 rounded"></div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <SubscriptionCard
                  subscription={subscription}
                  onCancelClick={() => setCancelModalOpen(true)}
                  onUpgradeClick={handleUpgrade}
                  onManagePayment={handleManagePayment}
                  onReactivateClick={handleReactivateSubscription}
                  isReactivating={reactivateLoading}
                  isManagingPayment={portalLoading}
                />

                <TokenBalanceCard balance={tokenBalance} onBuyTokens={handleBuyTokens} />

                <InvoiceList invoices={invoices} loading={invoicesLoading} />

                {/* Payment Method Section - only show if user has Stripe customer */}
                {subscription?.hasStripeCustomer && (
                  <div className="glass-strong rounded p-6 border border-white/20">
                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
                      Payment Method
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">
                      Manage your payment methods, update card details, or change billing address through the Stripe Customer Portal.
                    </p>
                    <button
                      onClick={handleManagePayment}
                      className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      Manage Payment Methods
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <CancelSubscriptionModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          onConfirm={handleCancelSubscription}
          periodEnd={subscription?.currentPeriodEnd || ''}
          isLoading={cancelLoading}
        />

        <BuyTokensModal
          isOpen={buyTokensModalOpen}
          onClose={() => setBuyTokensModalOpen(false)}
          onSuccess={handleTokenPurchaseSuccess}
        />
      </SettingsLayout>
    </DashboardLayout>
  );
}
