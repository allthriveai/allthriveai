/**
 * Product Checkout Modal
 *
 * Modal for purchasing marketplace products with Stripe Elements.
 * Handles both paid and free products.
 *
 * Flow:
 * 1. User clicks "Buy" on product
 * 2. Modal opens, creates PaymentIntent via API
 * 3. User enters payment details via Stripe Elements
 * 4. On success, webhook grants access, modal closes
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon, CheckIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StripePaymentForm } from '@/components/billing/StripePaymentForm';
import {
  createProductCheckout,
  claimFreeProduct,
  getOrderStatus,
  type CheckoutResponse,
} from '@/services/marketplace';

/** Polling configuration for order status checks */
const POLL_MAX_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1000;

interface ProductCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: number;
    title: string;
    price: number;
    currency: string;
    creator: string;
    imageUrl?: string;
  };
  onSuccess?: () => void;
}

export function ProductCheckoutModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: ProductCheckoutModalProps) {
  const queryClient = useQueryClient();
  const [checkoutData, setCheckoutData] = useState<CheckoutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef(true);
  // Ref to track if checkout has been initiated for this modal open
  const checkoutInitiatedRef = useRef(false);

  // Create checkout mutation
  const createCheckoutMutation = useMutation({
    mutationFn: () => createProductCheckout(product.id),
    onSuccess: (data) => {
      if (isMountedRef.current) {
        setCheckoutData(data);
        setError(null);
      }
    },
    onError: (err: Error) => {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to initialize checkout');
      }
    },
  });

  // Claim free product mutation
  const claimFreeMutation = useMutation({
    mutationFn: () => claimFreeProduct(product.id),
    onSuccess: () => {
      if (isMountedRef.current) {
        setSuccess(true);
        queryClient.invalidateQueries({ queryKey: ['marketplace-library'] });
        onSuccess?.();
      }
    },
    onError: (err: Error) => {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to claim product');
      }
    },
  });

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize checkout when modal opens
  useEffect(() => {
    if (isOpen && product.price > 0 && !checkoutInitiatedRef.current) {
      checkoutInitiatedRef.current = true;
      createCheckoutMutation.mutate();
    }

    // Reset the initiated ref when modal closes
    if (!isOpen) {
      checkoutInitiatedRef.current = false;
    }
  }, [isOpen, product.price, product.id]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCheckoutData(null);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isFree = product.price <= 0;
  const isLoading = createCheckoutMutation.isPending || claimFreeMutation.isPending;

  const handlePaymentSuccess = useCallback(async () => {
    if (!checkoutData) return;

    // Poll for order completion (webhooks are asynchronous)
    for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
      // Check if component is still mounted before continuing
      if (!isMountedRef.current) return;

      try {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

        // Check again after delay
        if (!isMountedRef.current) return;

        const status = await getOrderStatus(checkoutData.orderId);

        if (status.status === 'paid') {
          if (isMountedRef.current) {
            setSuccess(true);
            queryClient.invalidateQueries({ queryKey: ['marketplace-library'] });
            onSuccess?.();
          }
          return;
        }
      } catch (err) {
        console.error(`Poll attempt ${attempt} failed:`, err);
      }
    }

    // Timeout - payment succeeded but webhook might be delayed
    if (isMountedRef.current) {
      setError(
        'Your payment was successful, but access is being processed. ' +
        'Please refresh the page in a few seconds.'
      );
    }
  }, [checkoutData, queryClient, onSuccess]);

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleClaimFree = () => {
    claimFreeMutation.mutate();
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(price);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-lg"
        style={{
          background: 'var(--glass-fill)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-neon)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-fill-strong)] transition-all"
          aria-label="Close modal"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        {/* Success State */}
        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckIcon className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              {isFree ? 'Access Granted!' : 'Purchase Complete!'}
            </h2>
            <p className="text-[var(--text-secondary)] mb-6">
              You now have access to <strong>{product.title}</strong>
            </p>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-lg font-semibold text-white transition-all"
              style={{
                background: 'var(--gradient-primary)',
                boxShadow: 'var(--shadow-neon)',
              }}
            >
              Start Learning
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-8 pt-8 pb-6 border-b border-[var(--glass-border)]">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-green)] bg-clip-text text-transparent">
                {isFree ? 'Get Free Access' : 'Complete Purchase'}
              </h2>
            </div>

            {/* Product Info */}
            <div className="px-8 py-6 border-b border-[var(--glass-border)]">
              <div className="flex gap-4">
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--text-primary)]">
                    {product.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    by {product.creator}
                  </p>
                  <p className="mt-2 text-lg font-bold text-[var(--neon-cyan)]">
                    {isFree ? 'Free' : formatPrice(product.price, product.currency)}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8">
              {/* Loading State */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--neon-cyan)] border-t-transparent mb-4"></div>
                  <p className="text-[var(--text-secondary)]">
                    {isFree ? 'Granting access...' : 'Initializing payment...'}
                  </p>
                </div>
              )}

              {/* Free Product */}
              {!isLoading && isFree && !success && (
                <div className="text-center">
                  <p className="text-[var(--text-secondary)] mb-6">
                    Click below to get instant access to this product.
                  </p>
                  <button
                    onClick={handleClaimFree}
                    className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all"
                    style={{
                      background: 'var(--gradient-primary)',
                      boxShadow: 'var(--shadow-neon)',
                    }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <ShoppingCartIcon className="w-5 h-5" />
                      Get Free Access
                    </span>
                  </button>
                </div>
              )}

              {/* Paid Product - Payment Form */}
              {!isLoading && !isFree && checkoutData && !success && (
                <>
                  {/* Fee Breakdown */}
                  <div className="mb-6 p-4 rounded-lg bg-[var(--glass-fill-subtle)]">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-[var(--text-secondary)]">Subtotal</span>
                      <span className="text-[var(--text-primary)]">
                        {formatPrice(checkoutData.amount, checkoutData.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-[var(--glass-border)] pt-2 mt-2">
                      <span className="font-semibold text-[var(--text-primary)]">Total</span>
                      <span className="font-semibold text-[var(--neon-cyan)]">
                        {formatPrice(checkoutData.amount, checkoutData.currency)}
                      </span>
                    </div>
                  </div>

                  <StripePaymentForm
                    clientSecret={checkoutData.clientSecret}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 px-4 py-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400">
                  {error}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
