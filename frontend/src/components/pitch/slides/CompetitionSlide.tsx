import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';

const competitors = [
  {
    name: 'Social Platforms (Twitter, Discord, Reddit)',
    portfolio: false,
    learning: false,
    battles: false,
    aiNative: false,
    vendorNeutral: true,
  },
  {
    name: 'LinkedIn',
    portfolio: true,
    learning: true,
    battles: false,
    aiNative: false,
    vendorNeutral: true,
  },
  {
    name: 'Behance/Dribbble',
    portfolio: true,
    learning: false,
    battles: false,
    aiNative: false,
    vendorNeutral: true,
  },
  {
    name: 'Coursera/Udemy',
    portfolio: false,
    learning: true,
    battles: false,
    aiNative: false,
    vendorNeutral: false,
  },
  {
    name: 'Midjourney',
    portfolio: true,
    learning: false,
    battles: false,
    aiNative: true,
    vendorNeutral: false,
  },
  {
    name: 'All Thrive',
    portfolio: true,
    learning: true,
    battles: true,
    aiNative: true,
    vendorNeutral: true,
    highlight: true,
  },
];

const features = ['AI Automated\nPortfolio', 'Learning', 'Gamified\nChallenges', 'AI-Native', 'Vendor Neutral\nCommunity'];


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
            The only vendor-neutral AI portfolio + gamified learning platform
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
                    <th key={feature} className="p-4 text-gray-400 font-medium text-center text-sm whitespace-pre-line">
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
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.08 }}
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
                    <td className="p-4 text-center">
                      {competitor.vendorNeutral ? (
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

      </div>
    </PitchSlide>
  );
}
