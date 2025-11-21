import {
  faCompass,
  faGamepad,
  faGraduationCap,
  faCrown,
  faUser,
  faLifeRing,
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
}

export const getMenuSections = (
  onMenuClick: (item: string) => void,
  username?: string
): MenuSection[] => [
  {
    title: 'EXPLORE',
    icon: faCompass,
    items: [
      { label: 'For You', path: '#' },
      { label: 'Trending', path: '#' },
      { label: 'By Topics', path: '#' },
      { label: 'By Tools', path: '#' },
      { label: 'Top Profiles', path: '#' },
    ],
  },
  {
    title: 'PLAY',
    icon: faGamepad,
    items: [
      { label: 'Leaderboards', path: '#' },
      { label: 'Vote', path: '#' },
      { label: "This Week's Challenge", path: '#' },
      { label: 'Side Quests', path: '#' },
      { label: 'Prompt Battle', path: '/play/prompt-battle' },
    ],
  },
  {
    title: 'LEARN',
    icon: faGraduationCap,
    items: [
      { label: 'Learning Paths', path: '#' },
      { label: 'Quick Quizzes', path: '/quick-quizzes' },
      { label: 'Mentorship Program', path: '#' },
    ],
  },
  {
    title: 'MEMBERSHIP',
    icon: faCrown,
    items: [
      { label: 'Perks', path: '#' },
      { label: 'Events Calendar', onClick: () => onMenuClick('Events Calendar') },
    ],
  },
  {
    title: 'SUPPORT',
    icon: faLifeRing,
    items: [
      { label: 'Report an Issue', path: 'https://github.com/allthriveai/allthriveai/issues', external: true },
      { label: 'Chat', onClick: () => onMenuClick('Chat') },
      { label: 'Whats New', path: '#' },
      {
        label: 'About All Thrive',
        subItems: [
          { label: 'About Us', onClick: () => onMenuClick('About Us') },
          { label: 'Our Values', onClick: () => onMenuClick('Our Values') },
        ]
      },
      { label: 'Pricing', path: '#' },
    ],
  },
  {
    title: 'ACCOUNT',
    icon: faUser,
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
  'Quick Quizzes': (path) => path === '/quick-quizzes',
  'Prompt Battle': (path) => path === '/play/prompt-battle',
  'Chat': (_, search) => search.includes('chat='),
  'My Account': (path, search) => path === '/account/settings' && !search,
  'My Referral Codes': (path) => path === '/account/settings/referrals',
  'My Profile': (path, search, username) =>
    username ? path === `/${username}` && (search.includes('tab=showcase') || !search.includes('tab=')) : false,
  'My Projects': (path, search, username) =>
    username ? path === `/${username}` && search.includes('tab=playground') : false,
};

// Timing constants
export const TIMING = {
  SCROLL_DELAY_OPEN: 150,
  SCROLL_DELAY_ALREADY_OPEN: 50,
  COMING_SOON_DURATION: 3000,
} as const;
