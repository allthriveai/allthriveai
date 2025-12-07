import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';

const marketData = [
  {
    label: '500M+',
    value: 'Users',
    description: 'Looking to showcase & play',
    detail: 'Millions of users on scattered platforms',
    size: 'w-64 h-64 sm:w-80 sm:h-80',
    opacity: 'opacity-20',
  },
  {
    label: '50M+',
    value: 'Creators',
    description: 'Looking to sell',
    detail: 'Prompts, courses, templates',
    size: 'w-48 h-48 sm:w-56 sm:h-56',
    opacity: 'opacity-40',
  },
  {
    label: '200+',
    value: 'AI Companies',
    description: 'Hungry for user insights',
    detail: 'ChatGPT, Midjourney, Claude, Canva & more',
    size: 'w-32 h-32 sm:w-40 sm:h-40',
    opacity: 'opacity-70',
  },
];

export function MarketSlide() {
  return (
    <PitchSlide>
      <div className="w-full max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            The <GradientText>Opportunity</GradientText>
          </h2>
          <p className="text-xl text-gray-400">
            500M+ people using AI, looking to consolidate and learn
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Nested circles visualization */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative flex items-center justify-center"
            style={{ width: '320px', height: '320px' }}
          >
            {marketData.map((market, index) => (
              <motion.div
                key={market.label}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.4 + index * 0.2 }}
                className={`absolute rounded-full bg-gradient-to-br from-cyan-500 to-green-500 ${market.opacity} ${market.size}`}
              />
            ))}
          </motion.div>

          {/* Market details */}
          <div className="flex-1 space-y-4">
            {marketData.map((market, index) => (
              <motion.div
                key={market.label}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.15 }}
              >
                <GlassCard className="flex items-center gap-4">
                  <div className="text-center flex-shrink-0" style={{ width: '10rem' }}>
                    <div className="text-xs text-gray-500 mb-1">{market.label}</div>
                    <div className="text-2xl sm:text-3xl font-bold">
                      <GradientText>{market.value}</GradientText>
                    </div>
                  </div>
                  <div className="border-l border-white/10 pl-4">
                    <div className="text-white font-medium">{market.description}</div>
                    <div className="text-sm text-gray-500">{market.detail}</div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Comparable */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="text-center mt-10"
        >
          <p className="text-gray-500">
            Behance proved designers need portfolios <span className="text-cyan-400 font-medium">(acquired for $150M)</span>
            <br />
            <span className="text-white">We're building the same for AI creators</span>
          </p>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
