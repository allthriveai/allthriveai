import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faCompass } from '@fortawesome/free-solid-svg-icons';

interface CommunitySceneProps {
  elapsed: number;
}

// Timing breakpoints within the 6-second scene
const TIMING = {
  headline: 0,           // 0ms - "SEE WHAT OTHERS" appears
  areBuilding: 500,      // 0.5s - "ARE BUILDING" appears
  feedCards: 1500,       // 1.5s - Feed cards start appearing
  toolTray: 3500,        // 3.5s - Tool tray appears
  exploreBadge: 4500,    // 4.5s - "Explore Feed" badge
};

const FEED_ITEMS = [
  { avatar: 'JD', name: 'Jake', color: '#f472b6', likes: 42, tool: 'Midjourney' },
  { avatar: 'SR', name: 'Sara', color: '#60a5fa', likes: 28, tool: 'DALL-E' },
  { avatar: 'MK', name: 'Mike', color: '#34d399', likes: 67, tool: 'Suno' },
];

const TOOL_ICONS = [
  { name: 'ChatGPT', color: '#10a37f' },
  { name: 'Midjourney', color: '#ffffff' },
  { name: 'Claude', color: '#d4a27f' },
  { name: 'Suno', color: '#7c3aed' },
  { name: 'DALL-E', color: '#ff6b6b' },
  { name: 'Runway', color: '#00d4ff' },
];

export function CommunityScene({ elapsed }: CommunitySceneProps) {
  const showHeadline = elapsed >= TIMING.headline;
  const showAreBuilding = elapsed >= TIMING.areBuilding;
  const showFeedCards = elapsed >= TIMING.feedCards;
  const showToolTray = elapsed >= TIMING.toolTray;
  const showExploreBadge = elapsed >= TIMING.exploreBadge;

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
      <div className="absolute -left-20 top-1/3 w-64 h-64 rounded-full opacity-20 blur-3xl bg-cyan-500" />
      <div className="absolute -right-20 bottom-1/3 w-64 h-64 rounded-full opacity-15 blur-3xl bg-green-500" />

      {/* Header text - within Instagram safe zone */}
      <div className="relative z-10 pt-[20%] px-6 text-center">
        {showHeadline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="text-xl font-bold text-white/80 tracking-tight"
          >
            SEE WHAT OTHERS
          </motion.div>
        )}
        {showAreBuilding && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="text-3xl font-black bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent"
          >
            ARE BUILDING
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showAreBuilding ? 1 : 0 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-white/60 mt-2"
        >
          explore feed & 200+ AI tools
        </motion.div>
      </div>

      {/* Feed Cards - Scrolling effect */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 gap-3 overflow-hidden">
        {showFeedCards && FEED_ITEMS.map((item, i) => (
          <motion.div
            key={item.name}
            initial={{ x: i % 2 === 0 ? -200 : 200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.3, type: 'spring', stiffness: 200 }}
            className="w-full max-w-xs bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-3 flex items-center gap-3"
          >
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: item.color }}
            >
              {item.avatar}
            </div>

            {/* Project preview */}
            <div
              className="w-12 h-12 rounded-lg"
              style={{ backgroundColor: `${item.color}80` }}
            />

            {/* Info */}
            <div className="flex-1">
              <div className="text-white font-medium text-sm">{item.name}'s project</div>
              <div className="text-white/50 text-xs">Made with {item.tool}</div>
            </div>

            {/* Likes */}
            <div className="flex items-center gap-1 text-pink-400">
              <FontAwesomeIcon icon={faHeart} className="w-3 h-3" />
              <span className="text-xs font-medium">{item.likes}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tool Tray - within Instagram safe zone */}
      {showToolTray && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="relative z-10 px-6 pb-[30%]"
        >
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-3">
            <div className="text-xs text-white/50 mb-2 text-center">200+ AI Tools</div>
            <div className="flex justify-center gap-2 flex-wrap">
              {TOOL_ICONS.map((tool, i) => (
                <motion.div
                  key={tool.name}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.05, type: 'spring' }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: `${tool.color}20`,
                    color: tool.color,
                    border: `1px solid ${tool.color}30`,
                  }}
                >
                  {tool.name.charAt(0)}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Explore badge */}
      {showExploreBadge && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/30 to-green-500/30 border border-cyan-500/50 shadow-lg shadow-cyan-500/20">
            <FontAwesomeIcon icon={faCompass} className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-300 font-bold text-sm">Explore Feed</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default CommunityScene;
