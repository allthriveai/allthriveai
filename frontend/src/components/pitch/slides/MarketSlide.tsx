import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';

const marketData = [
  {
    label: 'TAM',
    value: '$50B',
    description: 'Total Addressable Market',
    detail: 'Global creator economy + AI tools market',
    size: 'w-64 h-64 sm:w-80 sm:h-80',
    opacity: 'opacity-20',
  },
  {
    label: 'SAM',
    value: '$8B',
    description: 'Serviceable Addressable Market',
    detail: 'AI creators needing portfolio & learning tools',
    size: 'w-48 h-48 sm:w-56 sm:h-56',
    opacity: 'opacity-40',
  },
  {
    label: 'SOM',
    value: '$500M',
    description: 'Serviceable Obtainable Market',
    detail: 'Active AI builders seeking community',
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
            <GradientText>Market</GradientText> Opportunity
          </h2>
          <p className="text-xl text-gray-400">
            The AI creator economy is exploding
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
                className={`absolute rounded-full bg-gradient-to-br from-cyan-500 to-green-500 ${market.opacity} flex items-center justify-center ${market.size}`}
              >
                {index === marketData.length - 1 && (
                  <span className="text-white font-bold text-lg">{market.label}</span>
                )}
              </motion.div>
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
                  <div className="text-center min-w-[80px]">
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

        {/* Growth indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="text-center mt-10"
        >
          <p className="text-gray-500">
            AI tools market growing at <span className="text-green-400 font-bold">35% CAGR</span>
          </p>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
