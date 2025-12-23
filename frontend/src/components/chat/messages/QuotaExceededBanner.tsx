/**
 * QuotaExceededBanner - Shows when user has exceeded their AI usage limit
 *
 * Features:
 * - Shows current plan tier
 * - Shows AI request usage (used/limit)
 * - Shows token balance
 * - Buy tokens button (if available)
 * - Upgrade plan button
 * - Dismiss button
 * - Two variants: default (sidebar) and neon (EmberHomePage)
 */

import { XMarkIcon } from '@heroicons/react/24/outline';
import type { QuotaExceededBannerProps } from '../core/types';

export function QuotaExceededBanner({
  info,
  onDismiss,
  onNavigate,
  variant = 'default',
}: QuotaExceededBannerProps) {
  const isNeon = variant === 'neon';

  if (isNeon) {
    // Neon Glass variant (EmberHomePage)
    return (
      <div className="mx-4 mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-300 mb-1">
                AI Usage Limit Reached
              </p>
              <p className="text-sm text-amber-500/80 dark:text-amber-400/80">
                You've used all your AI requests for this period.
              </p>
              <div className="mt-2 text-xs text-amber-600/80 dark:text-amber-500/80 space-y-1">
                <p>Plan: <span className="font-medium text-amber-700 dark:text-amber-300">{info.tier}</span></p>
                {info.aiRequestsLimit > 0 && (
                  <p>Requests: {info.aiRequestsUsed} / {info.aiRequestsLimit} used</p>
                )}
                <p>Token Balance: <span className="font-medium text-amber-700 dark:text-amber-300">{info.tokenBalance.toLocaleString()}</span></p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-amber-200/50 dark:hover:bg-white/5 rounded transition-colors"
              aria-label="Dismiss"
            >
              <XMarkIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </button>
          </div>

          <div className="flex gap-2">
            {info.canPurchaseTokens && (
              <button
                onClick={() => onNavigate('/settings/billing?tab=tokens')}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
              >
                Buy Tokens
              </button>
            )}
            <button
              onClick={() => onNavigate(info.upgradeUrl)}
              className="flex-1 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 rounded-md transition-colors"
            >
              Upgrade Plan
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default variant (sidebar)
  return (
    <div className="mx-4 mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-1">
              AI Usage Limit Reached
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              You've used all your AI requests for this period.
            </p>
            <div className="mt-2 text-xs text-amber-600 dark:text-amber-500 space-y-1">
              <p>Plan: <span className="font-medium">{info.tier}</span></p>
              {info.aiRequestsLimit > 0 && (
                <p>Requests: {info.aiRequestsUsed} / {info.aiRequestsLimit} used</p>
              )}
              <p>Token Balance: <span className="font-medium">{info.tokenBalance.toLocaleString()}</span></p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-amber-200 dark:hover:bg-amber-800 rounded transition-colors"
            aria-label="Dismiss"
          >
            <XMarkIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </button>
        </div>

        <div className="flex gap-2">
          {info.canPurchaseTokens && (
            <button
              onClick={() => onNavigate('/settings/billing?tab=tokens')}
              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
            >
              Buy Tokens
            </button>
          )}
          <button
            onClick={() => onNavigate(info.upgradeUrl)}
            className="flex-1 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-md transition-colors"
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}
