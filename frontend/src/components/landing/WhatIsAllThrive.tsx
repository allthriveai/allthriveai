/**
 * WhatIsAllThrive - Clear value prop section
 */

import { motion } from 'framer-motion';
import { PuzzlePieceIcon, AcademicCapIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const features = [
  {
    icon: PuzzlePieceIcon,
    title: 'Post the messy middle',
    description: 'Share and get feedback on what you\'re working on at any stage. This is a playground, not a portfolio.',
  },
  {
    icon: AcademicCapIcon,
    title: 'Learn through play',
    description: 'Play interactive games, play against other members, or participate in weekly challenges.',
  },
  {
    icon: UserGroupIcon,
    title: 'Figure it out together',
    description: 'Connect with others who are just as curious. No gatekeeping, just growth.',
  },
];

export function WhatIsAllThrive() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background with animated gradient */}
      <div className="absolute inset-0" aria-hidden="true">
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

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-cyan-400 font-medium mb-6 tracking-wide">What is All Thrive?</p>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.15]">
            For the AI curious{' '}
            <span className="bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent">
              at any level.
            </span>
          </h2>
        </motion.div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative"
            >
              <div className="relative h-full p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-cyan-500/30 transition-all duration-300">
                {/* Glow effect on hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative text-center">
                  <div className="w-12 h-12 mb-5 mx-auto rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center border border-cyan-500/20">
                    <feature.icon className="w-6 h-6 text-cyan-400" />
                  </div>

                  <h3 className="text-xl font-semibold text-white mb-3">
                    {feature.title}
                  </h3>

                  <p className="text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
