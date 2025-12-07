import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';

const competitors = [
  {
    name: 'Behance/Dribbble',
    portfolio: true,
    learning: false,
    battles: false,
    aiNative: false,
  },
  {
    name: 'Coursera/Udemy',
    portfolio: false,
    learning: true,
    battles: false,
    aiNative: false,
  },
  {
    name: 'Product Hunt',
    portfolio: false,
    learning: false,
    battles: false,
    aiNative: false,
  },
  {
    name: 'All Thrive',
    portfolio: true,
    learning: true,
    battles: true,
    aiNative: true,
    highlight: true,
  },
];

const features = ['Portfolio', 'Learning', 'Battles', 'AI-Native'];

const differentiators = [
  'Built specifically for AI creators, not retrofitted',
  'Automated capture from 50+ AI tools',
  'Gamified learning with real community engagement',
  'Unique Prompt Battles for competitive creators',
];

export function CompetitionSlide() {
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
            <GradientText>Competitive</GradientText> Landscape
          </h2>
          <p className="text-xl text-gray-400">
            The only platform built for AI creators
          </p>
        </motion.div>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-10"
        >
          <GlassCard className="overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-gray-400 font-medium"></th>
                  {features.map((feature) => (
                    <th key={feature} className="p-4 text-gray-400 font-medium text-center text-sm">
                      {feature}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {competitors.map((competitor, index) => (
                  <motion.tr
                    key={competitor.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                    className={`border-b border-white/5 ${
                      competitor.highlight ? 'bg-cyan-500/10' : ''
                    }`}
                  >
                    <td className={`p-4 font-medium ${competitor.highlight ? 'text-cyan-400' : 'text-white'}`}>
                      {competitor.name}
                    </td>
                    <td className="p-4 text-center">
                      {competitor.portfolio ? (
                        <CheckIcon className="w-5 h-5 text-green-400 mx-auto" />
                      ) : (
                        <XMarkIcon className="w-5 h-5 text-red-400/50 mx-auto" />
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {competitor.learning ? (
                        <CheckIcon className="w-5 h-5 text-green-400 mx-auto" />
                      ) : (
                        <XMarkIcon className="w-5 h-5 text-red-400/50 mx-auto" />
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {competitor.battles ? (
                        <CheckIcon className="w-5 h-5 text-green-400 mx-auto" />
                      ) : (
                        <XMarkIcon className="w-5 h-5 text-red-400/50 mx-auto" />
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {competitor.aiNative ? (
                        <CheckIcon className="w-5 h-5 text-green-400 mx-auto" />
                      ) : (
                        <XMarkIcon className="w-5 h-5 text-red-400/50 mx-auto" />
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </motion.div>

        {/* Why we win */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-4 text-center">Why We Win</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {differentiators.map((diff, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.8 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <CheckIcon className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{diff}</span>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
