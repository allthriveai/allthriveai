import { Link, useNavigate } from 'react-router-dom';
import type { Project } from '@/types/models';
import {
  CodeBracketIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

interface ProjectCardProps {
  project: Project;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (projectId: number) => void;
  isOwner?: boolean;  // Is the current user the owner of this project
  variant?: 'default' | 'masonry';  // Layout variant
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

export function ProjectCard({ project, selectionMode = false, isSelected = false, onSelect, isOwner = false, variant = 'default' }: ProjectCardProps) {
  const navigate = useNavigate();
  const Icon = typeIcons[project.type];
  const projectUrl = `/${project.username}/${project.slug}`;

  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode && onSelect) {
      e.preventDefault();
      onSelect(project.id);
    }
  };

  const CardWrapper = selectionMode ? 'div' : Link;
  const cardProps = selectionMode
    ? { onClick: handleClick, style: { cursor: 'pointer' } }
    : { to: projectUrl };

  // Masonry variant - image-focused with hover overlay
  if (variant === 'masonry') {
    return (
      <CardWrapper
        {...cardProps as any}
        className={`block relative rounded-xl overflow-hidden group ${
          isSelected ? 'ring-4 ring-primary-500' : ''
        }`}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <div className="absolute top-3 left-3 z-20">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect && onSelect(project.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 rounded border-2 border-white shadow-lg cursor-pointer"
            />
          </div>
        )}

        {/* Main image */}
        <div className="relative w-full">
          <img
            src={project.thumbnailUrl || '/allthrive-placeholder.svg'}
            alt={project.title}
            className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Edit button - always visible for owner */}
          {isOwner && !selectionMode && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/${project.username}/${project.slug}/edit`);
              }}
              className="absolute top-3 right-3 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-lg transition-all hover:scale-110 z-10"
              title="Edit project"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          )}

          {/* Hover overlay with description */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 z-10">
            <h3 className="text-lg font-bold text-white mb-2">
              {project.title}
            </h3>
            {project.description && (
              <p className="text-sm text-white/90 line-clamp-3">
                {project.description}
              </p>
            )}
            {/* Tags on hover */}
            {project.content?.tags && project.content.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {project.content.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs rounded-md bg-white/20 text-white backdrop-blur-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Small title always visible at bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 group-hover:opacity-0 transition-opacity duration-300">
            <h3 className="text-sm font-semibold text-white line-clamp-1">
              {project.title}
            </h3>
          </div>
        </div>
      </CardWrapper>
    );
  }

  return (
    <CardWrapper
      {...cardProps as any}
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

        {/* Type badge and Edit button */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {isOwner && !selectionMode && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/${project.username}/${project.slug}/edit`);
              }}
              className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-lg transition-all hover:scale-110"
              title="Edit project"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          )}
          <span className="px-2 py-1 text-xs font-medium rounded-full glass-strong border border-white/20 text-slate-700 dark:text-slate-300">
            {typeLabels[project.type]}
          </span>
        </div>

        {/* Showcase badge - shift left in selection mode */}
        {project.isShowcase && !selectionMode && (
          <div className="absolute top-3 left-3">
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-500/90 text-white">
              ⭐ Showcase
            </span>
          </div>
        )}
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
