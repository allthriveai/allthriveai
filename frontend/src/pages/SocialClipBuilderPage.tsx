import { useState, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay,
  faPause,
  faRotateRight,
  faSave,
  faArrowLeft,
  faVideo,
  faDownload,
  faSpinner,
  faImage,
} from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ClipPreview, type ClipPreviewHandle } from '@/components/creator/ClipPreview';
import { ClipCreatorChatPanel } from '@/components/creator/ClipCreatorChatPanel';
import type { SocialClipContent } from '@/types/clips';

// Initial empty clip state
const INITIAL_CLIP: SocialClipContent = {
  template: 'explainer',
  scenes: [],
  duration: 0,
  style: {
    primaryColor: '#22D3EE',
    accentColor: '#10B981',
  },
};

export default function SocialClipBuilderPage() {
  const { user } = useAuth();
  const [clipData, setClipData] = useState<SocialClipContent>(INITIAL_CLIP);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const clipPreviewRef = useRef<ClipPreviewHandle>(null);

  // Handle clip data updates from chat
  const handleClipUpdate = useCallback((newClipData: SocialClipContent) => {
    setClipData(newClipData);
    setCurrentTime(0);
    setIsPlaying(true); // Auto-play when clip updates
  }, []);

  // Playback controls
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleRestart = () => {
    setCurrentTime(0);
    setIsPlaying(true);
  };

  // Export as video (WebM)
  const handleExportVideo = useCallback(async () => {
    if (!clipPreviewRef.current || clipData.scenes.length === 0) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      const element = clipPreviewRef.current.getElement();
      if (!element) throw new Error('Preview element not found');

      // Use html2canvas to capture frames
      const { default: html2canvas } = await import('html2canvas');

      const fps = 30;
      const frameDuration = 1000 / fps;
      const totalFrames = Math.ceil(clipData.duration / frameDuration);
      const frames: ImageData[] = [];

      // Create a canvas for compositing
      const canvas = document.createElement('canvas');
      canvas.width = 1080; // 9:16 at 1080p
      canvas.height = 1920;
      const ctx = canvas.getContext('2d')!;

      // Capture frames
      for (let frame = 0; frame < totalFrames; frame++) {
        const time = frame * frameDuration;
        setCurrentTime(time);
        setExportProgress(Math.round((frame / totalFrames) * 50)); // First 50% is capturing

        // Wait for React to render the new time
        await new Promise((r) => setTimeout(r, 50));

        // Capture the frame
        const frameCanvas = await html2canvas(element, {
          backgroundColor: '#020617',
          scale: 2,
          logging: false,
          useCORS: true,
        });

        // Draw to our output canvas
        ctx.drawImage(frameCanvas, 0, 0, canvas.width, canvas.height);
        frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      }

      // Encode as WebM using MediaRecorder
      setExportProgress(50);

      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 8000000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }));
        };
      });

      recorder.start();

      // Replay frames to the canvas for recording
      for (let i = 0; i < frames.length; i++) {
        ctx.putImageData(frames[i], 0, 0);
        setExportProgress(50 + Math.round((i / frames.length) * 45));
        await new Promise((r) => setTimeout(r, frameDuration));
      }

      recorder.stop();
      const blob = await recordingDone;

      // Download the video
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clip-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);

      setExportProgress(100);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Try downloading as images instead.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setCurrentTime(0);
    }
  }, [clipData]);

  // Export as image sequence (fallback)
  const handleExportImages = useCallback(async () => {
    if (!clipPreviewRef.current || clipData.scenes.length === 0) return;

    setIsExporting(true);

    try {
      const { default: html2canvas } = await import('html2canvas');
      const element = clipPreviewRef.current.getElement();
      if (!element) throw new Error('Preview element not found');

      // Capture one frame per scene
      for (let i = 0; i < clipData.scenes.length; i++) {
        const scene = clipData.scenes[i];
        const midTime = scene.timing.start + (scene.timing.end - scene.timing.start) / 2;

        setCurrentTime(midTime);
        setExportProgress(Math.round(((i + 1) / clipData.scenes.length) * 100));

        await new Promise((r) => setTimeout(r, 100));

        const canvas = await html2canvas(element, {
          backgroundColor: '#020617',
          scale: 2,
          logging: false,
          useCORS: true,
        });

        // Download the image
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `scene-${i + 1}-${scene.type}.png`;
        a.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setCurrentTime(0);
    }
  }, [clipData]);

  // Admin-only check
  const isAdmin = user?.role === 'admin';
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center glass-panel p-8 rounded-2xl max-w-md">
            <FontAwesomeIcon icon={faVideo} className="text-4xl text-muted mb-4" />
            <h1 className="text-2xl font-bold mb-2">Social Clip Creator</h1>
            <p className="text-secondary">
              This feature is currently only available to admins.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const hasClipContent = clipData.scenes.length > 0;

  return (
    <DashboardLayout hideFooter>
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-4">
            <Link
              to="/create"
              className="flex items-center gap-2 text-secondary hover:text-primary transition-colors"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faVideo} className="text-cyan-400" />
              <h1 className="font-semibold">Social Clip Creator</h1>
            </div>
          </div>

          {/* Action buttons */}
          {hasClipContent && (
            <div className="flex items-center gap-2">
              {/* Export dropdown */}
              <div className="relative group">
                <button
                  className="btn-secondary flex items-center gap-2"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                      <span className="hidden sm:inline">{exportProgress}%</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faDownload} />
                      <span className="hidden sm:inline">Export</span>
                    </>
                  )}
                </button>

                {/* Dropdown menu */}
                {!isExporting && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <button
                      onClick={handleExportVideo}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 flex items-center gap-3 rounded-t-xl"
                    >
                      <FontAwesomeIcon icon={faVideo} className="text-cyan-400" />
                      <div>
                        <div className="font-medium">Export Video</div>
                        <div className="text-xs text-muted">WebM format</div>
                      </div>
                    </button>
                    <button
                      onClick={handleExportImages}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 flex items-center gap-3 rounded-b-xl border-t border-white/5"
                    >
                      <FontAwesomeIcon icon={faImage} className="text-green-400" />
                      <div>
                        <div className="font-medium">Export Images</div>
                        <div className="text-xs text-muted">PNG per scene</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Save button */}
              <button
                className="btn-primary flex items-center gap-2"
                onClick={() => {
                  // TODO: Implement save flow
                  console.log('Save clip:', clipData);
                }}
              >
                <FontAwesomeIcon icon={faSave} />
                <span className="hidden sm:inline">Save as Project</span>
              </button>
            </div>
          )}
        </header>

        {/* Main Content - Split Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Chat Panel (40%) */}
          <div className="w-full md:w-[40%] flex flex-col border-r border-white/10">
            <ClipCreatorChatPanel onClipUpdate={handleClipUpdate} />
          </div>

          {/* Right: Preview Panel (60%) */}
          <div className="hidden md:flex md:w-[60%] flex-col">
            {/* Preview Area */}
            <div className="flex-1 flex items-center justify-center p-8 bg-slate-950/50">
              <ClipPreview
                ref={clipPreviewRef}
                clipData={clipData}
                isPlaying={isPlaying && !isExporting}
                currentTime={currentTime}
                onTimeUpdate={setCurrentTime}
                onComplete={() => setIsPlaying(false)}
              />
            </div>

            {/* Playback Controls */}
            {hasClipContent && (
              <div className="px-6 py-4 border-t border-white/10 bg-slate-900/50">
                <div className="flex items-center justify-between">
                  {/* Play/Pause/Restart */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={isPlaying ? handlePause : handlePlay}
                      disabled={isExporting}
                      className="w-10 h-10 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      <FontAwesomeIcon
                        icon={isPlaying ? faPause : faPlay}
                        className="text-cyan-400"
                      />
                    </button>
                    <button
                      onClick={handleRestart}
                      disabled={isExporting}
                      className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      <FontAwesomeIcon icon={faRotateRight} className="text-secondary" />
                    </button>
                  </div>

                  {/* Timeline Info */}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-secondary">
                      Template: <span className="text-primary capitalize">{clipData.template}</span>
                    </span>
                    <span className="text-secondary">
                      Duration: <span className="text-primary">{(clipData.duration / 1000).toFixed(1)}s</span>
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted font-mono">
                      {(currentTime / 1000).toFixed(1)}s / {(clipData.duration / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all duration-100"
                    style={{
                      width: clipData.duration > 0 ? `${(currentTime / clipData.duration) * 100}%` : '0%',
                    }}
                  />
                </div>

                {/* Scene indicators */}
                <div className="mt-2 flex gap-1">
                  {clipData.scenes.map((scene, i) => {
                    const isActive = currentTime >= scene.timing.start && currentTime < scene.timing.end;
                    const isPast = currentTime >= scene.timing.end;
                    return (
                      <button
                        key={scene.id}
                        onClick={() => {
                          setCurrentTime(scene.timing.start);
                          setIsPlaying(true);
                        }}
                        className={`
                          flex-1 h-1 rounded-full transition-all
                          ${isActive ? 'bg-cyan-500' : isPast ? 'bg-cyan-500/50' : 'bg-white/10'}
                        `}
                        title={`Scene ${i + 1}: ${scene.type}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
