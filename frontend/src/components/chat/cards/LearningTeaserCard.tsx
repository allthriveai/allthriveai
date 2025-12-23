/**
 * LearningTeaserCard - Reusable teaser card for learning content in chat
 *
 * Features:
 * - Beautiful teaser cards with featured images
 * - Author avatar overlay with glow effect
 * - Supports projects, videos, quizzes, and lessons
 * - Neon glass styling to match chat aesthetic
 */

import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faBook, faGamepad, faCode } from '@fortawesome/free-solid-svg-icons';
import type { LearningContentItem } from '@/hooks/useIntelligentChat';

export interface LearningTeaserCardProps {
  item: LearningContentItem;
  contentType: string;
  onNavigate?: (path: string) => void;
  /** Compact mode for smaller grid display */
  compact?: boolean;
  /** Open project preview tray instead of navigating (for projects only) */
  onOpenProjectPreview?: (item: LearningContentItem) => void;
}

// Get icon for content type
function getContentTypeIcon(contentType: string) {
  switch (contentType) {
    case 'video':
      return faPlay;
    case 'quiz-challenges':
      return faGamepad;
    case 'projects':
      return faCode;
    default:
      return faBook;
  }
}

// Format duration from seconds
function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function LearningTeaserCard({
  item,
  contentType,
  onNavigate,
  compact = false,
  onOpenProjectPreview,
}: LearningTeaserCardProps) {
  const imageUrl = item.featured_image_url || item.thumbnail;
  const hasImage = !!imageUrl;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // For projects with preview handler, open tray instead of navigating
    if (contentType === 'projects' && onOpenProjectPreview) {
      onOpenProjectPreview(item);
      return;
    }

    // Otherwise navigate as usual
    if (item.url && onNavigate) {
      onNavigate(item.url);
    }
  };

  // Compact card for grid display
  if (compact) {
    const CompactCardContent = (
      <div className="group relative rounded-lg overflow-hidden bg-slate-800/50 border border-white/10 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-md hover:shadow-cyan-500/10">
        {/* Image Section - smaller square aspect */}
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-violet-600/20 to-cyan-600/20">
          {hasImage ? (
            <img
              src={imageUrl}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FontAwesomeIcon
                icon={getContentTypeIcon(contentType)}
                className="w-8 h-8 text-white/30"
              />
            </div>
          )}

          {/* Small author avatar */}
          {item.author_avatar_url && (
            <div className="absolute bottom-1.5 left-1.5">
              <img
                src={item.author_avatar_url}
                alt={item.author_username || 'Author'}
                className="w-6 h-6 rounded-full border border-white/60 object-cover"
              />
            </div>
          )}
        </div>

        {/* Compact Content Section */}
        <div className="p-2">
          <h4 className="text-xs font-medium text-white line-clamp-1 group-hover:text-cyan-300 transition-colors">
            {item.title}
          </h4>
          {item.author_username && (
            <p className="text-[10px] text-slate-400 truncate">
              @{item.author_username}
            </p>
          )}
        </div>
      </div>
    );

    // For projects with preview handler, use a clickable div instead of link
    if (contentType === 'projects' && onOpenProjectPreview) {
      return (
        <div onClick={handleClick} className="block cursor-pointer">
          {CompactCardContent}
        </div>
      );
    }

    if (item.url) {
      const isExternal = item.url.startsWith('http');
      if (isExternal) {
        return (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
            {CompactCardContent}
          </a>
        );
      }
      return (
        <Link to={item.url} onClick={handleClick} className="block">
          {CompactCardContent}
        </Link>
      );
    }
    return CompactCardContent;
  }

  // Standard card (original size)
  const CardContent = (
    <div className="group relative w-64 flex-shrink-0 rounded-xl overflow-hidden bg-slate-800/50 border border-white/10 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20">
      {/* Image Section */}
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-violet-600/20 to-cyan-600/20">
        {hasImage ? (
          <img
            src={imageUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FontAwesomeIcon
              icon={getContentTypeIcon(contentType)}
              className="w-12 h-12 text-white/30"
            />
          </div>
        )}

        {/* Duration badge for videos */}
        {item.duration_seconds && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs text-white font-medium">
            {formatDuration(item.duration_seconds)}
          </div>
        )}

        {/* Complexity badge for projects */}
        {item.complexity_level && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-violet-500/80 rounded text-xs text-white font-medium capitalize">
            {item.complexity_level}
          </div>
        )}

        {/* Author Avatar Overlay */}
        {item.author_avatar_url && (
          <div className="absolute bottom-2 left-2">
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-full bg-cyan-400/50 blur-md" />
              <img
                src={item.author_avatar_url}
                alt={item.author_username || 'Author'}
                className="relative w-10 h-10 rounded-full border-2 border-white/80 object-cover shadow-lg"
              />
            </div>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-3">
        <h4 className="text-sm font-medium text-white line-clamp-2 mb-1 group-hover:text-cyan-300 transition-colors">
          {item.title}
        </h4>

        {/* Author username */}
        {item.author_username && (
          <p className="text-xs text-slate-400 mb-2">
            by <span className="text-cyan-400">@{item.author_username}</span>
          </p>
        )}

        {/* Description if available */}
        {item.description && (
          <p className="text-xs text-slate-400 line-clamp-2 mb-2">
            {item.description}
          </p>
        )}

        {/* Key techniques tags */}
        {item.key_techniques && item.key_techniques.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.key_techniques.slice(0, 3).map((tech) => (
              <span
                key={tech}
                className="px-1.5 py-0.5 text-[10px] bg-violet-500/20 text-violet-300 rounded"
              >
                {tech}
              </span>
            ))}
          </div>
        )}

        {/* Video view count */}
        {item.view_count !== undefined && (
          <p className="text-xs text-slate-500 mt-1">
            {item.view_count.toLocaleString()} views
          </p>
        )}
      </div>
    </div>
  );

  // For projects with preview handler, use a clickable div instead of link
  if (contentType === 'projects' && onOpenProjectPreview) {
    return (
      <div onClick={handleClick} className="block cursor-pointer">
        {CardContent}
      </div>
    );
  }

  // Wrap in link if URL exists
  if (item.url) {
    const isExternal = item.url.startsWith('http');
    if (isExternal) {
      return (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {CardContent}
        </a>
      );
    }
    return (
      <Link to={item.url} onClick={handleClick} className="block">
        {CardContent}
      </Link>
    );
  }

  return CardContent;
}
