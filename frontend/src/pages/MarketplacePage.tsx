/**
 * MarketplacePage - Browse and purchase digital products
 * Features courses, prompt packs, templates, and digital products
 * Uses neon glass aesthetic with product grid
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuestTracking } from '@/hooks/useQuestTracking';
import {
  faStore,
  faGraduationCap,
  faLightbulb,
  faFileCode,
  faRocket,
} from '@fortawesome/free-solid-svg-icons';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { browseMarketplace } from '@/services/marketplace';
import type { ProductType, ProductListItem } from '@/types/marketplace';

const PRODUCT_TYPE_CONFIG: Record<ProductType, { icon: typeof faGraduationCap; label: string; color: string }> = {
  course: { icon: faGraduationCap, label: 'Courses', color: 'blue' },
  prompt_pack: { icon: faLightbulb, label: 'Prompt Packs', color: 'amber' },
  template: { icon: faFileCode, label: 'Templates', color: 'emerald' },
  ebook: { icon: faRocket, label: 'E-books', color: 'purple' },
};

export default function MarketplacePage() {
  const { trackPage } = useQuestTracking();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ProductType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    trackPage('/marketplace', 'Marketplace');
  }, [trackPage]);

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        setError(null);
        const params = selectedType !== 'all' ? { type: selectedType } : undefined;
        const response = await browseMarketplace(params);
        setProducts(response.results || []);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        setError('Failed to load products. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [selectedType]);

  // Filter by search
  const filteredProducts = products.filter((product) =>
    searchQuery
      ? product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const formatPrice = (price: string | number, currency: string = 'usd') => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (numPrice === 0) return 'Free';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(numPrice);
  };

  return (
    <DashboardLayout>
      {() => (
        <div className="min-h-screen bg-gray-50 dark:bg-background relative overflow-hidden">
          {/* Ambient Background Effects */}
          <div className="fixed inset-0 bg-grid-pattern opacity-0 dark:opacity-20 pointer-events-none" />
          <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-blue-500/0 dark:bg-cyan-500/10 blur-[100px] pointer-events-none" />
          <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/0 dark:bg-pink-accent/5 blur-[120px] pointer-events-none" />

          <div className="relative z-10 h-full overflow-y-auto">
            {/* Header */}
            <div className="relative border-b border-gray-200 dark:border-white/10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30">
                    <FontAwesomeIcon icon={faStore} className="text-2xl text-cyan-400" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      Marketplace
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                      Discover courses, prompts, and digital products
                    </p>
                  </div>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 focus:border-cyan-500 dark:focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    />
                  </div>

                  {/* Type Filter */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                      onClick={() => setSelectedType('all')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        selectedType === 'all'
                          ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30'
                          : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                      }`}
                    >
                      All
                    </button>
                    {(Object.keys(PRODUCT_TYPE_CONFIG) as ProductType[]).map((type) => {
                      const config = PRODUCT_TYPE_CONFIG[type];
                      return (
                        <button
                          key={type}
                          onClick={() => setSelectedType(type)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                            selectedType === type
                              ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30'
                              : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                          }`}
                        >
                          <FontAwesomeIcon icon={config.icon} className="text-xs" />
                          {config.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : error ? (
                <div className="text-center py-20">
                  <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                    <FontAwesomeIcon icon={faStore} className="text-3xl text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {searchQuery ? 'No products found' : 'No products yet'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {searchQuery
                      ? 'Try adjusting your search or filters'
                      : 'Be the first to publish a product!'}
                  </p>
                  {!searchQuery && (
                    <Link
                      to="/explore"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all"
                      style={{
                        background: 'linear-gradient(135deg, #0EA5E9, #22D3EE)',
                        boxShadow: '0 0 20px rgba(14, 165, 233, 0.3)',
                      }}
                    >
                      Explore Projects
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map((product) => {
                    const typeConfig = PRODUCT_TYPE_CONFIG[product.productType];
                    return (
                      <Link
                        key={product.id}
                        to={`/${product.creatorUsername}/${product.slug}`}
                        className="group bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden hover:border-gray-300 dark:hover:border-cyan-500/30 transition-all duration-300 hover:shadow-lg dark:hover:shadow-cyan-500/10"
                      >
                        {/* Image */}
                        <div className="relative aspect-video bg-gray-100 dark:bg-white/5 overflow-hidden">
                          {product.featuredImageUrl ? (
                            <img
                              src={product.featuredImageUrl}
                              alt={product.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FontAwesomeIcon
                                icon={typeConfig?.icon || faStore}
                                className="text-4xl text-gray-300 dark:text-gray-600"
                              />
                            </div>
                          )}
                          {/* Price Badge */}
                          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-emerald-500 text-white text-sm font-bold shadow-lg">
                            {formatPrice(product.price, product.currency)}
                          </div>
                          {/* Type Badge */}
                          <div className="absolute bottom-3 left-3 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1.5">
                            <FontAwesomeIcon icon={typeConfig?.icon || faStore} />
                            {product.productTypeDisplay || typeConfig?.label}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors line-clamp-2 mb-1">
                            {product.title}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            by {product.creatorUsername}
                          </p>
                          {product.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          {product.totalSales > 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                              {product.totalSales} {product.totalSales === 1 ? 'sale' : 'sales'}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
