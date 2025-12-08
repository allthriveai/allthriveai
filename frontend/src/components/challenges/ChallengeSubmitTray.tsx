/**
 * ChallengeSubmitTray - Right sidebar tray for submitting entries to weekly challenges
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  XMarkIcon,
  ArrowUpTrayIcon,
  LinkIcon,
  PhotoIcon,
  CheckIcon,
  BoltIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import {
  submitToChallenge,
  type WeeklyChallenge,
  type CreateSubmissionData,
} from '@/services/challenges';
import { uploadImage } from '@/services/upload';
import { logError } from '@/utils/errorHandler';

interface ChallengeSubmitTrayProps {
  isOpen: boolean;
  challenge: WeeklyChallenge;
  onClose: () => void;
  onSuccess: () => void;
}

// Popular AI tools for quick selection
const popularTools = [
  'Midjourney',
  'DALL-E 3',
  'Stable Diffusion',
  'Leonardo AI',
  'Ideogram',
  'Flux',
];

export function ChallengeSubmitTray({
  isOpen,
  challenge,
  onClose,
  onSuccess,
}: ChallengeSubmitTrayProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [aiToolUsed, setAiToolUsed] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track if tray should be rendered (for slide-out animation)
  const [shouldRender, setShouldRender] = useState(false);

  // Handle mount/unmount for animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    }
  }, [isOpen]);

  // Handle transition end to unmount after closing
  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Reset form when tray opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setImageUrl('');
      setExternalUrl('');
      setAiToolUsed('');
      setError(null);
      setImagePreview(null);
      setIsDragging(false);
      setIsUploading(false);
    }
  }, [isOpen]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, GIF, WebP)');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image must be less than 10MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const response = await uploadImage(file, 'challenges', true);
      setImageUrl(response.url);
    } catch (err) {
      setError('Failed to upload image. Please try again or use a URL.');
      setImagePreview(null);
      logError('Failed to upload challenge image', err as Error, {
        component: 'ChallengeSubmitTray',
        challengeSlug: challenge.slug,
        fileName: file.name,
        fileSize: file.size,
      });
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const clearImage = useCallback(() => {
    setImageUrl('');
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

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

    const data: CreateSubmissionData = {
      title: title.trim(),
      description: description.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      externalUrl: externalUrl.trim() || undefined,
      aiToolUsed: aiToolUsed.trim() || undefined,
    };

    try {
      await submitToChallenge(challenge.slug, data);
      onSuccess();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to submit. Please try again.';
      setError(errorMessage);
      logError('Failed to submit challenge entry', err as Error, {
        component: 'ChallengeSubmitTray',
        challengeSlug: challenge.slug,
        data,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!shouldRender) return null;

  return (
    <>
      {/* Backdrop - Clickable when open */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Right Sidebar Tray */}
      <aside
        className={`fixed right-0 top-0 h-full w-full sm:w-[28rem] lg:w-[32rem] border-l border-gray-200 dark:border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col bg-white dark:bg-gray-900 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <BoltIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Submit Your Entry
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Week {challenge.weekNumber}, {challenge.year}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Challenge info */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 mb-6"
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
          <form onSubmit={handleSubmit} className="space-y-5">
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

            {/* Image Upload / URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                <PhotoIcon className="inline w-4 h-4 mr-2" />
                Image <span className="text-pink-500">*</span>
              </label>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {/* Show preview if we have an image */}
              {(imagePreview || imageUrl) ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                  <img
                    src={imagePreview || imageUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <ArrowPathIcon className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
                    aria-label="Remove image"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* Drag and drop zone */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                      : 'border-gray-300 dark:border-white/20 hover:border-cyan-400 dark:hover:border-cyan-500/50 bg-gray-50 dark:bg-white/5'
                  }`}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <ArrowPathIcon className="w-8 h-8 text-cyan-500 animate-spin" />
                      <p className="text-sm text-gray-600 dark:text-slate-400">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <CloudArrowUpIcon className={`w-10 h-10 ${isDragging ? 'text-cyan-500' : 'text-gray-400 dark:text-slate-500'}`} />
                      <p className="text-sm text-gray-600 dark:text-slate-400">
                        <span className="font-medium text-cyan-600 dark:text-cyan-400">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-500">
                        PNG, JPG, GIF, WebP up to 10MB
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* URL input as fallback */}
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
                  <span className="text-xs text-gray-500 dark:text-slate-500">or paste URL</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
                </div>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setImagePreview(null);
                  }}
                  placeholder="https://example.com/your-image.jpg"
                  className="w-full px-4 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-500/50 text-sm transition-colors"
                />
              </div>
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
                  <button
                    key={tool}
                    type="button"
                    onClick={() => setAiToolUsed(tool)}
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
                  </button>
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
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}
          </form>
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          {/* Points info */}
          {challenge.pointsConfig && (
            <p className="text-xs text-center text-gray-500 dark:text-slate-500 mb-3">
              You'll earn{' '}
              <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                +{challenge.pointsConfig.submit || 50} points
              </span>{' '}
              for submitting!
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-300 dark:border-white/10 transition-colors font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
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
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default ChallengeSubmitTray;
