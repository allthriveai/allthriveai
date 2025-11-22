import { useState, useEffect } from 'react';
import { ChevronUpIcon } from '@heroicons/react/24/outline';

interface SlideUpElement {
  type: 'image' | 'video' | 'text';
  content: string;
  caption?: string;
}

interface SlideUpHeroProps {
  element1?: SlideUpElement;
  element2?: SlideUpElement;
}

function renderElement(element: SlideUpElement | undefined) {
  if (!element || !element.content) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-400">No content</p>
      </div>
    );
  }

  const parseVideoUrl = (url: string) => {
    if (!url) return null;

    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
    if (youtubeMatch) {
      return { platform: 'youtube', id: youtubeMatch[1] };
    }

    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return { platform: 'vimeo', id: vimeoMatch[1] };
    }

    const loomMatch = url.match(/loom\.com\/(?:share|embed)\/(\w+)/);
    if (loomMatch) {
      return { platform: 'loom', id: loomMatch[1] };
    }

    return null;
  };

  switch (element.type) {
    case 'image':
      return (
        <div className="w-full h-full flex flex-col">
          <img
            src={element.content}
            alt={element.caption || 'Hero image'}
            className="w-full h-full object-cover rounded-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/allthrive-placeholder.svg';
            }}
          />
          {element.caption && (
            <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
              {element.caption}
            </p>
          )}
        </div>
      );

    case 'video':
      const videoInfo = parseVideoUrl(element.content);

      // Check if it's an MP4 video file (direct video URL)
      const isDirectVideo = element.content.match(/\.(mp4|webm|ogg)$/i) || element.content.includes('/projects/videos/');

      if (!videoInfo && !isDirectVideo) {
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-400">Invalid video URL</p>
          </div>
        );
      }

      if (isDirectVideo) {
        // Render native video player for MP4/WebM/OGG
        return (
          <div className="w-full h-full flex flex-col">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
              <video
                src={element.content}
                controls
                className="w-full h-full"
                onError={(e) => {
                  console.error('Video load error');
                }}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            {element.caption && (
              <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                {element.caption}
              </p>
            )}
          </div>
        );
      }

      // Render embedded video (YouTube/Vimeo/Loom)
      let embedUrl = '';
      if (videoInfo!.platform === 'youtube') {
        embedUrl = `https://www.youtube.com/embed/${videoInfo!.id}?rel=0`;
      } else if (videoInfo!.platform === 'vimeo') {
        embedUrl = `https://player.vimeo.com/video/${videoInfo!.id}`;
      } else if (videoInfo!.platform === 'loom') {
        embedUrl = `https://www.loom.com/embed/${videoInfo!.id}`;
      }

      return (
        <div className="w-full h-full flex flex-col">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
            <iframe
              src={embedUrl}
              title={element.caption || 'Video'}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {element.caption && (
            <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
              {element.caption}
            </p>
          )}
        </div>
      );

    case 'text':
      const textLength = element.content.trim().length;
      let fontSize;
      if (textLength < 100) {
        fontSize = 'clamp(1.25rem, 2.5vw, 2rem)';
      } else if (textLength < 200) {
        fontSize = 'clamp(1rem, 2vw, 1.5rem)';
      } else if (textLength < 400) {
        fontSize = 'clamp(0.875rem, 1.5vw, 1.25rem)';
      } else {
        fontSize = 'clamp(0.75rem, 1.25vw, 1rem)';
      }

      return (
        <div className="w-full h-full flex items-center justify-center p-6 md:p-8">
          <div className="max-w-3xl">
            <p
              className="text-gray-900 dark:text-white leading-relaxed"
              style={{ fontSize, lineHeight: '1.5' }}
            >
              {element.content}
            </p>
            {element.caption && (
              <p className="mt-4 text-sm text-center text-gray-600 dark:text-gray-400 italic">
                {element.caption}
              </p>
            )}
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function SlideUpHero({ element1, element2 }: SlideUpHeroProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-expand on mobile after a delay
  useEffect(() => {
    if (isMobile && element2) {
      const timer = setTimeout(() => {
        setIsExpanded(true);
      }, 2000); // Show element2 after 2 seconds on mobile

      return () => clearTimeout(timer);
    }
  }, [isMobile, element2]);

  const handleToggle = () => {
    if (!isMobile) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative group">
        {/* Glowing backdrop */}
        <div className="absolute -inset-2 md:-inset-4 bg-white/5 rounded-2xl md:rounded-3xl blur-lg md:blur-xl opacity-50 transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl" />

        {/* Container */}
        <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
          {/* Element 1 - Always visible */}
          <div className="relative min-h-[300px] md:min-h-[400px] p-4 md:p-6">
            {renderElement(element1)}
          </div>

          {/* Element 2 - Slides up */}
          {element2 && (
            <>
              <div
                className={`transition-all duration-500 ease-in-out overflow-hidden ${
                  isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="border-t border-white/20 p-4 md:p-6 min-h-[300px] md:min-h-[400px] bg-white/5">
                  {renderElement(element2)}
                </div>
              </div>

              {/* Toggle button - visible on desktop, hidden on mobile after auto-expand */}
              {(!isMobile || !isExpanded) && (
                <button
                  onClick={handleToggle}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full border border-white/30 transition-all hover:scale-105 active:scale-95 shadow-lg z-10"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  <span className="text-sm font-medium hidden md:inline">
                    {isExpanded ? 'Show Less' : 'Show More'}
                  </span>
                  <ChevronUpIcon
                    className={`w-5 h-5 transition-transform duration-300 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
