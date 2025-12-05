import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { analytics } from '@/utils/analytics';

export default function CheckoutSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Track successful checkout
    // Note: Actual plan details will come from webhook, but we track the event
    analytics.checkoutCompleted('Subscription', 'monthly'); // Default values, will be updated by backend webhook

    // Optional: Auto-redirect after a few seconds
    const timer = setTimeout(() => {
      navigate('/settings/billing');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <DashboardLayout>
      {() => (
        <div className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="glass-strong rounded-xl p-8 text-center">
              {/* Success Icon */}
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircleIcon className="w-12 h-12 text-green-400" />
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-white mb-4">
                Payment Successful!
              </h1>

              {/* Description */}
              <p className="text-lg text-slate-300 mb-2">
                Your subscription has been activated.
              </p>
              <p className="text-slate-400 mb-8">
                You now have access to all the features of your plan.
              </p>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate('/settings/billing')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-green-500 text-background font-semibold hover:shadow-neon transition-all"
                >
                  View Billing Settings
                  <ArrowRightIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-all"
                >
                  Go to Dashboard
                </button>
              </div>

              {/* Auto-redirect notice */}
              <p className="text-sm text-slate-500 mt-6">
                You will be redirected to your billing settings in a few seconds...
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
