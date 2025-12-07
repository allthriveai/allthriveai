import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import { FolderOpenIcon, AcademicCapIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const problems = [
  {
    icon: FolderOpenIcon,
    title: 'Scattered Creations',
    description: 'AI builders create across 50+ tools - Midjourney, Claude, Replit, ChatGPT - but have no unified way to showcase their work.',
  },
  {
    icon: AcademicCapIcon,
    title: 'Fragmented Learning',
    description: 'Learning AI is overwhelming. Tutorials are scattered, progress is hard to track, and there\'s no clear path from beginner to expert.',
  },
  {
    icon: UserGroupIcon,
    title: 'No Community',
    description: 'AI creators work in isolation. No place to compete, collaborate, or get feedback from peers who understand the craft.',
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
            AI creators are everywhere, but nowhere
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
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                    <problem.icon className="w-8 h-8 text-red-400" />
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

        {/* Bottom stat */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-12"
        >
          <p className="text-gray-500">
            <span className="text-2xl font-bold text-cyan-400">500M+</span>
            <span className="ml-2">people use AI tools monthly, but have no portfolio to show for it</span>
          </p>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
