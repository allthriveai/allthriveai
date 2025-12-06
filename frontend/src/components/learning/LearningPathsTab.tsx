/**
 * Learning Paths Tab Component
 *
 * Displays user's learning paths and recommendations on their profile.
 * Shows the "Find Your Perfect AI Tool" quiz prominently first for personalization.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSpinner,
  faGraduationCap,
  faRocket,
  faTrophy,
  faPlus,
  faBookOpen,
  faWandMagicSparkles,
  faCheckCircle,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { LearningPathCard } from './LearningPathCard';
import { SkillLevelBadge } from './SkillLevelBadge';
import {
  useMyLearningPaths,
  useUserLearningPaths,
  useLearningPathRecommendations,
  useStartLearningPath,
} from '@/hooks/useLearningPaths';
import { useQuery } from '@tanstack/react-query';
import { getQuiz, getQuizHistory } from '@/services/quiz';
import type { UserLearningPath, TopicRecommendation } from '@/types/models';

const PERSONALIZATION_QUIZ_SLUG = 'find-your-perfect-ai-tool';

interface LearningPathsTabProps {
  username: string;
  isOwnProfile: boolean;
}

export function LearningPathsTab({ username, isOwnProfile }: LearningPathsTabProps) {
  const navigate = useNavigate();
  const [selectedPath, setSelectedPath] = useState<UserLearningPath | null>(null);

  // Fetch personalization quiz details
  const { data: personalizationQuiz, isLoading: isLoadingQuiz } = useQuery({
    queryKey: ['quiz', PERSONALIZATION_QUIZ_SLUG],
    queryFn: () => getQuiz(PERSONALIZATION_QUIZ_SLUG),
    enabled: isOwnProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check if user has completed the personalization quiz
  const { data: quizHistory } = useQuery({
    queryKey: ['quizHistory'],
    queryFn: getQuizHistory,
    enabled: isOwnProfile,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const hasCompletedPersonalizationQuiz = quizHistory?.attempts?.some(
    (attempt) => attempt.quiz?.slug === PERSONALIZATION_QUIZ_SLUG && attempt.isCompleted
  );

  // Use different hooks for own profile vs other users
  const {
    data: paths,
    isLoading: isLoadingPaths,
    error: pathsError,
  } = isOwnProfile
    ? useMyLearningPaths()
    : useUserLearningPaths(username);

  const {
    data: recommendations,
    isLoading: isLoadingRecommendations,
  } = useLearningPathRecommendations(5);

  const startPathMutation = useStartLearningPath();

  // Separate active paths and mastered paths
  const activePaths = paths?.filter(p => p.currentSkillLevel !== 'master') || [];
  const masteredPaths = paths?.filter(p => p.currentSkillLevel === 'master') || [];

  const handleStartPath = async (topic: string) => {
    try {
      await startPathMutation.mutateAsync(topic);
    } catch (error) {
      console.error('Failed to start learning path:', error);
    }
  };

  if (isLoadingPaths) {
    return (
      <div className="flex items-center justify-center py-20">
        <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (pathsError) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">Failed to load learning paths.</p>
      </div>
    );
  }

  const hasAnyPaths = (paths?.length || 0) > 0;

  return (
    <div className="space-y-8 pb-20">
      {/* Personalization Quiz - Always show first for own profile */}
      {isOwnProfile && personalizationQuiz && (
        <section>
          {!hasCompletedPersonalizationQuiz ? (
            // User hasn't taken the quiz yet - show prominent CTA
            <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-2xl p-6 md:p-8 text-white shadow-xl">
              {/* Background decoration */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white rounded-full blur-3xl" />
              </div>

              <div className="relative z-10">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                    <FontAwesomeIcon icon={faWandMagicSparkles} className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-1">
                      {personalizationQuiz.title}
                    </h2>
                    <p className="text-white/80 text-sm">
                      Start here to personalize your learning experience
                    </p>
                  </div>
                </div>

                <p className="text-white/90 mb-6 max-w-2xl">
                  {personalizationQuiz.description ||
                    "Discover which AI tools match your workflow and interests. Your answers help us recommend the perfect learning paths, quizzes, and projects for you."}
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => navigate(`/quizzes/${PERSONALIZATION_QUIZ_SLUG}`)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-white/90 transition-colors shadow-lg"
                  >
                    Take the Quiz
                    <FontAwesomeIcon icon={faArrowRight} className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-3 text-white/70 text-sm">
                    <span>{personalizationQuiz.questionCount || 10} questions</span>
                    <span>•</span>
                    <span>{personalizationQuiz.estimatedTime || 5} min</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // User has completed the quiz - show success state
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FontAwesomeIcon icon={faCheckCircle} className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Your AI Tool Profile is Complete!
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    We're using your preferences to personalize recommendations below.
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/quizzes/${PERSONALIZATION_QUIZ_SLUG}`)}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                >
                  Retake Quiz
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Active Learning Paths */}
      {activePaths.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FontAwesomeIcon icon={faGraduationCap} className="w-5 h-5 text-teal-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Active Learning Paths
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activePaths.map((path) => (
              <LearningPathCard
                key={path.id}
                path={path}
                onClick={() => setSelectedPath(path)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recommendations - Only show for own profile */}
      {isOwnProfile && !isLoadingRecommendations && recommendations && recommendations.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FontAwesomeIcon icon={faRocket} className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recommended Topics
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recommendations.map((rec) => (
              <RecommendedPathCard
                key={rec.topic}
                recommendation={rec}
                onStart={() => handleStartPath(rec.topic)}
                isStarting={startPathMutation.isPending}
              />
            ))}
          </div>
        </section>
      )}

      {/* Mastered Topics */}
      {masteredPaths.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FontAwesomeIcon icon={faTrophy} className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Mastered Topics
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {masteredPaths.map((path) => (
              <div
                key={path.id}
                className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center"
              >
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center mx-auto mb-2">
                  <FontAwesomeIcon icon={faTrophy} className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                  {path.topicDisplay}
                </h3>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {path.topicPoints} points
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {!hasAnyPaths && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <FontAwesomeIcon icon={faBookOpen} className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No learning paths yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {isOwnProfile
              ? 'Start taking quizzes and completing side quests to build your learning journey!'
              : `${username} hasn't started any learning paths yet.`}
          </p>
        </div>
      )}
    </div>
  );
}

// Recommended Path Card Component
interface RecommendedPathCardProps {
  recommendation: TopicRecommendation;
  onStart: () => void;
  isStarting: boolean;
}

function RecommendedPathCard({ recommendation, onStart, isStarting }: RecommendedPathCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900/50 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-5 hover:border-teal-500 dark:hover:border-teal-500 transition-colors">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {recommendation.topicDisplay}
      </h3>

      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
        <span>{recommendation.quizCount} quizzes</span>
        <span>{recommendation.sidequestCount} side quests</span>
      </div>

      <button
        onClick={onStart}
        disabled={isStarting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:bg-teal-400 text-white rounded-lg font-medium transition-colors"
      >
        {isStarting ? (
          <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
        ) : (
          <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
        )}
        Start Learning
      </button>
    </div>
  );
}
