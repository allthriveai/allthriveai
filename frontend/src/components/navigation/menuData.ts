import {
  faCompass,
  faGamepad,
  faGraduationCap,
  faUsers,
  faUser,
  faLifeRing,
  faWrench,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export interface MenuItem {
  label: string;
  path?: string; // Internal path for routing
  external?: boolean; // External URL
  onClick?: () => void;
  subItems?: MenuItem[];
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
    title: 'EXPLORE',
    icon: faCompass,
    path: '/explore',
    items: [],
  },
  {
    title: 'PLAY',
    icon: faGamepad,
    path: '/play/side-quests',
    items: [
      { label: "This Week's Challenge", path: '#' },
      { label: 'Side Quests', path: '/play/side-quests' },
      { label: 'Prompt Battle', path: '/play/prompt-battle' },
    ],
  },
  {
    title: 'LEARN',
    icon: faGraduationCap,
    path: '/learn',
    items: [
      { label: 'Learning Paths', path: '#' },
      { label: 'Quick Quizzes', path: '/quick-quizzes' },
      { label: 'Mentorship Program', path: '#' },
    ],
  },
  {
    title: 'MEMBERSHIP',
    icon: faUsers,
    path: '/thrive-circle',
    items: [
      { label: 'Your Thrive Circle', path: '/thrive-circle' },
      { label: 'Perks', path: '#' },
      { label: 'Events Calendar', onClick: () => onMenuClick('Events Calendar') },
    ],
  },
  {
    title: 'SUPPORT',
    icon: faLifeRing,
    onClick: () => onMenuClick('Chat'),
    items: [
      { label: 'Report an Issue', path: 'https://github.com/allthriveai/allthriveai/issues', external: true },
      { label: 'Chat', onClick: () => onMenuClick('Chat') },
      {
        label: 'About All Thrive',
        onClick: () => onMenuClick('About Us'),
        subItems: [
          { label: 'About Us', onClick: () => onMenuClick('About Us') },
          { label: 'Our Values', onClick: () => onMenuClick('Our Values') },
          { label: 'Whats New', path: '#' },
        ]
      },
      { label: 'Pricing', path: '#' },
    ],
  },
  {
    title: 'ACCOUNT',
    icon: faUser,
    path: username ? `/${username}?tab=showcase` : '#',
    items: [
      {
        label: 'My Profile',
        path: username ? `/${username}?tab=showcase` : '#',
      },
      {
        label: 'My Projects',
        path: username ? `/${username}?tab=playground` : '#',
      },
      { label: 'My Account', path: '/account/settings' },
      { label: 'Chrome Extension', path: '#' },
      { label: 'My Referral Codes', path: '/account/settings/referrals' },
    ],
  },
];

// Route patterns for active state detection
export const ROUTE_PATTERNS: Record<string, (path: string, search: string, username?: string) => boolean> = {
  'EXPLORE': (path) => path === '/explore',
  'LEARN': (path) => path === '/learn',
  'Quick Quizzes': (path) => path === '/quick-quizzes',
  'Side Quests': (path) => path === '/play/side-quests',
  'Prompt Battle': (path) => path === '/play/prompt-battle',
  'Chat': (_, search) => search.includes('chat='),
  'My Account': (path, search) => path === '/account/settings' && !search,
  'My Referral Codes': (path) => path === '/account/settings/referrals',
  'My Profile': (path, search, username) =>
    username ? path === `/${username}` && (search.includes('tab=showcase') || !search.includes('tab=')) : false,
  'My Projects': (path, search, username) =>
    username ? path === `/${username}` && search.includes('tab=playground') : false,
  'Your Thrive Circle': (path) => path === '/thrive-circle',
  'AI Tool Directory': (path) => path === '/tools',
};

// Timing constants
export const TIMING = {
  SCROLL_DELAY_OPEN: 150,
  SCROLL_DELAY_ALREADY_OPEN: 50,
  COMING_SOON_DURATION: 3000,
} as const;

// Export tools icon for use in LeftSidebar
export const TOOLS_ICON = faWrench;
