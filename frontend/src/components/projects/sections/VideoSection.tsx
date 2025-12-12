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
  const { url, embed_url, platform, video_id, title } = content;

  if (!video_id && !embed_url && !url) {
    return null;
  }

  // Build embed URL based on platform
  let embedSrc = embed_url;
  if (!embedSrc) {
    if (platform === 'youtube' && video_id) {
      embedSrc = `https://www.youtube.com/embed/${video_id}?rel=0`;
    } else if (platform === 'vimeo' && video_id) {
      embedSrc = `https://player.vimeo.com/video/${video_id}`;
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
