/**
 * ProjectHero - Main hero component that routes to correct display mode
 *
 * Handles all hero display modes: image, video, slideshow, quote, slideup
 * Supports inline editing for owners.
 */

import type { Project } from '@/types/models';
import { HeroImage } from './HeroImage';
import { HeroVideo } from './HeroVideo';
import { HeroQuote } from './HeroQuote';
import { HeroSlideshow } from './HeroSlideshow';
import { SlideUpHero } from '../SlideUpHero';

interface ProjectHeroProps {
  project: Project;
  /** Callbacks for SlideUpHero mode */
  onToolClick?: (slug: string) => void;
  onLikeToggle?: () => void;
  onCommentClick?: () => void;
  isLiked?: boolean;
  heartCount?: number;
  isAuthenticated?: boolean;
  /** Inline editing props */
  isEditing?: boolean;
  onEditClick?: () => void;
  onHeroImageChange?: (url: string) => void;
  onHeroImageUpload?: (file: File) => void;
  isUploadingHeroImage?: boolean;
}

export function ProjectHero({
  project,
  onToolClick,
  onLikeToggle,
  onCommentClick,
  isLiked = false,
  heartCount = 0,
  isAuthenticated = false,
  isEditing = false,
  onEditClick,
  onHeroImageChange,
  onHeroImageUpload,
  isUploadingHeroImage = false,
}: ProjectHeroProps) {
  const heroMode = project.content?.heroDisplayMode || 'image';
  const heroQuote = project.content?.heroQuote;
  const heroVideoUrl = project.content?.heroVideoUrl;
  const heroSlideshowImages = project.content?.heroSlideshowImages || [];
  const redditPermalink = project.content?.redditPermalink || project.externalUrl;

  // Helper to wrap content with edit overlay when in editing mode
  const wrapWithEditOverlay = (content: React.ReactNode) => {
    if (!isEditing || !onEditClick) return content;

    return (
      <div className="relative group cursor-pointer" onClick={onEditClick}>
        {content}
        {/* Edit overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-2xl">
          <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl text-white font-medium">
            Click to edit hero
          </div>
        </div>
      </div>
    );
  };

  // Quote mode
  if (heroMode === 'quote' && heroQuote) {
    return wrapWithEditOverlay(<HeroQuote quote={heroQuote} />);
  }

  // Video mode
  if (heroMode === 'video' && heroVideoUrl) {
    return wrapWithEditOverlay(<HeroVideo videoUrl={heroVideoUrl} redditPermalink={redditPermalink} />);
  }

  // Slideshow mode
  if (heroMode === 'slideshow' && heroSlideshowImages.length > 0) {
    return wrapWithEditOverlay(<HeroSlideshow images={heroSlideshowImages} />);
  }

  // Slide-up mode
  if (heroMode === 'slideup') {
    return wrapWithEditOverlay(
      <SlideUpHero
        element1={project.content?.heroSlideUpElement1}
        element2={project.content?.heroSlideUpElement2}
        tools={project.toolsDetails}
        onToolClick={onToolClick}
        isLiked={isLiked}
        heartCount={heartCount}
        onLikeToggle={onLikeToggle}
        onCommentClick={onCommentClick}
        isAuthenticated={isAuthenticated}
      />
    );
  }

  // Default: Image mode
  return (
    <HeroImage
      imageUrl={project.featuredImageUrl}
      projectTitle={project.title}
      projectType={project.type}
      isEditing={isEditing}
      onEditClick={onEditClick}
      onImageChange={onHeroImageChange}
      onImageUpload={onHeroImageUpload}
      isUploading={isUploadingHeroImage}
    />
  );
}
