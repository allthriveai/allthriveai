import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { useOnboardingProgress, type ChecklistItem } from '@/hooks/useOnboardingProgress';
import {
  CheckCircleIcon,
  SparklesIcon,
  UserIcon,
  AcademicCapIcon,
  FolderPlusIcon,
  LinkIcon,
  PuzzlePieceIcon,
  BoltIcon,
  WrenchScrewdriverIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';

// Map item IDs to icons
const iconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  complete_profile: UserIcon,
  take_quiz: AcademicCapIcon,
  add_project: FolderPlusIcon,
  connect_integration: LinkIcon,
  complete_side_quest: PuzzlePieceIcon,
  join_battle: BoltIcon,
  explore_tools: WrenchScrewdriverIcon,
};

// Map item IDs to colors (with light/dark mode support)
const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  complete_profile: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-600 dark:text-cyan-400',
    icon: 'text-cyan-600 dark:text-cyan-400',
  },
  take_quiz: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-600 dark:text-purple-400',
    icon: 'text-purple-600 dark:text-purple-400',
  },
  add_project: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-600 dark:text-green-400',
    icon: 'text-green-600 dark:text-green-400',
  },
  connect_integration: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  complete_side_quest: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    text: 'text-pink-600 dark:text-pink-400',
    icon: 'text-pink-600 dark:text-pink-400',
  },
  join_battle: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  explore_tools: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    icon: 'text-indigo-600 dark:text-indigo-400',
  },
};

function ChecklistItemCard({ item }: { item: ChecklistItem }) {
  const Icon = iconMap[item.id] || SparklesIcon;
  const colors = colorMap[item.id] || colorMap.complete_profile;

  return (
    <Link
      to={item.link}
      className={`block p-4 rounded-xl border transition-all duration-200 group ${
        item.completed
          ? 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 opacity-75'
          : `${colors.bg} ${colors.border} hover:scale-[1.02]`
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            item.completed ? 'bg-green-500/20' : colors.bg
          }`}
        >
          {item.completed ? (
            <CheckCircleSolidIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
          ) : (
            <Icon className={`w-5 h-5 ${colors.icon}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={`font-medium ${
                item.completed ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-white'
              }`}
            >
              {item.title}
            </h3>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                item.completed
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                  : `${colors.bg} ${colors.text}`
              }`}
            >
              +{item.points} pts
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{item.description}</p>
        </div>

        {/* Arrow */}
        {!item.completed && (
          <ArrowRightIcon className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
        )}
      </div>
    </Link>
  );
}

export default function GettingStartedPage() {
  const { progress, isLoading, error } = useOnboardingProgress();

  if (isLoading) {
    return (
      <DashboardLayout>
        <SettingsLayout>
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-600 dark:text-slate-400">Loading your progress...</p>
            </div>
          </div>
        </SettingsLayout>
      </DashboardLayout>
    );
  }

  if (error || !progress) {
    return (
      <DashboardLayout>
        <SettingsLayout>
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
              <p className="text-rose-600 dark:text-rose-400 mb-4">{error || 'Something went wrong'}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </SettingsLayout>
      </DashboardLayout>
    );
  }

  const isComplete = progress.progress_percentage === 100;

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-medium mb-4 tracking-wider uppercase">
            <SparklesIcon className="w-3.5 h-3.5" />
            Getting Started
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
            {isComplete ? "You're all set!" : 'Welcome to All Thrive'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            {isComplete
              ? "You've completed all the getting started tasks. Keep exploring and creating!"
              : 'Complete these tasks to get the most out of the platform and earn bonus points.'}
          </p>
        </div>

        {/* Tool Finder Card - Prominent placement */}
        <Link
          to="/quizzes/find-your-perfect-ai-tool"
          className="w-full glass-panel p-6 mb-6 text-left hover:border-cyan-500/30 transition-all group block"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
              <MagnifyingGlassIcon className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900 dark:text-white">Find Your Perfect AI Tool</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                  New
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Not sure which AI tools to use? Take our quick quiz and get personalized recommendations.
              </p>
            </div>
            <ArrowRightIcon className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
          </div>
        </Link>

        {/* Progress Card */}
        <div className="glass-panel p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Your Progress</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {progress.completed_count} of {progress.total_count} completed
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-600 dark:text-slate-400">Points Earned</p>
              <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 dark:from-cyan-400 to-green-600 dark:to-green-400">
                {progress.earned_points} / {progress.total_points}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-3 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all duration-500 rounded-full"
              style={{ width: `${progress.progress_percentage}%` }}
            />
          </div>
          <p className="text-sm text-slate-500 mt-2 text-center">
            {progress.progress_percentage}% complete
          </p>
        </div>

        {/* Checklist */}
        <div className="space-y-3">
          {/* Incomplete items first */}
          {progress.checklist
            .filter(item => !item.completed)
            .map(item => (
              <ChecklistItemCard key={item.id} item={item} />
            ))}

          {/* Completed items */}
          {progress.checklist.filter(item => item.completed).length > 0 && (
            <>
              <div className="flex items-center gap-3 pt-4">
                <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Completed</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
              </div>
              {progress.checklist
                .filter(item => item.completed)
                .map(item => (
                  <ChecklistItemCard key={item.id} item={item} />
                ))}
            </>
          )}
        </div>

        {/* CTA for when complete */}
        {isComplete && (
          <div className="mt-8 text-center">
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold hover:shadow-lg dark:hover:shadow-neon transition-all"
            >
              Start Exploring
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
          </div>
        )}
        </div>
      </SettingsLayout>
    </DashboardLayout>
  );
}
