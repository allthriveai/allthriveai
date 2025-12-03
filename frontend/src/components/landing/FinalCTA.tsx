import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface FinalCTAProps {
  onRequestInvite: () => void;
}

export function FinalCTA({ onRequestInvite }: FinalCTAProps) {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background with animated gradient */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 50% 50%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 30% 30%, rgba(74, 222, 128, 0.1) 0%, transparent 50%),
              radial-gradient(ellipse 50% 50% at 70% 70%, rgba(168, 85, 247, 0.08) 0%, transparent 50%),
              linear-gradient(180deg, #020617 0%, #0a1628 50%, #020617 100%)
            `,
          }}
        />
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-cyan-400/30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [-20, 20, -20],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Headline */}
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6">
            Ready to{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-green-400 to-emerald-400 bg-clip-text text-transparent">
              Thrive
            </span>
            ?
          </h2>

          {/* Subheadline */}
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Join our community of AI enthusiasts. Showcase your projects, learn
            from others, and level up your skills through gamified challenges.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              onClick={onRequestInvite}
              className="group relative px-10 py-5 rounded-2xl bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-bold text-lg shadow-neon-strong hover:shadow-[0_0_40px_rgba(34,211,238,0.5)] transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="relative z-10 flex items-center gap-3">
                Request Invitation
                <motion.svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </motion.svg>
              </span>
            </motion.button>

            <Link
              to="/explore"
              className="px-10 py-5 rounded-2xl border border-white/20 bg-white/5 text-white font-medium text-lg backdrop-blur-sm hover:bg-white/10 hover:border-cyan-500/30 transition-all duration-300"
            >
              Explore First
            </Link>
          </div>

        </motion.div>
      </div>
    </section>
  );
}
