import { motion } from 'framer-motion';
import { profileSteps } from '@/data/landingMockData';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileLines,
  faCircleCheck,
  faComments,
} from '@fortawesome/free-solid-svg-icons';
import { SparklesIcon } from '@heroicons/react/24/outline';

const stepIcons = {
  chat: faComments,
  sparkles: 'heroicon-sparkles',
  'document-text': faFileLines,
  'check-circle': faCircleCheck,
};

export function AutomatedProfile() {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#020617]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 20% 50%, rgba(34, 211, 238, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse 50% 30% at 80% 50%, rgba(74, 222, 128, 0.1) 0%, transparent 50%)
          `,
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Your AI Portfolio,{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
              Automated
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-4xl mx-auto">
            You've used ChatGPT, made images on Midjourney, built apps with coding agents—but where does it all live? Paste a link and All Thrive turns it into a shareable project portfolio.
          </p>
        </motion.div>

        {/* Steps timeline */}
        <div className="relative">
          {/* Connection line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500/30 via-green-500/30 to-cyan-500/30 transform -translate-y-1/2" />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {profileSteps.map((step, index) => {
              const iconKey = step.icon as keyof typeof stepIcons;
              const isSparkles = iconKey === 'sparkles';
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  className="relative h-full"
                >
                  {/* Step card */}
                  <div className="glass-card p-5 rounded-sm border border-white/10 hover:border-cyan-500/30 transition-all duration-300 text-center group h-full">
                    {/* Step number */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-r from-cyan-400 to-green-400 flex items-center justify-center text-[#020617] font-bold text-sm shadow-neon">
                      {step.id}
                    </div>

                    {/* Icon */}
                    <div className="w-14 h-14 mx-auto mb-3 rounded-sm bg-gradient-to-br from-cyan-500/20 to-green-500/20 flex items-center justify-center group-hover:shadow-neon transition-all duration-300">
                      {isSparkles ? (
                        <SparklesIcon className="w-7 h-7 text-cyan-400" />
                      ) : (
                        <FontAwesomeIcon
                          icon={stepIcons[iconKey]}
                          className="w-7 h-7 text-cyan-400"
                        />
                      )}
                    </div>

                    {/* Content */}
                    <h3 className="text-white font-semibold mb-2 whitespace-pre-line">{step.title}</h3>
                    <p className="text-gray-400 text-sm">{step.description}</p>
                  </div>

                  {/* Arrow between steps (hidden on mobile) */}
                  {index < profileSteps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <svg
                          className="w-6 h-6 text-cyan-500/50"
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
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Demo preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-12"
        >
          <div className="glass-card p-6 rounded-sm border border-cyan-500/20">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-sm bg-gradient-to-br from-cyan-400 to-green-400 flex items-center justify-center text-2xl font-bold text-[#020617] flex-shrink-0">
                MK
              </div>

              {/* Profile info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold text-white">Maya Kim</h3>
                  <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                    Verified
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-3">
                  Graphic designer exploring AI creativity. Making art with Midjourney and music with Suno.
                </p>

                {/* Auto-detected stats */}
                <div className="flex flex-wrap gap-3">
                  <div className="px-3 py-1.5 rounded-sm bg-white/5 border border-white/10">
                    <span className="text-cyan-400 font-semibold">5</span>
                    <span className="text-gray-400 text-sm ml-1">Projects</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-sm bg-white/5 border border-white/10">
                    <span className="text-cyan-400 font-semibold">4</span>
                    <span className="text-gray-400 text-sm ml-1">AI Tools</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-sm bg-white/5 border border-white/10">
                    <span className="text-cyan-400 font-semibold">320</span>
                    <span className="text-gray-400 text-sm ml-1">XP</span>
                  </div>
                </div>

                {/* Auto-generated tags */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Midjourney', 'ChatGPT', 'Suno', 'Canva'].map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* AI badge */}
            <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-center gap-2 text-gray-500 text-sm">
              <SparklesIcon className="w-4 h-4 text-cyan-400" />
              Profile auto-generated via All Thrive Chat
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
