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
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Validate Stripe key is configured
if (!STRIPE_KEY) {
  console.error('❌ VITE_STRIPE_PUBLISHABLE_KEY is not set in environment variables');
  console.error('Please add VITE_STRIPE_PUBLISHABLE_KEY to your .env file and restart the dev server');
}

const stripePromise = loadStripe(STRIPE_KEY || '');

interface PaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

/**
 * Inner form component that uses Stripe hooks
 * Must be wrapped by <Elements> provider
 */
function PaymentForm({ onSuccess, onError }: PaymentFormProps) {
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
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/account/billing?success=true`,
        },
        redirect: 'if_required', // Only redirect if required by payment method
      });

      if (error) {
        // Categorize errors for better UX
        let errorMessage = error.message || 'Payment failed. Please try again.';

        switch (error.type) {
          case 'card_error':
            // Card was declined
            errorMessage = `Card declined: ${error.message}`;
            break;
          case 'validation_error':
            // Invalid card details
            errorMessage = 'Please check your card details and try again.';
            break;
          case 'invalid_request_error':
            // Invalid request to Stripe
            errorMessage = 'Payment setup error. Please refresh and try again.';
            break;
          case 'api_connection_error':
          case 'api_error':
            // Network or Stripe API errors
            errorMessage = 'Network error. Please check your connection and try again.';
            break;
          case 'rate_limit_error':
            // Too many requests
            errorMessage = 'Too many attempts. Please wait a moment and try again.';
            break;
          case 'authentication_error':
            // Authentication with Stripe failed
            errorMessage = 'Payment system error. Please contact support.';
            break;
          default:
            errorMessage = error.message || 'Payment failed. Please try again.';
        }

        onError(errorMessage);
      } else if (paymentIntent?.status === 'succeeded') {
        // Payment succeeded
        onSuccess();
      } else if (paymentIntent?.status === 'requires_action') {
        // 3D Secure or other action required - Stripe Elements handles this automatically
        onError('Additional verification required. Please follow the prompts.');
      } else if (paymentIntent?.status === 'processing') {
        // Payment is processing - wait for webhook
        onSuccess(); // Let the success handler poll for completion
      } else {
        // Unknown payment intent status
        console.error('[Payment Unknown Status]', paymentIntent?.status);
        onError('Payment status unknown. Please contact support if you were charged.');
      }
    } catch (err) {
      console.error('[Payment Unexpected Error]', err);
      onError('An unexpected error occurred. Please contact support if you were charged.');
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
