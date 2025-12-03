/**
 * Stripe Payment Form Component
 *
 * Handles payment collection via Stripe Elements for subscriptions.
 * Used within SubscribeModal to complete subscription creation.
 */

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import type { StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// Load Stripe publishable key from environment
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

/**
 * Inner form component that uses Stripe hooks
 * Must be wrapped by <Elements> provider
 */
function PaymentForm({ clientSecret, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      onError('Stripe has not loaded yet. Please try again.');
      return;
    }

    setIsProcessing(true);

    try {
      // Confirm payment
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/account/billing?success=true`,
        },
        redirect: 'if_required', // Only redirect if required by payment method
      });

      if (error) {
        onError(error.message || 'Payment failed. Please try again.');
      } else {
        // Payment succeeded
        onSuccess();
      }
    } catch (err) {
      onError('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Stripe Payment Element */}
      <div
        style={{
          background: 'var(--glass-fill)',
          border: '1px solid var(--glass-border)',
        }}
        className="rounded-lg p-6"
      >
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 px-6 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: isProcessing ? 'var(--glass-fill)' : 'var(--gradient-primary)',
          color: 'var(--text-primary)',
          boxShadow: isProcessing ? 'none' : 'var(--shadow-neon)',
        }}
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          'Complete Payment'
        )}
      </button>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>Secured by Stripe</span>
      </div>
    </form>
  );
}

interface StripePaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

/**
 * Main component that wraps PaymentForm with Elements provider
 */
export function StripePaymentForm({ clientSecret, onSuccess, onError }: StripePaymentFormProps) {
  // Elements options
  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'night', // Dark theme to match neon glass design
      variables: {
        colorPrimary: '#22d3ee', // Neon cyan
        colorBackground: '#0f172a', // Dark background
        colorText: '#f8fafc', // Light text
        colorDanger: '#ef4444', // Red for errors
        fontFamily: 'system-ui, sans-serif',
        borderRadius: '0.5rem',
      },
      rules: {
        '.Input': {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(148, 163, 184, 0.35)',
          boxShadow: 'none',
        },
        '.Input:focus': {
          border: '1px solid #22d3ee',
          boxShadow: '0 0 0 1px #22d3ee',
        },
        '.Tab': {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(148, 163, 184, 0.35)',
        },
        '.Tab--selected': {
          backgroundColor: 'rgba(34, 211, 238, 0.1)',
          border: '1px solid #22d3ee',
          color: '#22d3ee',
        },
        '.Label': {
          color: '#f8fafc',
        },
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm clientSecret={clientSecret} onSuccess={onSuccess} onError={onError} />
    </Elements>
  );
}
