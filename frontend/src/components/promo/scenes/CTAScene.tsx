import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';

interface CTASceneProps {
  elapsed: number;
}

// Timing breakpoints within the 4-second scene
const TIMING = {
  logo: 0,               // 0ms - AllThrive logo appears
  tagline: 800,          // 0.8s - Tagline appears
  button: 1500,          // 1.5s - CTA button appears
  socialProof: 2200,     // 2.2s - Social proof appears
  buttonPulse: 3000,     // 3s - Button starts pulsing
};

export function CTAScene({ elapsed }: CTASceneProps) {
  const showLogo = elapsed >= TIMING.logo;
  const showTagline = elapsed >= TIMING.tagline;
  const showButton = elapsed >= TIMING.button;
  const showSocialProof = elapsed >= TIMING.socialProof;
  const buttonPulse = elapsed >= TIMING.buttonPulse;

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        // Instagram safe zone padding
        paddingTop: '20%',
        paddingBottom: '30%',
      }}
    >
      {/* Background with converging gradients */}
      <div className="absolute inset-0 bg-[#020617]" />
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-30 blur-3xl bg-gradient-to-b from-cyan-500 to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-t from-green-500 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6">
        {/* Logo */}
        {showLogo && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="mb-6 flex flex-col items-center"
          >
            <img
              src="/all-thrvie-logo-blue.png"
              alt="All Thrive"
              className="w-20 h-20 mb-2"
            />
            <div className="text-3xl font-black">
              <span className="text-white">All</span>
              <span className="bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">Thrive</span>
            </div>
          </motion.div>
        )}

        {/* Tagline */}
        {showTagline && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="mb-8"
          >
            <div className="text-lg text-white/80 font-medium">
              Creating with AI?
            </div>
            <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent mt-1">
              You belong here.
            </div>
          </motion.div>
        )}

        {/* CTA Button */}
        {showButton && (
          <motion.button
            initial={{ scale: 0, y: 20 }}
            animate={{
              scale: buttonPulse ? [1, 1.05, 1] : 1,
              y: 0,
            }}
            transition={{
              scale: buttonPulse
                ? { duration: 1, repeat: Infinity, ease: 'easeInOut' }
                : { type: 'spring', stiffness: 300 },
              y: { type: 'spring', stiffness: 300 },
            }}
            className="relative px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-bold text-lg shadow-lg shadow-cyan-500/30 flex items-center gap-3 mx-auto"
          >
            JOIN THE WAITLIST
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <FontAwesomeIcon icon={faArrowRight} className="w-4 h-4" />
            </motion.span>

            {/* Glow ring */}
            {buttonPulse && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-cyan-400"
                animate={{ scale: [1, 1.2], opacity: [0.5, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </motion.button>
        )}

        {/* Social proof */}
        {showSocialProof && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-white/50 text-sm"
          >
            Join 2,000+ AI curious people on the waitlist
          </motion.div>
        )}
      </div>

      {/* Floating particles */}
      {showLogo && [...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-cyan-400/50"
          initial={{
            x: (Math.random() - 0.5) * 300,
            y: (Math.random() - 0.5) * 500,
            opacity: 0,
          }}
          animate={{
            y: [(Math.random() - 0.5) * 500, (Math.random() - 0.5) * 500 - 100],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
          style={{
            left: '50%',
            top: '50%',
          }}
        />
      ))}
    </motion.div>
  );
}

export default CTAScene;
