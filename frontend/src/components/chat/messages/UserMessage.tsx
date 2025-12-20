/**
 * UserMessage - Displays user's chat message bubble
 *
 * Features:
 * - Cyan gradient background
 * - Right-aligned
 * - Two variants: default (sidebar) and neon (EmberHomePage)
 * - Renders image attachments inline
 */

import type { UserMessageProps } from '../core/types';

// Regex to match media markdown: [Image: filename](url), [Video: filename](url), or [File: filename](url)
const MEDIA_PATTERN = /\[(Image|Video|File):\s*([^\]]+)\]\(([^)]+)\)/g;

interface MediaMatch {
  type: 'image' | 'video' | 'file';
  filename: string;
  url: string;
  fullMatch: string;
}

function parseMediaFromContent(content: string): { textParts: string[]; media: MediaMatch[] } {
  const media: MediaMatch[] = [];
  let match;

  // Reset regex state
  MEDIA_PATTERN.lastIndex = 0;

  while ((match = MEDIA_PATTERN.exec(content)) !== null) {
    media.push({
      type: match[1].toLowerCase() as 'image' | 'video',
      filename: match[2],
      url: match[3],
      fullMatch: match[0],
    });
  }

  // Split content by media patterns to get text parts
  const textParts = content.split(MEDIA_PATTERN).filter((_part, index) => {
    // Filter out the capture groups (type, filename, url) - keep only the text between
    return index % 4 === 0;
  });

  return { textParts, media };
}

function MediaPreview({ media, isNeon }: { media: MediaMatch; isNeon: boolean }) {
  if (media.type === 'image') {
    return (
      <div className="mt-2 rounded-lg overflow-hidden">
        <img
          src={media.url}
          alt={media.filename}
          className={`max-w-full ${isNeon ? 'max-h-64' : 'max-h-48'} object-contain rounded-lg`}
          loading="lazy"
        />
      </div>
    );
  }

  if (media.type === 'video') {
    return (
      <div className="mt-2 rounded-lg overflow-hidden">
        <video
          src={media.url}
          controls
          className={`max-w-full ${isNeon ? 'max-h-64' : 'max-h-48'} rounded-lg`}
        >
          Your browser does not support video.
        </video>
      </div>
    );
  }

  if (media.type === 'file') {
    // Get file extension for icon hint
    const extension = media.filename.split('.').pop()?.toLowerCase() || '';
    const isVideoFile = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension);
    const isAudioFile = ['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(extension);

    // If it's actually a video file, render as video
    if (isVideoFile) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden">
          <video
            src={media.url}
            controls
            className={`max-w-full ${isNeon ? 'max-h-64' : 'max-h-48'} rounded-lg`}
          >
            Your browser does not support video.
          </video>
        </div>
      );
    }

    // If it's an audio file, render audio player
    if (isAudioFile) {
      return (
        <div className="mt-2">
          <audio src={media.url} controls className="w-full max-w-xs">
            Your browser does not support audio.
          </audio>
        </div>
      );
    }

    // Generic file - render as link
    return (
      <div className="mt-2">
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white underline"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="truncate max-w-[200px]">{media.filename}</span>
        </a>
      </div>
    );
  }

  return null;
}

export function UserMessage({ content, variant = 'default' }: UserMessageProps) {
  const isNeon = variant === 'neon';
  const { textParts, media } = parseMediaFromContent(content);

  // Get the text content (first non-empty part, or empty string)
  const textContent = textParts.filter(p => p.trim()).join(' ').trim();

  if (isNeon) {
    // Neon Glass variant (EmberHomePage)
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-5 py-4 rounded-2xl rounded-br-sm bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
          {textContent && (
            <span className="text-lg whitespace-pre-wrap break-words">{textContent}</span>
          )}
          {media.map((m, i) => (
            <MediaPreview key={i} media={m} isNeon={isNeon} />
          ))}
        </div>
      </div>
    );
  }

  // Default variant (sidebar)
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] sm:max-w-sm md:max-w-md px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
        {textContent && (
          <span className="whitespace-pre-wrap break-words">{textContent}</span>
        )}
        {media.map((m, i) => (
          <MediaPreview key={i} media={m} isNeon={isNeon} />
        ))}
      </div>
    </div>
  );
}
