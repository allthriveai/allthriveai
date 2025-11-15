import type { User } from '@/types/models';

interface ProfileCenterProps {
  user: User | null;
  activeTab: 'showcase' | 'playground' | 'settings';
  onTabChange: (tab: 'showcase' | 'playground' | 'settings') => void;
}

export function ProfileCenter({ user, activeTab, onTabChange }: ProfileCenterProps) {
  const tabs = [
    { id: 'showcase', label: 'Showcase' },
    { id: 'playground', label: 'Playground' },
    { id: 'settings', label: 'Settings' },
  ] as const;

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-y-auto">
      {/* Profile Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-8">
        <div className="flex items-start gap-6">
          {/* Profile Photo */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.firstName || 'Profile'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{(user?.firstName || 'U')[0]}</span>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-2xl">
              {user?.bio || 'No bio added yet.'}
            </p>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">0</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Projects</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">0</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Followers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">0</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Following</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-6 py-4 font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'showcase' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Showcase</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">No projects yet</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'playground' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Playground</h2>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">Experiment with AI agents here</p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h2>
            <div className="space-y-6 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bio
                </label>
                <textarea
                  value={user?.bio || ''}
                  disabled
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
                />
              </div>

              <button className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium">
                Edit Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
