/**
 * Learning Dashboard Component
 *
 * Displays the user's learning progress, stats, and recommendations.
 */
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFire,
  faBolt,
  faBookOpen,
  faTrophy,
  faChartLine,
  faGraduationCap,
  faLightbulb,
  faClock,
  faExclamationTriangle,
  faArrowRight,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';
import {
  useLearnerProfile,
  useLearningStats,
  useConceptMastery,
  useMyLearningPaths,
} from '@/hooks/useLearningPaths';
import { SkillLevelBadge } from './SkillLevelBadge';
import { PathProgressBar } from './PathProgressBar';
import type { MasteryLevel } from '@/types/models';

// Mastery level colors
const masteryColors: Record<MasteryLevel, string> = {
  unknown: 'bg-gray-400',
  aware: 'bg-blue-400',
  learning: 'bg-cyan-500',
  practicing: 'bg-emerald-500',
  proficient: 'bg-purple-500',
  expert: 'bg-amber-500',
};

const masteryLabels: Record<MasteryLevel, string> = {
  unknown: 'Not Started',
  aware: 'Aware',
  learning: 'Learning',
  practicing: 'Practicing',
  proficient: 'Proficient',
  expert: 'Expert',
};

/**
 * Stats Card Component
 */
interface StatsCardProps {
  icon: typeof faFire;
  iconColor: string;
  label: string;
  value: string | number;
  subtext?: string;
}

