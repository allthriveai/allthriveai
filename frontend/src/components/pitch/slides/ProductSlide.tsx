import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import { SparklesIcon } from '@heroicons/react/24/outline';

export function ProductSlide() {
  return (
    <PitchSlide>
      {/* Background gradients */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 60% 40% at 20% 30%, rgba(34, 211, 238, 0.12) 0%, transparent 50%),
              radial-gradient(ellipse 50% 30% at 80% 70%, rgba(74, 222, 128, 0.1) 0%, transparent 50%)
            `,
          }}
        />
      </div>

      <div className="w-full max-w-6xl relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            The <GradientText>Product</GradientText>
          </h2>
          <p className="text-xl text-gray-400">
            See what users experience
          </p>
        </motion.div>

        {/* Two-column product showcase */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Left: AI-Automated Portfolio */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="glass-card p-5 rounded-xl border border-cyan-500/20 h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-green-400 flex items-center justify-center">
                  <SparklesIcon className="w-4 h-4 text-[#020617]" />
                </div>
                <h3 className="text-lg font-semibold text-white">AI-Automated Portfolio</h3>
              </div>

              {/* Mini profile mockup */}
              <div className="bg-slate-900/80 rounded-lg p-4 border border-white/5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-400 to-green-400 flex items-center justify-center text-lg font-bold text-[#020617] flex-shrink-0">
                    MK
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold text-sm">Maya Kim</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px]">Verified</span>
                    </div>
                    <p className="text-gray-500 text-xs mb-2 line-clamp-1">AI artist & prompt engineer</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Midjourney', 'ChatGPT', 'Suno'].map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Mini project grid */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {/* Art project */}
                  <div className="aspect-square rounded-lg bg-gradient-to-br from-purple-900/40 to-pink-900/30 flex items-center justify-center overflow-hidden border border-white/5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400/30 to-pink-400/20" />
                  </div>
                  {/* Code project */}
                  <div className="aspect-square rounded-lg bg-gradient-to-br from-cyan-900/40 to-blue-900/30 flex flex-col items-start justify-center px-1.5 gap-0.5 overflow-hidden border border-white/5">
                    <div className="w-full h-1 rounded-full bg-cyan-400/20" />
                    <div className="w-3/4 h-1 rounded-full bg-cyan-400/15" />
                    <div className="w-5/6 h-1 rounded-full bg-cyan-400/10" />
                  </div>
                  {/* Music project */}
                  <div className="aspect-square rounded-lg bg-gradient-to-br from-emerald-900/40 to-teal-900/30 flex items-end justify-center gap-0.5 pb-2 overflow-hidden border border-white/5">
                    <div className="w-1 h-3 rounded-full bg-emerald-400/25" />
                    <div className="w-1 h-5 rounded-full bg-emerald-400/30" />
                    <div className="w-1 h-4 rounded-full bg-emerald-400/20" />
                    <div className="w-1 h-6 rounded-full bg-emerald-400/35" />
                    <div className="w-1 h-3 rounded-full bg-emerald-400/25" />
                  </div>
                </div>
              </div>

              <p className="text-gray-400 text-sm mt-3 text-center">
                Paste a link → AI extracts & organizes
              </p>
            </div>
          </motion.div>

          {/* Right: Prompt Battles */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="glass-card p-5 rounded-xl border border-rose-500/20 h-full relative overflow-hidden">
              {/* Background glows */}
              <div className="absolute -left-10 top-0 w-32 h-32 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, rgba(34, 211, 238, 0.4) 0%, transparent 70%)' }} />
              <div className="absolute -right-10 top-0 w-32 h-32 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, rgba(251, 55, 255, 0.3) 0%, transparent 70%)' }} />

              <div className="flex items-center gap-2 mb-4 relative z-10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Prompt Battles</h3>
              </div>

              {/* Battle Arena mockup */}
              <div className="bg-slate-900/80 rounded-lg p-4 border border-white/5 relative z-10">
                {/* VS Layout */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  {/* Player 1 */}
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700/50 to-slate-800/50 ring-2 ring-cyan-400/50 flex items-center justify-center mb-2 overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-br from-cyan-400/20 to-cyan-600/20 flex items-center justify-center">
                        <span className="text-cyan-400 font-bold text-lg">JD</span>
                      </div>
                    </div>
                    <span className="text-cyan-300 text-xs font-semibold">@jdoe</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[8px] font-bold mt-1">YOU</span>
                  </div>

                  {/* VS Badge */}
                  <div className="relative">
                    <motion.div
                      className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-500/50"
                      style={{ boxShadow: '0 0 20px rgba(34, 211, 238, 0.3)' }}
                    >
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400">VS</span>
                    </motion.div>
                  </div>

                  {/* Player 2 */}
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700/50 to-slate-800/50 flex items-center justify-center mb-2 overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-br from-purple-400/20 to-pink-600/20 flex items-center justify-center">
                        <span className="text-purple-400 font-bold text-lg">MK</span>
                      </div>
                    </div>
                    <span className="text-white text-xs font-semibold">@maya_k</span>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-slate-400 text-[8px]">Ready</span>
                    </div>
                  </div>
                </div>

                {/* Challenge prompt */}
                <div className="bg-white/5 rounded-lg p-3 mb-3 border border-white/5">
                  <p className="text-gray-400 text-[10px] mb-1 uppercase tracking-wider">Challenge</p>
                  <p className="text-white text-sm font-medium">"Create a logo for a space coffee shop"</p>
                </div>

                {/* Timer bar */}
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                  <span className="text-rose-300 text-xs font-semibold tracking-wider uppercase">Battle in Progress</span>
                </div>
              </div>

              <p className="text-gray-400 text-sm mt-3 text-center relative z-10">
                Real-time 1v1 prompting competitions
              </p>
            </div>
          </motion.div>
        </div>

        {/* Bottom feature row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-6 grid grid-cols-3 gap-4"
        >
          {[
            { label: 'Chrome Extension', desc: 'One-click capture' },
            { label: 'Learning Paths', desc: 'Personalized by activity' },
            { label: '200+ AI Tools', desc: 'All in one directory' },
          ].map((item, i) => (
            <div
              key={item.label}
              className="glass-card py-4 px-4 rounded-xl border border-white/10 text-center"
            >
              <p className="text-white font-medium text-sm">{item.label}</p>
              <p className="text-gray-500 text-xs">{item.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-center mt-8"
        >
          <p className="text-xl text-gray-300">
            Create with AI anywhere. Consolidate here. <GradientText>Thrive together.</GradientText>
          </p>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
