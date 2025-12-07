/**
 * Buy Tokens Modal Component
 *
 * Allows users to purchase token packages directly from the billing page.
 * Uses Stripe Payment Intent for one-time payments.
 */

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { StripePaymentForm } from './StripePaymentForm';
import { getTokenPackages, purchaseTokens } from '@/services/billing';
import type { TokenPackage } from '@/services/billing';

interface BuyTokensModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BuyTokensModal({ isOpen, onClose, onSuccess }: BuyTokensModalProps) {
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'payment'>('select');

  // Load available token packages
  useEffect(() => {
    const loadPackages = async () => {
      try {
        setLoading(true);
        const data = await getTokenPackages();
        setPackages(data);
      } catch (err) {
        console.error('Failed to load token packages:', err);
        setError('Failed to load token packages. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadPackages();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedPackage(null);
      setClientSecret(null);
      setStep('select');
      setError(null);
    }
  }, [isOpen]);

  const handlePackageSelect = async (pkg: TokenPackage) => {
    try {
      setPurchasing(true);
      setError(null);

      // Create payment intent
      const result = await purchaseTokens(pkg.slug);

      setSelectedPackage(pkg);
      setClientSecret(result.clientSecret);
      setStep('payment');
    } catch (err) {
      console.error('Failed to create payment intent:', err);
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(errorMessage || 'Failed to initiate purchase. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handlePaymentSuccess = () => {
    onSuccess();
    onClose();
  };

  const handlePaymentError = (errorMsg: string) => {
    setError(errorMsg);
  };

  const handleBack = () => {
    setStep('select');
    setSelectedPackage(null);
    setClientSecret(null);
    setError(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'select' ? 'Buy AI Tokens' : `Purchase ${selectedPackage?.name}`}
      className="max-w-2xl"
    >
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {step === 'select' && (
        <div className="space-y-6">
          <p className="text-slate-300 text-sm">
            Purchase additional AI tokens for extended usage beyond your monthly quota.
            Tokens never expire and can be used for any AI-powered feature.
          </p>

          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-strong rounded-lg p-6 border border-white/20 animate-pulse">
                  <div className="h-6 w-32 bg-slate-700 rounded mb-2"></div>
                  <div className="h-8 w-24 bg-slate-700 rounded mb-4"></div>
                  <div className="h-4 w-48 bg-slate-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => handlePackageSelect(pkg)}
                  disabled={purchasing}
                  className="glass-strong rounded-lg p-6 border border-white/20 hover:border-primary-500/50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-100 group-hover:text-primary-400 transition-colors">
                          {pkg.name}
                        </h3>
                        <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded text-xs font-medium">
                          ${pkg.price}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-2xl font-bold text-slate-100">
                          {pkg.tokenAmount.toLocaleString()}
                        </span>
                        <span className="text-sm text-slate-400">tokens</span>
                      </div>
                      <p className="text-sm text-slate-400">{pkg.description}</p>
                      <div className="mt-3 text-xs text-slate-500">
                        {(Number(pkg.price) / (pkg.tokenAmount / 1000000)).toFixed(2)}¢ per 1M tokens
                      </div>
                    </div>
                    <svg
                      className="w-6 h-6 text-slate-500 group-hover:text-primary-400 transition-colors flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="glass-strong rounded-lg p-4 border border-white/20">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-300">
                <p className="font-medium mb-1">Token Details</p>
                <ul className="text-slate-400 space-y-1">
                  <li>• Tokens never expire</li>
                  <li>• Use for AI chat, content generation, and more</li>
                  <li>• Secure payment via Stripe</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'payment' && clientSecret && selectedPackage && (
        <div className="space-y-6">
          <div className="glass-strong rounded-lg p-6 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Package</span>
              <span className="text-slate-100 font-medium">{selectedPackage.name}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Tokens</span>
              <span className="text-slate-100 font-medium">
                {selectedPackage.tokenAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <span className="text-sm font-medium text-slate-300">Total</span>
              <span className="text-xl font-bold text-slate-100">${selectedPackage.price}</span>
            </div>
          </div>

          <StripePaymentForm
            clientSecret={clientSecret}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />

          <button
            onClick={handleBack}
            className="w-full px-4 py-2 text-slate-400 hover:text-slate-300 transition-colors text-sm"
          >
            ← Back to package selection
          </button>
        </div>
      )}
    </Modal>
  );
}
