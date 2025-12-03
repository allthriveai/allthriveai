import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGraduationCap, faScroll, faTrophy, faBolt, faPlay, faClock, faCheck, faStar } from '@fortawesome/free-solid-svg-icons';

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
    description: 'Challenge other users to real-time prompt competitions',
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

// Visual preview for Side Quests - RPG-style quest intro
function QuestPreview() {
  return (
    <div className="h-full w-full bg-[#0a1628]/80 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-6 flex flex-col">
      {/* Quest scroll header */}
      <div className="flex items-center justify-center mb-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center border-2 border-purple-500/30">
          <FontAwesomeIcon icon={faScroll} className="w-7 h-7 text-purple-400" />
        </div>
      </div>

      {/* Greeting */}
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-1">
          Hello, Adventurer!
        </h3>
        <p className="text-gray-400 text-sm">A new quest awaits you...</p>
      </div>

      {/* Mission briefing */}
      <div className="flex-1 bg-purple-500/10 rounded-xl border border-purple-500/20 p-4 mb-4">
        <div className="text-xs text-purple-400 font-medium uppercase tracking-wide mb-2">Your Mission</div>
        <h4 className="text-white font-bold text-lg mb-2">Banana Time</h4>
        <p className="text-gray-300 text-sm leading-relaxed">
          Generate an image with Nano Banana! Unleash your creativity and bring your wildest ideas to life with AI.
        </p>
      </div>

      {/* Quest details */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-1.5">
          <FontAwesomeIcon icon={faStar} className="w-3 h-3" />
          Easy
        </span>
        <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
          Creative Maker
        </span>
      </div>

      {/* Reward & Accept */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faBolt} className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400 font-bold">+20 XP</span>
        </div>
        <button className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/30 transition-all">
          Accept Quest
        </button>
      </div>
    </div>
  );
}

// Visual preview for Prompt Battles - Duel style
function BattlePreview() {
  return (
    <div className="h-full w-full bg-[#0a1628]/80 backdrop-blur-sm rounded-2xl border border-amber-500/20 p-5 flex flex-col overflow-hidden">
      {/* Header with timer */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">Live Battle</div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <FontAwesomeIcon icon={faClock} className="w-3 h-3 text-red-400" />
          <span className="text-red-400 text-xs font-medium">2:34</span>
        </div>
      </div>

      {/* Battle topic */}
      <div className="text-center mb-4">
        <h3 className="text-white font-bold text-lg">Surreal Landscapes</h3>
        <p className="text-gray-500 text-xs">Who creates the best dreamscape?</p>
      </div>

      {/* Duel arena */}
      <div className="flex-1 flex items-center gap-3">
        {/* Player 1 */}
        <div className="flex-1 flex flex-col items-center">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/40 flex items-center justify-center mb-2 relative">
            <span className="text-2xl">🌌</span>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-[10px] font-bold text-white">47</div>
          </div>
          <span className="text-white text-sm font-medium">@dreamer</span>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-cyan-400 text-xs font-bold">127</span>
            <span className="text-gray-500 text-xs">votes</span>
          </div>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <span className="text-white font-black text-sm">VS</span>
          </div>
          <div className="w-px h-8 bg-gradient-to-b from-amber-500/50 to-transparent mt-2" />
        </div>

        {/* Player 2 */}
        <div className="flex-1 flex flex-col items-center">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/40 flex items-center justify-center mb-2 relative">
            <span className="text-2xl">🏔️</span>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[10px] font-bold text-white">52</div>
          </div>
          <span className="text-white text-sm font-medium">@visionary</span>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-purple-400 text-xs font-bold">119</span>
            <span className="text-gray-500 text-xs">votes</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-3">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faTrophy} className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400 font-bold text-sm">Win 250 XP</span>
        </div>
        <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:shadow-lg hover:shadow-amber-500/30 transition-all">
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
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Learn By{' '}
            <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              Doing
            </span>
          </h2>
          <p className="text-lg text-gray-400">
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
          <div
            className="space-y-4"
            role="tablist"
            aria-label="Learning modalities"
          >
            {learningTypes.map((type, index) => {
              const isActive = activeType === type.id;
              const colorClasses = {
                cyan: {
                  activeBg: 'bg-cyan-500/10',
                  activeBorder: 'border-cyan-500/50',
                  focusRing: 'focus:ring-cyan-400',
                  icon: 'text-cyan-400',
                  iconBg: 'from-cyan-500/30 to-green-500/30',
                },
                purple: {
                  activeBg: 'bg-purple-500/10',
                  activeBorder: 'border-purple-500/50',
                  focusRing: 'focus:ring-purple-400',
                  icon: 'text-purple-400',
                  iconBg: 'from-purple-500/30 to-pink-500/30',
                },
                amber: {
                  activeBg: 'bg-amber-500/10',
                  activeBorder: 'border-amber-500/50',
                  focusRing: 'focus:ring-amber-400',
                  icon: 'text-amber-400',
                  iconBg: 'from-amber-500/30 to-orange-500/30',
                },
              }[type.color];

              const handleKeyDown = (e: React.KeyboardEvent) => {
                const types = learningTypes.map(t => t.id);
                const currentIndex = types.indexOf(activeType);

                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  const nextIndex = (currentIndex + 1) % types.length;
                  setActiveType(types[nextIndex]);
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const prevIndex = (currentIndex - 1 + types.length) % types.length;
                  setActiveType(types[prevIndex]);
                }
              };

              return (
                <button
                  key={type.id}
                  id={`tab-${type.id}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${type.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveType(type.id)}
                  onKeyDown={handleKeyDown}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#020617] ${colorClasses.focusRing} ${
                    isActive
                      ? `${colorClasses.activeBg} ${colorClasses.activeBorder}`
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses.iconBg} flex items-center justify-center flex-shrink-0`} aria-hidden="true">
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
          <div
            className="min-h-[400px] lg:min-h-0"
            id={`tabpanel-${activeType}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeType}`}
            aria-live="polite"
          >
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
