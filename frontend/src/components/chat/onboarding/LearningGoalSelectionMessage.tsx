/**
 * LearningGoalSelectionMessage - Learning goal selection for Ember chat
 *
 * Shows learning goal options as interactive buttons in chat.
 * Uses orange Ember theme with larger fonts.
 */

import { useState } from 'react';
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

// Ember avatar component - positioned at bottom
function EmberAvatar() {
  return (
    <div className="relative flex-shrink-0 self-start">
      <img
        src="/ember-avatar.png"
        alt="Ember"
        className="w-12 h-12 rounded-full object-cover"
      />
    </div>
  );
}

interface LearningGoalSelectionMessageProps {
  onSelectGoal: (goal: LearningGoal) => void;
  onSkip: () => void;
  isPending?: boolean;
}

export function LearningGoalSelectionMessage({
  onSelectGoal,
  onSkip,
  isPending = false,
}: LearningGoalSelectionMessageProps) {
  const [selectedGoal, setSelectedGoal] = useState<LearningGoal | null>(null);

  const handleSelectGoal = (goal: LearningGoalOption) => {
    setSelectedGoal(goal.id);
    onSelectGoal(goal.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-4"
    >
      {/* Layout with Ember avatar alongside */}
      <div className="flex items-start gap-4">
        <EmberAvatar />

        <div className="flex-1 max-w-2xl space-y-4">
          {/* Header messages */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-subtle px-5 py-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20"
          >
            <p className="text-orange-100 text-lg leading-relaxed">
              Hey there! I'm Ember, your AI learning companion.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-subtle px-5 py-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20"
          >
            <p className="text-orange-100 text-lg leading-relaxed">
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
                  glass-subtle hover:bg-white/[0.08] border border-orange-500/20 hover:border-orange-500/40
                  group overflow-hidden
                  ${selectedGoal === goal.id ? 'ring-2 ring-orange-500 bg-orange-500/10' : ''}
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
                    <h3 className="font-semibold text-lg text-orange-100 group-hover:text-orange-50 transition-colors">
                      {goal.title}
                    </h3>
                    <p className="text-base text-orange-200/70 group-hover:text-orange-200/90 transition-colors">
                      {goal.description}
                    </p>
                  </div>

                  <div className="text-orange-400/50 group-hover:text-orange-400 transition-colors">
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
              className="text-orange-200/50 hover:text-orange-200/80 text-sm transition-colors disabled:cursor-wait"
            >
              Skip for now - I'll figure it out as I go
            </button>
          </motion.div>

          {/* Loading indicator */}
          {isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <div className="inline-flex items-center gap-2 text-orange-400">
                <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                <span>Creating your personalized path...</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default LearningGoalSelectionMessage;
