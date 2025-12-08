/**
 * BannerImageSection - Reusable banner image upload/edit component
 * Part of the scalable ProjectFieldsEditor system
 */

import { useState } from 'react';
import { PhotoIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { FaCamera } from 'react-icons/fa';

interface BannerImageSectionProps {
  bannerUrl: string;
  setBannerUrl: (url: string) => void;
  handleBannerUpload: (file: File) => void;
  isUploadingBanner: boolean;
  isSaving?: boolean;
}

const GRADIENT_BANNERS = [
  'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=1600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1557682268-e3955ed5d83f?w=1600&h=400&fit=crop',
];

export function BannerImageSection({
  bannerUrl,
  setBannerUrl,
  handleBannerUpload,
  isUploadingBanner,
}: BannerImageSectionProps) {
  const [showBannerEdit, setShowBannerEdit] = useState(false);

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
        Banner Image
      </label>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        This appears on your project card in Explore
      </p>

      <div className="relative">
        {bannerUrl ? (
          <div
            className="group relative w-full h-48 overflow-hidden cursor-pointer rounded-lg"
            onClick={() => setShowBannerEdit(!showBannerEdit)}
          >
            <img
              src={bannerUrl}
              alt="Project banner"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/allthrive-placeholder.svg';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/80 to-gray-900/40 backdrop-blur-[1px]" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="text-center">
                <FaCamera className="w-12 h-12 text-white mx-auto mb-3" />
                <p className="text-white font-medium text-lg">Change Banner</p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer rounded-lg"
            onClick={() => setShowBannerEdit(true)}
          >
            <div className="text-center">
              <PhotoIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">Add a banner image</p>
            </div>
          </div>
        )}

        {showBannerEdit && (
          <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg">
            <div className="space-y-4">
              {/* Gradient Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Choose a Gradient
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GRADIENT_BANNERS.map((gradientUrl, index) => (
                    <button
                      key={index}
                      onClick={() => setBannerUrl(gradientUrl)}
                      className={`relative h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        bannerUrl === gradientUrl
                          ? 'border-primary-500 ring-2 ring-primary-500 ring-offset-2'
                          : 'border-gray-300 dark:border-gray-700 hover:border-primary-400'
                      }`}
                    >
                      <img src={gradientUrl} alt={`Gradient ${index + 1}`} className="w-full h-full object-cover" />
                      {bannerUrl === gradientUrl && (
                        <div className="absolute inset-0 bg-primary-500/20 flex items-center justify-center">
                          <CheckCircleIcon className="w-8 h-8 text-white drop-shadow-lg" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload Banner Image
                </label>
                <label className="flex-1 cursor-pointer">
                  <div className="px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 transition-colors text-center">
                    {isUploadingBanner ? (
                      <span className="text-gray-600 dark:text-gray-400">Uploading...</span>
                    ) : (
                      <span className="text-gray-600 dark:text-gray-400">Click to upload</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBannerUpload(file);
                    }}
                    className="hidden"
                    disabled={isUploadingBanner}
                  />
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Recommended size: 1600x400px (4:1 ratio). Max 5MB.
                </p>
              </div>

              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Banner Image URL
                </label>
                <input
                  type="url"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setShowBannerEdit(false);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="https://example.com/banner.jpg"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setBannerUrl('');
                    setShowBannerEdit(false);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Remove
                </button>
                <button
                  onClick={() => setShowBannerEdit(false)}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
