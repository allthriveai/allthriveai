import { motion } from 'framer-motion';

interface CTAVideoSceneProps {
  elapsed: number;
}

const TIMING = {
  logo: 0,          // 15s - Logo appears immediately
  line1: 400,       // 15.4s
  line2: 800,       // 15.8s
  tagline: 1400,    // 16.4s
  button: 2200,     // 17.2s
};

export function CTAVideoScene({ elapsed }: CTAVideoSceneProps) {
  const showLogo = elapsed >= TIMING.logo;
  const showLine1 = elapsed >= TIMING.line1;
  const showLine2 = elapsed >= TIMING.line2;
  const showTagline = elapsed >= TIMING.tagline;
  const showButton = elapsed >= TIMING.button;

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background glow */}
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute left-1/3 top-1/3 w-64 h-64 bg-green-500/15 rounded-full blur-3xl" />
      </div>

      <div className="text-center px-8 z-10">
        {/* AllThrive Logo */}
        {showLogo && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="mb-6"
          >
            <img
              src="/all-thrvie-logo.png"
              alt="AllThrive"
              className="w-24 h-24 mx-auto mb-3"
            />
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
              allthrive.ai
            </div>
          </motion.div>
        )}

        {showLine1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white/70 text-base mb-1"
          >
            Create with AI anywhere
          </motion.div>
        )}

        {showLine2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white/70 text-base mb-6"
          >
            Consolidate here
          </motion.div>
        )}

        {showTagline && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="mb-8"
          >
            <span className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-green-400 to-cyan-400 bg-clip-text text-transparent">
              THRIVE TOGETHER
            </span>
          </motion.div>
        )}

        {showButton && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <motion.div
              className="inline-flex items-center px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-bold text-lg shadow-lg shadow-cyan-500/30"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              Request Invitation
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default CTAVideoScene;
