import { SparklesIcon, FireIcon, TagIcon, WrenchScrewdriverIcon, UserGroupIcon, NewspaperIcon } from '@heroicons/react/24/outline';

export type ExploreTab = 'for-you' | 'trending' | 'news' | 'categories' | 'tools' | 'profiles';

interface TabConfig {
  id: ExploreTab;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabConfig[] = [
  { id: 'for-you', label: 'For You', icon: <SparklesIcon className="w-5 h-5" /> },
  { id: 'trending', label: 'Trending', icon: <FireIcon className="w-5 h-5" /> },
  { id: 'news', label: 'News', icon: <NewspaperIcon className="w-5 h-5" /> },
  { id: 'categories', label: 'By Categories', icon: <TagIcon className="w-5 h-5" /> },
  { id: 'tools', label: 'By Tools', icon: <WrenchScrewdriverIcon className="w-5 h-5" /> },
  { id: 'profiles', label: 'By Profiles', icon: <UserGroupIcon className="w-5 h-5" /> },
];

interface TabNavigationProps {
  activeTab: ExploreTab;
  onChange: (tab: ExploreTab) => void;
}

export function TabNavigation({ activeTab, onChange }: TabNavigationProps) {
  return (
    <div className="mb-6">
      {/* Desktop: Horizontal tabs */}
      <div className="hidden sm:flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap
              ${
                activeTab === tab.id
                  ? 'glass-subtle text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 shadow-neon'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-neon'
              }
            `}
            style={{ borderRadius: 'var(--radius)' }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Mobile: Dropdown */}
      <div className="sm:hidden">
        <select
          value={activeTab}
          onChange={(e) => onChange(e.target.value as ExploreTab)}
          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:shadow-neon"
          style={{ borderRadius: 'var(--radius)' }}
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
