import { useState } from 'react';
import { CheckIcon, ClipboardIcon, ShareIcon } from '@heroicons/react/24/outline';

interface ReferralCodeDisplayProps {
  code: string;
  referralUrl: string;
  usesCount: number;
  maxUses?: number | null;
  isValid: boolean;
}

export function ReferralCodeDisplay({
  code,
  referralUrl,
  usesCount,
  maxUses,
  isValid,
}: ReferralCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join AllThrive AI',
          text: `Use my referral code to join AllThrive AI: ${code}`,
          url: referralUrl,
        });
      } catch (error) {
        console.error('Failed to share:', error);
      }
    } else {
      // Fallback to copying URL if Web Share API is not available
      handleCopyUrl();
    }
  };

  return (
    <div className="glass-strong rounded-xl p-6 border border-white/20">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Your Referral Code
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Share this code with friends to invite them to AllThrive AI
          </p>
        </div>
        {isValid ? (
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            Active
          </span>
        ) : (
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
            Inactive
          </span>
        )}
      </div>

      {/* Referral Code Display */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Code
            </label>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-wider font-mono">
              {code}
            </p>
          </div>
          <button
            onClick={handleCopyCode}
            className="p-3 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
            title="Copy code"
          >
            {copied ? (
              <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <ClipboardIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Referral URL Display */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
          Referral Link
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={referralUrl}
            readOnly
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg border border-slate-300 dark:border-slate-600 font-mono"
          />
          <button
            onClick={handleCopyUrl}
            className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors flex items-center gap-2"
          >
            {copiedUrl ? (
              <>
                <CheckIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Copied!</span>
              </>
            ) : (
              <>
                <ClipboardIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats and Share */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="text-sm">
          <span className="text-slate-600 dark:text-slate-400">Uses: </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {usesCount}
            {maxUses && ` / ${maxUses}`}
          </span>
        </div>
        <button
          onClick={handleShare}
          className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors flex items-center gap-2"
        >
          <ShareIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>
    </div>
  );
}
