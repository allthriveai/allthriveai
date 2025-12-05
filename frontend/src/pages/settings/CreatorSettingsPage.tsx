/**
 * Creator Settings Page
 *
 * Allows users with creator/mentor roles to manage their creator account,
 * view dashboard stats, and manage products.
 *
 * Users without creator role see a prompt to request creator access.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/models';
import {
  getCreatorAccount,
  createCreatorAccount,
  getCreatorDashboard,
  listMyProducts,
} from '@/services/marketplace';
import type {
  CreatorAccount,
  CreatorDashboardStats,
  ProductListItem,
} from '@/types/marketplace';
import {
  CheckCircleIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
  ChartBarIcon,
  PlusIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';

// Roles that have access to creator features
const CREATOR_ROLES: UserRole[] = ['creator', 'mentor', 'admin'];

// Check if a role has creator access
function hasCreatorAccess(role?: UserRole): boolean {
  return role ? CREATOR_ROLES.includes(role) : false;
}

// Status badge for onboarding status
function OnboardingBadge({ status, isOnboarded }: { status: string; isOnboarded: boolean }) {
  if (isOnboarded) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <CheckCircleIcon className="w-3.5 h-3.5" />
        Ready to Sell
      </span>
    );
  }

  const statusStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
    not_started: {
      bg: 'bg-slate-500/20',
      text: 'text-slate-400',
      border: 'border-slate-500/30',
      label: 'Not Started',
    },
    pending: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      label: 'Pending',
    },
    restricted: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      border: 'border-red-500/30',
      label: 'Restricted',
    },
  };

  const style = statusStyles[status] || statusStyles.not_started;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text} border ${style.border}`}>
      {style.label}
    </span>
  );
}

// Stats card component
function StatsCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: typeof ChartBarIcon;
  subtitle?: string;
}) {
  return (
    <div className="glass-strong rounded-xl p-5 border border-white/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-100">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="p-2 rounded-lg bg-primary-500/10">
          <Icon className="w-5 h-5 text-primary-400" />
        </div>
      </div>
    </div>
  );
}

// Request creator access prompt for non-creators
function RequestCreatorAccess() {
  return (
    <div className="glass-strong rounded-xl p-8 border border-white/20 text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-500/20 to-cyan-500/20 flex items-center justify-center">
        <SparklesIcon className="w-10 h-10 text-primary-400" />
      </div>

      <h2 className="text-2xl font-bold text-slate-100 mb-3">
        Become a Creator or Mentor
      </h2>

      <p className="text-slate-400 mb-6 max-w-lg mx-auto">
        To sell digital products on AllThrive, you need creator or mentor access.
        Share your expertise by creating courses, prompt packs, templates, and more.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-8">
        {/* Creator Benefits */}
        <div className="text-left p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBagIcon className="w-5 h-5 text-teal-400" />
            <h3 className="font-semibold text-slate-200">Creator</h3>
          </div>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>Sell digital products</li>
            <li>Import YouTube courses</li>
            <li>Earn 95% of sales</li>
          </ul>
        </div>

        {/* Mentor Benefits */}
        <div className="text-left p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <AcademicCapIcon className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-slate-200">Mentor</h3>
          </div>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>All creator features</li>
            <li>Offer 1:1 mentorship</li>
            <li>Featured in directory</li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href="mailto:support@allthrive.ai?subject=Creator%20Access%20Request&body=Hi%20AllThrive%20team%2C%0A%0AI'd%20like%20to%20request%20creator%2Fmentor%20access.%0A%0AAbout%20me%3A%0A%0AWhat%20I%20plan%20to%20create%3A%0A%0AThank%20you!"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        >
          <SparklesIcon className="w-5 h-5" />
          Request Creator Access
        </a>
        <Link
          to="/explore"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-slate-300 font-medium rounded-lg transition-colors"
        >
          Explore Courses
        </Link>
      </div>

      <p className="text-xs text-slate-500 mt-6">
        Creator access is reviewed by our team. Most requests are approved within 24-48 hours.
      </p>
    </div>
  );
}

