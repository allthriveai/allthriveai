import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import { CheckIcon } from '@heroicons/react/24/solid';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    features: ['Basic portfolio', 'Community access', 'Weekly challenges', 'Limited quizzes'],
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$9',
    period: '/mo',
    features: ['Unlimited portfolio', 'All learning content', 'Priority battles', 'Analytics dashboard', 'Custom domain'],
    highlight: true,
  },
  {
    name: 'Team',
    price: '$29',
    period: '/mo',
    features: ['Everything in Pro', 'Team portfolios', 'Admin controls', 'API access', 'White-label option'],
    highlight: false,
  },
];

const revenueStreams = [
  { name: 'Subscriptions', percentage: 60, color: 'from-cyan-500 to-cyan-400' },
  { name: 'Marketplace', percentage: 25, color: 'from-green-500 to-green-400' },
  { name: 'Enterprise', percentage: 15, color: 'from-purple-500 to-purple-400' },
];

export function BusinessModelSlide() {
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
            <GradientText>Business</GradientText> Model
          </h2>
          <p className="text-xl text-gray-400">
            Freemium with multiple revenue streams
          </p>
        </motion.div>

        {/* Pricing tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
            >
              <GlassCard
                className={`h-full ${tier.highlight ? 'border-cyan-500/50 bg-cyan-500/5' : ''}`}
              >
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">
                      <GradientText>{tier.price}</GradientText>
                    </span>
                    {tier.period && <span className="text-gray-500">{tier.period}</span>}
                  </div>
                </div>
                <ul className="space-y-2">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-400">
                      <CheckIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Revenue mix */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-4 text-center">Revenue Mix (Target)</h3>
            <div className="space-y-3">
              {revenueStreams.map((stream, index) => (
                <motion.div
                  key={stream.name}
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.8, delay: 0.8 + index * 0.1 }}
                >
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">{stream.name}</span>
                    <span className="text-white font-medium">{stream.percentage}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stream.percentage}%` }}
                      transition={{ duration: 1, delay: 0.9 + index * 0.1 }}
                      className={`h-full bg-gradient-to-r ${stream.color} rounded-full`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
