import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGraduationCap, faScroll, faTrophy, faBolt, faPlay, faClock, faCheck } from '@fortawesome/free-solid-svg-icons';

type LearningType = 'courses' | 'quests' | 'battles';

const learningTypes = [
  {
    id: 'courses' as const,
    title: 'Interactive Courses',
    description: 'Structured lessons with hands-on exercises and real-world projects',
    icon: faGraduationCap,
    color: 'cyan',
  },
  {
    id: 'quests' as const,
    title: 'Side Quests',
    description: 'Creative challenges to practice skills and build your portfolio',
    icon: faScroll,
    color: 'purple',
  },
  {
    id: 'battles' as const,
    title: 'Prompt Battles',
    description: 'Compete in timed challenges and earn rankings',
    icon: faTrophy,
    color: 'amber',
  },
];

// Visual preview for Interactive Courses
function CoursePreview() {
  return (
    <div className="h-full w-full bg-[#0a1628]/80 backdrop-blur-sm rounded-2xl border border-cyan-500/20 p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/30 to-green-500/30 flex items-center justify-center">
          <FontAwesomeIcon icon={faGraduationCap} className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <div className="text-xs text-cyan-400 font-medium">COURSE</div>
          <h3 className="text-white font-bold">Prompt Engineering 101</h3>
        </div>
      </div>

      <div className="flex-1 space-y-3">
        {['Introduction to Prompts', 'Writing Clear Instructions', 'Advanced Techniques', 'Real-World Examples'].map((lesson, i) => (
          <div
            key={lesson}
            className={`flex items-center gap-3 p-3 rounded-xl ${
              i < 2 ? 'bg-green-500/10 border border-green-500/20' : 'bg-white/5 border border-white/10'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              i < 2 ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400'
            }`}>
              {i < 2 ? <FontAwesomeIcon icon={faCheck} className="w-3 h-3" /> : i + 1}
            </div>
            <span className={i < 2 ? 'text-green-400' : 'text-gray-400'}>{lesson}</span>
            {i < 2 && <span className="ml-auto text-green-400 text-xs">+25 XP</span>}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Progress</span>
          <span className="text-cyan-400 font-medium">50%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-400 to-green-400"
            initial={{ width: 0 }}
            animate={{ width: '50%' }}
            transition={{ duration: 1, delay: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}

// Visual preview for Side Quests
function QuestPreview() {
  return (
    <div className="h-full w-full bg-[#0a1628]/80 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
          <FontAwesomeIcon icon={faScroll} className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <div className="text-xs text-purple-400 font-medium">SIDE QUEST</div>
          <h3 className="text-white font-bold">Create AI Album Art</h3>
        </div>
      </div>

      <p className="text-gray-400 mb-4">
        Use any AI image generator to create album cover art for your favorite music. Share your creation with the community!
      </p>

      <div className="flex-1">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="aspect-square rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center">
            <span className="text-4xl">🎨</span>
          </div>
          <div className="aspect-square rounded-xl bg-gradient-to-br from-pink-500/20 to-orange-500/20 border border-pink-500/20 flex items-center justify-center">
            <span className="text-4xl">🎵</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs">Creative</span>
          <span className="px-3 py-1 rounded-full bg-pink-500/20 text-pink-400 text-xs">Beginner</span>
          <span className="px-3 py-1 rounded-full bg-white/10 text-gray-400 text-xs">~30 min</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <span className="flex items-center gap-2 text-purple-400 font-medium">
          <FontAwesomeIcon icon={faBolt} className="w-4 h-4" />
          +75 XP
        </span>
        <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium flex items-center gap-2">
          <FontAwesomeIcon icon={faPlay} className="w-3 h-3" />
          Start Quest
        </button>
      </div>
    </div>
  );
}

// Visual preview for Prompt Battles
function BattlePreview() {
  return (
    <div className="h-full w-full bg-[#0a1628]/80 backdrop-blur-sm rounded-2xl border border-amber-500/20 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
            <FontAwesomeIcon icon={faTrophy} className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="text-xs text-amber-400 font-medium">PROMPT BATTLE</div>
            <h3 className="text-white font-bold">Surreal Landscapes</h3>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30">
          <FontAwesomeIcon icon={faClock} className="w-3 h-3 text-red-400" />
          <span className="text-red-400 text-sm font-medium">2:34:15</span>
        </div>
      </div>

      <p className="text-gray-400 mb-4">
        Create the most dreamlike, surreal landscape using a single prompt. Community votes decide the winner!
      </p>

      <div className="flex-1">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
              <span className="text-amber-400/40 text-xl">🏔️</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">24 entries</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-400">156 votes</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faTrophy} className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400 font-medium">Win 250 XP</span>
        </div>
        <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium">
          Enter Battle
        </button>
      </div>
    </div>
  );
}

const previews: Record<LearningType, React.ReactNode> = {
  courses: <CoursePreview />,
  quests: <QuestPreview />,
  battles: <BattlePreview />,
};

export function SideQuestsPreview() {
  const [activeType, setActiveType] = useState<LearningType>('courses');

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#0a1628] to-[#020617]" />
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 50% 50% at 70% 30%, rgba(74, 222, 128, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse 40% 40% at 30% 70%, rgba(34, 211, 238, 0.08) 0%, transparent 50%)
          `,
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium mb-4">
            Gamified Learning
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Learn By{' '}
            <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              Doing
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Interactive courses, creative quests, and prompt battles that make learning feel like play.
          </p>
        </motion.div>

        {/* Tabs + Preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch"
        >
          {/* Left - Tabs */}
          <div className="space-y-4">
            {learningTypes.map((type) => {
              const isActive = activeType === type.id;
              const colorClasses = {
                cyan: {
                  activeBg: 'bg-cyan-500/10',
                  activeBorder: 'border-cyan-500/50',
                  icon: 'text-cyan-400',
                  iconBg: 'from-cyan-500/30 to-green-500/30',
                },
                purple: {
                  activeBg: 'bg-purple-500/10',
                  activeBorder: 'border-purple-500/50',
                  icon: 'text-purple-400',
                  iconBg: 'from-purple-500/30 to-pink-500/30',
                },
                amber: {
                  activeBg: 'bg-amber-500/10',
                  activeBorder: 'border-amber-500/50',
                  icon: 'text-amber-400',
                  iconBg: 'from-amber-500/30 to-orange-500/30',
                },
              }[type.color];

              return (
                <button
                  key={type.id}
                  onClick={() => setActiveType(type.id)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 ${
                    isActive
                      ? `${colorClasses.activeBg} ${colorClasses.activeBorder}`
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <FontAwesomeIcon icon={type.icon} className={`w-6 h-6 ${colorClasses.icon}`} />
                    </div>
                    <div>
                      <h3 className={`font-semibold mb-1 ${isActive ? 'text-white' : 'text-gray-300'}`}>
                        {type.title}
                      </h3>
                      <p className="text-gray-400 text-sm">{type.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right - Preview */}
          <div className="min-h-[400px] lg:min-h-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeType}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                {previews[activeType]}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
