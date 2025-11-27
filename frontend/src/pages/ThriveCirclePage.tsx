import { useAuth } from '@/hooks/useAuth';
import { useThriveCircle } from '@/hooks/useThriveCircle';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { WeeklyGoalsPanel } from '@/components/thrive-circle/WeeklyGoalsPanel';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFire,
  faTrophy,
  faChartLine,
  faUsers,
  faBook,
  faRocket
} from '@fortawesome/free-solid-svg-icons';

export default function ThriveCirclePage() {
  const { isAuthenticated } = useAuth();
  const { tierStatus, weeklyGoals, circleProjects, isLoading, isLoadingWeeklyGoals, isLoadingCircleProjects } = useThriveCircle();

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        {() => (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-2">
                Join Thrive Circle
              </h1>
              <p className="text-muted">
                Log in to see your learning journey and connect with the community
              </p>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {() => (
        <div className="h-full overflow-y-auto">
          {/* Hero Banner */}
          <div className="relative h-64 bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-800 dark:to-primary-950">
            <div className="absolute inset-0 bg-[url('/thrive-hero-pattern.svg')] opacity-10"></div>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
              <h1 className="text-4xl font-bold text-white mb-4">
                {tierStatus?.tierDisplay ? `${tierStatus.tierDisplay} Circle` : 'Thrive Circle'}
              </h1>
              <p className="text-xl text-primary-100 max-w-3xl">
                Your gamified learning journey. Earn XP through quizzes, projects, and community engagement to unlock tiers from Seedling to Evergreen. Track your streaks, complete weekly goals, and grow with fellow learners.
              </p>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Column 1 - About You */}
                <section className="lg:col-span-3 space-y-6">
                  {/* Your Journey */}
                  {tierStatus && (
                    <div className="glass p-6 rounded">
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <FontAwesomeIcon icon={faTrophy} className="text-primary-500" />
                        Your Journey
                      </h2>

                      {/* Tier Badge */}
                      <div className="p-6 rounded bg-gradient-primary text-white text-center mb-4 shadow-brand">
                        <FontAwesomeIcon icon={faFire} className="text-5xl mb-3" />
                        <div className="text-xl font-bold capitalize">{tierStatus.tier}</div>
                        <div className="text-sm opacity-90 mt-1">{tierStatus.totalXp?.toLocaleString() || 0} XP</div>
                      </div>

                      {/* Progress to next tier */}
                      {tierStatus.nextTierXp && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm text-muted">
                            <span>Next tier</span>
                            <span>{Math.round(tierStatus.progressToNext || 0)}%</span>
                          </div>
                          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-primary transition-all duration-500"
                              style={{ width: `${tierStatus.progressToNext || 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Your Streak */}
                  <div className="glass p-6 rounded">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <FontAwesomeIcon icon={faFire} className="text-orange-500" />
                      Your Streak
                    </h3>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-1">
                        {tierStatus?.currentStreakDays || 0}
                      </div>
                      <div className="text-sm text-muted mb-3">days</div>
                      <div className="text-xs text-muted">
                        Best: {tierStatus?.longestStreakDays || 0} days
                      </div>
                    </div>
                  </div>

                  {/* Your Stats */}
                  <div className="glass p-6 rounded">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <FontAwesomeIcon icon={faChartLine} className="text-accent-500" />
                      Your Stats
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-muted text-sm">Quizzes</span>
                        <span className="font-semibold">{tierStatus?.lifetimeQuizzesCompleted || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted text-sm">Projects</span>
                        <span className="font-semibold">{tierStatus?.lifetimeProjectsCreated || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted text-sm">Side Quests</span>
                        <span className="font-semibold">{tierStatus?.lifetimeSideQuestsCompleted || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted text-sm">Comments</span>
                        <span className="font-semibold">{tierStatus?.lifetimeCommentsPosted || 0}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Column 2 - Community */}
                <section className="lg:col-span-3 space-y-6">
                  {/* Weekly Goals */}
                  <WeeklyGoalsPanel goals={weeklyGoals} isLoading={isLoadingWeeklyGoals} />

                  {/* Circle Stats */}
                  <div className="glass p-6 rounded">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <FontAwesomeIcon icon={faUsers} className="text-accent-500" />
                      Circle Stats
                    </h3>
                    <div className="text-center py-4">
                      <div className="text-2xl font-bold text-primary-600 dark:text-primary-400 mb-1">
                        {circleProjects?.length || 0}
                      </div>
                      <div className="text-sm text-muted">
                        {tierStatus?.tierDisplay || 'Circle'} projects
                      </div>
                    </div>
                  </div>

                  {/* Circle Interests */}
                  <div className="glass p-6 rounded">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <FontAwesomeIcon icon={faBook} className="text-primary-500" />
                      Circle Interests
                    </h3>
                    <p className="text-xs text-muted text-center py-6">
                      Coming soon!<br />
                      See trending topics in your tier.
                    </p>
                  </div>
                </section>

                {/* Column 3 - Projects Feed */}
                <section className="lg:col-span-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                      <FontAwesomeIcon icon={faRocket} className="text-accent-500" />
                      {tierStatus?.tierDisplay ? `${tierStatus.tierDisplay} Circle` : 'Circle'} Projects
                    </h2>
                    <p className="text-sm text-muted">
                      Projects from members in your tier
                    </p>
                  </div>

                  {isLoadingCircleProjects ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400" />
                        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading projects...</p>
                      </div>
                    </div>
                  ) : circleProjects && circleProjects.length > 0 ? (
                    <div className="columns-1 sm:columns-2 gap-2">
                      {circleProjects.map((project: any) => (
                        <div key={project.id} className="break-inside-avoid mb-2">
                          <ProjectCard
                            project={project}
                            variant="masonry"
                            userAvatarUrl={project.user_avatar_url}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <FontAwesomeIcon icon={faRocket} className="text-5xl text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          Be the first in your circle to share a project!
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
