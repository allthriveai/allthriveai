import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import { ClockIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

// Animated checkmark component
function AnimatedCheck({ delay = 0 }: { delay?: number }) {
  return (
    <div className="w-5 h-5 flex-shrink-0 mt-0.5 relative">
      {/* Circle */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay }}
        className="absolute inset-0 rounded-full bg-green-500"
      />
      {/* Checkmark */}
      <motion.svg
        viewBox="0 0 24 24"
        className="absolute inset-0 w-5 h-5"
        initial="hidden"
        animate="visible"
      >
        <motion.path
          d="M9 12.5L11.5 15L15.5 10"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={{
            hidden: { pathLength: 0, opacity: 0 },
            visible: { pathLength: 1, opacity: 1 }
          }}
          transition={{ duration: 0.4, delay: delay + 0.2, ease: "easeOut" }}
        />
      </motion.svg>
    </div>
  );
}

const buildProgress = [
  { label: 'AI Portfolio Builder', status: 'done', description: 'Paste URL, auto-extract & organize' },
  { label: 'Chrome Extension', status: 'done', description: 'One-click capture while creating' },
  { label: 'Prompt Battles', status: 'done', description: 'Real-time 1v1 competitions' },
  { label: 'Gamified Learning', status: 'done', description: 'XP, levels, achievements' },
  { label: 'AI Chat Onboarding', status: 'done', description: 'Conversational profile setup' },
  { label: 'Creator Marketplace', status: 'coming', description: 'Sell courses, templates & digital products' },
  { label: 'Community & Private Chat', status: 'coming', description: 'Connect with other creators' },
];

const roadmap = [
  { date: 'Now', event: 'Private Beta', completed: true },
  { date: 'Q1 2025', event: 'Public Launch', completed: false },
  { date: 'Q2 2025', event: 'Grow creator marketplace', completed: false },
  { date: 'Q3 2025', event: 'Grow partnerships', completed: false },
];

export function TractionSlide() {
  return (
    <PitchSlide>
      <div className="w-full max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            <GradientText>Progress</GradientText> & Roadmap
          </h2>
          <p className="text-xl text-gray-400">
            Product built, ready for users
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* What's Built */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <GlassCard className="h-full">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <CheckCircleIcon className="w-7 h-7 text-green-400" />
                  What's Built
                </h3>
                <div className="mt-3 h-px bg-gradient-to-r from-green-400/50 to-transparent" />
              </div>
              <div className="space-y-3">
                {buildProgress.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.15 }}
                    className="flex items-start gap-3"
                  >
                    {item.status === 'done' ? (
                      <AnimatedCheck delay={0.4 + index * 0.15} />
                    ) : (
                      <div className="w-5 h-5 flex-shrink-0 mt-0.5 rounded-full border-2 border-amber-400/50 bg-amber-400/10" />
                    )}
                    <div>
                      <div className="text-white font-medium text-sm flex items-center gap-2">
                        {item.label}
                        {item.status === 'coming' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs">{item.description}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          {/* Roadmap */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <GlassCard className="h-full">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <ClockIcon className="w-7 h-7 text-cyan-400" />
                  Roadmap
                </h3>
                <div className="mt-3 h-px bg-gradient-to-r from-cyan-400/50 to-transparent" />
              </div>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-white/10" />

                <div className="space-y-6">
                  {roadmap.map((milestone, index) => (
                    <motion.div
                      key={milestone.event}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                      className="flex items-center gap-4 pl-0"
                    >
                      <div
                        className={`w-4 h-4 rounded-full flex-shrink-0 z-10 ${
                          milestone.completed
                            ? 'bg-gradient-to-r from-cyan-400 to-green-400'
                            : 'bg-slate-700 border-2 border-white/20'
                        }`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${milestone.completed ? 'text-white' : 'text-gray-400'}`}>
                            {milestone.event}
                          </span>
                          {milestone.completed && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400">LIVE</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{milestone.date}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Stage indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="text-center mt-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-400 font-medium">Pre-launch • Seeking funding for marketing and growth</span>
          </div>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
