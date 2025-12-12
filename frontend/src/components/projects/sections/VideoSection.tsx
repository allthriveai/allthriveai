/**
 * VideoSection - Embedded video player for clipped content
 *
 * A simple, focused video section for displaying YouTube/Vimeo embeds.
 * Used primarily for clipped articles that have embedded videos.
 *
 * Note: Some videos may have domain-restricted embedding. We show a thumbnail
 * with a "Watch on YouTube" link as a fallback since we can't detect domain
 * restrictions via API.
 */

import { useState } from 'react';
import { PlayCircleIcon } from '@heroicons/react/24/solid';
import type { VideoSectionContent } from '@/types/sections';

interface VideoSectionProps {
  content: VideoSectionContent;
}

export function VideoSection({ content }: VideoSectionProps) {
  const [embedFailed, setEmbedFailed] = useState(false);

  // Support both camelCase (from API) and snake_case (from types)
  const url = content.url;
  const embedUrl = (content as any).embedUrl || content.embed_url;
  const platform = content.platform;
  const videoId = (content as any).videoId || content.video_id;
  const title = content.title;
  const thumbnail = (content as any).thumbnail || content.thumbnail;

  if (!videoId && !embedUrl && !url) {
    return null;
  }

  // Build embed URL based on platform
  let embedSrc = embedUrl;
  if (!embedSrc) {
    if (platform === 'youtube' && videoId) {
      embedSrc = `https://www.youtube.com/embed/${videoId}?rel=0`;
    } else if (platform === 'vimeo' && videoId) {
      embedSrc = `https://player.vimeo.com/video/${videoId}`;
    }
  }

  // Build watch URL for fallback
  const watchUrl = url || (platform === 'youtube' && videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : platform === 'vimeo' && videoId
    ? `https://vimeo.com/${videoId}`
    : null);

  // Build thumbnail URL
  const thumbnailUrl = thumbnail || (platform === 'youtube' && videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : null);

  if (!embedSrc && !watchUrl) {
    return null;
  }

  return (
    <section className="project-section" data-section-type="video">
      {/* Section Header */}
      {title && (
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
        </div>
      )}

      {/* Video Embed or Fallback */}
      <div className="relative group">
        {/* Glowing backdrop */}
        <div className="absolute -inset-2 bg-gradient-to-r from-red-500/10 to-pink-500/10 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition duration-500" />

        {/* Video container */}
        <div className="relative bg-black rounded-xl overflow-hidden shadow-lg aspect-video">
          {embedSrc && !embedFailed ? (
            <iframe
              src={embedSrc}
              title={title || 'Video'}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onError={() => setEmbedFailed(true)}
            />
          ) : watchUrl ? (
            /* Fallback: Show thumbnail with play button linking to YouTube */
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center bg-gray-900"
            >
              {thumbnailUrl && (
                <img
                  src={thumbnailUrl}
                  alt={title || 'Video thumbnail'}
                  className="absolute inset-0 w-full h-full object-cover opacity-70"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-3 text-white">
                <PlayCircleIcon className="w-16 h-16 drop-shadow-lg" />
                <span className="text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
                  Watch on {platform === 'youtube' ? 'YouTube' : platform === 'vimeo' ? 'Vimeo' : 'external site'}
                </span>
              </div>
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
