/**
 * StorefrontSection - Products and services display for creators
 *
 * Supports both:
 * - Native AllThrive products (with integrated checkout)
 * - External product links (Gumroad, etc.)
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PlusIcon,
  XMarkIcon,
  ShoppingBagIcon,
  ArrowTopRightOnSquareIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import type { StorefrontSectionContent, StorefrontItem } from '@/types/profileSections';
import type { ProfileUser } from './ProfileSectionRenderer';
import type { ProductListItem } from '@/types/marketplace';
import { listMyProducts } from '@/services/marketplace';
import { ProductCheckoutModal } from '@/components/marketplace';
import { MediaUploader } from '@/components/forms';

interface StorefrontSectionProps {
  content: StorefrontSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  onUpdate?: (content: StorefrontSectionContent) => void;
}

type ModalMode = 'add-external' | 'add-native' | 'checkout';

export function StorefrontSection({ content, user, isEditing, onUpdate }: StorefrontSectionProps) {
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [newItem, setNewItem] = useState<Partial<StorefrontItem>>({});
  const [checkoutProduct, setCheckoutProduct] = useState<{
    id: number;
    title: string;
    price: number;
    currency: string;
    creator: string;
    imageUrl?: string;
  } | null>(null);

  const items = content?.items || [];
  const title = content?.title || 'Shop';
  const layout = content?.layout || 'grid';

  // Fetch creator's products when in edit mode and showing add-native modal
  const { data: myProducts, isLoading: loadingProducts } = useQuery({
    queryKey: ['my-marketplace-products'],
    queryFn: listMyProducts,
    enabled: isEditing && modalMode === 'add-native',
  });

  // Filter out products already in storefront
  const existingProductIds = new Set(
    items.filter((i) => i.productId).map((i) => i.productId)
  );
  const availableProducts = myProducts?.filter(
    (p) => !existingProductIds.has(p.id) && p.status === 'published'
  );

  const handleAddExternalItem = () => {
    if (!newItem.title?.trim() || !newItem.url?.trim() || !onUpdate) return;

    const item: StorefrontItem = {
      id: `item-${Date.now()}`,
      title: newItem.title.trim(),
      description: newItem.description?.trim(),
      price: newItem.price?.trim(),
      url: newItem.url.trim().startsWith('http')
        ? newItem.url.trim()
        : `https://${newItem.url.trim()}`,
      imageUrl: newItem.imageUrl?.trim(),
      badge: newItem.badge?.trim(),
      category: newItem.category?.trim(),
    };

    onUpdate({
      ...content,
      items: [...items, item],
    });
    setNewItem({});
    setModalMode(null);
  };

  const handleAddNativeProduct = (product: ProductListItem) => {
    if (!onUpdate) return;

    const item: StorefrontItem = {
      id: `product-${product.id}-${Date.now()}`,
      productId: product.id,
      title: product.title,
      description: product.description,
      price: parseFloat(product.price) <= 0 ? 'Free' : `$${product.price}`,
      currency: product.currency,
      imageUrl: product.featuredImageUrl,
      category: product.productTypeDisplay,
    };

    onUpdate({
      ...content,
      items: [...items, item],
    });
    setModalMode(null);
  };

  const handleRemoveItem = (id: string) => {
    if (!onUpdate) return;
    const newItems = items.filter((item) => item.id !== id);
    onUpdate({ ...content, items: newItems });
  };

  const handleBuyClick = (item: StorefrontItem) => {
    if (item.productId) {
      // Native product - open checkout modal
      const priceNum = item.price
        ? parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0
        : 0;
      setCheckoutProduct({
        id: item.productId,
        title: item.title,
        price: priceNum,
        currency: item.currency || 'USD',
        creator: user.username || 'Creator',
        imageUrl: item.imageUrl,
      });
      setModalMode('checkout');
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setNewItem({});
    setCheckoutProduct(null);
  };

  // Empty state when not editing and no items
  if (items.length === 0 && !isEditing) {
    return null;
  }

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShoppingBagIcon className="w-6 h-6 text-primary-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
        </div>
        {isEditing && (
          <div className="flex gap-2">
            <button
              onClick={() => setModalMode('add-native')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add Product
            </button>
            <button
              onClick={() => setModalMode('add-external')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              Add External Link
            </button>
          </div>
        )}
      </div>

      {/* Items display */}
      {items.length > 0 && (
        <div
          className={
            layout === 'list'
              ? 'space-y-4'
              : layout === 'featured'
                ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
          }
        >
          {items.map((item) => (
            <div
              key={item.id}
              className={`group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-primary-300 dark:hover:border-primary-600 transition-all hover:shadow-lg ${
                layout === 'featured' ? 'flex flex-col' : ''
              }`}
            >
              {/* Remove button */}
              {isEditing && (
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}

              {/* Badge */}
              {item.badge && (
                <div className="absolute top-2 left-2 z-10 px-2 py-0.5 text-xs font-semibold bg-primary-500 text-white rounded-full">
                  {item.badge}
                </div>
              )}

              {/* Native product indicator */}
              {item.productId && (
                <div className="absolute top-2 right-2 z-10 px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded-full">
                  All Thrive
                </div>
              )}

              {/* Image */}
              {item.imageUrl ? (
                <div
                  className={`overflow-hidden ${layout === 'featured' ? 'aspect-video' : 'aspect-[4/3]'}`}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ) : (
                <div
                  className={`bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center ${layout === 'featured' ? 'aspect-video' : 'aspect-[4/3]'}`}
                >
                  <ShoppingBagIcon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                </div>
              )}

              {/* Content */}
              <div className="p-4">
                {item.category && (
                  <div className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-1">
                    {item.category}
                  </div>
                )}

                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {item.title}
                </h3>

                {item.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                    {item.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-auto">
                  {item.price && (
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {item.price}
                    </span>
                  )}

                  {item.productId ? (
                    // Native product - Buy button
                    <button
                      onClick={() => handleBuyClick(item)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                    >
                      <ShoppingCartIcon className="w-4 h-4" />
                      {item.price === 'Free' ? 'Get Free' : 'Buy Now'}
                    </button>
                  ) : item.url ? (
                    // External product - View link
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                    >
                      View
                      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && isEditing && (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          <ShoppingBagIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No products yet</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setModalMode('add-native')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add Your Products
            </button>
            <button
              onClick={() => setModalMode('add-external')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              Add External Link
            </button>
          </div>
        </div>
      )}

      {/* Add Native Product Modal */}
      {modalMode === 'add-native' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Product to Storefront
              </h3>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Products list */}
            <div className="p-4">
              {loadingProducts ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
                </div>
              ) : !availableProducts || availableProducts.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingBagIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    No published products available
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Create and publish products in the Creator Dashboard
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Select a product to add to your storefront:
                  </p>
                  {availableProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleAddNativeProduct(product)}
                      className="w-full flex items-center gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all text-left"
                    >
                      {product.featuredImageUrl ? (
                        <img
                          src={product.featuredImageUrl}
                          alt={product.title}
                          className="w-16 h-12 rounded-md object-cover"
                        />
                      ) : (
                        <div className="w-16 h-12 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <ShoppingBagIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">
                          {product.title}
                        </h4>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-primary-600 dark:text-primary-400">
                            {parseFloat(product.price) <= 0
                              ? 'Free'
                              : `$${product.price}`}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {product.productTypeDisplay}
                          </span>
                        </div>
                      </div>
                      <PlusIcon className="w-5 h-5 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add External Product Modal */}
      {modalMode === 'add-external' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add External Product Link
              </h3>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={newItem.title || ''}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  placeholder="Product name"
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL *
                </label>
                <input
                  type="url"
                  value={newItem.url || ''}
                  onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                  placeholder="https://gumroad.com/..."
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newItem.description || ''}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Brief description..."
                  rows={2}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Price
                  </label>
                  <input
                    type="text"
                    value={newItem.price || ''}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    placeholder="$29"
                    className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newItem.category || ''}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    placeholder="Course, Template..."
                    className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product Image
                </label>
                {newItem.imageUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={newItem.imageUrl}
                      alt="Product preview"
                      className="w-full h-32 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => setNewItem({ ...newItem, imageUrl: undefined })}
                      className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg"
                      aria-label="Remove image"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <MediaUploader
                    accept="image"
                    folder="storefront"
                    compact
                    onUpload={(media) => {
                      if (media.length > 0) {
                        setNewItem({ ...newItem, imageUrl: media[0].url });
                      }
                    }}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Badge
                </label>
                <input
                  type="text"
                  value={newItem.badge || ''}
                  onChange={(e) => setNewItem({ ...newItem, badge: e.target.value })}
                  placeholder="New, Popular, Sale..."
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExternalItem}
                disabled={!newItem.title?.trim() || !newItem.url?.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal for Native Products */}
      {modalMode === 'checkout' && checkoutProduct && (
        <ProductCheckoutModal
          isOpen={true}
          onClose={closeModal}
          product={checkoutProduct}
          onSuccess={closeModal}
        />
      )}
    </div>
  );
}
