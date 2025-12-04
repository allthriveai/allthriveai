import {
  faCompass,
  faGamepad,
  faGraduationCap,
  faUsers,
  faUser,
  faLifeRing,
  faWrench,
  faTrophy,
  faBrain,
  faUserGroup,
  faGift,
  faCalendar,
  faComments,
  faBug,
  faInfoCircle,
  faHeart,
  faWandSparkles,
  faDollarSign,
  faIdCard,
  faFolderOpen,
  faCog,
  faPuzzlePiece,
  faTicket,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export interface MenuItem {
  label: string;
  path?: string; // Internal path for routing
  external?: boolean; // External URL
  onClick?: () => void;
  subItems?: MenuItem[];
  icon?: IconDefinition;
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
      { label: "This Week's Challenge", path: '#', icon: faTrophy },
      { label: 'Side Quests', path: '/play/side-quests', icon: faGamepad },
      { label: 'Prompt Battle', path: '/play/prompt-battle', icon: faTrophy },
      { label: 'Quizzes', path: '/quick-quizzes', icon: faBrain },
    ],
  },
  {
    title: 'LEARN',
    icon: faGraduationCap,
    path: '/learn',
    items: [
      { label: 'Learning Paths', path: '#', icon: faGraduationCap },
      { label: 'Quizzes', path: '/quick-quizzes', icon: faBrain },
      { label: 'Mentorship Program', path: '#', icon: faUsers },
      { label: 'Tool Directory', path: '/tools', icon: faWrench },
    ],
  },
  {
    title: 'MEMBERSHIP',
    icon: faUsers,
    path: '/thrive-circle',
    items: [
      { label: 'Your Thrive Circle', path: '/thrive-circle', icon: faUserGroup },
      { label: 'Perks', path: '#', icon: faGift },
      { label: 'Events Calendar', onClick: () => onMenuClick('Events Calendar'), icon: faCalendar },
    ],
  },
  {
    title: 'SUPPORT',
    icon: faLifeRing,
    onClick: () => onMenuClick('Chat'),
    items: [
      { label: 'Chat', onClick: () => onMenuClick('Chat'), icon: faComments },
      { label: 'Report an Issue', path: 'https://github.com/allthriveai/allthriveai/issues', external: true, icon: faBug },
      {
        label: 'About All Thrive',
        onClick: () => onMenuClick('About Us'),
        icon: faInfoCircle,
        subItems: [
          { label: 'About Us', onClick: () => onMenuClick('About Us'), icon: faInfoCircle },
          { label: 'Our Values', onClick: () => onMenuClick('Our Values'), icon: faHeart },
          { label: 'Whats New', path: '#', icon: faWandSparkles },
        ]
      },
      { label: 'Pricing', path: '/pricing', icon: faDollarSign },
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
        icon: faIdCard,
      },
      {
        label: 'Activity & Points',
        path: username ? `/${username}?tab=activity` : '#',
        icon: faTrophy,
      },
      { label: 'My Account', path: '/account/settings', icon: faCog },
      { label: 'Chrome Extension', path: '#', icon: faPuzzlePiece },
      { label: 'My Referral Codes', path: '/account/settings/referrals', icon: faTicket },
    ],
  },
];

// Route patterns for active state detection
export const ROUTE_PATTERNS: Record<string, (path: string, search: string, username?: string) => boolean> = {
  'EXPLORE': (path) => path === '/explore',
  'LEARN': (path) => path === '/learn',
  'Quizzes': (path) => path === '/quick-quizzes',
  'Side Quests': (path) => path === '/play/side-quests',
  'Prompt Battle': (path) => path === '/play/prompt-battle',
  'Chat': (_, search) => search.includes('chat='),
  'My Account': (path, search) => path === '/account/settings' && !search,
  'My Referral Codes': (path) => path === '/account/settings/referrals',
  'My Profile': (path, search, username) =>
    username ? path === `/${username}` && (search.includes('tab=showcase') || !search.includes('tab=')) : false,
  'Activity & Points': (path, search, username) =>
    username ? path === `/${username}` && search.includes('tab=activity') : false,
  'Your Thrive Circle': (path) => path === '/thrive-circle',
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
