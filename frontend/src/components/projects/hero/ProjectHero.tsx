/**
 * ProjectHero - Main hero component that routes to correct display mode
 *
 * Handles all hero display modes: image, video, slideshow, quote, slideup
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
}

export function ProjectHero({
  project,
  onToolClick,
  onLikeToggle,
  onCommentClick,
  isLiked = false,
  heartCount = 0,
  isAuthenticated = false,
}: ProjectHeroProps) {
  const heroMode = project.content?.heroDisplayMode || 'image';
  const heroQuote = project.content?.heroQuote;
  const heroVideoUrl = project.content?.heroVideoUrl;
  const heroSlideshowImages = project.content?.heroSlideshowImages || [];

  // Quote mode
  if (heroMode === 'quote' && heroQuote) {
    return <HeroQuote quote={heroQuote} />;
  }

  // Video mode
  if (heroMode === 'video' && heroVideoUrl) {
    return <HeroVideo videoUrl={heroVideoUrl} />;
  }

  // Slideshow mode
  if (heroMode === 'slideshow' && heroSlideshowImages.length > 0) {
    return <HeroSlideshow images={heroSlideshowImages} />;
  }

  // Slide-up mode
  if (heroMode === 'slideup') {
    return (
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
    />
  );
}
