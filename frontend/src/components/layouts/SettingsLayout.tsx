import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  UserCircleIcon,
  BellIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  GiftIcon,
  SparklesIcon,
  PuzzlePieceIcon,
  ShoppingBagIcon,
  RocketLaunchIcon,
  ChartBarIcon,
  BoltIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';

interface SettingsSidebarItem {
  label: string;
  path: string;
  icon: typeof UserCircleIcon;
  comingSoon?: boolean;
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
    label: 'Activity',
    path: '/account/settings/activity',
    icon: ChartBarIcon,
  },
  {
    label: 'Battles',
    path: '/account/settings/battles',
    icon: BoltIcon,
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
    label: 'Notifications',
    path: '/account/settings/notifications',
    icon: BellIcon,
  },
  {
    label: 'Billing',
    path: '/account/settings/billing',
    icon: CreditCardIcon,
    comingSoon: true,
  },
  {
    label: 'Creator',
    path: '/account/settings/creator',
    icon: ShoppingBagIcon,
    comingSoon: true,
  },
  {
    label: 'Brand Voice',
    path: '/account/settings/brand-voice',
    icon: MegaphoneIcon,
  },
  {
    label: 'Privacy & Security',
    path: '/account/settings/privacy',
    icon: ShieldCheckIcon,
  },
  {
    label: 'Onboarding',
    path: '/onboarding',
    icon: RocketLaunchIcon,
  },
];

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentPath = location.pathname;

  // Find current active item
  const activeItem = settingsNavItems.find(item =>
    item.path === currentPath || (item.path !== '/account/settings' && currentPath.startsWith(item.path))
  ) || settingsNavItems[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMobileNav = (path: string) => {
    navigate(path);
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-full">
      {/* Secondary Sidebar */}
      <aside className="w-full md:w-64 glass-strong border-b md:border-b-0 md:border-r border-white/10 flex-shrink-0 z-20 md:min-h-full">
        <div className="p-4 md:p-6 md:h-full">
          {/* Desktop Header */}
          <div className="hidden md:block">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Settings
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Manage your account preferences
            </p>
          </div>

          {/* Mobile Dropdown */}
          <div className="md:hidden relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <activeItem.icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <span className="font-medium">{activeItem.label}</span>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[60vh] overflow-y-auto">
                {settingsNavItems.map((item) => {
                  const isActive = item.path === activeItem.path;
                  const Icon = item.icon;

                  // Coming soon items are non-clickable
                  if (item.comingSoon) {
                    return (
                      <div
                        key={item.path}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm border-b last:border-0 border-slate-100 dark:border-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60"
                      >
                        <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500 blur-[1px]" />
                        <span className="blur-[1px]">{item.label}</span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                          Coming Soon
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={item.path}
                      onClick={() => handleMobileNav(item.path)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors border-b last:border-0 border-slate-100 dark:border-white/5 ${
                        isActive
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'}`} />
                      {item.label}
                      {isActive && (
                        <span className="ml-auto text-primary-600 dark:text-primary-400">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex md:flex-col gap-1">
            {settingsNavItems.map((item) => {
              const Icon = item.icon;

              // For coming soon items, render a non-clickable div
              if (item.comingSoon) {
                return (
                  <div
                    key={item.path}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-500 cursor-not-allowed opacity-60 relative"
                  >
                    <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500 blur-[1px]" />
                    <span className="blur-[1px]">{item.label}</span>
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                      Coming Soon
                    </span>
                  </div>
                );
              }

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
      <div className="flex-1 md:overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
