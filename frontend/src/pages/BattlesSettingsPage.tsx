import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { MyBattlesTab } from '@/components/battles/MyBattlesTab';

export default function BattlesSettingsPage() {
  return (
    <DashboardLayout>
      {() => (
        <SettingsLayout>
          <div className="p-6 md:p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Battles
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Manage your prompt battles and track your progress
              </p>
            </div>

            <MyBattlesTab />
          </div>
        </SettingsLayout>
      )}
    </DashboardLayout>
  );
}
