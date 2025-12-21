/**
 * EmberFlowsPage - Admin page showing Ember chat user flows as one big zoomable Mermaid diagram
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { MermaidDiagram } from '@/components/projects/shared/MermaidDiagram';
import {
  MapIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowsPointingOutIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';

// User Journey Flow - What the user sees and clicks at each step
const COMPLETE_FLOW = `flowchart TD
    START([User Opens Ember Chat])
    START --> GREETING["Greeting Message:<br/>Good morning! What are you in the mood for?"]

    GREETING --> PILLS{Feeling Pills}

    PILLS --> P1["Share something I've been working on"]
    PILLS --> P2["Play a game"]
    PILLS --> P3["See this week's challenge"]
    PILLS --> P4["Learn something new"]
    PILLS --> P5["Sell a product or service"]
    PILLS --> P6["Explore what others are making"]
    PILLS --> P7["Connect with others"]
    PILLS --> P8["Personalize my experience"]
    PILLS --> P9["What's trending today?"]
    PILLS --> P10["Give me a quick win"]
    PILLS --> P11["Make my avatar"]

    %% SHARE SOMETHING FLOW
    P1 --> SHARE_Q["How would you like to share your project?"]
    SHARE_Q --> S1["Connect to an integration<br/><i>Pull your project from GitHub...</i>"]
    SHARE_Q --> S2["Paste in a URL<br/><i>Import from any website or...</i>"]
    SHARE_Q --> S3["Upload a project<br/><i>Upload images, files, or document...</i>"]
    SHARE_Q --> S4["Chrome extension<br/><i>Install our extension to easil...</i>"]

    S1 --> PLATFORM_Q["Which platform would you like to import from?"]
    PLATFORM_Q --> GITHUB["GitHub"]
    PLATFORM_Q --> GITLAB["GitLab"]
    PLATFORM_Q --> FIGMA["Figma"]
    PLATFORM_Q --> YOUTUBE["YouTube"]

    GITHUB --> GH_AUTH["Connect GitHub Account"]
    GH_AUTH --> GH_REPOS["Select Repository"]
    GH_REPOS --> GH_IMPORT["Import Project"]
    GH_IMPORT --> PROJECT_CREATED([Project Created])

    GITLAB --> GL_AUTH["Connect GitLab Account"]
    GL_AUTH --> GL_REPOS["Select Repository"]
    GL_REPOS --> GL_IMPORT["Import Project"]
    GL_IMPORT --> PROJECT_CREATED

    FIGMA --> FIG_AUTH["Connect Figma Account"]
    FIG_AUTH --> FIG_FILES["Select File"]
    FIG_FILES --> FIG_IMPORT["Import Project"]
    FIG_IMPORT --> PROJECT_CREATED

    YOUTUBE --> YT_AUTH["Connect YouTube Account"]
    YT_AUTH --> YT_VIDEOS["Select Video"]
    YT_VIDEOS --> YT_IMPORT["Import Project"]
    YT_IMPORT --> PROJECT_CREATED

    S2 --> URL_INPUT["Enter URL"]
    URL_INPUT --> URL_PROCESS["Processing URL..."]
    URL_PROCESS --> PROJECT_CREATED

    S3 --> FILE_PICKER["Select File to Upload"]
    FILE_PICKER --> UPLOAD_PROCESS["Uploading..."]
    UPLOAD_PROCESS --> PROJECT_CREATED

    S4 --> COMING_SOON["Coming Soon!"]

    %% PLAY A GAME FLOW
    P2 --> GAME_Q["Which game would you like to play?"]
    GAME_Q --> G1["Context Snake"]
    GAME_Q --> G2["AI Trivia Quiz"]
    GAME_Q --> G3["Ethics Defender"]
    GAME_Q --> G4["Prompt Battle"]

    G1 --> SNAKE_START["Start Context Snake Game"]
    G2 --> TRIVIA_START["Start AI Trivia Quiz"]
    G3 --> ETHICS_START["Start Ethics Defender Game"]
    G4 --> BATTLE_START["Start Prompt Battle"]

    SNAKE_START --> GAME_PLAY([Playing Game])
    TRIVIA_START --> GAME_PLAY
    ETHICS_START --> GAME_PLAY
    BATTLE_START --> GAME_PLAY

    %% OTHER PILLS - Direct responses
    P3 --> CHALLENGE_RESP["Shows weekly challenge details"]
    P4 --> LEARN_RESP["Shows learning recommendations"]
    P5 --> SELL_RESP["Guides through selling setup"]
    P6 --> EXPLORE_RESP["Shows trending projects"]
    P7 --> CONNECT_RESP["Shows connection options"]
    P8 --> PERSONALIZE_RESP["Opens personalization flow"]
    P9 --> TRENDING_RESP["Shows trending content"]
    P10 --> QUICKWIN_RESP["Suggests quick action"]
    P11 --> AVATAR_FLOW["Start Avatar Creation"]

    AVATAR_FLOW --> AVATAR_STYLE["Choose Avatar Style"]
    AVATAR_STYLE --> AVATAR_GEN["Generating Avatar..."]
    AVATAR_GEN --> AVATAR_DONE([Avatar Created])

    CHALLENGE_RESP --> CONTINUE([Continue Chatting])
    LEARN_RESP --> CONTINUE
    SELL_RESP --> CONTINUE
    EXPLORE_RESP --> CONTINUE
    CONNECT_RESP --> CONTINUE
    PERSONALIZE_RESP --> CONTINUE
    TRENDING_RESP --> CONTINUE
    QUICKWIN_RESP --> CONTINUE`;

export default function EmberFlowsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Zoom and pan state
  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 50, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.5, 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s - 0.2, 0.2));
  }, []);

  const handleReset = useCallback(() => {
    setScale(0.8);
    setPosition({ x: 50, y: 20 });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale((s) => Math.max(0.1, Math.min(s + delta, 10)));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <AdminLayout>
        <div className="p-4 md:p-6 lg:p-8 h-[calc(100vh-120px)] flex flex-col">
          {/* Header */}
          <header className="mb-4 flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                  <MapIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                    Ember <span className="text-orange-600 dark:text-orange-400">User Flows</span>
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Complete visual map • Drag to pan, scroll to zoom
                  </p>
                </div>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <button
                    onClick={handleZoomOut}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Zoom Out"
                  >
                    <MagnifyingGlassMinusIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  </button>
                  <span className="px-3 text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[60px] text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Zoom In"
                  >
                    <MagnifyingGlassPlusIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  </button>
                </div>
                <button
                  onClick={handleReset}
                  className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Reset View"
                >
                  <HomeIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Fullscreen"
                >
                  <ArrowsPointingOutIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            </div>
          </header>

          {/* Canvas Container */}
          <div
            ref={containerRef}
            className={`flex-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden cursor-grab ${isDragging ? 'cursor-grabbing' : ''} ${isFullscreen ? 'rounded-none' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <div
              ref={contentRef}
              className="inline-block p-8 select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'top left',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700">
                <MermaidDiagram code={COMPLETE_FLOW} />
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">User Journey Key</h3>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs">( )</div>
                <span className="text-slate-600 dark:text-slate-400">Start/End Point</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs">[ ]</div>
                <span className="text-slate-600 dark:text-slate-400">User Action / Screen</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rotate-45 bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs"></div>
                <span className="text-slate-600 dark:text-slate-400">Decision Point</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-slate-400 dark:bg-slate-500"></div>
                <span className="text-slate-600 dark:text-slate-400">User clicks / selects</span>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </DashboardLayout>
  );
}
