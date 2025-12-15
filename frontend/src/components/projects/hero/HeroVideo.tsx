/**
 * HeroVideo - Video display mode for project hero
 *
 * Supports embedded videos (YouTube, Vimeo, Loom, Reddit) and direct video files.
 */

// Shared styling constants
const VIDEO_GLOW_BACKDROP = 'absolute -inset-2 md:-inset-4 bg-white/5 rounded-2xl md:rounded-3xl blur-lg md:blur-xl opacity-50 transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl';
const VIDEO_CONTAINER_OUTER = 'relative p-1 md:p-2 bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl overflow-hidden';
const VIDEO_CONTAINER_INNER = 'relative aspect-video rounded-xl md:rounded-2xl overflow-hidden bg-black';

interface HeroVideoProps {
  videoUrl: string;
  /** Optional Reddit permalink for proper video+audio playback */
  redditPermalink?: string;
  /** Whether to autoplay the video (default: false for embeds, true for direct videos) */
  autoplay?: boolean;
}

/**
 * Parse video URL to determine platform and video ID
 */
function parseVideoUrl(url: string): { platform: 'youtube' | 'vimeo' | 'loom'; id: string; isShort?: boolean } | null {
  if (!url) return null;

  // YouTube Shorts pattern (must check before regular YouTube)
  const youtubeShortsMatch = url.match(/youtube\.com\/shorts\/([\w-]{11})/);
  if (youtubeShortsMatch) {
    return { platform: 'youtube', id: youtubeShortsMatch[1], isShort: true };
  }

  // YouTube patterns (regular videos)
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

/**
 * Check if URL is a Reddit video (v.redd.it)
 */
function isRedditVideo(url: string): boolean {
  return url.includes('v.redd.it') || (url.includes('reddit.com') && url.includes('.mp4'));
}

/**
 * Check if URL is a direct video file (excluding Reddit videos)
 */
function isDirectVideo(url: string): boolean {
  return (
    (url.endsWith('.mp4') ||
    url.endsWith('.webm') ||
    url.endsWith('.ogg') ||
    url.includes('/projects/videos/')) &&
    !isRedditVideo(url) // Exclude Reddit videos from direct video handling
  );
}

export function HeroVideo({ videoUrl, redditPermalink, autoplay = false }: HeroVideoProps) {
  if (!videoUrl) return null;

  // Handle Reddit videos with iframe embed for proper audio support
  if (isRedditVideo(videoUrl) && redditPermalink) {
    // Convert Reddit permalink to embed URL
    const embedUrl = redditPermalink.replace('reddit.com', 'reddit.com/mediaembed');

    return (
      <div className="w-full">
        <div className="relative group">
          <div className={VIDEO_GLOW_BACKDROP} />
          <div className={VIDEO_CONTAINER_OUTER}>
            <div className={VIDEO_CONTAINER_INNER}>
              <iframe
                src={embedUrl}
                title="Reddit video"
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-presentation"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle direct video files
  if (isDirectVideo(videoUrl)) {
    return (
      <div className="w-full flex justify-center">
        <div className="relative group inline-block">
          <div className={VIDEO_GLOW_BACKDROP} />
          <div className="relative p-1 md:p-2 bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl">
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              playsInline
              className="rounded-xl md:rounded-2xl max-h-[80vh] max-w-full"
              onError={() => {
                console.error('Video load error');
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Handle embedded videos (YouTube, Vimeo, Loom)
  const videoInfo = parseVideoUrl(videoUrl);
  if (!videoInfo) return null;

  let embedUrl = '';
  const autoplayParam = autoplay ? '1' : '0';
  if (videoInfo.platform === 'youtube') {
    // mute=1 is required for autoplay to work in most browsers
    embedUrl = `https://www.youtube.com/embed/${videoInfo.id}?rel=0&autoplay=${autoplayParam}${autoplay ? '&mute=1' : ''}`;
  } else if (videoInfo.platform === 'vimeo') {
    embedUrl = `https://player.vimeo.com/video/${videoInfo.id}?autoplay=${autoplayParam}${autoplay ? '&muted=1' : ''}`;
  } else if (videoInfo.platform === 'loom') {
    embedUrl = `https://www.loom.com/embed/${videoInfo.id}?autoplay=${autoplayParam}`;
  }

  // YouTube Shorts use vertical aspect ratio (9:16)
  const isVertical = videoInfo.isShort;

  if (isVertical) {
    return (
      <div className="w-full flex justify-center">
        <div className="relative group inline-block">
          <div className={VIDEO_GLOW_BACKDROP} />
          <div className="relative p-1 md:p-2 bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
            <div className="relative w-[280px] md:w-[320px] aspect-[9/16] rounded-xl md:rounded-2xl overflow-hidden bg-black">
              <iframe
                src={embedUrl}
                title="Project video"
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // YouTube Shorts use vertical aspect ratio (9:16)
  const isVertical = videoInfo.isShort;

  if (isVertical) {
    return (
      <div className="w-full flex justify-center">
        <div className="relative group inline-block">
          <div className={VIDEO_GLOW_BACKDROP} />
          <div className="relative p-1 md:p-2 bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
            <div className="relative w-[280px] md:w-[320px] aspect-[9/16] rounded-xl md:rounded-2xl overflow-hidden bg-black">
              <iframe
                src={embedUrl}
                title="Project video"
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative group">
        <div className={VIDEO_GLOW_BACKDROP} />
        <div className={VIDEO_CONTAINER_OUTER}>
          <div className={VIDEO_CONTAINER_INNER}>
            <iframe
              src={embedUrl}
              title="Project video"
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  );
}
