import { motion } from 'framer-motion';
import { PitchSlide, GradientText } from '../PitchSlide';

export function TitleSlide() {
  return (
    <PitchSlide>
      <div className="flex flex-col items-center text-center max-w-4xl">
        {/* Floating orbs */}
        <motion.div
          className="absolute w-64 h-64 rounded-full blur-3xl opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(34, 211, 238, 0.5) 0%, transparent 70%)',
            top: '15%',
            left: '15%',
          }}
          animate={{
            y: [0, -20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute w-48 h-48 rounded-full blur-3xl opacity-25"
          style={{
            background: 'radial-gradient(circle, rgba(74, 222, 128, 0.5) 0%, transparent 70%)',
            bottom: '20%',
            right: '15%',
          }}
          animate={{
            y: [0, 15, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <img
            src="/all-thrvie-logo.png"
            alt="All Thrive"
            className="h-24 sm:h-32 w-auto drop-shadow-2xl"
          />
        </motion.div>

        {/* Company name */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-5xl sm:text-7xl font-bold mb-6"
        >
          <GradientText>All Thrive</GradientText>
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-2xl sm:text-3xl text-white font-light mb-4"
        >
          Create with AI anywhere. Consolidate here. Thrive together.
        </motion.p>

        {/* Sub-tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-lg sm:text-xl text-gray-400 max-w-4xl whitespace-nowrap"
        >
          A home for AI creators to Showcase, Learn, & Play
        </motion.p>
      </div>
    </PitchSlide>
  );
}
