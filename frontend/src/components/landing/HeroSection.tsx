import { motion } from 'framer-motion';
import { IconCloud } from './IconCloud';

interface HeroSectionProps {
  onRequestInvite: () => void;
  isModalOpen?: boolean;
}

export function HeroSection({ onRequestInvite, isModalOpen = false }: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <a href="/" className="inline-flex items-center gap-2 sm:gap-3">
              <img
                src="/all-thrvie-logo.png"
                alt="All Thrive"
                className="h-8 sm:h-10 w-auto"
              />
              <span className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                All Thrive
              </span>
            </a>
            <div className="flex items-center gap-2 sm:gap-4">
              <a
                href="/explore"
                className="text-white/70 font-medium text-xs sm:text-sm hover:text-white transition-colors duration-300"
              >
                Explore
              </a>
              <a
                href="/auth"
                className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-sm border border-white/20 text-white/90 font-medium text-xs sm:text-sm hover:bg-white/10 hover:border-white/30 transition-all duration-300"
              >
                Sign In
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Animated background gradients */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% 0%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 20%, rgba(74, 222, 128, 0.1) 0%, transparent 50%),
              radial-gradient(ellipse 50% 30% at 20% 80%, rgba(34, 211, 238, 0.08) 0%, transparent 50%),
              linear-gradient(180deg, #020617 0%, #0a1628 50%, #020617 100%)
            `,
          }}
        />
        {/* Animated floating orbs */}
        <motion.div
          className="absolute w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(34, 211, 238, 0.4) 0%, transparent 70%)',
            top: '10%',
            left: '10%',
          }}
          animate={{
            y: [0, -30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(74, 222, 128, 0.4) 0%, transparent 70%)',
            bottom: '20%',
            right: '10%',
          }}
          animate={{
            y: [0, 20, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-24 sm:pt-20 pb-12 sm:pb-20">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* Left side - Text content */}
          <div className="flex-[3] text-center lg:text-left">
            {/* Main headline */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="mb-6"
            >
              <h1 className="font-bold tracking-tight mb-6 max-w-2xl">
                <span className="block text-[2rem] sm:text-[3rem] md:text-[4rem] text-white leading-[1.1]">
                  Creating with AI?
                </span>
                <span
                  className="block text-[2.5rem] sm:text-[3.5rem] md:text-[4.5rem] leading-[1.1] animate-gradient-rotate"
                  style={{
                    backgroundSize: '300% 300%',
                    background: 'linear-gradient(90deg, #22d3ee, #4ade80, #22d3ee)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  You belong here.
                </span>
              </h1>
              <p className="text-xl sm:text-[1.375rem] text-gray-300 mb-4">
                Share your work. Level up your skills. Thrive together.
              </p>
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex items-center lg:items-start justify-center lg:justify-start"
            >
              <button
                onClick={onRequestInvite}
                className="group relative px-8 py-4 rounded-sm bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold text-lg shadow-neon hover:shadow-neon-strong transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Request Invitation
                  <svg
                    className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </span>
              </button>
            </motion.div>

          </div>

          {/* Right side - Icon Cloud */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className={`flex-[2] w-full max-w-md lg:max-w-none ${isModalOpen ? 'pointer-events-none' : ''}`}
          >
            <div className="relative aspect-square max-w-[420px] mx-auto lg:mr-auto lg:ml-0">
              {/* Glow effect behind cloud */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/20 to-green-500/20 blur-3xl" />

              {/* Center Logo */}
              <div className="absolute inset-0 flex items-center justify-center z-0">
                <img
                  src="/all-thrvie-logo.png"
                  alt="All Thrive"
                  className="w-16 h-auto opacity-90 drop-shadow-2xl"
                />
              </div>

              <div className="relative z-10">
                <IconCloud />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

    </section>
  );
}
