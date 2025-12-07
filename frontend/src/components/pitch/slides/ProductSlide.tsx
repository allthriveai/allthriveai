import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import {
  DocumentDuplicateIcon,
  PuzzlePieceIcon,
  BoltIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';

const features = [
  {
    icon: DocumentDuplicateIcon,
    title: 'Portfolio Builder',
    description: 'Drag-and-drop portfolio from 50+ AI tools',
  },
  {
    icon: PuzzlePieceIcon,
    title: 'Chrome Extension',
    description: 'One-click capture while you create',
  },
  {
    icon: BoltIcon,
    title: 'Prompt Battles',
    description: 'Real-time competitive challenges',
  },
  {
    icon: ChartBarIcon,
    title: 'Progress Tracking',
    description: 'XP, levels, and achievement badges',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Privacy Controls',
    description: 'Public/private visibility settings',
  },
  {
    icon: GlobeAltIcon,
    title: 'Tool Directory',
    description: '200+ curated AI tools with examples',
  },
];

export function ProductSlide() {
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
            The <GradientText>Product</GradientText>
          </h2>
          <p className="text-xl text-gray-400">
            Everything AI creators need in one place
          </p>
        </motion.div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15 + index * 0.08 }}
            >
              <GlassCard className="h-full py-5" hover>
                <div className="flex flex-col items-center text-center">
                  <feature.icon className="w-8 h-8 text-cyan-400 mb-3" />
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {feature.description}
                  </p>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Demo screenshot placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <GlassCard className="p-4 border-cyan-500/30">
            <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <img
                  src="/all-thrvie-logo.png"
                  alt="All Thrive"
                  className="h-12 w-auto mx-auto mb-3 opacity-50"
                />
                <p className="text-gray-500 text-sm">Live Demo</p>
                <p className="text-cyan-400 text-xs mt-1">allthrive.ai</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
