import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { useAuth } from '@/hooks/useAuth';
import { ActivityInsightsTab } from '@/components/profile/ActivityInsightsTab';

export default function ActivitySettingsPage() {
  const { user } = useAuth();

  return (
    <SettingsLayout>
      <div className="p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Activity
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            View your activity insights, trends, and engagement statistics
          </p>
        </div>

        {user && (
          <ActivityInsightsTab
            username={user.username}
            isOwnProfile={true}
          />
        )}
      </div>
    </SettingsLayout>
  );
}
