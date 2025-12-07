import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import { SparklesIcon, TrophyIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';

const solutions = [
  {
    icon: SparklesIcon,
    title: 'Automated Portfolio',
    description: 'One-click capture from any AI tool. Paste a URL, use our Chrome extension, or connect integrations to auto-sync your work.',
    color: 'cyan',
  },
  {
    icon: RocketLaunchIcon,
    title: 'Gamified Learning',
    description: 'Interactive courses, quizzes, and challenges. Earn XP, unlock achievements, and level up through Thrive Circles.',
    color: 'green',
  },
  {
    icon: TrophyIcon,
    title: 'Prompt Battles',
    description: 'Real-time competitive challenges against other creators. Face off in timed prompt battles across categories.',
    color: 'purple',
  },
];

const colorMap = {
  cyan: 'bg-cyan-500/20 text-cyan-400',
  green: 'bg-green-500/20 text-green-400',
  purple: 'bg-purple-500/20 text-purple-400',
};

export function SolutionSlide() {
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
            The <GradientText>Solution</GradientText>
          </h2>
          <p className="text-xl text-gray-400">
            One platform to showcase, learn, and compete
          </p>
        </motion.div>

        {/* Solution cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {solutions.map((solution, index) => (
            <motion.div
              key={solution.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.15 }}
            >
              <GlassCard className="h-full" hover>
                <div className="flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-full ${colorMap[solution.color as keyof typeof colorMap].split(' ')[0]} flex items-center justify-center mb-4`}>
                    <solution.icon className={`w-8 h-8 ${colorMap[solution.color as keyof typeof colorMap].split(' ')[1]}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {solution.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {solution.description}
                  </p>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Value prop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-12"
        >
          <p className="text-2xl text-white font-light">
            Create with AI anywhere. <GradientText>Consolidate here.</GradientText> Thrive together.
          </p>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
