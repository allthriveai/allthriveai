/**
 * WhatIsAllThrive - Clear value prop section
 */

import { motion } from 'framer-motion';

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

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-cyan-400 font-medium mb-6 tracking-wide">What is All Thrive?</p>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-8 leading-[1.15]">
            The Gamified AI Portfolio Platform{' '}
            <span className="bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent">
              For Creators
            </span>
          </h2>

          <p className="text-xl sm:text-2xl text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Automate your AI portfolio, compete in Prompt Battles, and level up your AI skills.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
