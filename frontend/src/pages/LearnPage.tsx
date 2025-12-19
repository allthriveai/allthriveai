import { useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { StructuredLearningPath } from '@/components/learning';
import { useStructuredPath, useResetLearningSetup, useCompleteLearningSetup } from '@/hooks/useLearningPaths';
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

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
 * Waiting for setup view - shown in main area while user sets learning goal in chat
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
          Chat with Ember in the panel to tell me what you'd like to learn. I'll create a personalized learning path just for you.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-orange-400 text-sm">
          <span className="animate-pulse">Check out the chat panel</span>
          <FontAwesomeIcon icon={faArrowRight} />
        </div>
      </div>
    </div>
  );
}

/**
 * Authenticated user learning view with structured path
 */
interface OpenChatOptions {
  welcomeMode?: boolean;
  context?: 'learn' | 'explore' | 'project' | 'default';
}

interface AuthenticatedLearnPageProps {
  openAddProject: (options?: boolean | OpenChatOptions) => void;
  setLearningSetupContext: (context: {
    needsSetup: boolean;
    onSelectGoal: (goal: LearningGoal) => void;
    onSkip: () => void;
    isPending: boolean;
  } | null) => void;
}

function AuthenticatedLearnPage({ openAddProject, setLearningSetupContext }: AuthenticatedLearnPageProps) {
  const { data: pathData, isLoading, error, refetch } = useStructuredPath();
  const { mutate: resetSetup, isPending: isResetting } = useResetLearningSetup();
  const { mutate: completeSetup, isPending: isSettingUp } = useCompleteLearningSetup();
  const hasOpenedChat = useRef(false);
  const hasSetContext = useRef(false);

  // Handler for when user selects a learning goal in chat
  const handleSelectGoal = useCallback((goal: LearningGoal) => {
    completeSetup(goal, {
      onSuccess: () => {
        // Clear the learning setup context after successful setup
        setLearningSetupContext(null);
        refetch();
      },
    });
  }, [completeSetup, setLearningSetupContext, refetch]);

  // Handler for when user skips learning goal selection
  const handleSkip = useCallback(() => {
    completeSetup('exploring', {
      onSuccess: () => {
        setLearningSetupContext(null);
        refetch();
      },
    });
  }, [completeSetup, setLearningSetupContext, refetch]);

  // Set up learning context in chat when user needs to set up their path
  useEffect(() => {
    if (!isLoading && pathData && !pathData.hasCompletedPathSetup && !hasSetContext.current) {
      hasSetContext.current = true;
      setLearningSetupContext({
        needsSetup: true,
        onSelectGoal: handleSelectGoal,
        onSkip: handleSkip,
        isPending: isSettingUp,
      });
    }
  }, [isLoading, pathData, handleSelectGoal, handleSkip, isSettingUp, setLearningSetupContext]);

  // Update pending state in context when it changes
  useEffect(() => {
    if (pathData && !pathData.hasCompletedPathSetup) {
      setLearningSetupContext({
        needsSetup: true,
        onSelectGoal: handleSelectGoal,
        onSkip: handleSkip,
        isPending: isSettingUp,
      });
    }
  }, [isSettingUp, pathData, handleSelectGoal, handleSkip, setLearningSetupContext]);

  // Auto-open Ember chat on first load with learn context
  useEffect(() => {
    if (!hasOpenedChat.current && !isLoading) {
      hasOpenedChat.current = true;
      // Small delay to ensure layout is ready
      setTimeout(() => {
        openAddProject({ context: 'learn' });
      }, 300);
    }
  }, [isLoading, openAddProject]);

  // Handle reset - set up context again for chat
  const handleResetPath = useCallback(() => {
    resetSetup(undefined, {
      onSuccess: () => {
        hasSetContext.current = false;
        refetch();
      },
    });
  }, [resetSetup, refetch]);

  // Clean up learning context when component unmounts
  useEffect(() => {
    return () => {
      setLearningSetupContext(null);
    };
  }, [setLearningSetupContext]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Failed to load your learning path.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show waiting view if user hasn't completed setup - they should use the chat
  if (pathData && !pathData.hasCompletedPathSetup) {
    return <WaitingForSetupView />;
  }

  // Show the structured learning path
  if (pathData) {
    return (
      <StructuredLearningPath
        pathData={pathData}
        onResetPath={handleResetPath}
        isResetting={isResetting}
      />
    );
  }

  return null;
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
      {({ openAddProject, setLearningSetupContext }) => (
        <div className="h-full overflow-y-auto">
          {isAuthenticated ? (
            <AuthenticatedLearnPage
              openAddProject={openAddProject}
              setLearningSetupContext={setLearningSetupContext}
            />
          ) : (
            <GuestLearnPage />
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
