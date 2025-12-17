import { motion } from 'framer-motion';
import { PitchSlide, GradientText } from '../PitchSlide';
import { EnvelopeIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

export function ThankYouSlide() {
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

        {/* Thank you */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-5xl sm:text-7xl font-bold mb-6"
        >
          <GradientText>Thank You</GradientText>
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-xl sm:text-2xl text-gray-400 mb-10 italic"
        >
          Creating with AI? You belong here.
        </motion.p>

        {/* Contact */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6"
        >
          <a
            href="mailto:allie@allthrive.ai"
            className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <EnvelopeIcon className="w-5 h-5" />
            allie@allthrive.ai
          </a>
          <a
            href="https://allthrive.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <GlobeAltIcon className="w-5 h-5" />
            allthrive.ai
          </a>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
