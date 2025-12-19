/**
 * ColdStartOnboarding - Learning path cold start onboarding
 *
 * Displays Ember greeting with a single question about learning goals.
 * Uses orange Ember theme with typewriter effect.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDragon,
  faRocket,
  faLightbulb,
  faBriefcase,
  faCompass,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { useCompleteLearningSetup } from '@/hooks/useLearningPaths';
import type { LearningGoal } from '@/types/models';

interface LearningGoalOption {
  id: LearningGoal;
  title: string;
  description: string;
  icon: typeof faRocket;
  gradient: string;
}

const learningGoalOptions: LearningGoalOption[] = [
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
    title: 'Career Exploration',
    description: 'Discover how AI can boost your productivity and career.',
    icon: faBriefcase,
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    id: 'exploring',
    title: 'Just Exploring',
    description: "I'm curious about AI and want to look around.",
    icon: faCompass,
    gradient: 'from-amber-500 to-orange-500',
  },
];

// Ember avatar component
function EmberAvatar() {
  return (
    <div className="relative flex-shrink-0 self-start">
      <div className="absolute inset-[-4px] bg-black/60 rounded-full blur-md" />
      <div className="absolute inset-[-2px] bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-full" />
      <div className="relative w-14 h-14 flex items-center justify-center bg-slate-900/80 rounded-full border border-orange-500/30">
        <FontAwesomeIcon
          icon={faDragon}
          className="text-2xl text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.6)]"
        />
      </div>
    </div>
  );
}

interface ColdStartOnboardingProps {
  onComplete: () => void;
}

export function ColdStartOnboarding({ onComplete }: ColdStartOnboardingProps) {
  const [selectedGoal, setSelectedGoal] = useState<LearningGoal | null>(null);
  const { mutate: completeSetup, isPending } = useCompleteLearningSetup();

  const handleSelectGoal = (goal: LearningGoalOption) => {
    setSelectedGoal(goal.id);
    completeSetup(goal.id, {
      onSuccess: () => {
        // Wait a moment for visual feedback then complete
        setTimeout(() => {
          onComplete();
        }, 500);
      },
    });
  };

  const handleSkip = () => {
    setSelectedGoal('exploring');
    completeSetup('exploring', {
      onSuccess: () => {
        onComplete();
      },
    });
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {/* Ember greeting section */}
        <div className="flex gap-4 mb-8">
          <EmberAvatar />

          <div className="flex-1 space-y-4">
            {/* Greeting message with typewriter-like stagger */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-subtle px-5 py-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20"
            >
              <p className="text-orange-100 text-lg leading-relaxed">
                Hey there! I'm Ember, your AI learning companion.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-subtle px-5 py-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20"
            >
              <p className="text-orange-100 text-lg leading-relaxed">
                What brings you here today? This helps me personalize your learning path.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Goal selection cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="space-y-3"
        >
          {learningGoalOptions.map((goal, index) => (
            <motion.button
              key={goal.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 + index * 0.1 }}
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
        </motion.div>

        {/* Skip button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="mt-6 text-center"
        >
          <button
            onClick={handleSkip}
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
            className="mt-6 text-center"
          >
            <div className="inline-flex items-center gap-2 text-orange-400">
              <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              <span>Creating your personalized path...</span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default ColdStartOnboarding;
