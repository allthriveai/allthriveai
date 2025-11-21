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

    // If hero mode is specified, use that
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

    // Fallback: use featuredImageUrl > cover > thumbnailUrl > placeholder
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

  // Masonry variant - TikTok-inspired with larger cards showing more info
  if (variant === 'masonry') {
    const heroElement = getHeroElement();

    return (
      <CardWrapper
        {...(cardProps as React.ComponentProps<typeof Link>)}
        className={`block relative rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group ${
          isSelected ? 'ring-4 ring-primary-500' : ''
        }`}
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

        {/* Hero Element Display */}
        <div className="relative w-full aspect-[3/4] overflow-hidden bg-gray-900">
          {heroElement.type === 'image' && (
            <>
              <img
                src={heroElement.url}
                alt={project.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </>
          )}

          {heroElement.type === 'video' && (
            <>
              <video
                src={heroElement.url}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </>
          )}

          {heroElement.type === 'slideshow' && (
            <>
              <img
                src={heroElement.images[0]}
                alt={project.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              {/* Slideshow counter */}
              <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs font-medium">
                1/{heroElement.images.length}
              </div>
            </>
          )}

          {heroElement.type === 'quote' && (
            <div className="w-full h-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-8">
              <blockquote className="text-white text-center max-w-lg">
                <p className="text-xl md:text-2xl font-medium italic leading-relaxed">
                  "{heroElement.text}"
                </p>
              </blockquote>
            </div>
          )}

          {/* Top action buttons */}
          <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
            {/* Menu button for owner */}
            {isOwner && !selectionMode && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className="p-2.5 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 text-white shadow-lg transition-all hover:scale-110"
                  title="Options"
                >
                  <EllipsisVerticalIcon className="w-5 h-5" />
                </button>

                {/* Dropdown menu */}
                {showMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowMenu(false);
                        navigate(`/${project.username}/${project.slug}/edit`);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
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
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
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
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 border-t border-gray-200 dark:border-gray-700"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom content - always visible */}
          <div className="absolute bottom-0 left-0 right-0 p-5 z-20">
            {/* Title */}
            <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 leading-tight">
              {project.title}
            </h3>

            {/* Description */}
            {project.description && (
              <p className="text-sm text-white/90 mb-3 line-clamp-2 leading-relaxed">
                {project.description}
              </p>
            )}

            {/* Tags */}
            {project.content?.tags && project.content.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {project.content.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/20 text-white backdrop-blur-sm border border-white/20"
                  >
                    #{tag}
                  </span>
                ))}
                {project.content.tags.length > 3 && (
                  <span className="px-2.5 py-1 text-xs font-medium text-white/70">
                    +{project.content.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Footer with heart and tool */}
            <div className="flex items-center justify-between">
              {/* Heart button */}
              <button
                onClick={handleLike}
                disabled={isLiking}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 transition-all hover:scale-105 disabled:opacity-50 group/heart"
              >
                {isLiked ? (
                  <HeartIconSolid className="w-5 h-5 text-red-500 group-hover/heart:scale-110 transition-transform" />
                ) : (
                  <HeartIcon className="w-5 h-5 text-white group-hover/heart:scale-110 transition-transform" />
                )}
                <span className="text-sm font-semibold text-white">
                  {heartCount > 0 ? heartCount : ''}
                </span>
              </button>

              {/* Top tool used */}
              {project.toolsDetails && project.toolsDetails.length > 0 ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20">
                  {project.toolsDetails[0].logoUrl && (
                    <img
                      src={project.toolsDetails[0].logoUrl}
                      alt={project.toolsDetails[0].name}
                      className="w-4 h-4 rounded object-contain"
                    />
                  )}
                  <span className="text-xs font-medium text-white">
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
