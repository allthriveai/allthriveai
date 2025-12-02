import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSideQuests } from '@/hooks/useSideQuests';
import { useQuestCategories } from '@/hooks/useQuestCategories';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SideQuestCard } from '@/components/side-quests/SideQuestCard';
import { MySideQuestsPanel } from '@/components/side-quests/MySideQuestsPanel';
import { QuestCategoryCard } from '@/components/side-quests/QuestCategoryCard';
import { DailyQuestsSection } from '@/components/side-quests/DailyQuestsSection';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCompass,
  faTrophy,
  faMap,
  faCheckCircle,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import type { QuestCategory, QuestCategoryProgress } from '@/types/models';

// Helper to chunk array into rows for honeycomb grid
function chunkIntoRows<T>(items: T[], itemsPerRow: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += itemsPerRow) {
    rows.push(items.slice(i, i + itemsPerRow));
  }
  return rows;
}

export default function SideQuestsPage() {
  const { isAuthenticated } = useAuth();
  const {
    availableQuests,
    myQuests,
    isLoading,
    isLoadingMyQuests,
    startQuestAsync,
    isStartingQuest
  } = useSideQuests();

  const {
    categories,
    dailyQuests,
    isLoading: isLoadingCategories,
    isLoadingDaily,
  } = useQuestCategories();

  const [selectedTab, setSelectedTab] = useState<'pathways' | 'available' | 'my-quests'>('pathways');
  const [selectedCategory, setSelectedCategory] = useState<(QuestCategory & { progress: QuestCategoryProgress | null }) | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle starting a quest with feedback
  const handleStartQuest = async (questId: string) => {
    try {
      const result = await startQuestAsync(questId);
      // Find the quest name for the success message
      const quest = availableQuests.find(q => q.id === questId) || dailyQuests.find(q => q.id === questId);
      setSuccessMessage(`Quest "${quest?.title || 'Quest'}" accepted! Check My Quests to track your progress.`);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
      // Switch to My Quests tab
      setSelectedTab('my-quests');
    } catch (error) {
      console.error('Failed to start quest:', error);
      setSuccessMessage(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        {() => (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-2">
                Join Side Quests
              </h1>
              <p className="text-muted">
                Log in to discover and complete optional challenges for bonus XP
              </p>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  // Filter categories - exclude daily from main list (shown separately)
  const mainCategories = categories.filter(c => c.categoryType !== 'daily');
  const inProgressCount = myQuests.filter(q => q.status === 'in_progress').length;

  return (
    <DashboardLayout>
      {() => (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900">
          {/* Hero Banner with honeycomb pattern */}
          <div className="relative h-64 bg-gradient-to-r from-violet-600 to-indigo-800 dark:from-violet-800 dark:to-indigo-950 overflow-hidden">
            {/* Honeycomb pattern overlay */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100' viewBox='0 0 56 100'%3E%3Cpath fill='%23fff' d='M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100' fill-opacity='0.4'/%3E%3Cpath fill='%23fff' d='M28 0L28 34L0 50L0 84L28 100L56 84L56 50L28 34' fill-opacity='0.2'/%3E%3C/svg%3E")`,
                backgroundSize: '56px 100px',
              }}
            />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
              <h1 className="text-4xl font-bold text-white mb-4 flex items-center gap-3">
                <FontAwesomeIcon icon={faCompass} className="text-yellow-300" />
                Side Quests
              </h1>
              <p className="text-xl text-violet-100 max-w-3xl">
                Complete quests to earn bonus points, unlock achievements, and master new skills. Choose a pathway to focus your journey!
              </p>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Success notification */}
            {successMessage && (
              <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg flex items-center justify-between animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 dark:text-green-400 text-xl" />
                  <p className="text-green-800 dark:text-green-200 font-medium">{successMessage}</p>
                </div>
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            )}

            {/* Daily Quests Section */}
            {!isLoadingDaily && dailyQuests.length > 0 && (
              <DailyQuestsSection
                quests={dailyQuests}
                onStartQuest={handleStartQuest}
                isStarting={isStartingQuest}
              />
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => {
                  setSelectedTab('pathways');
                  setSelectedCategory(null);
                }}
                className={`px-4 py-2 font-medium transition-colors ${
                  selectedTab === 'pathways'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                    : 'text-muted hover:text-default'
                }`}
              >
                <FontAwesomeIcon icon={faMap} className="mr-2" />
                Quest Pathways
              </button>
              <button
                onClick={() => setSelectedTab('available')}
                className={`px-4 py-2 font-medium transition-colors ${
                  selectedTab === 'available'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                    : 'text-muted hover:text-default'
                }`}
              >
                <FontAwesomeIcon icon={faCompass} className="mr-2" />
                All Quests
              </button>
              <button
                onClick={() => setSelectedTab('my-quests')}
                className={`px-4 py-2 font-medium transition-colors ${
                  selectedTab === 'my-quests'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                    : 'text-muted hover:text-default'
                }`}
              >
                <FontAwesomeIcon icon={faTrophy} className="mr-2" />
                My Quests
                {inProgressCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs rounded-full">
                    {inProgressCount}
                  </span>
                )}
              </button>
            </div>

            {/* Content */}
            {selectedTab === 'pathways' && !selectedCategory && (
              <div>
                {isLoadingCategories ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
                  </div>
                ) : mainCategories.length === 0 ? (
                  <div className="text-center py-12">
                    <FontAwesomeIcon icon={faMap} className="text-6xl text-muted mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Quest Pathways Available</h3>
                    <p className="text-muted">Check back soon for new adventure paths!</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-default mb-2">Choose Your Path</h2>
                      <p className="text-muted">Each pathway contains themed quests. Complete all quests in a pathway to earn bonus points!</p>
                    </div>
                    {/* Honeycomb grid for categories */}
                    <div className="flex flex-wrap justify-center gap-4">
                      {mainCategories.map((category) => (
                        <QuestCategoryCard
                          key={category.id}
                          category={category}
                          onClick={() => setSelectedCategory(category)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {selectedTab === 'pathways' && selectedCategory && (
              <div>
                {/* Back button */}
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="mb-4 text-muted hover:text-default transition-colors flex items-center gap-2"
                >
                  <span>&larr;</span> Back to Pathways
                </button>

                {/* Category header */}
                <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-800 text-white">
                  <h2 className="text-2xl font-bold mb-2">{selectedCategory.name}</h2>
                  <p className="text-violet-100 mb-4">{selectedCategory.description}</p>
                  {selectedCategory.progress && (
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white rounded-full transition-all duration-500"
                            style={{ width: `${selectedCategory.progress.completionPercentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium">
                        {selectedCategory.progress.completedQuests}/{selectedCategory.progress.totalQuests} completed
                      </span>
                    </div>
                  )}
                </div>

                {/* Honeycomb grid for quests in category */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
                  </div>
                ) : (
                  <div className="honeycomb-grid">
                    {chunkIntoRows(
                      availableQuests.filter(q => q.categorySlug === selectedCategory.slug),
                      4
                    ).map((row, rowIndex) => (
                      <div key={`row-${rowIndex}`} className="honeycomb-row">
                        {row.map((quest, colIndex) => (
                          <div
                            key={quest.id}
                            className="honeycomb-cell"
                            style={{ '--delay': `${(rowIndex * 4 + colIndex) * 0.05}s` } as React.CSSProperties}
                          >
                            <SideQuestCard
                              quest={quest}
                              onStart={() => handleStartQuest(quest.id)}
                              isStarting={isStartingQuest}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedTab === 'available' && (
              <div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
                  </div>
                ) : availableQuests.length === 0 ? (
                  <div className="text-center py-12">
                    <FontAwesomeIcon icon={faCompass} className="text-6xl text-muted mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Quests Available</h3>
                    <p className="text-muted">Check back soon for new challenges!</p>
                  </div>
                ) : (
                  <div className="honeycomb-grid">
                    {chunkIntoRows(availableQuests, 4).map((row, rowIndex) => (
                      <div key={`row-${rowIndex}`} className="honeycomb-row">
                        {row.map((quest, colIndex) => (
                          <div
                            key={quest.id}
                            className="honeycomb-cell"
                            style={{ '--delay': `${(rowIndex * 4 + colIndex) * 0.03}s` } as React.CSSProperties}
                          >
                            <SideQuestCard
                              quest={quest}
                              onStart={() => handleStartQuest(quest.id)}
                              isStarting={isStartingQuest}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedTab === 'my-quests' && (
              <div>
                {isLoadingMyQuests ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
                  </div>
                ) : myQuests.length === 0 ? (
                  <div className="text-center py-12">
                    <FontAwesomeIcon icon={faTrophy} className="text-6xl text-muted mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Active Quests</h3>
                    <p className="text-muted mb-4">Start a quest from a pathway or browse all available quests to begin earning bonus points!</p>
                    <button
                      onClick={() => setSelectedTab('pathways')}
                      className="btn-primary"
                    >
                      Browse Quest Pathways
                    </button>
                  </div>
                ) : (
                  <MySideQuestsPanel quests={myQuests} />
                )}
              </div>
            )}
          </div>

          {/* CSS for honeycomb grid */}
          <style>{`
            .honeycomb-grid {
              --hex-size: 160px;
              --hex-margin: 4px;

              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 20px 10px;
            }

            .honeycomb-row {
              display: flex;
              justify-content: center;
              margin-top: calc(var(--hex-size) * -0.25);
              transform: translateX(calc((var(--hex-size) / 2 + var(--hex-margin)) / -2));
            }

            .honeycomb-row:first-child {
              margin-top: 0;
            }

            .honeycomb-row:nth-child(even) {
              transform: translateX(calc((var(--hex-size) / 2 + var(--hex-margin)) / 2));
            }

            .honeycomb-cell {
              width: var(--hex-size);
              flex-shrink: 0;
              margin: 0 var(--hex-margin);
              animation: fadeInUp 0.4s ease-out backwards;
              animation-delay: var(--delay, 0s);
            }

            @media (min-width: 480px) {
              .honeycomb-grid {
                --hex-size: 170px;
                --hex-margin: 5px;
              }
            }

            @media (min-width: 640px) {
              .honeycomb-grid {
                --hex-size: 180px;
                --hex-margin: 6px;
              }
            }

            @media (min-width: 768px) {
              .honeycomb-grid {
                --hex-size: 200px;
                --hex-margin: 8px;
              }
            }

            @media (min-width: 1024px) {
              .honeycomb-grid {
                --hex-size: 220px;
                --hex-margin: 10px;
              }
            }

            @media (min-width: 1280px) {
              .honeycomb-grid {
                --hex-size: 240px;
                --hex-margin: 12px;
              }
            }

            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </div>
      )}
    </DashboardLayout>
  );
}
