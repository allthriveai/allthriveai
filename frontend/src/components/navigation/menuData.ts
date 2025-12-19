import {
  faCompass,
  faGamepad,
  faGraduationCap,
  faUsers,
  faUser,
  faWrench,
  faTrophy,
  faBrain,
  faUserGroup,
  faGift,
  faCalendar,
  faComments,
  faWandSparkles,
  faIdCard,
  faCog,
  faStore,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export interface MenuItem {
  label: string;
  path?: string; // Internal path for routing
  external?: boolean; // External URL
  onClick?: () => void;
  subItems?: MenuItem[];
  icon?: IconDefinition;
  className?: string; // Custom class for styling (e.g., pink text for Prompt Battle)
}

export interface MenuSection {
  title: string;
  icon: IconDefinition;
  items: MenuItem[];
  path?: string; // Optional direct path for section header
  onClick?: () => void; // Optional click handler for section header
}

export const getMenuSections = (
  onMenuClick: (item: string) => void,
  username?: string
): MenuSection[] => [
  {
    title: 'DISCOVER',
    icon: faCompass,
    path: '/explore',
    items: [
      { label: 'Explore', path: '/explore', icon: faCompass },
      { label: 'Tool Directory', path: '/tools', icon: faWrench },
      { label: 'Marketplace (Coming Soon)', icon: faStore },
    ],
  },
  {
    title: 'PLAY',
    icon: faGamepad,
    path: '/challenges',
    items: [
      { label: "This Week's Challenge", path: '/challenges', icon: faTrophy },
      { label: 'Side Quests', path: '/play/side-quests', icon: faGamepad },
      { label: 'Prompt Battle', path: '/play/prompt-battle', icon: faTrophy, className: 'text-pink-500 dark:text-pink-400' },
      { label: 'Quizzes', path: '/quizzes', icon: faBrain },
      { label: 'Learning Paths', path: '#', icon: faGraduationCap },
    ],
  },
  {
    title: 'CONNECT',
    icon: faUsers,
    path: '/thrive-circle',
    items: [
      { label: 'Your Thrive Circle', path: '/thrive-circle', icon: faUserGroup },
      { label: 'Perks', path: '/perks', icon: faGift },
      { label: 'Events Calendar', onClick: () => onMenuClick('Events Calendar'), icon: faCalendar },
      { label: 'Chat', onClick: () => onMenuClick('Chat'), icon: faComments },
    ],
  },
  {
    title: 'ACCOUNT',
    icon: faUser,
    path: username ? `/${username}?tab=playground` : '#',
    items: [
      {
        label: 'My Profile',
        path: username ? `/${username}?tab=playground` : '#',
        icon: faIdCard,
      },
      { label: 'Account Settings', path: '/account/settings', icon: faCog },
      { label: 'Onboarding', path: '/onboarding', icon: faWandSparkles },
    ],
  },
];

// Route patterns for active state detection
export const ROUTE_PATTERNS: Record<string, (path: string, search: string, username?: string) => boolean> = {
  'DISCOVER': (path) => path === '/explore',
  'Quizzes': (path) => path === '/quizzes',
  "This Week's Challenge": (path) => path === '/challenges' || path.startsWith('/challenges/') || path === '/this-weeks-challenge',
  'Side Quests': (path) => path === '/play/side-quests',
  'Prompt Battle': (path) => path === '/play/prompt-battle',
  'Chat': (_, search) => search.includes('chat='),
  'Account Settings': (path, search) => path === '/account/settings' && !search,
  'Onboarding': (path) => path === '/onboarding',
  'My Profile': (path, search, username) =>
    username ? path === `/${username}` && (search.includes('tab=playground') || !search.includes('tab=')) : false,
  'Your Thrive Circle': (path) => path === '/thrive-circle',
  'Perks': (path) => path === '/perks',
  'Marketplace': (path) => path === '/marketplace',
  'Tool Directory': (path) => path === '/tools',
};

// Timing constants
export const TIMING = {
  SCROLL_DELAY_OPEN: 150,
  SCROLL_DELAY_ALREADY_OPEN: 50,
  COMING_SOON_DURATION: 3000,
} as const;

// Export tools icon
export const TOOLS_ICON = faWrench;
