/**
 * DemoSection - Video walkthrough or live demo links
 */

import { PlayCircleIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import type { DemoSectionContent, VideoEmbed, DemoCTA } from '@/types/sections';

interface DemoSectionProps {
  content: DemoSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: DemoSectionContent) => void;
}

function parseVideoUrl(url: string): { platform: string; id: string } | null {
  if (!url) return null;

  // YouTube patterns
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (youtubeMatch) {
    return { platform: 'youtube', id: youtubeMatch[1] };
  }

  // Vimeo patterns
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return { platform: 'vimeo', id: vimeoMatch[1] };
  }

  // Loom patterns
  const loomMatch = url.match(/loom\.com\/(?:share|embed)\/(\w+)/);
  if (loomMatch) {
    return { platform: 'loom', id: loomMatch[1] };
  }

  return null;
}

function VideoPlayer({ video }: { video: VideoEmbed }) {
  const videoInfo = parseVideoUrl(video.url);
  const isDirectVideo =
    video.type === 'direct' ||
    video.url.endsWith('.mp4') ||
    video.url.endsWith('.webm') ||
    video.url.endsWith('.ogg');

  if (isDirectVideo) {
    return (
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
        <video
          src={video.url}
          controls
          className="w-full h-full"
          poster={video.thumbnail}
        />
      </div>
    );
  }

  if (videoInfo) {
    let embedUrl = '';

    if (videoInfo.platform === 'youtube') {
      embedUrl = `https://www.youtube.com/embed/${videoInfo.id}?rel=0`;
    } else if (videoInfo.platform === 'vimeo') {
      embedUrl = `https://player.vimeo.com/video/${videoInfo.id}`;
    } else if (videoInfo.platform === 'loom') {
      embedUrl = `https://www.loom.com/embed/${videoInfo.id}`;
    }

    return (
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={embedUrl}
          title="Demo video"
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return null;
}

function CTAButton({ cta }: { cta: DemoCTA }) {
  const baseClasses = 'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5';

  const styleClasses = {
    primary: 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg hover:shadow-xl',
    secondary: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white',
    outline: 'border-2 border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400',
  };

  return (
    <a
      href={cta.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClasses} ${styleClasses[cta.style]}`}
    >
      {cta.style === 'primary' && <PlayCircleIcon className="w-5 h-5" />}
      {cta.label}
      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
    </a>
  );
}

export function DemoSection({ content, isEditing, onUpdate }: DemoSectionProps) {
  const { video, liveUrl, ctas } = content;

  // Check if there's any content to show
  const hasVideo = video && video.url;
  const hasCTAs = ctas && ctas.length > 0;

  if (!hasVideo && !hasCTAs && !liveUrl) {
    return null;
  }

  return (
    <section className="project-section" data-section-type="demo">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Demo</h2>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Content */}
      <div className="space-y-8">
        {/* Video */}
        {hasVideo && (
          <div className="relative group">
            {/* Glowing backdrop */}
            <div className="absolute -inset-2 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition duration-500" />

            {/* Video container */}
            <div className="relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
              <VideoPlayer video={video} />
            </div>
          </div>
        )}

        {/* CTAs */}
        {(hasCTAs || liveUrl) && (
          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Live URL as primary CTA if no video */}
            {liveUrl && !hasVideo && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold bg-primary-500 hover:bg-primary-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
              >
                <PlayCircleIcon className="w-6 h-6" />
                Try Live Demo
                <ArrowTopRightOnSquareIcon className="w-5 h-5" />
              </a>
            )}

            {/* Custom CTAs */}
            {hasCTAs && ctas.map((cta, index) => (
              <CTAButton key={index} cta={cta} />
            ))}

            {/* Live URL as secondary if video exists */}
            {liveUrl && hasVideo && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border-2 border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400 transition-all duration-200 hover:-translate-y-0.5"
              >
                Try Live Demo
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
