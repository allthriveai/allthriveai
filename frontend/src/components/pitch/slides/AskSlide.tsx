import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import { UserGroupIcon, AcademicCapIcon, SparklesIcon } from '@heroicons/react/24/outline';

const memberTypes = [
  {
    icon: UserGroupIcon,
    title: 'Community Pillars',
    description: 'Shape the culture and values of our growing AI creator community',
  },
  {
    icon: AcademicCapIcon,
    title: 'Mentors',
    description: 'Guide the next generation of AI creators through challenges and growth',
  },
  {
    icon: SparklesIcon,
    title: 'Early Creators',
    description: 'Be among the first to build your portfolio and establish your reputation',
  },
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
            Join as a <GradientText>Founding Member</GradientText>
          </h2>
          <p className="text-xl text-gray-400">
            We're looking for passionate AI creators to help build something special
          </p>
        </motion.div>

        {/* Member types */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10"
        >
          {memberTypes.map((type, index) => (
            <motion.div
              key={type.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
            >
              <GlassCard className="h-full text-center p-6">
                <type.icon className="w-12 h-12 mx-auto mb-4 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white mb-2">{type.title}</h3>
                <p className="text-gray-400 text-sm">{type.description}</p>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Call to action */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <GlassCard className="inline-block px-12 py-8 border-cyan-500/30">
            <p className="text-lg text-gray-300 mb-4">
              Be a founding voice. Help us shape the future of AI creativity.
            </p>
            <div className="text-2xl font-bold">
              <GradientText>Are you ready to thrive?</GradientText>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
