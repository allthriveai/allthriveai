/**
 * HeroImage - Image display mode for project hero
 *
 * Displays featured image with zoom-on-hover and full-screen modal.
 * Returns null if no image is provided (hides the component entirely).
 */

import { useState } from 'react';

interface HeroImageProps {
  imageUrl: string | null | undefined;
  projectTitle: string;
  projectType?: string; // Optional, kept for backwards compatibility
}

export function HeroImage({ imageUrl, projectTitle }: HeroImageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // No image - hide the component entirely
  if (!imageUrl) {
    return null;
  }

  return (
    <>
      <div
        className="relative group transform hover:scale-[1.02] transition-all duration-500 ease-out hover:rotate-1 cursor-zoom-in"
        onClick={() => setIsModalOpen(true)}
      >
        {/* Glassy Card Container for Image */}
        <div className="absolute -inset-2 md:-inset-4 bg-white/5 rounded-2xl md:rounded-3xl blur-lg md:blur-xl opacity-50 transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl" />
        <div className="relative p-1 md:p-2 bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl">
          <img
            src={imageUrl}
            alt={`${projectTitle} featured`}
            className="w-full h-auto rounded-xl md:rounded-2xl shadow-inner"
          />
        </div>
      </div>

      {/* Full Screen Image Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
          onClick={() => setIsModalOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            onClick={() => setIsModalOpen(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={imageUrl}
            alt={`${projectTitle} full view`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-[scale-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
