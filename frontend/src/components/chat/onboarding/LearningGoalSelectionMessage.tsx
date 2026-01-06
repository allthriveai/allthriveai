/**
 * LearningGoalSelectionMessage - Learning goal selection for chat companions
 *
 * Shows learning goal options as interactive buttons in chat.
 * Supports different companions (Sage for Learn, Ava for general).
 */

import { useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRocket,
  faLightbulb,
  faLifeRing,
  faCompass,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import type { LearningGoal } from '@/types/models';
import { ChatErrorBoundary } from '../ChatErrorBoundary';

// Companion configurations
export interface CompanionConfig {
  name: string;
  avatar: string;
  greeting: string;
  theme: {
    gradient: string;
    border: string;
    text: string;
    textMuted: string;
    button: string;
    buttonHover: string;
    buttonSelected: string;
    skipText: string;
    loadingText: string;
  };
}

export const SAGE_COMPANION: CompanionConfig = {
  name: 'Sage',
  avatar: '/sage-avatar.png',
  greeting: "Hey there! I'm Sage, your AI learning companion.",
  theme: {
    gradient: 'from-emerald-500/10 to-teal-500/5',
    border: 'border-emerald-500/20',
    text: 'text-emerald-100',
    textMuted: 'text-emerald-200/70',
    button: 'border-emerald-500/20 hover:border-emerald-500/40',
    buttonHover: 'group-hover:text-emerald-200/90',
    buttonSelected: 'ring-emerald-500 bg-emerald-500/10',
    skipText: 'text-emerald-200/50 hover:text-emerald-200/80',
    loadingText: 'text-emerald-400',
  },
};

export const AVA_COMPANION: CompanionConfig = {
  name: 'Ava',
  avatar: '/ava-avatar.png',
  greeting: "Hey there! I'm Ava, your AI learning companion.",
  theme: {
    gradient: 'from-orange-500/10 to-amber-500/5',
    border: 'border-orange-500/20',
    text: 'text-orange-100',
    textMuted: 'text-orange-200/70',
    button: 'border-orange-500/20 hover:border-orange-500/40',
    buttonHover: 'group-hover:text-orange-200/90',
    buttonSelected: 'ring-orange-500 bg-orange-500/10',
    skipText: 'text-orange-200/50 hover:text-orange-200/80',
    loadingText: 'text-orange-400',
  },
};

// Lazy load game component to avoid blocking initial render
const ChatGameCard = lazy(() => import('../games/ChatGameCard').then(m => ({ default: m.ChatGameCard })));

interface LearningGoalOption {
  id: LearningGoal;
  title: string;
  description: string;
  icon: typeof faRocket;
  gradient: string;
}

export const learningGoalOptions: LearningGoalOption[] = [
  {
    id: 'build_projects',
    title: 'Build AI Projects',
    description: 'Get hands-on with tools like LangChain and build real applications.',
    icon: faRocket,
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'understand_concepts',
    title: 'Understand AI Concepts',
    description: 'Learn the fundamentals of AI models, prompting, and workflows.',
    icon: faLightbulb,
    gradient: 'from-cyan-500 to-teal-500',
  },
  {
    id: 'career',
    title: 'Get Unstuck',
    description: "I'm building something with AI and need help troubleshooting.",
    icon: faLifeRing,
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    id: 'exploring',
    title: 'Just Exploring',
    description: "I'm curious about AI and want to look around.",
    icon: faCompass,
    gradient: 'from-amber-500 to-orange-500',
  },
];

// Companion avatar component - positioned at bottom
function CompanionAvatar({ companion }: { companion: CompanionConfig }) {
  const borderColor = companion.name === 'Sage' ? 'border-emerald-500/50' : 'border-cyan-500/50';
  return (
    <div className="relative flex-shrink-0 self-start">
      <img
        src={companion.avatar}
        alt={companion.name}
        className={`w-12 h-12 rounded-full border-2 ${borderColor}`}
      />
    </div>
  );
}

interface LearningGoalSelectionMessageProps {
  onSelectGoal: (goal: LearningGoal) => void;
  onSkip: () => void;
  isPending?: boolean;
  /** Which companion to show. Defaults to Sage for learning context. */
  companion?: CompanionConfig;
}

export function LearningGoalSelectionMessage({
  onSelectGoal,
  onSkip,
  isPending = false,
  companion = SAGE_COMPANION,
}: LearningGoalSelectionMessageProps) {
  const [selectedGoal, setSelectedGoal] = useState<LearningGoal | null>(null);
  const theme = companion.theme;

  const handleSelectGoal = (goal: LearningGoalOption) => {
    setSelectedGoal(goal.id);
    onSelectGoal(goal.id);
  };

  // Dynamic loading indicator background based on theme
  const loadingBgClass = companion.name === 'Sage' ? 'bg-emerald-800/20' : 'bg-orange-800/20';
  const loadingSpinnerBorderClass = companion.name === 'Sage'
    ? 'border-emerald-400 border-t-transparent'
    : 'border-orange-400 border-t-transparent';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-4"
    >
      {/* Layout with companion avatar alongside */}
      <div className="flex items-start gap-4">
        <CompanionAvatar companion={companion} />

        <div className="flex-1 max-w-2xl space-y-4">
          {/* Header messages */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`glass-subtle px-5 py-4 rounded-xl bg-gradient-to-br ${theme.gradient} border ${theme.border}`}
          >
            <p className={`${theme.text} text-lg leading-relaxed`}>
              {companion.greeting}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className={`glass-subtle px-5 py-4 rounded-xl bg-gradient-to-br ${theme.gradient} border ${theme.border}`}
          >
            <p className={`${theme.text} text-lg leading-relaxed`}>
              What brings you here today? This helps me personalize your learning path.
            </p>
          </motion.div>

          {/* Goal options */}
          <div className="grid gap-3">
            {learningGoalOptions.map((goal, index) => (
              <motion.button
                key={goal.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.01, x: 4 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleSelectGoal(goal)}
                disabled={selectedGoal !== null || isPending}
                className={`
                  relative w-full p-4 rounded-xl text-left transition-all
                  glass-subtle hover:bg-white/[0.08] border ${theme.button}
                  group overflow-hidden
                  ${selectedGoal === goal.id ? `ring-2 ${theme.buttonSelected}` : ''}
                  ${selectedGoal !== null && selectedGoal !== goal.id ? 'opacity-40' : ''}
                  ${isPending ? 'cursor-wait' : ''}
                `}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-r ${goal.gradient} opacity-0 group-hover:opacity-5 transition-opacity`}
                />

                <div className="relative flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${goal.gradient} flex items-center justify-center shadow-lg group-hover:shadow-neon transition-shadow`}
                  >
                    <FontAwesomeIcon icon={goal.icon} className="text-lg text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-lg ${theme.text} group-hover:text-white/90 transition-colors`}>
                      {goal.title}
                    </h3>
                    <p className={`text-base ${theme.textMuted} ${theme.buttonHover} transition-colors`}>
                      {goal.description}
                    </p>
                  </div>

                  <div className={`${theme.textMuted} group-hover:text-white/80 transition-colors`}>
                    <FontAwesomeIcon icon={faArrowRight} className="w-5 h-5" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Skip button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center"
          >
            <button
              onClick={onSkip}
              disabled={selectedGoal !== null || isPending}
              className={`${theme.skipText} text-sm transition-colors disabled:cursor-wait`}
            >
              Skip for now - I'll figure it out as I go
            </button>
          </motion.div>

          {/* Loading indicator with mini game */}
          {isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Loading text */}
              <div className="text-center">
                <div className={`inline-flex items-center gap-2 ${theme.loadingText}`}>
                  <div className={`w-4 h-4 border-2 ${loadingSpinnerBorderClass} rounded-full animate-spin`} />
                  <span>Building your personalized learning path — this can take a few minutes. Play a quick game while you wait!</span>
                </div>
              </div>

              {/* Mini game while waiting */}
              <ChatErrorBoundary inline resetKey="learning-setup-game">
                <Suspense fallback={<div className={`h-32 animate-pulse ${loadingBgClass} rounded-xl`} />}>
                  <ChatGameCard gameType="snake" config={{ difficulty: 'easy' }} />
                </Suspense>
              </ChatErrorBoundary>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default LearningGoalSelectionMessage;
