import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMousePointer, faCheckCircle, faHeart, faComment } from '@fortawesome/free-solid-svg-icons';

interface PortfolioVideoSceneProps {
  elapsed: number;
  isPlaying: boolean;
}

// Tools to rotate through quickly - ends on Midjourney
const TOOLS = ['Codex', 'Lovable', 'Runway', 'Replit', 'Cursor', 'v0', 'Midjourney'];

const TIMING = {
  chatBubbleIn: 0,           // 0ms - User chat bubble appears
  toolRotateStart: 300,      // 0.3s - Start rotating tool names
  toolRotateEnd: 2000,       // 2s - Stop rotating, land on one
  addButtonIn: 2200,         // 2.2s - Add Project button appears
  cursorIn: 2500,            // 2.5s - Cursor appears
  cursorClick: 3000,         // 3s - Cursor clicks
  aiResponseIn: 3300,        // 3.3s - AI chat response
  profileCardIn: 4200,       // 4.2s - Profile card slides in
  subtextIn: 5200,           // 5.2s - Subtext appears
};

export function PortfolioVideoScene({ elapsed, isPlaying }: PortfolioVideoSceneProps) {
  const [currentToolIndex, setCurrentToolIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const showChatBubble = elapsed >= TIMING.chatBubbleIn;
  const isRotating = elapsed >= TIMING.toolRotateStart && elapsed < TIMING.toolRotateEnd;
  const showAddButton = elapsed >= TIMING.addButtonIn;
  const showCursor = elapsed >= TIMING.cursorIn;
  const showClick = elapsed >= TIMING.cursorClick;
  const showAiResponse = elapsed >= TIMING.aiResponseIn;
  const showProfileCard = elapsed >= TIMING.profileCardIn;
  const showSubtext = elapsed >= TIMING.subtextIn;

  // Rotate through tools quickly
  useEffect(() => {
    if (!isPlaying || !isRotating) return;

    const interval = setInterval(() => {
      setCurrentToolIndex(prev => (prev + 1) % TOOLS.length);
    }, 120); // Fast rotation

    return () => clearInterval(interval);
  }, [isPlaying, isRotating]);

  // Land on Midjourney (last item) when rotation stops
  const rotationEnded = elapsed >= TIMING.toolRotateEnd;
  useEffect(() => {
    if (rotationEnded) {
      setCurrentToolIndex(TOOLS.length - 1); // Midjourney
    }
  }, [rotationEnded]);

  // Reset tool index when scene restarts
  useEffect(() => {
    if (elapsed < 100) {
      setCurrentToolIndex(0);
    }
  }, [elapsed]);

  // Control video playback
  useEffect(() => {
    if (videoRef.current && showProfileCard) {
      videoRef.current.play().catch(() => {});
    }
  }, [showProfileCard]);

  // Also play when isPlaying changes
  useEffect(() => {
    if (videoRef.current && isPlaying && showProfileCard) {
      videoRef.current.play().catch(() => {});
    } else if (videoRef.current && !isPlaying) {
      videoRef.current.pause();
    }
  }, [isPlaying, showProfileCard]);

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background glows */}
      <div className="absolute left-1/4 top-1/4 w-64 h-64 rounded-full opacity-20 blur-3xl bg-green-500" />
      <div className="absolute right-1/4 bottom-1/3 w-64 h-64 rounded-full opacity-20 blur-3xl bg-cyan-500" />

      {/* Content container */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">

        {/* Phase 1: Chat conversation */}
        {!showProfileCard && (
          <div className="w-full max-w-sm px-4 space-y-4">
            {/* User chat bubble */}
            {showChatBubble && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="flex justify-end"
              >
                <div className="bg-cyan-600 rounded-2xl rounded-br-sm px-5 py-4 max-w-[90%]">
                  <p className="text-white text-lg leading-relaxed">
                    I want to add this cool new project I built with{' '}
                    <span className="font-bold text-cyan-200">
                      {TOOLS[currentToolIndex]}
                    </span>
                  </p>
                </div>
              </motion.div>
            )}

            {/* Add Project button */}
            {showAddButton && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center relative"
              >
                <motion.button
                  animate={showClick ? { scale: [1, 0.95, 1] } : {}}
                  transition={{ duration: 0.15 }}
                  className={`px-6 py-3 rounded-full font-semibold text-base transition-all ${
                    showClick
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                      : 'bg-slate-700 text-white/90 border border-slate-600'
                  }`}
                >
                  + Add Project
                </motion.button>

                {/* Cursor */}
                {showCursor && (
                  <motion.div
                    initial={{ x: 60, y: 40, opacity: 0 }}
                    animate={{
                      x: showClick ? 0 : 10,
                      y: showClick ? 0 : 10,
                      opacity: 1
                    }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className="absolute top-1/2 left-1/2"
                  >
                    <FontAwesomeIcon
                      icon={faMousePointer}
                      className={`w-6 h-6 drop-shadow-lg ${showClick ? 'text-green-400' : 'text-white'}`}
                    />
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* AI Response bubble */}
            {showAiResponse && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="flex justify-start"
              >
                <div className="bg-slate-700/90 rounded-2xl rounded-bl-sm px-5 py-4 max-w-[90%] border border-slate-600/50">
                  <div className="flex items-center gap-2 mb-2">
                    <img src="/all-thrvie-logo-blue-900x900.png" alt="AllThrive" className="w-6 h-6" />
                    <span className="text-green-400 text-sm font-semibold">AllThrive</span>
                  </div>
                  <p className="text-white/90 text-lg">
                    Importing project to your profile for you...
                  </p>
                  {/* Loading dots */}
                  <motion.div className="flex gap-1.5 mt-3">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                        className="w-2 h-2 rounded-full bg-green-400"
                      />
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Phase 2: Project imported result */}
        <AnimatePresence>
          {showProfileCard && (
            <>
              {/* Success Header */}
              <motion.div
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center px-6 mb-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, delay: 0.1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/40 mb-3"
                >
                  <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-semibold text-sm">Project Imported!</span>
                </motion.div>
              </motion.div>

              {/* Project Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-full max-w-sm px-4"
              >
                <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50 shadow-xl">
                  {/* Project Video */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="relative aspect-[4/3] bg-slate-900"
                  >
                    <video
                      ref={videoRef}
                      src="/sammy.mp4"
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                      onCanPlay={(e) => {
                        if (isPlaying) {
                          (e.target as HTMLVideoElement).play().catch(() => {});
                        }
                      }}
                    />
                    {/* Tool badge overlay */}
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-1 text-[10px] rounded-full bg-black/60 text-white/90 backdrop-blur-sm">
                        Midjourney
                      </span>
                    </div>
                  </motion.div>

                  {/* Project Info */}
                  <div className="p-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <h3 className="text-white font-bold text-sm mb-1">Mastering Samurai Animation</h3>
                      <p className="text-white/50 text-xs mb-3">AI-generated animation techniques</p>
                    </motion.div>

                    {/* User info and engagement */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-green-500 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-white">AJ</span>
                        </div>
                        <span className="text-white/70 text-xs">@allierays</span>
                      </div>
                      <div className="flex items-center gap-3 text-white/50">
                        <div className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faHeart} className="w-3 h-3" />
                          <span className="text-xs">42</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faComment} className="w-3 h-3" />
                          <span className="text-xs">12</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>

              {/* Subtext */}
              {showSubtext && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mt-4 px-6"
                >
                  <span className="text-white/60 text-sm">Creating with AI? </span>
                  <span className="text-cyan-400 text-sm font-semibold">You belong here</span>
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default PortfolioVideoScene;
