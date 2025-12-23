import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import { FolderOpenIcon, AcademicCapIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const problems = [
  {
    icon: FolderOpenIcon,
    title: 'Scattered Creations',
    description: 'AI builders produce work across 50+ tools, making it hard to organize, track, or showcase anything in one place.',
  },
  {
    icon: AcademicCapIcon,
    title: 'Learning is Boring',
    description: 'ChatGPT teaches anything, but learners struggle to retain lessons without tracking, feedback, or community.',
  },
  {
    icon: UserGroupIcon,
    title: 'Walled Garden Communities',
    description: 'Every AI tool builds its own locked-in community. Members are siloed by platform instead of united by craft.',
  },
];

export function ProblemSlide() {
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
            The <GradientText>Problem</GradientText>
          </h2>
          <p className="text-xl text-gray-400">
            The AI curious are everywhere, but nowhere
          </p>
        </motion.div>

        {/* Problem cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((problem, index) => (
            <motion.div
              key={problem.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.15 }}
            >
              <GlassCard className="h-full" hover>
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-4">
                    <problem.icon className="w-8 h-8 text-orange-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {problem.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {problem.description}
                  </p>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-12"
        >
          <p className="text-2xl text-white font-light">
            <GradientText>Creating with AI?</GradientText> You belong here.
          </p>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
