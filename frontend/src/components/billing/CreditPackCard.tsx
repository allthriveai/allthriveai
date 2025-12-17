import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { CreditPack, CreditPackStatus } from '@/services/billing';

// Simple chevron icon
function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// Status badge for credit pack
function CreditPackStatusBadge({ status }: { status: string }) {
  const statusStyles: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    past_due: 'bg-red-500/20 text-red-400 border-red-500/30',
    canceled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  const style = statusStyles[status] || statusStyles.inactive;
  const displayStatus = status === 'inactive' ? 'None' : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {displayStatus}
    </span>
  );
}

// Cancel Credit Pack Modal
function CancelCreditPackModal({
  isOpen,
  onClose,
  onConfirm,
  currentBalance,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentBalance: number;
  isLoading: boolean;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel Credit Pack" className="max-w-lg">
      <div className="space-y-4">
        <p className="text-slate-300">
          Are you sure you want to cancel your credit pack subscription?
        </p>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-400">
                Your {currentBalance.toLocaleString()} remaining credits will be forfeited
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Credits do not transfer and cannot be refunded after cancellation.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-slate-700/50 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-all disabled:opacity-50"
          >
            Keep Credit Pack
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-medium hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Canceling...
              </>
            ) : (
              'Cancel & Forfeit Credits'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface CreditPackCardProps {
  creditPacks: CreditPack[];
  creditPackStatus: CreditPackStatus | null;
  onSubscribe: (packId: number) => Promise<void>;
  onChangePack: (packId: number) => Promise<void>;
  onCancel: () => Promise<void>;
  isLoading: boolean;
}

export function CreditPackCard({
  creditPacks,
  creditPackStatus,
  onSubscribe,
  onChangePack,
  onCancel,
  isLoading,
}: CreditPackCardProps) {
  const [selectedPackId, setSelectedPackId] = useState<number | null>(
    creditPackStatus?.creditPack?.id || null
  );
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const hasActivePack = creditPackStatus?.hasCreditPack && creditPackStatus.status === 'active';
  const currentPack = creditPackStatus?.creditPack;

  const handlePackChange = (packId: number) => {
    setSelectedPackId(packId);
  };

  const handleSubscribeOrChange = async () => {
    if (!selectedPackId) return;

    setActionLoading(true);
    try {
      if (hasActivePack) {
        await onChangePack(selectedPackId);
      } else {
        await onSubscribe(selectedPackId);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await onCancel();
      setCancelModalOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  // Show loading skeleton if data not yet loaded
  if (!creditPackStatus) {
    return (
      <div className="glass-strong rounded p-6 border border-white/20">
        <div className="animate-pulse">
          <div className="h-6 w-32 bg-slate-700 rounded mb-4"></div>
          <div className="h-10 w-full bg-slate-700 rounded mb-4"></div>
          <div className="h-4 w-48 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <>
      <div className="glass-strong rounded p-6 border border-white/20">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-1">
              Credit Pack
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-slate-100">
                {hasActivePack ? currentPack?.name : 'No Credit Pack'}
              </span>
              <CreditPackStatusBadge status={creditPackStatus.status} />
            </div>
          </div>
        </div>

        {/* Credit Balance Display */}
        {hasActivePack && (
          <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-slate-100">
                  {creditPackStatus.creditPackBalance.toLocaleString()}
                </div>
                <div className="text-sm text-slate-400">credits remaining</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-400">Next grant</div>
                <div className="text-sm text-slate-300">{formatDate(creditPackStatus.currentPeriodEnd)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Credit Pack Selector */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">
            {hasActivePack ? 'Change credit pack' : 'Select a credit pack'}
          </label>
          <div className="relative">
            <select
              value={selectedPackId || ''}
              onChange={(e) => handlePackChange(Number(e.target.value))}
              disabled={isLoading || actionLoading}
              className="w-full appearance-none px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 disabled:opacity-50 cursor-pointer pr-10"
            >
              <option value="" disabled>Select a credit pack...</option>
              {creditPacks.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.creditsPerMonth.toLocaleString()} credits/mo - ${pack.priceCents / 100}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Credits roll over while subscribed. Forfeited when cancelled.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {selectedPackId && selectedPackId !== currentPack?.id && (
            <button
              onClick={handleSubscribeOrChange}
              disabled={isLoading || actionLoading}
              className="px-4 py-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-lg font-medium hover:from-primary-600 hover:to-accent-600 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : hasActivePack ? (
                'Change Pack'
              ) : (
                'Subscribe'
              )}
            </button>
          )}

          {hasActivePack && (
            <button
              onClick={() => setCancelModalOpen(true)}
              disabled={isLoading || actionLoading}
              className="px-4 py-2 text-slate-400 hover:text-red-400 transition-colors text-sm"
            >
              Cancel Credit Pack
            </button>
          )}
        </div>
      </div>

      <CancelCreditPackModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancel}
        currentBalance={creditPackStatus.creditPackBalance}
        isLoading={actionLoading}
      />
    </>
  );
}
