import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';

export default function NotificationsSettingsPage() {
  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          <div className="max-w-2xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Email Notifications
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Manage your email notification preferences
              </p>
            </div>

            <div className="glass-strong rounded p-12 border border-white/20 text-center">
              <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔔</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Coming Soon
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Email notification settings will be available in a future update
              </p>
            </div>
          </div>
        </div>
      </SettingsLayout>
    </DashboardLayout>
  );
}
