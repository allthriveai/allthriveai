/**
 * HeroVideo - Video display mode for project hero
 *
 * Supports embedded videos (YouTube, Vimeo, Loom) and direct video files.
 */

interface HeroVideoProps {
  videoUrl: string;
}

/**
 * Parse video URL to determine platform and video ID
 */
function parseVideoUrl(url: string): { platform: 'youtube' | 'vimeo' | 'loom'; id: string } | null {
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

/**
 * Check if URL is a direct video file
 */
function isDirectVideo(url: string): boolean {
  return (
    url.endsWith('.mp4') ||
    url.endsWith('.webm') ||
    url.endsWith('.ogg') ||
    url.includes('/projects/videos/') ||
    url.includes('v.redd.it') || // Reddit video URLs
    url.includes('reddit.com') && (url.includes('DASH_') || url.includes('.mp4')) // Reddit video fallback patterns
  );
}

export function HeroVideo({ videoUrl }: HeroVideoProps) {
  if (!videoUrl) return null;

  // Handle direct video files
  if (isDirectVideo(videoUrl)) {
    return (
      <div className="w-full flex justify-center">
        <div className="relative group inline-block">
          {/* Glowing backdrop */}
          <div className="absolute -inset-2 md:-inset-4 bg-white/5 rounded-2xl md:rounded-3xl blur-lg md:blur-xl opacity-50 transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl" />

          {/* Video container */}
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
  if (videoInfo.platform === 'youtube') {
    embedUrl = `https://www.youtube.com/embed/${videoInfo.id}?rel=0`;
  } else if (videoInfo.platform === 'vimeo') {
    embedUrl = `https://player.vimeo.com/video/${videoInfo.id}`;
  } else if (videoInfo.platform === 'loom') {
    embedUrl = `https://www.loom.com/embed/${videoInfo.id}`;
  }

  return (
    <div className="w-full">
      <div className="relative group">
        {/* Glowing backdrop */}
        <div className="absolute -inset-2 md:-inset-4 bg-white/5 rounded-2xl md:rounded-3xl blur-lg md:blur-xl opacity-50 transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl" />

        {/* Video container */}
        <div className="relative p-1 md:p-2 bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
          <div className="relative aspect-video rounded-xl md:rounded-2xl overflow-hidden bg-black">
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
