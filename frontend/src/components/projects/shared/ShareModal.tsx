/**
 * ShareModal - Unified share modal for all project types
 *
 * Provides consistent sharing experience across all project layouts
 * with social media links and copy-to-clipboard functionality.
 */

import { useState } from 'react';
import {
  XMarkIcon,
  LinkIcon,
  CheckIcon,
  DocumentTextIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  username: string;
  slug: string;
  /** Optional custom share text. Defaults to project title */
  shareText?: string;
}

export function ShareModal({
  isOpen,
  onClose,
  title,
  username,
  slug,
  shareText,
}: ShareModalProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}/${username}/${slug}`;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const text = shareText || `Check out "${title}" by @${username} on All Thrive AI`;
  const encodedText = encodeURIComponent(text);
  const encodedDescription = encodeURIComponent(`Check out ${title} by @${username}`);

  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`,
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const downloadContext = async (format: 'md' | 'json') => {
    setDownloadError(null);
    try {
      const endpoint = format === 'md' ? 'context-md' : 'context-json';
      // Add ?download=true for markdown to trigger Content-Disposition header
      const queryParam = format === 'md' ? '?download=true' : '';
      const url = `/api/v1/users/${username}/projects/${slug}/${endpoint}/${queryParam}`;
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          // Use */* for markdown since DRF content negotiation doesn't support text/markdown
          'Accept': format === 'json' ? 'application/json' : '*/*',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Download error response:', response.status, errorText);
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const filename = format === 'md' ? 'claude.md' : `${slug}.json`;

      // Trigger download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Failed to download context:', error);
      setDownloadError('Download failed. Please try again.');
      setTimeout(() => setDownloadError(null), 3000);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 animate-[fade-in_0.2s_ease-out] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded shadow-2xl max-w-md w-full p-6 animate-[scale-in_0.2s_ease-out] border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Share Project</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Social Media Buttons */}
        <div className="space-y-3 mb-6">
          <a
            href={shareUrls.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="font-medium">Share on X (Twitter)</span>
          </a>

          <a
            href={shareUrls.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#0A66C2] hover:bg-[#094d92] text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            <span className="font-medium">Share on LinkedIn</span>
          </a>

          <a
            href={shareUrls.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#1877F2] hover:bg-[#1565d8] text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span className="font-medium">Share on Facebook</span>
          </a>

          <a
            href={shareUrls.reddit}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#FF4500] hover:bg-[#e03d00] text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
            </svg>
            <span className="font-medium">Share on Reddit</span>
          </a>

          <a
            href={shareUrls.email}
            className="flex items-center gap-3 w-full p-3 rounded-lg bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="font-medium">Share via Email</span>
          </a>
        </div>

        {/* Copy Link */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 w-full p-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white transition-colors"
          >
            {linkCopied ? (
              <>
                <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-600 dark:text-green-400">Link Copied!</span>
              </>
            ) : (
              <>
                <LinkIcon className="w-5 h-5" />
                <span className="font-medium">Copy Link</span>
              </>
            )}
          </button>
        </div>

        {/* Download for AI */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Download for AI tools</p>
          <div className="flex gap-2">
            <button
              onClick={() => downloadContext('md')}
              className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white transition-colors"
            >
              <DocumentTextIcon className="w-5 h-5" />
              <span className="font-medium">claude.md</span>
            </button>
            <button
              onClick={() => downloadContext('json')}
              className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white transition-colors"
            >
              <CodeBracketIcon className="w-5 h-5" />
              <span className="font-medium">JSON</span>
            </button>
          </div>
          {downloadError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{downloadError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
