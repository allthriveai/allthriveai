import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar, faCheck } from '@fortawesome/free-solid-svg-icons';

interface PortfolioSceneProps {
  elapsed: number;
}

// Timing breakpoints within the 8-second scene
const TIMING = {
  headline: 0,           // 0ms - "CREATING WITH AI?" appears
  aiProjects: 500,       // 0.5s - "YOU BELONG HERE" appears
  cardFrame: 1500,       // 1.5s - Card frame materializes
  avatar: 2000,          // 2s - Avatar appears
  name: 2500,            // 2.5s - Name appears
  toolBadges: 3000,      // 3s - Tool badges pop in
  projects: 4500,        // 4.5s - Project thumbnails
  stats: 5500,           // 5.5s - Stats animate
  aiAutomated: 6500,     // 6.5s - "AI Automated" badge
};

const TOOL_BADGES = [
  { name: 'Midjourney', color: '#ffffff' },
  { name: 'ChatGPT', color: '#10a37f' },
  { name: 'Suno', color: '#7c3aed' },
  { name: 'Canva', color: '#00c4cc' },
];

const PROJECTS = [
  { color: '#f472b6' },
  { color: '#60a5fa' },
  { color: '#34d399' },
  { color: '#fbbf24' },
];

export function PortfolioScene({ elapsed }: PortfolioSceneProps) {
  const showHeadline = elapsed >= TIMING.headline;
  const showAiProjects = elapsed >= TIMING.aiProjects;
  const showCardFrame = elapsed >= TIMING.cardFrame;
  const showAvatar = elapsed >= TIMING.avatar;
  const showName = elapsed >= TIMING.name;
  const showToolBadges = elapsed >= TIMING.toolBadges;
  const showProjects = elapsed >= TIMING.projects;
  const showStats = elapsed >= TIMING.stats;
  const showAiAutomated = elapsed >= TIMING.aiAutomated;

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#0a1628] to-[#020617]" />
      <div className="absolute -right-20 top-1/4 w-64 h-64 rounded-full opacity-20 blur-3xl bg-green-500" />
      <div className="absolute -left-20 bottom-1/4 w-64 h-64 rounded-full opacity-15 blur-3xl bg-cyan-500" />

      {/* Header text - within Instagram safe zone */}
      <div className="relative z-10 pt-[20%] px-6 text-center">
        {showHeadline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="text-xl font-bold text-white/80 tracking-tight"
          >
            CREATING WITH AI?
          </motion.div>
        )}
        {showAiProjects && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="text-3xl font-black bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent"
          >
            YOU BELONG HERE
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showAiProjects ? 1 : 0 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-white/60 mt-2"
        >
          Share your work. Level up your skills.
        </motion.div>
      </div>

      {/* Profile Card - within Instagram safe zone */}
      <div className="flex-1 flex items-center justify-center px-6 pb-[28%] relative z-10">
        {showCardFrame && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="w-full max-w-xs bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5"
          >
            {/* Avatar + Name row */}
            <div className="flex items-center gap-3 mb-4">
              {showAvatar && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-green-500 flex items-center justify-center text-white font-bold text-xl"
                >
                  MK
                </motion.div>
              )}
              {showName && (
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="text-white font-bold">Maya Kim</div>
                  <div className="text-white/50 text-sm">@mayakim</div>
                </motion.div>
              )}
            </div>

            {/* Tool badges */}
            {showToolBadges && (
              <div className="flex flex-wrap gap-2 mb-4">
                {TOOL_BADGES.map((tool, i) => (
                  <motion.span
                    key={tool.name}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.1, type: 'spring' }}
                    className="px-2 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${tool.color}20`,
                      color: tool.color,
                      border: `1px solid ${tool.color}30`,
                    }}
                  >
                    {tool.name}
                  </motion.span>
                ))}
              </div>
            )}

            {/* Project thumbnails */}
            {showProjects && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                {PROJECTS.map((project, i) => (
                  <motion.div
                    key={i}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="aspect-square rounded-lg"
                    style={{ backgroundColor: project.color }}
                  />
                ))}
              </div>
            )}

            {/* Stats row */}
            {showStats && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-between text-center border-t border-white/10 pt-3"
              >
                <div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1 }}
                    className="text-lg font-bold text-white"
                  >
                    12
                  </motion.div>
                  <div className="text-xs text-white/50">Projects</div>
                </div>
                <div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="text-lg font-bold text-cyan-400"
                  >
                    4
                  </motion.div>
                  <div className="text-xs text-white/50">AI Tools</div>
                </div>
                <div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.3 }}
                    className="text-lg font-bold text-green-400"
                  >
                    820
                  </motion.div>
                  <div className="text-xs text-white/50">XP</div>
                </div>
              </motion.div>
            )}

            {/* AI Automated badge */}
            {showAiAutomated && (
              <motion.div
                initial={{ y: 20, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-500/20 to-cyan-500/20 border border-green-500/30"
              >
                <FontAwesomeIcon icon={faStar} className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-bold text-sm">AI Automated</span>
                <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-green-400" />
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default PortfolioScene;
