import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSideQuests } from '@/hooks/useSideQuests';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SideQuestCard } from '@/components/side-quests/SideQuestCard';
import { MySideQuestsPanel } from '@/components/side-quests/MySideQuestsPanel';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCompass,
  faFire,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons';

export default function SideQuestsPage() {
  const { isAuthenticated } = useAuth();
  const {
    availableQuests,
    myQuests,
    isLoading,
    isLoadingMyQuests,
    startQuest,
    isStartingQuest
  } = useSideQuests();

  const [selectedTab, setSelectedTab] = useState<'available' | 'my-quests'>('available');

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

  return (
    <DashboardLayout>
      {() => (
        <div className="h-full overflow-y-auto">
          {/* Hero Banner */}
          <div className="relative h-64 bg-gradient-to-r from-violet-600 to-indigo-800 dark:from-violet-800 dark:to-indigo-950">
            <div className="absolute inset-0 bg-[url('/quest-hero-pattern.svg')] opacity-10"></div>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
              <h1 className="text-4xl font-bold text-white mb-4 flex items-center gap-3">
                <FontAwesomeIcon icon={faCompass} className="text-yellow-300" />
                Side Quests
              </h1>
              <p className="text-xl text-violet-100 max-w-3xl">
                Optional challenges that help you level up faster. Complete quests to earn bonus XP, unlock achievements, and master new skills.
              </p>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setSelectedTab('available')}
                className={`px-4 py-2 font-medium transition-colors ${
                  selectedTab === 'available'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                    : 'text-muted hover:text-default'
                }`}
              >
                <FontAwesomeIcon icon={faCompass} className="mr-2" />
                Available Quests
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
                {myQuests.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs rounded-full">
                    {myQuests.filter(q => q.status === 'in_progress').length}
                  </span>
                )}
              </button>
            </div>

            {/* Content */}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableQuests.map((quest) => (
                      <SideQuestCard
                        key={quest.id}
                        quest={quest}
                        onStart={() => startQuest(quest.id)}
                        isStarting={isStartingQuest}
                      />
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
                    <p className="text-muted mb-4">Start a quest from the Available Quests tab to begin earning bonus XP!</p>
                    <button
                      onClick={() => setSelectedTab('available')}
                      className="btn-primary"
                    >
                      Browse Available Quests
                    </button>
                  </div>
                ) : (
                  <MySideQuestsPanel quests={myQuests} />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
