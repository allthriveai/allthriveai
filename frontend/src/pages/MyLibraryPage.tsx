/**
 * MyLibraryPage - View purchased products and download assets
 * Shows all products the user has access to with download buttons
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBookOpen,
  faGraduationCap,
  faLightbulb,
  faFileCode,
  faRocket,
  faDownload,
  faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons';
import { ArrowDownTrayIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
import { getMyLibrary, getProduct, downloadAsset } from '@/services/marketplace';
import type { ProductAccess, ProductType, ProductAsset } from '@/types/marketplace';

const PRODUCT_TYPE_CONFIG: Record<ProductType, { icon: typeof faGraduationCap; label: string }> = {
  course: { icon: faGraduationCap, label: 'Course' },
  prompt_pack: { icon: faLightbulb, label: 'Prompt Pack' },
  template: { icon: faFileCode, label: 'Template' },
  ebook: { icon: faRocket, label: 'E-book' },
};

interface LibraryItemWithAssets extends ProductAccess {
  assets?: ProductAsset[];
  loadingAssets?: boolean;
}

export default function MyLibraryPage() {
  const [items, setItems] = useState<LibraryItemWithAssets[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingAsset, setDownloadingAsset] = useState<number | null>(null);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  // Fetch library
  useEffect(() => {
    async function fetchLibrary() {
      try {
        setLoading(true);
        setError(null);
        const library = await getMyLibrary();
        setItems(library.map((item) => ({ ...item, assets: undefined, loadingAssets: false })));
      } catch (err) {
        console.error('Failed to fetch library:', err);
        setError('Failed to load your library. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchLibrary();
  }, []);

  // Load assets when item is expanded
  const handleExpand = async (item: LibraryItemWithAssets) => {
    if (expandedItem === item.id) {
      setExpandedItem(null);
      return;
    }

    setExpandedItem(item.id);

    // If we already have assets, don't reload
    if (item.assets) return;

    // Load product details to get assets
    if (item.product?.id) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, loadingAssets: true } : i))
      );

      try {
        const productDetail = await getProduct(item.product.id);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, assets: productDetail.assets, loadingAssets: false }
              : i
          )
        );
      } catch (err) {
        console.error('Failed to load product assets:', err);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, loadingAssets: false } : i))
        );
      }
    }
  };

  // Handle download
  const handleDownload = async (productId: number, asset: ProductAsset) => {
    try {
      setDownloadingAsset(asset.id);
      await downloadAsset(productId, asset.id);
    } catch (err) {
      console.error('Failed to download:', err);
      alert('Failed to download file. Please try again.');
    } finally {
      setDownloadingAsset(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

  return (
    <DashboardLayout>
      {() => (
        <div className="min-h-screen bg-gray-50 dark:bg-background relative overflow-hidden">
          {/* Ambient Background Effects */}
          <div className="fixed inset-0 bg-grid-pattern opacity-0 dark:opacity-20 pointer-events-none" />
          <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-emerald-500/0 dark:bg-emerald-500/10 blur-[100px] pointer-events-none" />
          <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/0 dark:bg-cyan-500/5 blur-[120px] pointer-events-none" />

          <div className="relative z-10 h-full overflow-y-auto">
            {/* Header */}
            <div className="relative border-b border-gray-200 dark:border-white/10">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-emerald-500/30">
                    <FontAwesomeIcon icon={faBookOpen} className="text-2xl text-emerald-400" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      My Library
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                      Your purchased products and downloads
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : error ? (
                <div className="text-center py-20">
                  <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                    <FolderOpenIcon className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Your library is empty
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Products you purchase will appear here
                  </p>
                  <Link
                    to="/marketplace"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #10B981, #22D3EE)',
                      boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    Browse Marketplace
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
                    const typeConfig = PRODUCT_TYPE_CONFIG[item.productType];
                    const isExpanded = expandedItem === item.id;

                    return (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden transition-all"
                      >
                        {/* Item Header */}
                        <div
                          onClick={() => handleExpand(item)}
                          className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                          {/* Icon */}
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                            <FontAwesomeIcon
                              icon={typeConfig?.icon || faBookOpen}
                              className="text-xl text-emerald-500"
                            />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                              {item.productTitle}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              by {item.creatorUsername} • {typeConfig?.label}
                            </p>
                          </div>

                          {/* Expand Arrow */}
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
                              Purchased {formatDate(item.grantedAt)}
                            </span>
                            <div
                              className={`w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            >
                              <ArrowDownTrayIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </div>
                          </div>
                        </div>

                        {/* Expanded Assets */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
                            {item.loadingAssets ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : item.assets && item.assets.length > 0 ? (
                              <div className="p-4 space-y-2">
                                {item.assets
                                  .filter((asset) => asset.assetType === 'download')
                                  .map((asset) => (
                                    <div
                                      key={asset.id}
                                      className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10"
                                    >
                                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                        <FontAwesomeIcon
                                          icon={faDownload}
                                          className="text-emerald-500"
                                        />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">
                                          {asset.title}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                          {formatFileSize(asset.fileSize)}
                                        </p>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownload(item.product?.id, asset);
                                        }}
                                        disabled={downloadingAsset === asset.id}
                                        className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                      >
                                        {downloadingAsset === asset.id ? (
                                          <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Downloading...
                                          </>
                                        ) : (
                                          <>
                                            <FontAwesomeIcon icon={faDownload} />
                                            Download
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  ))}

                                {/* View Product Link */}
                                {item.product?.slug && (
                                  <Link
                                    to={`/${item.creatorUsername}/${item.product.slug}`}
                                    className="flex items-center justify-center gap-2 p-3 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                  >
                                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                                    View Product Page
                                  </Link>
                                )}
                              </div>
                            ) : (
                              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                <p>No downloadable files available</p>
                                {item.product?.slug && (
                                  <Link
                                    to={`/${item.creatorUsername}/${item.product.slug}`}
                                    className="inline-flex items-center gap-2 mt-4 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                                  >
                                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                                    View Product Page
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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