function StatsCard({ icon, iconColor, label, value, subtext }: StatsCardProps) {
  return (
    <div className="glass-strong p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${iconColor} flex items-center justify-center`}>
        <FontAwesomeIcon icon={icon} className="text-white text-xl" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
        {subtext && (
          <p className="text-xs text-gray-500 dark:text-gray-500">{subtext}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Concept Progress Item
 */
interface ConceptProgressItemProps {
  name: string;
  slug: string;
  masteryLevel: MasteryLevel;
  masteryScore: number;
  topic: string;
}

function ConceptProgressItem({ name, masteryLevel, masteryScore, topic }: ConceptProgressItemProps) {
  const percentage = Math.round(masteryScore * 100);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">{name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{topic.replace(/-/g, ' ')}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${masteryColors[masteryLevel]} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-8">
          {percentage}%
        </span>
      </div>
    </div>
  );
}

/**
 * Empty State Component
 */
function EmptyState({ title, description, actionLabel, actionHref }: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <FontAwesomeIcon icon={faLightbulb} className="text-2xl text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-xs mx-auto">{description}</p>
      <Link
        to={actionHref}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        {actionLabel}
        <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
      </Link>
    </div>
  );
}

/**
 * Learning Dashboard Main Component
 */
export function LearningDashboard() {
  const { data: profile, isLoading: profileLoading } = useLearnerProfile();
  const { data: stats, isLoading: statsLoading } = useLearningStats(30);
  const { data: mastery, isLoading: masteryLoading } = useConceptMastery();
  const { data: paths, isLoading: pathsLoading } = useMyLearningPaths();

  const isLoading = profileLoading || statsLoading || masteryLoading || pathsLoading;

  // Calculate derived stats
  const expertConcepts = mastery?.filter(m => m.masteryLevel === 'expert' || m.masteryLevel === 'proficient').length || 0;
  const practicedConcepts = mastery?.filter(m => m.masteryLevel !== 'unknown').length || 0;

  // Get concepts that need review (low mastery but practiced)
  const needsReview = mastery
    ?.filter(m => m.masteryLevel === 'learning' || m.masteryLevel === 'aware')
    .slice(0, 3) || [];

  // Get top performing concepts
  const topConcepts = mastery
    ?.filter(m => m.masteryLevel !== 'unknown')
    .sort((a, b) => b.masteryScore - a.masteryScore)
    .slice(0, 5) || [];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faChartLine} className="text-primary-500" />
          Your Progress
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            icon={faFire}
            iconColor="bg-orange-500"
            label="Day Streak"
            value={profile?.learningStreakDays || 0}
            subtext={profile?.longestStreakDays ? `Best: ${profile.longestStreakDays} days` : undefined}
          />
          <StatsCard
            icon={faBolt}
            iconColor="bg-cyan-500"
            label="Total XP"
            value={stats?.totalXp || 0}
            subtext="Last 30 days"
          />
          <StatsCard
            icon={faGraduationCap}
            iconColor="bg-purple-500"
            label="Concepts"
            value={`${expertConcepts}/${practicedConcepts}`}
            subtext="Expert level"
          />
          <StatsCard
            icon={faBookOpen}
            iconColor="bg-emerald-500"
            label="Quizzes"
            value={profile?.totalQuizzesCompleted || 0}
            subtext="Completed"
          />
        </div>
      </section>

      {/* Active Learning Paths */}
      {paths && paths.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faTrophy} className="text-amber-500" />
              Active Learning Paths
            </h2>
            <Link
              to="/quizzes"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              View All <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paths.slice(0, 4).map(path => (
              <div key={path.id} className="glass-strong p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 dark:text-white">{path.topicDisplay}</h3>
                  <SkillLevelBadge level={path.currentSkillLevel} size="sm" />
                </div>
                <PathProgressBar
                  currentLevel={path.currentSkillLevel}
                  topicPoints={path.topicPoints}
                  pointsToNextLevel={path.pointsToNextLevel}
                  progressPercentage={path.progressPercentage}
                />
                <div className="flex items-center justify-between mt-3 text-sm text-gray-600 dark:text-gray-400">
                  <span>{path.quizzesCompleted}/{path.quizzesTotal} quizzes</span>
                  <span>{path.progressPercentage}% complete</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Concept Mastery & Review */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Concepts */}
        <section className="glass-strong p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faGraduationCap} className="text-purple-500" />
            Concept Progress
          </h2>
          {topConcepts.length > 0 ? (
            <div className="space-y-2">
              {topConcepts.map(m => (
                <ConceptProgressItem
                  key={m.id}
                  name={m.concept.name}
                  slug={m.concept.slug}
                  masteryLevel={m.masteryLevel}
                  masteryScore={m.masteryScore}
                  topic={m.concept.topic}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Start Learning"
              description="Take quizzes to build your concept knowledge and track your progress."
              actionLabel="Browse Quizzes"
              actionHref="/quizzes"
            />
          )}
        </section>

        {/* Needs Review */}
        <section className="glass-strong p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faClock} className="text-orange-500" />
            Ready for Review
          </h2>
          {needsReview.length > 0 ? (
            <div className="space-y-3">
              {needsReview.map(m => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-orange-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{m.concept.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {masteryLabels[m.masteryLevel]} - {Math.round(m.masteryScore * 100)}% mastery
                    </p>
                  </div>
                  <Link
                    to={`/quizzes?topic=${m.concept.topic}`}
                    className="text-sm text-orange-600 dark:text-orange-400 hover:underline"
                  >
                    Practice
                  </Link>
                </div>
              ))}
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center pt-2">
                Regular review helps reinforce your knowledge!
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FontAwesomeIcon icon={faTrophy} className="text-xl text-green-600 dark:text-green-400" />
              </div>
              <p className="text-gray-600 dark:text-gray-400">All caught up!</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">No concepts need review right now.</p>
            </div>
          )}
        </section>
      </div>

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faLightbulb} className="text-cyan-500" />
          What's Next?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/quizzes"
            className="glass-strong p-6 hover:-translate-y-1 transition-transform group"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FontAwesomeIcon icon={faQuestionCircle} className="text-white text-xl" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Take a Quiz</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Test your knowledge and earn XP
            </p>
          </Link>

          <Link
            to="/tools"
            className="glass-strong p-6 hover:-translate-y-1 transition-transform group"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FontAwesomeIcon icon={faBookOpen} className="text-white text-xl" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Explore Tools</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Discover AI tools and learn how to use them
            </p>
          </Link>

          <Link
            to="/explore"
            className="glass-strong p-6 hover:-translate-y-1 transition-transform group"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FontAwesomeIcon icon={faGraduationCap} className="text-white text-xl" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Learn from Projects</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              See how others build with AI
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
