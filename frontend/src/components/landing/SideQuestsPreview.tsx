import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGraduationCap, faScroll, faTrophy, faBolt, faPlay, faClock, faCheck, faStar } from '@fortawesome/free-solid-svg-icons';

type LearningType = 'courses' | 'quests' | 'battles';

const learningTypes = [
  {
    id: 'courses' as const,
    title: 'Interactive Courses',
    description: 'Structured lessons with hands-on exercises and real-world projects',
    icon: faGraduationCap,
    color: 'amber',
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
    color: 'cyan',
  },
];

// Visual preview for Interactive Courses
function CoursePreview() {
  return (
    <div className="h-full w-full bg-[#0a1628]/80 backdrop-blur-sm rounded-sm border border-amber-500/20 p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-sm bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
          <FontAwesomeIcon icon={faGraduationCap} className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <div className="text-xs text-amber-400 font-medium">COURSE</div>
          <h3 className="text-white font-bold">Prompt Engineering 101</h3>
        </div>
      </div>

      <div className="flex-1 space-y-3">
        {['Introduction to Prompts', 'Writing Clear Instructions', 'Advanced Techniques', 'Real-World Examples'].map((lesson, i) => (
          <div
            key={lesson}
            className={`flex items-center gap-3 p-3 rounded-sm ${
              i < 2 ? 'bg-green-500/10 border border-green-500/20' : 'bg-white/5 border border-white/10'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              i < 2 ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400'
            }`}>
              {i < 2 ? <FontAwesomeIcon icon={faCheck} className="w-3 h-3" /> : i + 1}
            </div>
            <span className={i < 2 ? 'text-green-400' : 'text-gray-400'}>{lesson}</span>
            {i < 2 && <span className="ml-auto text-green-400 text-xs">+25 Points</span>}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Progress</span>
          <span className="text-amber-400 font-medium">50%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-400"
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
    <div className="h-full w-full bg-[#0a1628]/80 backdrop-blur-sm rounded-sm border border-purple-500/20 p-6 flex flex-col">
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
      <div className="flex-1 bg-purple-500/10 rounded-sm border border-purple-500/20 p-4 mb-4">
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
          <span className="text-amber-400 font-bold">+20 Points</span>
        </div>
        <button className="px-5 py-2.5 rounded-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/30 transition-all">
          Accept Quest
        </button>
      </div>
    </div>
  );
}

// Visual preview for Prompt Battles - Neon blue with glowing VS
function BattlePreview() {
  return (
    <div className="relative h-full w-full bg-[#0a1628]/90 backdrop-blur-sm rounded-sm border border-cyan-500/30 p-6 flex flex-col overflow-hidden">
      {/* Background glows */}
      <div className="absolute -left-8 top-1/4 w-32 h-32 rounded-full opacity-20 blur-2xl bg-cyan-400" />
      <div className="absolute -right-8 bottom-1/4 w-32 h-32 rounded-full opacity-15 blur-2xl bg-pink-400" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/30">
          <FontAwesomeIcon icon={faBolt} className="w-3 h-3 text-rose-400" />
          <span className="text-xs font-semibold text-rose-300 uppercase tracking-wide">Live Battle</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30">
          <FontAwesomeIcon icon={faClock} className="w-3 h-3 text-red-400" />
          <span className="text-red-400 text-xs font-bold">2:34</span>
        </div>
      </div>

      {/* VS Layout */}
      <div className="relative z-10 flex items-center justify-center gap-6 mb-6">
        {/* Player 1 */}
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg mb-2 shadow-lg shadow-cyan-500/30">
            AD
          </div>
          <span className="text-white font-semibold text-sm">@aidesigner</span>
          <span className="text-cyan-400 text-xs mt-1">Typing...</span>
        </div>

        {/* VS Badge - Neon glow */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-500/50 flex items-center justify-center relative shadow-[0_0_30px_rgba(34,211,238,0.5)]">
            {/* Animated ring */}
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400/30 animate-ping" />
            <span className="text-xl font-black bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
              VS
            </span>
          </div>
        </div>

        {/* Player 2 */}
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg mb-2 shadow-lg shadow-pink-500/30">
            PP
          </div>
          <span className="text-white font-semibold text-sm">@promptpro</span>
          <span className="text-purple-400 text-xs mt-1">Ready</span>
        </div>
      </div>

      {/* Challenge Display */}
      <div className="relative z-10 bg-white/5 border border-cyan-500/20 rounded-lg p-4 mb-4">
        <div className="text-xs text-cyan-400 font-medium uppercase tracking-wide mb-2">Challenge</div>
        <p className="text-white text-sm font-medium leading-relaxed">
          Create a prompt for a surreal dreamscape with floating islands and bioluminescent flora
        </p>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between pt-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faTrophy} className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-400 font-bold text-sm">+200 Points</span>
        </div>
        <button className="px-4 py-2 rounded-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold hover:shadow-lg hover:shadow-cyan-500/50 transition-all flex items-center gap-2">
          <FontAwesomeIcon icon={faPlay} className="w-3 h-3" />
          Join Battle
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
  const [activeType, setActiveType] = useState<LearningType>('battles');
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-rotate through learning types
  useEffect(() => {
    if (isPaused) return;

    const types: LearningType[] = ['battles', 'courses', 'quests'];

    intervalRef.current = setInterval(() => {
      setActiveType((current) => {
        const currentIndex = types.indexOf(current);
        const nextIndex = (currentIndex + 1) % types.length;
        return types[nextIndex];
      });
    }, 5000); // Rotate every 5 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused]);

  // Pause auto-rotation when user manually selects a tab
  const handleTabClick = (type: LearningType) => {
    setActiveType(type);
    setIsPaused(true);
    // Resume auto-rotation after 10 seconds of inactivity
    setTimeout(() => setIsPaused(false), 10000);
  };

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
                  onClick={() => handleTabClick(type.id)}
                  onKeyDown={handleKeyDown}
                  className={`w-full text-left p-5 rounded-sm border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#020617] ${colorClasses.focusRing} ${
                    isActive
                      ? `${colorClasses.activeBg} ${colorClasses.activeBorder}`
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-sm bg-gradient-to-br ${colorClasses.iconBg} flex items-center justify-center flex-shrink-0`} aria-hidden="true">
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
            className="h-[420px]"
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
