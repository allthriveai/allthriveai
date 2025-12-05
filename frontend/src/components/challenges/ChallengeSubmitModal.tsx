/**
 * ChallengeSubmitModal - Modal for submitting entries to weekly challenges
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  ArrowUpTrayIcon,
  LinkIcon,
  PhotoIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import {
  submitToChallenge,
  type WeeklyChallenge,
  type CreateSubmissionData,
} from '@/services/challenges';
import { logError } from '@/utils/errorHandler';

interface ChallengeSubmitModalProps {
  challenge: WeeklyChallenge;
  onClose: () => void;
  onSuccess: () => void;
}

// Animation variants
const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

export function ChallengeSubmitModal({
  challenge,
  onClose,
  onSuccess,
}: ChallengeSubmitModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [aiToolUsed, setAiToolUsed] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Popular AI tools for quick selection
  const popularTools = [
    'Midjourney',
    'DALL-E 3',
    'Stable Diffusion',
    'Leonardo AI',
    'Ideogram',
    'Flux',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please enter a title for your submission');
      return;
    }

    if (!imageUrl.trim() && !externalUrl.trim()) {
      setError('Please provide an image URL or external link');
      return;
    }

    setIsSubmitting(true);

    try {
      const data: CreateSubmissionData = {
        title: title.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        externalUrl: externalUrl.trim() || undefined,
        aiToolUsed: aiToolUsed.trim() || undefined,
      };

      await submitToChallenge(challenge.slug, data);
      onSuccess();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to submit. Please try again.';
      setError(errorMessage);
      logError('Failed to submit challenge entry', err as Error, {
        component: 'ChallengeSubmitModal',
        challengeSlug: challenge.slug,
        data,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          variants={backdropVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          variants={modalVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Submit Your Entry
            </h2>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 flex items-center justify-center text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Challenge info */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 mb-6"
          >
            <p className="text-sm text-cyan-700 dark:text-cyan-400 font-medium">
              {challenge.title}
            </p>
            {challenge.prompt && (
              <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                {challenge.prompt}
              </p>
            )}
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Title <span className="text-pink-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your creation a name"
                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-500/50 transition-colors"
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your creation (optional)"
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-500/50 resize-none transition-colors"
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                <PhotoIcon className="inline w-4 h-4 mr-2" />
                Image URL <span className="text-pink-500">*</span>
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/your-image.jpg"
                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-500/50 transition-colors"
              />
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Direct link to your image (from imgur, Discord, etc.)
              </p>
            </div>

            {/* External URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                <LinkIcon className="inline w-4 h-4 mr-2" />
                External Link (Optional)
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://your-portfolio.com/project"
                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-500/50 transition-colors"
              />
            </div>

            {/* AI Tool Used */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                AI Tool Used
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {popularTools.map((tool) => (
                  <motion.button
                    key={tool}
                    type="button"
                    onClick={() => setAiToolUsed(tool)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      aiToolUsed === tool
                        ? 'bg-cyan-100 dark:bg-cyan-500/30 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-500/50'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    {aiToolUsed === tool && (
                      <CheckIcon className="inline w-3 h-3 mr-1" />
                    )}
                    {tool}
                  </motion.button>
                ))}
              </div>
              <input
                type="text"
                value={aiToolUsed}
                onChange={(e) => setAiToolUsed(e.target.value)}
                placeholder="Or type your own..."
                className="w-full px-4 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-500/50 text-sm transition-colors"
              />
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <div className="flex gap-3 pt-4">
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 px-4 py-3 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-300 dark:border-white/10 transition-colors font-medium"
                disabled={isSubmitting}
              >
                Cancel
              </motion.button>
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium inline-flex items-center justify-center gap-2 hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <ArrowUpTrayIcon className="w-5 h-5" />
                    Submit Entry
                  </>
                )}
              </motion.button>
            </div>

            {/* Points info */}
            {challenge.pointsConfig && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-xs text-center text-gray-500 dark:text-slate-500"
              >
                You'll earn{' '}
                <span className="text-cyan-600 dark:text-cyan-400">
                  +{challenge.pointsConfig.submit || 50} points
                </span>{' '}
                for submitting!
              </motion.p>
            )}
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
