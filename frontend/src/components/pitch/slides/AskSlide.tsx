import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import { EnvelopeIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

const useOfFunds = [
  { category: 'Engineering', percentage: 50, description: 'Product development & AI infrastructure' },
  { category: 'Growth', percentage: 30, description: 'Marketing, partnerships & community' },
  { category: 'Operations', percentage: 20, description: 'Team, legal & overhead' },
];

export function AskSlide() {
  return (
    <PitchSlide>
      <div className="w-full max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            The <GradientText>Ask</GradientText>
          </h2>
          <p className="text-xl text-gray-400">
            Join us in building the home for AI creators
          </p>
        </motion.div>

        {/* Funding amount */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mb-10"
        >
          <GlassCard className="inline-block px-12 py-8 border-cyan-500/30">
            <div className="text-sm text-gray-400 mb-2">Raising</div>
            <div className="text-5xl sm:text-6xl font-bold mb-2">
              <GradientText>$1.5M</GradientText>
            </div>
            <div className="text-gray-400">Seed Round</div>
          </GlassCard>
        </motion.div>

        {/* Use of funds */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-10"
        >
          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-6 text-center">Use of Funds</h3>
            <div className="space-y-4">
              {useOfFunds.map((item, index) => (
                <motion.div
                  key={item.category}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <span className="text-white font-medium">{item.category}</span>
                      <span className="text-gray-500 text-sm ml-2">- {item.description}</span>
                    </div>
                    <span className="text-cyan-400 font-bold">{item.percentage}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percentage}%` }}
                      transition={{ duration: 0.8, delay: 0.6 + index * 0.1 }}
                      className="h-full bg-gradient-to-r from-cyan-500 to-green-500 rounded-full"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* Contact */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
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
          </div>

          {/* Thank you */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="flex flex-col items-center"
          >
            <img
              src="/all-thrvie-logo.png"
              alt="All Thrive"
              className="h-12 w-auto mb-4 opacity-70"
            />
            <p className="text-2xl font-light text-white">
              Thank you
            </p>
            <p className="text-gray-500 mt-2 italic">
              Create with AI anywhere. Consolidate here. Thrive together.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
