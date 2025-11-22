import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { Project } from '@/types/models';
import {
  CodeBracketIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  PencilIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  EyeSlashIcon,
  EyeIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { toggleProjectLike } from '@/services/projects';

interface ProjectCardProps {
  project: Project;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (projectId: number) => void;
  isOwner?: boolean;  // Is the current user the owner of this project
  variant?: 'default' | 'masonry';  // Layout variant
  onDelete?: (projectId: number) => void;
  onToggleShowcase?: (projectId: number) => void;
}

const typeIcons = {
  github_repo: CodeBracketIcon,
  image_collection: PhotoIcon,
  prompt: ChatBubbleLeftRightIcon,
  other: DocumentTextIcon,
};

const typeLabels = {
  github_repo: 'GitHub Repo',
  image_collection: 'Image Collection',
  prompt: 'Prompt',
  other: 'Project',
};

export function ProjectCard({ project, selectionMode = false, isSelected = false, onSelect, isOwner = false, variant = 'default', onDelete, onToggleShowcase }: ProjectCardProps) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [isLiked, setIsLiked] = useState(project.isLikedByUser);
  const [heartCount, setHeartCount] = useState(project.heartCount);
  const [isLiking, setIsLiking] = useState(false);
  const Icon = typeIcons[project.type];
  const projectUrl = `/${project.username}/${project.slug}`;

  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode && onSelect) {
      e.preventDefault();
      onSelect(project.id);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLiking) return;

    setIsLiking(true);
    try {
      const result = await toggleProjectLike(project.id);
      setIsLiked(result.liked);
      setHeartCount(result.heartCount);
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  // Get hero element to display
  const getHeroElement = () => {
    const heroMode = project.content?.heroDisplayMode;

    // If hero mode is specified, use that (regardless of variant)
    if (heroMode === 'image' && project.featuredImageUrl) {
      return { type: 'image' as const, url: project.featuredImageUrl };
    }
    if (heroMode === 'video' && project.content?.heroVideoUrl) {
      return { type: 'video' as const, url: project.content.heroVideoUrl };
    }
    if (heroMode === 'slideshow' && project.content?.heroSlideshowImages && project.content.heroSlideshowImages.length > 0) {
      return { type: 'slideshow' as const, images: project.content.heroSlideshowImages };
    }
    if (heroMode === 'quote' && project.content?.heroQuote) {
      return { type: 'quote' as const, text: project.content.heroQuote };
    }
    if (heroMode === 'slideup' && project.content?.heroSlideUpElement1) {
      return {
        type: 'slideup' as const,
        element1: project.content.heroSlideUpElement1,
        element2: project.content.heroSlideUpElement2
      };
    }

    // Fallback: use featuredImageUrl > thumbnailUrl > placeholder
    if (project.featuredImageUrl) {
      return { type: 'image' as const, url: project.featuredImageUrl };
    }
    const cover = (project.content as Record<string, unknown>)?.coverImage || (project.content as Record<string, unknown>)?.cover;
    if (cover?.url) {
      return { type: 'image' as const, url: cover.url };
    }
    if (project.thumbnailUrl) {
      return { type: 'image' as const, url: project.thumbnailUrl };
    }
    return { type: 'image' as const, url: '/allthrive-placeholder.svg' };
  };

  const CardWrapper = selectionMode ? 'div' : Link;
  const cardProps = selectionMode
    ? { onClick: handleClick, style: { cursor: 'pointer' } }
    : { to: projectUrl };

  // Masonry variant - Flexible height for text, portrait for media
  if (variant === 'masonry') {
    const heroElement = getHeroElement();
    // Treat quote and slideup cards as media cards for styling purposes (dark mode overlay style)
    const isMediaCard = ['image', 'video', 'slideshow', 'quote', 'slideup'].includes(heroElement.type) || (heroElement.type === 'image' && project.type !== 'github_repo');
    const isQuote = heroElement.type === 'quote';
    const isSlideup = heroElement.type === 'slideup';

    // Get gradient colors for quote cards
    const gradientFrom = project.content?.heroGradientFrom || 'rgb(124, 58, 237)'; // violet-600
    const gradientTo = project.content?.heroGradientTo || 'rgb(79, 70, 229)'; // indigo-600

    return (
      <CardWrapper
        {...(cardProps as React.ComponentProps<typeof Link>)}
        className={`block relative rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group ${
          isSelected ? 'ring-4 ring-primary-500' : ''
        } ${(isQuote || isSlideup) ? 'min-h-[400px]' : (isMediaCard ? 'aspect-[3/4]' : 'h-auto')}`}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <div className="absolute top-4 left-4 z-30">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect && onSelect(project.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-6 h-6 rounded border-2 border-white shadow-lg cursor-pointer"
            />
          </div>
        )}

        {/* BACKGROUND LAYER */}
        <div className="absolute inset-0 bg-gray-900">
            {heroElement.type === 'image' && (
              <img
                src={heroElement.url}
                alt={project.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            )}

            {heroElement.type === 'video' && (
              <video
                src={heroElement.url}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            )}

            {heroElement.type === 'slideshow' && (
              <img
                src={heroElement.images[0]}
                alt={project.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            )}

            {isQuote && (
              <div
                className="absolute inset-0 group-hover:scale-105 transition-transform duration-700"
                style={{
                  background: `linear-gradient(to bottom right, ${gradientFrom}, ${gradientTo})`
                }}
              >
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay pointer-events-none" />
              </div>
            )}

            {isSlideup && heroElement.element1 && (
              <>
                {/* Show element1 as background */}
                {heroElement.element1.type === 'image' && (
                  <img
                    src={heroElement.element1.content}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                {heroElement.element1.type === 'video' && (
                  <video
                    src={heroElement.element1.content}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                )}
                {heroElement.element1.type === 'text' && (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-6">
                    <p className="text-white text-lg md:text-xl font-medium leading-relaxed line-clamp-6 text-center">
                      {heroElement.element1.content}
                    </p>
                  </div>
                )}
              </>
            )}
        </div>

        {/* CONTENT LAYER */}
        {/* Quote Content - Positioned to avoid footer overlap */}
        {isQuote && (
          <div className="absolute top-0 left-0 right-0 bottom-40 px-6 flex items-center justify-center z-10 pointer-events-none overflow-hidden">
             <p className="text-lg md:text-xl font-medium leading-relaxed tracking-normal drop-shadow-sm font-sans line-clamp-[8] text-white/95 text-center">
               {heroElement.text}
             </p>
          </div>
        )}

        {/* Slideup Element2 Preview - Show if it's text */}
        {isSlideup && heroElement.element2?.type === 'text' && (
          <div className="absolute top-0 left-0 right-0 bottom-40 px-6 flex items-center justify-center z-10 pointer-events-none overflow-hidden">
             <p className="text-lg md:text-xl font-medium leading-relaxed tracking-normal drop-shadow-lg font-sans line-clamp-[6] text-white/95 text-center">
               {heroElement.element2.content}
             </p>
          </div>
        )}

        {/* Repo Content (Flex Flow for non-media) */}
        {!isMediaCard && (
          <div className="relative w-full h-full flex flex-col min-h-[320px] bg-slate-900">
            {project.type === 'github_repo' && (
              <div className="absolute inset-0 opacity-50 pointer-events-none">
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
              </div>
            )}
            <div className="flex-1 p-8 flex flex-col items-center justify-center relative z-10">
               {project.type === 'github_repo' && (
                 <div className="w-full flex flex-col items-center gap-4 opacity-80">
                    <CodeBracketIcon className="w-16 h-16 text-slate-400" />
                    <div className="w-full space-y-2 opacity-50">
                      <div className="h-2 w-3/4 bg-slate-600 rounded mx-auto" />
                      <div className="h-2 w-1/2 bg-slate-600 rounded mx-auto" />
                      <div className="h-2 w-5/6 bg-slate-600 rounded mx-auto" />
                    </div>
                 </div>
               )}
            </div>
            <div className="h-4 shrink-0" />
          </div>
        )}

        {/* GRADIENT OVERLAY & FOOTER */}
        {/* Always render footer absolute at bottom for seamless look */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          {/* Gradient Background for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent -top-12" />

          <div className="relative p-5 pt-2">
            <h3 className="text-xl font-bold mb-1 line-clamp-2 leading-tight text-white drop-shadow-md">
              {project.title}
            </h3>

            {project.description && (
              <p className="text-sm mb-3 line-clamp-2 leading-relaxed font-medium text-white/90 drop-shadow-sm">
                {project.description}
              </p>
            )}

            {/* Tags */}
            {project.content?.tags && project.content.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {project.content.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="px-2.5 py-1 text-xs font-semibold rounded-full bg-white/10 text-white backdrop-blur-md border border-white/10"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleLike}
                disabled={isLiking}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:scale-105 disabled:opacity-50 group/heart bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20"
              >
                {isLiked ? (
                  <HeartIconSolid className="w-5 h-5 text-red-500 group-hover/heart:scale-110 transition-transform drop-shadow-sm" />
                ) : (
                  <HeartIcon className="w-5 h-5 text-white group-hover/heart:scale-110 transition-transform drop-shadow-sm" />
                )}
                <span className="text-sm font-bold text-white">
                  {heartCount > 0 ? heartCount : ''}
                </span>
              </button>

              {project.toolsDetails && project.toolsDetails.length > 0 ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20">
                  {project.toolsDetails[0].logoUrl && (
                    <img
                      src={project.toolsDetails[0].logoUrl}
                      alt={project.toolsDetails[0].name}
                      className="w-4 h-4 rounded object-contain"
                    />
                  )}
                  <span className="text-xs font-bold text-white">
                    {project.toolsDetails[0].name}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </CardWrapper>
    );
  }

  return (
    <CardWrapper
      {...(cardProps as React.ComponentProps<typeof Link>)}
      className={`block glass-subtle hover:glass-strong transition-all duration-300 rounded-xl overflow-hidden group relative ${
        isSelected ? 'ring-4 ring-primary-500' : ''
      }`}
    >
      {/* Selection checkbox - positioned absolutely over the card */}
      {selectionMode && (
        <div className="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect && onSelect(project.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded border-2 border-white shadow-lg cursor-pointer"
          />
        </div>
      )}

      {/* Thumbnail or placeholder */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={project.thumbnailUrl || '/allthrive-placeholder.svg'}
          alt={project.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Type badge and Menu button */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {isOwner && !selectionMode && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-lg transition-all hover:scale-110"
                title="Options"
              >
                <EllipsisVerticalIcon className="w-4 h-4" />
              </button>

              {/* Dropdown menu */}
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMenu(false);
                      navigate(`/${project.username}/${project.slug}/edit`);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <PencilIcon className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMenu(false);
                      if (onToggleShowcase) onToggleShowcase(project.id);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    {project.isShowcase ? (
                      <>
                        <EyeSlashIcon className="w-4 h-4" />
                        Remove from Showcase
                      </>
                    ) : (
                      <>
                        <EyeIcon className="w-4 h-4" />
                        Add to Showcase
                      </>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMenu(false);
                      if (onDelete) onDelete(project.id);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 border-t border-gray-200 dark:border-gray-700"
                  >
                    <TrashIcon className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
          <span className="px-2 py-1 text-xs font-medium rounded-full glass-strong border border-white/20 text-slate-700 dark:text-slate-300">
            {typeLabels[project.type]}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
          {project.title}
        </h3>

        {project.description && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Tags */}
        {project.content?.tags && project.content.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {project.content.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs rounded-md bg-white/50 dark:bg-white/5 text-slate-600 dark:text-slate-400"
              >
                {tag}
              </span>
            ))}
            {project.content.tags.length > 3 && (
              <span className="px-2 py-1 text-xs text-slate-500 dark:text-slate-500">
                +{project.content.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-500">
          <div className="flex items-center gap-1">
            <Icon className="w-4 h-4" />
            <span>/{project.slug}</span>
          </div>
          <span>{new Date(project.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </CardWrapper>
  );
}
