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
  faWandSparkles,
  faIdCard,
  faCog,
  faStore,
  faCouch,
  faHandHoldingHeart,
  faQuestion,
  faComments,
  faPaintBrush,
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

/**
 * AI Collective flat navigation items
 * [Ava Logo] | Ask | Offer | Chat | Create | [Avatar]
 */
export interface FlatNavItem {
  label: string;
  path: string;
  icon?: IconDefinition;
}

/**
 * Get flat navigation items for the new AI Collective nav
 * All paths go to # for now until pages are built
 */
export const getFlatNavItems = (): FlatNavItem[] => [
  { label: 'Ask', path: '#', icon: faQuestion },
  { label: 'Offer', path: '#', icon: faHandHoldingHeart },
  { label: 'Chat', path: '#', icon: faComments },
  { label: 'Create', path: '#', icon: faPaintBrush },
];

/**
 * Avatar dropdown menu items
 */
export const getAvatarMenuItems = (username?: string): MenuItem[] => [
  {
    label: 'My Profile',
    path: username ? `/${username}` : '#',
    icon: faIdCard,
  },
  {
    label: 'My Asks',
    path: '#',
    icon: faQuestion,
  },
  {
    label: 'My Offers',
    path: '#',
    icon: faHandHoldingHeart,
  },
  {
    label: 'My Learning',
    path: '#',
    icon: faGraduationCap,
  },
  {
    label: 'Settings',
    path: '/account/settings',
    icon: faCog,
  },
];

/**
 * PHASE_1: Legacy section-based menu (kept for MobileMenu compatibility)
 * Will be refactored when mobile nav is updated
 */
export const getMenuSections = (
  _onMenuClick: (item: string) => void,
  username?: string
): MenuSection[] => [
  // Flat nav items as a section for mobile menu
  {
    title: 'BROWSE',
    icon: faCompass,
    path: '#',
    items: [
      { label: 'Ask', path: '#', icon: faQuestion },
      { label: 'Offer', path: '#', icon: faHandHoldingHeart },
    ],
  },
  {
    title: 'CONNECT',
    icon: faUsers,
    path: '#',
    items: [
      { label: 'Chat', path: '#', icon: faComments },
    ],
  },
  {
    title: 'CREATE',
    icon: faPaintBrush,
    path: '#',
    items: [
      { label: 'Create', path: '#', icon: faPaintBrush },
    ],
  },
  // PHASE_1: [KEEP] Account section - core user functionality
  {
    title: 'ACCOUNT',
    icon: faUser,
    path: username ? `/${username}` : '#',
    items: [
      {
        label: 'My Profile',
        path: username ? `/${username}` : '#',
        icon: faIdCard,
      },
      { label: 'My Asks', path: '#', icon: faQuestion },
      { label: 'My Offers', path: '#', icon: faHandHoldingHeart },
      { label: 'My Learning', path: '#', icon: faGraduationCap },
      { label: 'Settings', path: '/account/settings', icon: faCog },
    ],
  },
];

/**
 * PHASE_1: [HIDDEN] Full legacy menu sections
 * Kept here for reference during Phase 1 - delete in Phase 3
 */
export const _LEGACY_MENU_SECTIONS = (
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
      { label: 'Marketplace', path: '#', icon: faStore },
    ],
  },
  {
    title: 'LEARN',
    icon: faGraduationCap,
    path: '/learn',
    items: [
      { label: 'Learning Paths', path: '/learn', icon: faGraduationCap },
      { label: 'Quizzes', path: '/quizzes', icon: faBrain },
    ],
  },
  {
    title: 'PLAY',
    icon: faGamepad,
    path: '/play/games',
    items: [
      { label: "This Week's Challenge", path: '/challenges', icon: faTrophy },
      { label: 'Games', path: '/play/games', icon: faGamepad },
      { label: 'Prompt Battle', path: '/play/prompt-battle', icon: faTrophy, className: 'text-pink-500 dark:text-pink-400' },
    ],
  },
  {
    title: 'CONNECT',
    icon: faUsers,
    path: '/thrive-circle',
    items: [
      { label: 'Your Thrive Circle', path: '/thrive-circle', icon: faUserGroup },
      { label: 'The Lounge', path: '/lounge', icon: faCouch },
      { label: 'Browse Members', path: '/explore?tab=profiles', icon: faUsers },
      { label: 'Events Calendar', onClick: () => onMenuClick('Events Calendar'), icon: faCalendar },
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
      { label: 'Membership Perks', path: '/perks', icon: faGift },
      { label: 'Account Settings', path: '/account/settings', icon: faCog },
      { label: 'Onboarding', path: '/onboarding', icon: faWandSparkles },
    ],
  },
];

// Route patterns for active state detection
export const ROUTE_PATTERNS: Record<string, (path: string, search: string, username?: string) => boolean> = {
  'DISCOVER': (path) => path === '/explore',
  'LEARN': (path) => path === '/learn' || path.startsWith('/learn/') || path === '/quizzes' || path.startsWith('/quizzes/'),
  'Quizzes': (path) => path === '/quizzes' || path.startsWith('/quizzes/'),
  "This Week's Challenge": (path) => path === '/challenges' || path.startsWith('/challenges/') || path === '/this-weeks-challenge',
  'Games': (path) => path === '/play/games',
  'Prompt Battle': (path) => path === '/play/prompt-battle',
  'Account Settings': (path, search) => path === '/account/settings' && !search,
  'Onboarding': (path) => path === '/onboarding',
  'My Profile': (path, search, username) =>
    username ? path === `/${username}` && (search.includes('tab=playground') || !search.includes('tab=')) : false,
  'Your Thrive Circle': (path) => path === '/thrive-circle',
  'The Lounge': (path) => path === '/lounge' || path.startsWith('/lounge/'),
  'Browse Members': (path, search) => path === '/explore' && search.includes('tab=profiles'),
  'My Messages': (path) => path === '/messages' || path.startsWith('/messages/'),
  'Membership Perks': (path) => path === '/perks',
  'Tool Directory': (path) => path === '/tools',
  'Learning Paths': (path) => path === '/learn' || path.startsWith('/learn/'),
};

// Timing constants
export const TIMING = {
  SCROLL_DELAY_OPEN: 150,
  SCROLL_DELAY_ALREADY_OPEN: 50,
  COMING_SOON_DURATION: 3000,
} as const;

// Export tools icon
export const TOOLS_ICON = faWrench;
