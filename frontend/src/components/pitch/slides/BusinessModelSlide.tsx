import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import {
  CreditCardIcon,
  SparklesIcon,
  ShoppingBagIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';

const revenueStreams = [
  {
    icon: CreditCardIcon,
    name: 'Subscriptions',
    description: 'Free, $15/mo, $40/mo tiers',
    detail: 'AI chat limits, learning paths, analytics',
    example: '$15 - $40/user/month',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    icon: SparklesIcon,
    name: 'Token Packages',
    description: 'Pay-as-you-go AI credits',
    detail: 'Users buy extra tokens when they run out',
    example: 'One-time purchases, never expire',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: ShoppingBagIcon,
    name: 'Marketplace Fees',
    description: '8% on every sale',
    detail: 'Creators sell prompts, courses, templates',
    example: 'Creator keeps 92%',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: BuildingOffice2Icon,
    name: 'Partnerships',
    description: 'Analytics & sponsored placement',
    detail: 'AI tool vendors pay for user insights & promotion',
    example: 'Usage data, featured listings',
    color: 'from-orange-500 to-amber-500',
  },
];

export function BusinessModelSlide() {
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
            <GradientText>4 Revenue</GradientText> Streams
          </h2>
          <p className="text-xl text-gray-400">
            B2C + B2B model with multiple monetization paths
          </p>
        </motion.div>

        {/* Revenue Streams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {revenueStreams.map((stream, index) => (
            <motion.div
              key={stream.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
            >
              <GlassCard className="h-full" hover>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stream.color} flex items-center justify-center flex-shrink-0`}>
                    <stream.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {stream.name}
                    </h3>
                    <p className="text-cyan-400 text-sm font-medium mb-1">
                      {stream.description}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {stream.detail}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Simple summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-8 text-center"
        >
          <GlassCard className="inline-block px-8 py-4">
            <p className="text-white">
              <span className="text-gray-400">Land with</span>{' '}
              <span className="font-semibold">free tier</span>
              <span className="text-gray-400 mx-2">→</span>
              <span className="text-gray-400">expand via</span>{' '}
              <span className="font-semibold">subscriptions + marketplace</span>
              <span className="text-gray-400 mx-2">→</span>
              <span className="text-gray-400">monetize</span>{' '}
              <span className="font-semibold">B2B data</span>
            </p>
          </GlassCard>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
