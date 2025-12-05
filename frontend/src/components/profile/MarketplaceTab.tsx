/**
 * Marketplace Tab Component
 *
 * Displays all products a creator has published on the marketplace.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSpinner,
  faStore,
  faBoxOpen,
  faVideo,
  faFileAlt,
  faBook,
  faBolt,
} from '@fortawesome/free-solid-svg-icons';
import { browseMarketplace } from '@/services/marketplace';
import type { ProductListItem } from '@/types/marketplace';

interface MarketplaceTabProps {
  username: string;
  isOwnProfile: boolean;
}

// Product type to icon mapping
const productTypeIcons: Record<string, typeof faVideo> = {
  course: faVideo,
  prompt_pack: faBolt,
  template: faFileAlt,
  ebook: faBook,
};

// Product type display names
const productTypeLabels: Record<string, string> = {
  course: 'Course',
  prompt_pack: 'Prompt Pack',
  template: 'Template',
  ebook: 'E-Book',
};

function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <Link
      to={`/marketplace/${product.creatorUsername}/${product.slug}`}
      className="group block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-lg hover:border-teal-500/50 transition-all duration-300"
    >
      {/* Featured Image */}
      <div className="aspect-video bg-gradient-to-br from-teal-500/10 to-cyan-500/10 relative overflow-hidden">
        {product.featuredImageUrl ? (
          <img
            src={product.featuredImageUrl}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FontAwesomeIcon
              icon={productTypeIcons[product.productType] || faBoxOpen}
              className="w-12 h-12 text-teal-500/30"
            />
          </div>
        )}
        {/* Product Type Badge */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300 backdrop-blur-sm">
            <FontAwesomeIcon
              icon={productTypeIcons[product.productType] || faBoxOpen}
              className="w-3 h-3 text-teal-500"
            />
            {productTypeLabels[product.productType] || product.productTypeDisplay}
          </span>
        </div>
        {/* Featured Badge */}
        {product.isFeatured && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500 text-white">
              Featured
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
          {product.title}
        </h3>
        {product.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
            {product.description}
          </p>
        )}

        {/* Price & Stats */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-teal-600 dark:text-teal-400">
            {parseFloat(product.price) === 0 ? (
              'Free'
            ) : (
              <>
                {product.currency === 'USD' ? '$' : product.currency}
                {parseFloat(product.price).toFixed(2)}
              </>
            )}
          </span>
          {product.totalSales > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {product.totalSales} sale{product.totalSales !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function MarketplaceTab({ username, isOwnProfile }: MarketplaceTabProps) {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCreatorProducts() {
      if (!username) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await browseMarketplace({ creator: username });
        setProducts(response.results);
      } catch (err) {
        console.error('Failed to load creator products:', err);
        setError('Failed to load products');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCreatorProducts();
  }, [username]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <FontAwesomeIcon icon={faBoxOpen} className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No products yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          {isOwnProfile
            ? 'Start selling your courses, prompt packs, and more!'
            : `${username} hasn't published any products yet.`}
        </p>
        {isOwnProfile && (
          <Link
            to="/account/settings/creator"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            <FontAwesomeIcon icon={faStore} className="w-4 h-4" />
            Go to Creator Settings
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FontAwesomeIcon icon={faStore} className="w-5 h-5 text-teal-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {products.length} Product{products.length !== 1 ? 's' : ''}
        </h2>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
