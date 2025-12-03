/**
 * BannerEditor - Full-width banner editor for the section editor
 *
 * Displays the banner at the top of the editor canvas with hover-to-edit
 * functionality. Provides:
 * - Full-width banner display (matches published view)
 * - Click to edit with gradient presets
 * - Upload or URL input
 * - Visual feedback during upload
 */

import { useState, useRef } from 'react';
import {
  PhotoIcon,
  XMarkIcon,
  CheckCircleIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { FaCamera } from 'react-icons/fa';
import { useSectionEditorContext } from '@/context/SectionEditorContext';

// Gradient banner presets - beautiful abstract gradients
const GRADIENT_BANNERS = [
  'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=1600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1557682268-e3955ed5d83f?w=1600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=1600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1600&h=400&fit=crop',
];

export function BannerEditor() {
  const {
    bannerUrl,
    setBannerUrl,
    handleBannerUpload,
    uploadState,
  } = useSectionEditorContext();

  const [showEditor, setShowEditor] = useState(false);
  const [urlInput, setUrlInput] = useState(bannerUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploading = uploadState.banner;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await handleBannerUpload(file);
        setShowEditor(false);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput && urlInput !== bannerUrl) {
      setBannerUrl(urlInput);
    }
    setShowEditor(false);
  };

  const handleGradientSelect = (url: string) => {
    setBannerUrl(url);
    setUrlInput(url);
  };

  // Render the banner display
  if (!showEditor) {
    return (
      <div
        className="relative w-full h-48 md:h-64 lg:h-72 group cursor-pointer overflow-hidden"
        onClick={() => {
          setUrlInput(bannerUrl);
          setShowEditor(true);
        }}
      >
        {bannerUrl ? (
          <>
            {/* Banner Image */}
            <img
              src={bannerUrl}
              alt="Project banner"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/allthrive-placeholder.svg';
              }}
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </>
        ) : (
          /* Empty State */
          <div className="w-full h-full bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 flex items-center justify-center">
            <div className="text-center">
              <PhotoIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-2" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Click to add banner
              </p>
            </div>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="text-center">
            <FaCamera className="w-10 h-10 md:w-12 md:h-12 text-white mx-auto mb-2" />
            <p className="text-white font-medium text-base md:text-lg">
              {bannerUrl ? 'Change Banner' : 'Add Banner'}
            </p>
          </div>
        </div>

        {/* Upload Progress Overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-white font-medium">Uploading...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render the editor panel
  return (
    <div className="w-full bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      {/* Preview */}
      <div className="relative w-full h-32 md:h-40 overflow-hidden">
        {bannerUrl ? (
          <>
            <img
              src={bannerUrl}
              alt="Banner preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
        )}
      </div>

      {/* Editor Panel */}
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Gradient Presets */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Choose a Gradient
          </label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {GRADIENT_BANNERS.map((url, index) => (
              <button
                key={index}
                onClick={() => handleGradientSelect(url)}
                className={`relative h-16 md:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                  bannerUrl === url
                    ? 'border-primary-500 ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900'
                    : 'border-gray-300 dark:border-gray-700 hover:border-primary-400'
                }`}
              >
                <img
                  src={url}
                  alt={`Gradient ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {bannerUrl === url && (
                  <div className="absolute inset-0 bg-primary-500/30 flex items-center justify-center">
                    <CheckCircleIcon className="w-6 h-6 text-white drop-shadow-lg" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Section */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Upload Button */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Upload Image
            </label>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-600 dark:text-gray-400">Uploading...</span>
                </>
              ) : (
                <>
                  <ArrowUpTrayIcon className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    Click to upload
                  </span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Recommended: 1600x400px (4:1). Max 5MB.
            </p>
          </div>

          {/* URL Input */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Or paste URL
            </label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUrlSubmit();
              }}
              placeholder="https://example.com/banner.jpg"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={() => {
              setBannerUrl('');
              setUrlInput('');
            }}
            className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 inline-block mr-1" />
            Remove Banner
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setUrlInput(bannerUrl);
                setShowEditor(false);
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUrlSubmit}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
