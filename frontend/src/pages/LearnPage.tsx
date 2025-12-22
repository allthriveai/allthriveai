import { useEffect, useRef, useCallback, useState } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PathLibraryGrid } from '@/components/learning';
import { InlineChatLayout } from '@/components/chat/layouts';
import {
  useStructuredPath,
  useCompleteLearningSetup,
  useSavedPaths,
} from '@/hooks/useLearningPaths';
import { useStableConversationId } from '@/hooks/useStableConversationId';
import { useQuestTracking } from '@/hooks/useQuestTracking';
import { useAuth } from '@/hooks/useAuth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGraduationCap, faArrowRight, faDragon } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import type { LearningGoal } from '@/types/models';

/**
 * Guest view for unauthenticated users
 */
function GuestLearnPage() {
  return (
    <div className="h-full overflow-y-auto">
      {/* Hero Banner */}
      <header className="relative h-64 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
        <div className="absolute top-1/2 left-1/4 -translate-x-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-cyan-500/20 dark:bg-cyan-500/20 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] rounded-full bg-purple-500/10 dark:bg-purple-500/10 blur-[100px] pointer-events-none" />

        <div className="relative px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-purple-500 dark:from-cyan-400 dark:via-cyan-300 dark:to-purple-400 bg-clip-text text-transparent">
              Learn AI
            </span>
          </h1>
          <p className="text-xl text-gray-700 dark:text-gray-300 max-w-2xl">
            Expand your AI knowledge with personalized learning paths, interactive quizzes, and expert guidance
          </p>
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-12">
        {/* Sign Up CTA */}
        <div className="glass-strong p-8 text-center mb-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            <FontAwesomeIcon icon={faGraduationCap} className="text-white text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Start Your Learning Journey
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-lg mx-auto">
            Sign in to track your progress, build learning streaks, and unlock personalized recommendations.
          </p>
          <Link
            to="/login?next=/learn"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            Sign In to Learn
            <FontAwesomeIcon icon={faArrowRight} />
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-strong p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Personalized Learning</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Adaptive difficulty that adjusts to your skill level and learning pace.
            </p>
          </div>
          <div className="glass-strong p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Spaced Repetition</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Smart review reminders help you retain knowledge longer.
            </p>
          </div>
          <div className="glass-strong p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Track Progress</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Build streaks, earn XP, and watch your expertise grow over time.
            </p>
          </div>
        </div>

        {/* Browse Quizzes Link */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Want to try a quiz first?
          </p>
          <Link
            to="/quizzes"
            className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline font-medium"
          >
            Browse Available Quizzes
            <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Waiting for setup view - shown when user needs to tell Ember what they want to learn
 */
function WaitingForSetupView() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 flex items-center justify-center">
          <FontAwesomeIcon
            icon={faDragon}
            className="text-3xl text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.6)]"
          />
        </div>
        <h2 className="text-xl font-bold text-white mb-3">
          Let's Get Started!
        </h2>
        <p className="text-gray-400">
          Chat with Ember to tell me what you'd like to learn. I'll create a personalized learning path just for you.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-orange-400 text-sm">
          <FontAwesomeIcon icon={faArrowRight} />
          <span>Start chatting with Ember</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Learning setup context for the inline chat
 */
interface LearningSetupContext {
  needsSetup: boolean;
  onSelectGoal: (goal: LearningGoal) => void;
  onSkip: () => void;
  isPending: boolean;
}

/**
 * Authenticated user learning view with inline Ember chat
 */
function AuthenticatedLearnPage() {
  const { data: savedPaths, isLoading: pathsLoading } = useSavedPaths();
  const { data: pathData, isLoading: structuredLoading, refetch } = useStructuredPath();
  const { mutate: completeSetup, isPending: isSettingUp } = useCompleteLearningSetup();

  // Get stable conversation ID for the learn context
  const conversationId = useStableConversationId({ context: 'learn' });

  // Learning setup context for the inline chat
  const [learningSetupContext, setLearningSetupContext] = useState<LearningSetupContext | null>(null);

  const hasSetContext = useRef(false);

  const isLoading = pathsLoading || structuredLoading;
  const hasSavedPaths = savedPaths && savedPaths.length > 0;

  // Handler for when user selects a learning goal in chat
  const handleSelectGoal = useCallback((goal: LearningGoal) => {
    completeSetup(goal, {
      onSuccess: () => {
        // Clear the learning setup context after successful setup
        setLearningSetupContext(null);
        refetch();
      },
    });
  }, [completeSetup, refetch]);

  // Handler for when user skips learning goal selection
  const handleSkip = useCallback(() => {
    completeSetup('exploring', {
      onSuccess: () => {
        setLearningSetupContext(null);
        refetch();
      },
    });
  }, [completeSetup, refetch]);

  // Set up learning context when user needs to set up their path
  useEffect(() => {
    if (!isLoading && pathData && !pathData.hasCompletedPathSetup && !hasSavedPaths && !hasSetContext.current) {
      hasSetContext.current = true;
      setLearningSetupContext({
        needsSetup: true,
        onSelectGoal: handleSelectGoal,
        onSkip: handleSkip,
        isPending: isSettingUp,
      });
    }
  }, [isLoading, pathData, hasSavedPaths, handleSelectGoal, handleSkip, isSettingUp]);

  // Update pending state in context when it changes
  useEffect(() => {
    if (pathData && !pathData.hasCompletedPathSetup && !hasSavedPaths) {
      setLearningSetupContext({
        needsSetup: true,
        onSelectGoal: handleSelectGoal,
        onSkip: handleSkip,
        isPending: isSettingUp,
      });
    }
  }, [isSettingUp, pathData, hasSavedPaths, handleSelectGoal, handleSkip]);

  // Handle create new path - focus on Ember chat
  const handleCreateNew = useCallback(() => {
    // Could scroll to chat or highlight it
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  // Render the main content based on state
  const renderMainContent = () => {
    // Show cold start if no saved paths and setup not complete
    if (!hasSavedPaths && pathData && !pathData.hasCompletedPathSetup) {
      return <WaitingForSetupView />;
    }

    // Show the path library grid
    return (
      <PathLibraryGrid
        onCreateNew={handleCreateNew}
      />
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Hero Banner - Neon Glass Style */}
      <header className="relative h-48 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden flex-shrink-0" aria-label="Learn page header">
        {/* Ambient Glow Background */}
        <div className="absolute top-1/2 left-1/4 -translate-x-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-orange-500/20 dark:bg-orange-500/15 blur-[120px] pointer-events-none" aria-hidden="true" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] rounded-full bg-amber-500/10 dark:bg-amber-500/10 blur-[100px] pointer-events-none" aria-hidden="true" />

        <div className="relative px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 dark:from-orange-400 dark:via-amber-400 dark:to-yellow-400 bg-clip-text text-transparent">Learn</span>
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl">
            Expand your AI knowledge with personalized learning paths and Ember as your guide
          </p>
        </div>
      </header>

      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main content area - flexible width */}
        <div className="flex-1 overflow-y-auto">
          {renderMainContent()}
        </div>

        {/* Ember inline chat panel - fixed width on right */}
        <div className="w-96 flex-shrink-0 hidden lg:block">
          <InlineChatLayout
            conversationId={conversationId}
            context="learn"
            learningSetupContext={learningSetupContext}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Main Learn Page
 */
export default function LearnPage() {
  const { isAuthenticated, isLoading } = useAuth();

  // Quest tracking for page visit
  const { trackPage } = useQuestTracking();
  useEffect(() => {
    trackPage('/learn', 'Learn');
  }, [trackPage]);

  if (isLoading) {
    return (
      <DashboardLayout>
        {() => (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
          </div>
        )}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {() => (
        <div className="h-[calc(100vh-4rem)] overflow-hidden">
          {isAuthenticated ? (
            <AuthenticatedLearnPage />
          ) : (
            <GuestLearnPage />
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
