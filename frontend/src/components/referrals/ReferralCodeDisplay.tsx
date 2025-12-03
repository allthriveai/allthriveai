import { useState } from 'react';
import { CheckIcon, ClipboardIcon, ShareIcon, PencilIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ReferralCodeDisplayProps {
  code: string;
  referralUrl: string;
  usesCount: number;
  maxUses?: number | null;
  isValid: boolean;
  onCodeUpdate?: (newCode: string) => Promise<void>;
}

export function ReferralCodeDisplay({
  code,
  referralUrl,
  usesCount,
  maxUses,
  isValid,
  onCodeUpdate,
}: ReferralCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(code);
  const [error, setError] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

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
          title: 'Join All Thrive AI',
          text: `Use my referral code to join All Thrive AI: ${code}`,
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

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(code);
    setError('');
    setIsAvailable(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(code);
    setError('');
    setIsAvailable(null);
  };

  const validateCode = (value: string): string | null => {
    const sanitized = value.trim().toUpperCase();

    if (!sanitized) {
      return 'Code cannot be empty';
    }
    if (sanitized.length < 3) {
      return 'Code must be at least 3 characters';
    }
    if (sanitized.length > 20) {
      return 'Code must be at most 20 characters';
    }
    if (!/^[A-Z0-9_-]+$/.test(sanitized)) {
      return 'Code can only contain letters, numbers, hyphens, and underscores';
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setEditValue(value);
    setError('');
    setIsAvailable(null);

    // Client-side validation
    const validationError = validateCode(value);
    if (validationError) {
      setError(validationError);
    }
  };

  const checkAvailability = async (value: string) => {
    if (!onCodeUpdate) return;

    const validationError = validateCode(value);
    if (validationError) {
      setError(validationError);
      setIsAvailable(false);
      return;
    }

    setIsChecking(true);
    try {
      const response = await fetch('/api/v1/me/referral-code/check_availability/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code: value }),
      });

      const data = await response.json();
      setIsAvailable(data.available);
      if (!data.available) {
        setError(data.error || 'This code is already taken');
      }
    } catch (error) {
      console.error('Failed to check availability:', error);
      setError('Failed to check availability');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSave = async () => {
    if (!onCodeUpdate) return;

    const validationError = validateCode(editValue);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await onCodeUpdate(editValue);
      setIsEditing(false);
      setError('');
    } catch (error: any) {
      setError(error.message || 'Failed to update code');
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
            Share this code with friends to invite them to All Thrive AI
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
        {!isEditing ? (
          <div className="flex items-center gap-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Your Referral Code
              </label>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-wider font-mono">
                {code}
              </p>
            </div>
            <div className="flex gap-2">
              {onCodeUpdate && (
                <button
                  onClick={handleEdit}
                  className="p-3 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  title="Edit code"
                >
                  <PencilIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
              )}
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
        ) : (
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Customize Your Referral Code
            </label>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={editValue}
                  onChange={handleInputChange}
                  onBlur={() => editValue && checkAvailability(editValue)}
                  placeholder="ENTER-CODE"
                  maxLength={20}
                  className="w-full px-4 py-3 text-xl font-bold font-mono tracking-wider uppercase bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg border-2 border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {error && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
                )}
                {isChecking && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Checking availability...</p>
                )}
                {isAvailable === true && !error && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400">✓ This code is available!</p>
                )}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  3-20 characters • Letters, numbers, hyphens, underscores
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!!error || isChecking || isAvailable === false}
                  className="px-4 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-3 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 font-medium rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
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
