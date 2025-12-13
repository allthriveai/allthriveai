/**
 * BattleShareModal Component
 *
 * Modal for sharing battle results to social media platforms.
 * Fetches share data from the API and displays platform-specific share options.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  ShareIcon,
  LinkIcon,
  CheckIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/solid';
import { api } from '@/services/api';

// Social platform icons as SVG components
const TwitterIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const RedditIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
  </svg>
);

interface ShareData {
  battleId: number;
  shareUrl: string;
  ogImageUrl: string | null;
  shareText: {
    headline: string;
    twitter: string;
    facebook: string;
    reddit: string;
    emailSubject: string;
    emailBody: string;
  };
  platformUrls: {
    twitter: string;
    facebook: string;
    linkedin: string;
    reddit: string;
    email: string;
  };
  meta: {
    title: string;
    description: string;
    image: string | null;
  };
}

interface BattleShareModalProps {
  battleId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function BattleShareModal({ battleId, isOpen, onClose }: BattleShareModalProps) {
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch share data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const controller = new AbortController();

    const fetchShareData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/battles/${battleId}/share/`, {
          signal: controller.signal,
        });
        if (isMounted) {
          setShareData(response.data);
        }
      } catch (err) {
        if (isMounted && !controller.signal.aborted) {
          setError('Failed to load share options');
          console.error('Error fetching share data:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchShareData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [battleId, isOpen]);

  // Handle escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Cleanup copied timeout on unmount
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  const copyToClipboard = useCallback(async () => {
    if (!shareData) return;

    try {
      await navigator.clipboard.writeText(shareData.shareUrl);
      setCopied(true);

      // Clear any existing timeout
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }

      copiedTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        copiedTimeoutRef.current = null;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [shareData]);

  const openShareLink = (url: string) => {
    window.open(url, '_blank', 'width=600,height=400,menubar=no,toolbar=no');
  };

  const platforms = shareData
    ? [
        {
          name: 'Twitter/X',
          icon: TwitterIcon,
          url: shareData.platformUrls.twitter,
          color: 'hover:bg-slate-800',
        },
        {
          name: 'Facebook',
          icon: FacebookIcon,
          url: shareData.platformUrls.facebook,
          color: 'hover:bg-blue-900/30',
        },
        {
          name: 'LinkedIn',
          icon: LinkedInIcon,
          url: shareData.platformUrls.linkedin,
          color: 'hover:bg-blue-800/30',
        },
        {
          name: 'Reddit',
          icon: RedditIcon,
          url: shareData.platformUrls.reddit,
          color: 'hover:bg-orange-900/30',
        },
        {
          name: 'Email',
          icon: EnvelopeIcon,
          url: shareData.platformUrls.email,
          color: 'hover:bg-slate-700',
        },
      ]
    : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Slide-out tray from right */}
          <motion.div
            ref={modalRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 sm:max-w-[90vw]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
          >
            <div className="h-full bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <ShareIcon className="w-5 h-5 text-cyan-400" aria-hidden="true" />
                  <h2 id="share-modal-title" className="text-lg font-semibold text-white">Share Battle</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-slate-800 transition-colors"
                  aria-label="Close share modal"
                >
                  <XMarkIcon className="w-5 h-5 text-slate-400" aria-hidden="true" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-red-400">{error}</p>
                    <button
                      onClick={onClose}
                      className="mt-4 px-4 py-2 bg-slate-800 rounded-lg text-slate-300 hover:bg-slate-700"
                    >
                      Close
                    </button>
                  </div>
                ) : shareData ? (
                  <>
                    {/* OG Image Preview */}
                    {shareData.ogImageUrl && (
                      <div className="mb-6 rounded-xl overflow-hidden border border-slate-700/50">
                        <img
                          src={shareData.ogImageUrl}
                          alt="Share preview"
                          className="w-full h-auto"
                        />
                      </div>
                    )}

                    {/* Headline */}
                    <p className="text-center text-slate-300 mb-6">
                      {shareData.shareText.headline}
                    </p>

                    {/* Platform buttons */}
                    <div className="grid grid-cols-2 gap-3 mb-6" role="group" aria-label="Share platforms">
                      {platforms.map((platform) => (
                        <button
                          key={platform.name}
                          onClick={() => openShareLink(platform.url)}
                          className={`flex items-center gap-3 p-4 rounded-xl
                                     bg-slate-800/50 border border-slate-700/50
                                     transition-all ${platform.color}`}
                          aria-label={`Share on ${platform.name}`}
                        >
                          <span aria-hidden="true" className="text-slate-300"><platform.icon /></span>
                          <span className="text-sm text-slate-300 font-medium">
                            {platform.name.split('/')[0]}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Copy link */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareData.shareUrl}
                        readOnly
                        aria-label="Share URL"
                        className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50
                                   rounded-xl text-slate-300 text-sm truncate"
                      />
                      <button
                        onClick={copyToClipboard}
                        className={`px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-2
                                   ${copied
                                     ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                     : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/30'
                                   }`}
                        aria-label={copied ? 'Link copied to clipboard' : 'Copy link to clipboard'}
                      >
                        {copied ? (
                          <>
                            <CheckIcon className="w-5 h-5" aria-hidden="true" />
                            <span aria-live="polite">Copied!</span>
                          </>
                        ) : (
                          <>
                            <LinkIcon className="w-5 h-5" aria-hidden="true" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default BattleShareModal;
