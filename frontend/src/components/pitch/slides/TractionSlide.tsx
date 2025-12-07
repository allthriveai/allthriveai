import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline';

const metrics = [
  { label: 'Beta Users', value: '500+', growth: '+40%', period: 'MoM' },
  { label: 'Projects Created', value: '2,000+', growth: '+65%', period: 'MoM' },
  { label: 'Battles Played', value: '1,200+', growth: '+80%', period: 'MoM' },
  { label: 'Avg Session Time', value: '12 min', growth: '+25%', period: 'MoM' },
];

const milestones = [
  { date: 'Q3 2024', event: 'MVP Launch', completed: true },
  { date: 'Q4 2024', event: 'Chrome Extension', completed: true },
  { date: 'Q1 2025', event: 'Prompt Battles', completed: true },
  { date: 'Q2 2025', event: 'Marketplace', completed: false },
  { date: 'Q3 2025', event: 'Mobile App', completed: false },
];

export function TractionSlide() {
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
            <GradientText>Traction</GradientText> & Milestones
          </h2>
          <p className="text-xl text-gray-400">
            Growing fast with strong engagement
          </p>
        </motion.div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
            >
              <GlassCard className="text-center" hover>
                <div className="text-3xl sm:text-4xl font-bold mb-2">
                  <GradientText>{metric.value}</GradientText>
                </div>
                <div className="text-sm text-gray-400 mb-2">{metric.label}</div>
                <div className="flex items-center justify-center gap-1 text-green-400 text-sm">
                  <ArrowTrendingUpIcon className="w-4 h-4" />
                  <span>{metric.growth}</span>
                  <span className="text-gray-500">{metric.period}</span>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-6 text-center">Product Roadmap</h3>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/10" />

              {/* Milestones */}
              <div className="relative flex justify-between">
                {milestones.map((milestone, index) => (
                  <motion.div
                    key={milestone.event}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.8 + index * 0.1 }}
                    className="flex flex-col items-center"
                  >
                    <div
                      className={`w-4 h-4 rounded-full mb-3 ${
                        milestone.completed
                          ? 'bg-gradient-to-r from-cyan-400 to-green-400'
                          : 'bg-white/20 border-2 border-white/30'
                      }`}
                    />
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">{milestone.date}</div>
                      <div className={`text-xs font-medium ${milestone.completed ? 'text-white' : 'text-gray-400'}`}>
                        {milestone.event}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Key highlight */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="text-center mt-8"
        >
          <p className="text-gray-500">
            <span className="text-cyan-400 font-bold">70%</span> of beta users return weekly
          </p>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
