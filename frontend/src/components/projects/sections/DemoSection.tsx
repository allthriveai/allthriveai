/**
 * DemoSection - Video walkthrough or live demo links
 *
 * Supports inline editing when isEditing=true for owners.
 */

import { useCallback } from 'react';
import { PlayCircleIcon, ArrowTopRightOnSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { InlineEditableTitle, InlineEditableText } from '../shared/InlineEditable';
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

interface CTAButtonProps {
  cta: DemoCTA;
  index: number;
  isEditing?: boolean;
  onUpdate?: (index: number, cta: DemoCTA) => void;
  onDelete?: (index: number) => void;
}

function CTAButton({ cta, index, isEditing, onUpdate, onDelete }: CTAButtonProps) {
  const baseClasses = 'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5';

  const styleClasses = {
    primary: 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg hover:shadow-xl',
    secondary: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white',
    outline: 'border-2 border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400',
  };

  const handleLabelChange = useCallback(
    async (newLabel: string) => {
      if (onUpdate) {
        onUpdate(index, { ...cta, label: newLabel });
      }
    },
    [index, cta, onUpdate]
  );

  const handleUrlChange = useCallback(
    async (newUrl: string) => {
      if (onUpdate) {
        onUpdate(index, { ...cta, url: newUrl });
      }
    },
    [index, cta, onUpdate]
  );

  if (isEditing) {
    return (
      <div className="relative group flex flex-col gap-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        {onDelete && (
          <button
            onClick={() => onDelete(index)}
            className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete CTA"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
        <InlineEditableText
          value={cta.label}
          isEditable={true}
          onChange={handleLabelChange}
          placeholder="Button label..."
          className="font-semibold text-gray-900 dark:text-white"
        />
        <InlineEditableText
          value={cta.url}
          isEditable={true}
          onChange={handleUrlChange}
          placeholder="https://..."
          className="text-sm text-gray-500 dark:text-gray-400"
        />
        <select
          value={cta.style}
          onChange={(e) => onUpdate?.(index, { ...cta, style: e.target.value as DemoCTA['style'] })}
          className="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
        >
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="outline">Outline</option>
        </select>
      </div>
    );
  }

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

// Helper to check if a URL is valid and not a placeholder
function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Filter out placeholder/dummy URLs
  if (['...', '#', '', 'null', 'undefined'].includes(url)) return false;
  // Must start with http:// or https://
  return url.startsWith('http://') || url.startsWith('https://');
}

export function DemoSection({ content, isEditing, onUpdate }: DemoSectionProps) {
  const { video, liveUrl: rawLiveUrl, ctas: rawCtas, title } = content;

  // Filter out invalid URLs in view mode (keep all in edit mode so user can fix them)
  const liveUrl = isEditing ? rawLiveUrl : (isValidUrl(rawLiveUrl) ? rawLiveUrl : null);
  const ctas = isEditing ? rawCtas : rawCtas?.filter(cta => isValidUrl(cta.url));

  // Check if there's any content to show
  const hasVideo = video && video.url && isValidUrl(video.url);
  const hasCTAs = ctas && ctas.length > 0;

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (onUpdate) {
        onUpdate({ ...content, title: newTitle });
      }
    },
    [content, onUpdate]
  );

  const handleVideoUrlChange = useCallback(
    async (newUrl: string) => {
      if (onUpdate) {
        const newVideo: VideoEmbed = { ...video, url: newUrl, type: 'embed' };
        onUpdate({ ...content, video: newVideo });
      }
    },
    [content, video, onUpdate]
  );

  const handleLiveUrlChange = useCallback(
    async (newUrl: string) => {
      if (onUpdate) {
        onUpdate({ ...content, liveUrl: newUrl });
      }
    },
    [content, onUpdate]
  );

  const handleCTAUpdate = useCallback(
    (index: number, updatedCTA: DemoCTA) => {
      if (onUpdate) {
        const newCTAs = [...(ctas || [])];
        newCTAs[index] = updatedCTA;
        onUpdate({ ...content, ctas: newCTAs });
      }
    },
    [content, ctas, onUpdate]
  );

  const handleCTADelete = useCallback(
    (index: number) => {
      if (onUpdate) {
        const newCTAs = (ctas || []).filter((_, i) => i !== index);
        onUpdate({ ...content, ctas: newCTAs });
      }
    },
    [content, ctas, onUpdate]
  );

  const handleAddCTA = useCallback(() => {
    if (onUpdate) {
      const newCTA: DemoCTA = {
        label: 'New Button',
        url: 'https://',
        style: 'secondary',
      };
      onUpdate({ ...content, ctas: [...(ctas || []), newCTA] });
    }
  }, [content, ctas, onUpdate]);

  // Allow empty content in edit mode
  if (!hasVideo && !hasCTAs && !liveUrl && !isEditing) {
    return null;
  }

  return (
    <section className="project-section" data-section-type="demo">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        {isEditing ? (
          <InlineEditableTitle
            value={title || 'Demo'}
            isEditable={true}
            onChange={handleTitleChange}
            placeholder="Section title..."
            className="text-2xl font-bold text-gray-900 dark:text-white"
            as="h2"
          />
        ) : (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {title || 'Demo'}
          </h2>
        )}
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Content */}
      <div className="space-y-8">
        {/* Video */}
        {(hasVideo || isEditing) && (
          <div className="relative group">
            {/* Glowing backdrop */}
            <div className="absolute -inset-2 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition duration-500" />

            {/* Video container */}
            <div className="relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
              {hasVideo ? (
                <VideoPlayer video={video} />
              ) : isEditing ? (
                <div className="p-8 text-center text-gray-400">
                  Add a video URL below
                </div>
              ) : null}
            </div>

            {/* Video URL editor */}
            {isEditing && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Video URL (YouTube, Vimeo, Loom, or direct)
                </p>
                <InlineEditableText
                  value={video?.url || ''}
                  isEditable={true}
                  onChange={handleVideoUrlChange}
                  placeholder="https://youtube.com/watch?v=..."
                  className="text-sm text-gray-600 dark:text-gray-300"
                />
              </div>
            )}
          </div>
        )}

        {/* Live URL editor */}
        {isEditing && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Live Demo URL
            </p>
            <InlineEditableText
              value={liveUrl || ''}
              isEditable={true}
              onChange={handleLiveUrlChange}
              placeholder="https://your-demo-site.com"
              className="text-sm text-gray-600 dark:text-gray-300"
            />
          </div>
        )}

        {/* CTAs */}
        {(hasCTAs || liveUrl || isEditing) && (
          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Live URL as primary CTA if no video (view mode only) */}
            {!isEditing && liveUrl && !hasVideo && (
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
            {ctas?.map((cta, index) => (
              <CTAButton
                key={index}
                cta={cta}
                index={index}
                isEditing={isEditing}
                onUpdate={handleCTAUpdate}
                onDelete={handleCTADelete}
              />
            ))}

            {/* Add CTA button */}
            {isEditing && (
              <button
                onClick={handleAddCTA}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 text-gray-400 hover:text-primary-500 transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                <span className="text-sm font-medium">Add Button</span>
              </button>
            )}

            {/* Live URL as secondary if video exists (view mode only) */}
            {!isEditing && liveUrl && hasVideo && (
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
