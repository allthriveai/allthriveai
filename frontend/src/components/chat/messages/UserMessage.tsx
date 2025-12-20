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

// Regex to match image markdown: [Image: filename](url) or [Video: filename](url)
const MEDIA_PATTERN = /\[(Image|Video):\s*([^\]]+)\]\(([^)]+)\)/g;

interface MediaMatch {
  type: 'image' | 'video';
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
  const textParts = content.split(MEDIA_PATTERN).filter((part, index) => {
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
