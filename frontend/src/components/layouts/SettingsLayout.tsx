import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  UserCircleIcon,
  LockClosedIcon,
  BellIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  GiftIcon,
  SparklesIcon,
  PuzzlePieceIcon,
} from '@heroicons/react/24/outline';

interface SettingsSidebarItem {
  label: string;
  path: string;
  icon: typeof UserCircleIcon;
}

interface SettingsLayoutProps {
  children: ReactNode;
}

const settingsNavItems: SettingsSidebarItem[] = [
  {
    label: 'Edit Profile',
    path: '/account/settings',
    icon: UserCircleIcon,
  },
  {
    label: 'Password',
    path: '/account/settings/password',
    icon: LockClosedIcon,
  },
  {
    label: 'Integrations',
    path: '/account/settings/integrations',
    icon: PuzzlePieceIcon,
  },
  {
    label: 'Personalization',
    path: '/account/settings/personalization',
    icon: SparklesIcon,
  },
  {
    label: 'Referrals',
    path: '/account/settings/referrals',
    icon: GiftIcon,
  },
  {
    label: 'Email Notifications',
    path: '/account/settings/notifications',
    icon: BellIcon,
  },
  {
    label: 'Billing',
    path: '/account/settings/billing',
    icon: CreditCardIcon,
  },
  {
    label: 'Privacy & Security',
    path: '/account/settings/privacy',
    icon: ShieldCheckIcon,
  },
  {
    label: 'Teams',
    path: '/account/settings/teams',
    icon: UserGroupIcon,
  },
];

export function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Secondary Sidebar */}
      <aside className="w-64 glass-strong border-r border-white/10 overflow-y-auto flex-shrink-0">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Settings
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Manage your account preferences
          </p>

          <nav className="space-y-1">
            {settingsNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/account/settings'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white/10 dark:hover:bg-white/5'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`w-5 h-5 ${
                          isActive
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
