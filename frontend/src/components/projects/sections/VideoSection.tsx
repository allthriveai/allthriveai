/**
 * VideoSection - Embedded video player for clipped content
 *
 * A simple, focused video section for displaying YouTube/Vimeo embeds.
 * Used primarily for clipped articles that have embedded videos.
 */

import type { VideoSectionContent } from '@/types/sections';

interface VideoSectionProps {
  content: VideoSectionContent;
}

export function VideoSection({ content }: VideoSectionProps) {
  // Support both camelCase (from API) and snake_case (from types)
  const url = content.url;
  const embedUrl = (content as any).embedUrl || content.embed_url;
  const platform = content.platform;
  const videoId = (content as any).videoId || content.video_id;
  const title = content.title;

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

  if (!embedSrc) {
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

      {/* Video Embed */}
      <div className="relative group">
        {/* Glowing backdrop */}
        <div className="absolute -inset-2 bg-gradient-to-r from-red-500/10 to-pink-500/10 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition duration-500" />

        {/* Video container */}
        <div className="relative bg-black rounded-xl overflow-hidden shadow-lg aspect-video">
          <iframe
            src={embedSrc}
            title={title || 'Video'}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}
