import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';

const useOfFunds = [
  { category: 'Community Outreach & Growth', percentage: 80, description: 'Building the AI creator community' },
  { category: 'Operations', percentage: 20, description: 'Overhead & legal' },
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
              <GradientText>$750K</GradientText>
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

      </div>
    </PitchSlide>
  );
}
