import { motion, AnimatePresence } from 'framer-motion';

interface HookSceneProps {
  elapsed: number;
}

// AI tool logos with positions and animation delays
const AI_TOOLS = [
  { name: 'ChatGPT', color: '#10a37f', x: -60, y: -80, delay: 0 },
  { name: 'Midjourney', color: '#ffffff', x: 40, y: -90, delay: 0.1 },
  { name: 'Claude', color: '#d4a27f', x: -20, y: -50, delay: 0.2 },
  { name: 'DALL-E', color: '#ff6b6b', x: 80, y: -40, delay: 0.3 },
  { name: 'Suno', color: '#7c3aed', x: -90, y: -20, delay: 0.15 },
  { name: 'Runway', color: '#00d4ff', x: 100, y: 10, delay: 0.25 },
  { name: 'Stable Diffusion', color: '#ff8c00', x: -100, y: 30, delay: 0.35 },
  { name: 'Gemini', color: '#4285f4', x: 70, y: 50, delay: 0.05 },
  { name: 'Perplexity', color: '#20b2aa', x: -40, y: 70, delay: 0.2 },
  { name: 'ElevenLabs', color: '#f472b6', x: 30, y: 80, delay: 0.3 },
  { name: 'Copilot', color: '#0078d4', x: -70, y: 50, delay: 0.1 },
  { name: 'Notion AI', color: '#ffffff', x: 90, y: -60, delay: 0.25 },
  { name: 'Jasper', color: '#ff5733', x: -110, y: -50, delay: 0.15 },
  { name: 'Copy.ai', color: '#9b59b6', x: 110, y: 40, delay: 0.35 },
  { name: 'Pika', color: '#f39c12', x: 0, y: 90, delay: 0.05 },
  { name: 'Luma', color: '#1abc9c', x: -30, y: -100, delay: 0.4 },
];

// Timing breakpoints within the 4-second scene
const TIMING = {
  cloudStart: 0,
  questionAppears: 1200,
  cloudFadeOut: 2200,
  makeItFun: 2500,
  logoAppears: 2800,
};

export function HookScene({ elapsed }: HookSceneProps) {
  const showCloud = elapsed >= TIMING.cloudStart && elapsed < TIMING.cloudFadeOut;
  const showQuestion = elapsed >= TIMING.questionAppears && elapsed < TIMING.makeItFun;
  const showMakeItFun = elapsed >= TIMING.makeItFun;
  const showLogo = elapsed >= TIMING.logoAppears;

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#0a1628] to-[#020617]" />

      {/* CSS for gentle cloud floating animation */}
      <style>{`
        @keyframes cloud-float-1 {
          0%, 100% { transform: translate(0px, 0px); }
          50% { transform: translate(8px, -12px); }
        }
        @keyframes cloud-float-2 {
          0%, 100% { transform: translate(0px, 0px); }
          50% { transform: translate(-10px, -8px); }
        }
        @keyframes cloud-float-3 {
          0%, 100% { transform: translate(0px, 0px); }
          50% { transform: translate(6px, 10px); }
        }
        @keyframes cloud-float-4 {
          0%, 100% { transform: translate(0px, 0px); }
          50% { transform: translate(-8px, 6px); }
        }
      `}</style>

      {/* Floating cloud of AI tools */}
      <AnimatePresence>
        {showCloud && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            {AI_TOOLS.map((tool, index) => (
              <motion.div
                key={tool.name}
                className="absolute text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{
                  backgroundColor: `${tool.color}25`,
                  color: tool.color,
                  border: `1px solid ${tool.color}50`,
                  boxShadow: `0 0 15px ${tool.color}30`,
                  left: `calc(50% + ${tool.x}px)`,
                  top: `calc(50% + ${tool.y}px)`,
                  animation: `cloud-float-${(index % 4) + 1} ${2.5 + (index % 3) * 0.5}s ease-in-out infinite`,
                  animationDelay: `${tool.delay}s`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 0.9, scale: 1 }}
                transition={{ delay: tool.delay, duration: 0.3 }}
              >
                {tool.name}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question text */}
      <AnimatePresence>
        {showQuestion && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center z-20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1, transition: { duration: 0.3 } }}
            transition={{ duration: 0.4 }}
          >
            <div className="text-center px-8 bg-[#020617]/80 py-4 rounded-xl backdrop-blur-sm">
              <div className="text-xl font-bold text-white leading-tight">
                Overwhelmed by how many
              </div>
              <div className="text-xl font-bold text-white leading-tight">
                AI tools are out there?
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showMakeItFun && (
          <motion.div
            className="flex flex-col items-center z-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent mb-4">
              LET'S MAKE IT FUN
            </div>
          </motion.div>
        )}

        {showLogo && (
          <motion.div
            className="flex flex-col items-center z-20"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <motion.img
              src="/all-thrvie-logo-blue.png"
              alt="AllThrive"
              className="w-20 h-20"
              initial={{ rotate: -180 }}
              animate={{ rotate: 0 }}
              transition={{ type: 'spring', stiffness: 150, damping: 15 }}
            />
            <div className="text-lg text-white/70 font-medium mt-2">
              allthrive.ai
            </div>
          </motion.div>
        )}
      </div>

      {/* Particle burst */}
      {showLogo && (
        <>
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: `linear-gradient(135deg, #22d3ee, #34d399)`,
                left: '50%',
                top: '50%',
                marginLeft: -4,
                marginTop: -4,
              }}
              initial={{ x: 0, y: 0, scale: 1, opacity: 0.8 }}
              animate={{
                x: Math.cos((i / 12) * Math.PI * 2) * 80,
                y: Math.sin((i / 12) * Math.PI * 2) * 80,
                scale: 0,
                opacity: 0,
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          ))}
        </>
      )}
    </motion.div>
  );
}

export default HookScene;