// Product item for the list
function ProductItem({ product }: { product: ProductListItem }) {
  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    published: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    archived: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        {product.featuredImageUrl ? (
          <img
            src={product.featuredImageUrl}
            alt={product.title}
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
            <ShoppingBagIcon className="w-6 h-6 text-slate-500" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{product.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded border ${statusColors[product.status]}`}>
              {product.status}
            </span>
            <span className="text-xs text-slate-500">{product.productTypeDisplay}</span>
          </div>
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-4">
        <p className="text-sm font-medium text-slate-200">
          {parseFloat(product.price) > 0 ? `$${product.price}` : 'Free'}
        </p>
        <p className="text-xs text-slate-500">{product.totalSales} sales</p>
      </div>
    </div>
  );
}

export default function CreatorSettingsPage() {
  const { user } = useAuth();
  const isCreator = hasCreatorAccess(user?.role);

  const [account, setAccount] = useState<CreatorAccount | null>(null);
  const [dashboard, setDashboard] = useState<CreatorDashboardStats | null>(null);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch creator data (only if user has creator role)
  const fetchCreatorData = useCallback(async () => {
    // Skip fetching if user doesn't have creator role
    if (!isCreator) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [accountData, dashboardData, productsData] = await Promise.all([
        getCreatorAccount(),
        getCreatorDashboard().catch(() => null),
        listMyProducts().catch(() => []),
      ]);
      setAccount(accountData);
      setDashboard(dashboardData);
      setProducts(productsData);
    } catch {
      // Account might not exist yet
      setAccount(null);
      setDashboard(null);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [isCreator]);

  useEffect(() => {
    fetchCreatorData();
  }, [fetchCreatorData]);

  // Create creator account
  const handleCreateAccount = async () => {
    setIsCreating(true);
    try {
      const newAccount = await createCreatorAccount();
      setAccount(newAccount);
      // Refresh dashboard data
      const dashboardData = await getCreatorDashboard().catch(() => null);
      setDashboard(dashboardData);
    } catch (error) {
      console.error('Failed to create creator account:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Import from YouTube
  const handleYouTubeImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const result = await importFromYouTube({
        youtubeUrl: youtubeUrl.trim(),
        productType: 'course',
        price: '0.00',
      });
      setImportSuccess(result.message);
      setYoutubeUrl('');
      // Refresh products list
      const productsData = await listMyProducts().catch(() => []);
      setProducts(productsData);
    } catch (error: unknown) {
      const errorMessage = error && typeof error === 'object' && 'error' in error
        ? String((error as { error: string }).error)
        : 'Failed to import video. Please try again.';
      setImportError(errorMessage);
    } finally {
      setIsImporting(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6 md:mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Creator Settings
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Manage your creator account and sell digital products
              </p>
            </div>

            {!isCreator ? (
              // User doesn't have creator/mentor role - show request access prompt
              <RequestCreatorAccess />
            ) : isLoading ? (
              // Loading state
              <div className="space-y-6">
                <div className="glass-strong rounded-xl p-6 border border-white/20 animate-pulse">
                  <div className="h-6 w-40 bg-slate-700 rounded mb-4"></div>
                  <div className="h-4 w-64 bg-slate-700 rounded"></div>
                </div>
              </div>
            ) : !account ? (
              // No creator account - show setup prompt
              <div className="glass-strong rounded-xl p-8 border border-white/20 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/10 flex items-center justify-center">
                  <ShoppingBagIcon className="w-8 h-8 text-primary-400" />
                </div>
                <h2 className="text-xl font-semibold text-slate-100 mb-2">
                  Become a Creator
                </h2>
                <p className="text-slate-400 mb-6 max-w-md mx-auto">
                  Start selling digital products like courses, prompt packs, templates, and e-books.
                  Set up your creator account to get started.
                </p>
                <button
                  onClick={handleCreateAccount}
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <PlusIcon className="w-5 h-5" />
                      Create Creator Account
                    </>
                  )}
                </button>
              </div>
            ) : (
              // Has creator account - show dashboard
              <div className="space-y-6">
                {/* Account Status Card */}
                <div className="glass-strong rounded-xl p-6 border border-white/20">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-lg font-semibold text-slate-100">
                          Creator Account
                        </h2>
                        <OnboardingBadge
                          status={account.onboardingStatus}
                          isOnboarded={account.isOnboarded}
                        />
                      </div>
                      <p className="text-sm text-slate-400">
                        {account.isOnboarded
                          ? 'Your account is set up and ready to accept payments.'
                          : 'Complete Stripe Connect setup to start selling paid products.'}
                      </p>
                    </div>
                    {!account.isOnboarded && (
                      <a
                        href="/api/v1/marketplace/creator/stripe-onboarding/"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                      >
                        Complete Setup
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                {dashboard && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatsCard
                      title="Total Products"
                      value={dashboard.totalProducts}
                      icon={ShoppingBagIcon}
                      subtitle={`${dashboard.publishedProducts} published`}
                    />
                    <StatsCard
                      title="Total Sales"
                      value={dashboard.totalSales}
                      icon={ChartBarIcon}
                    />
                    <StatsCard
                      title="Total Revenue"
                      value={formatCurrency(dashboard.totalRevenue)}
                      icon={CurrencyDollarIcon}
                    />
                    <StatsCard
                      title="Earnings"
                      value={formatCurrency(dashboard.totalEarnings)}
                      icon={CurrencyDollarIcon}
                      subtitle={`${formatCurrency(dashboard.pendingBalance)} pending`}
                    />
                  </div>
                )}

                {/* Products List */}
                <div className="glass-strong rounded-xl p-6 border border-white/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-100">
                      Your Products
                    </h3>
                    <Link
                      to="/creator/products/new"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
                    >
                      <PlusIcon className="w-5 h-5" />
                      Add Product
                    </Link>
                  </div>

                  {products.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingBagIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No products yet</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Create courses, prompt packs, templates, and more
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {products.slice(0, 5).map((product) => (
                        <ProductItem key={product.id} product={product} />
                      ))}
                    </div>
                  )}

                  {products.length > 5 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <Link
                        to="/creator/products"
                        className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
                      >
                        View all {products.length} products →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </SettingsLayout>
    </DashboardLayout>
  );
}
