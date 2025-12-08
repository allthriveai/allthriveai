/**
 * HeroImage - Image display mode for project hero
 *
 * Displays featured image with zoom-on-hover and full-screen modal.
 */

import { useState } from 'react';
import type { ComponentType } from 'react';
import {
  DocumentTextIcon,
  CodeBracketIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

interface HeroImageProps {
  imageUrl: string | null | undefined;
  projectTitle: string;
  projectType: string;
}

// Type icons for fallback display
const typeIcons: Record<string, ComponentType<{ className?: string }>> = {
  github_repo: CodeBracketIcon,
  figma_design: PhotoIcon,
  image_collection: PhotoIcon,
  prompt: ChatBubbleLeftRightIcon,
  reddit_thread: ChatBubbleLeftRightIcon,
  other: DocumentTextIcon,
};

export function HeroImage({ imageUrl, projectTitle, projectType }: HeroImageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const Icon = typeIcons[projectType] || DocumentTextIcon;

  // No image - show fallback
  if (!imageUrl) {
    return (
      <div className="w-full aspect-video rounded-2xl md:rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center p-6 md:p-12 text-center shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10">
          <Icon className="w-16 h-16 md:w-24 md:h-24 text-white/20 mx-auto mb-4 md:mb-6" />
          <p className="text-white/40 text-base md:text-lg font-light">No featured image provided</p>
        </div>
      </div>
    );
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
