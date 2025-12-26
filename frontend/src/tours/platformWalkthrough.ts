/**
 * Platform Walkthrough Tour Definition
 *
 * A guided tour of All Thrive's main features, led by Ava the AI guide.
 * This tour navigates users to actual pages with modal overlays explaining each feature.
 */

import type { TourDefinition } from './types';

/**
 * The main platform walkthrough tour.
 * Covers: Profile, Projects, Explore, Battles, AI Chat, Quest Board
 */
export const platformWalkthroughTour: TourDefinition = {
  id: 'platform_walkthrough',
  title: 'Platform Tour',
  description: 'Let Ava show you around All Thrive.',
  completionPoints: 100,
  // NOTE: targetPath means "where to navigate AFTER this step" (when clicking Next)
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to the Tour!',
      targetPath: '/:username', // After welcome, go to profile
      dialogue: [
        "Hey there, adventurer! Ready to explore All Thrive?",
        "I'll show you all the coolest features. Let's go!",
      ],
      features: [
        'Quick tour of the main features',
        'Learn how to showcase your AI projects',
        'Discover the community',
      ],
      icon: 'faDragon',
      gradient: 'from-orange-500 to-amber-500',
    },
    {
      id: 'profile',
      title: 'Your Profile',
      // No targetPath - stays on profile for next step (projects)
      dialogue: [
        "This is your profile - your AI portfolio home base!",
        "Showcase your projects, skills, and what you're passionate about.",
      ],
      features: [
        'Add a bio and profile picture',
        'Display your AI projects',
        'Share your interests and expertise',
      ],
      icon: 'faUser',
      gradient: 'from-cyan-500 to-teal-500',
    },
    {
      id: 'projects',
      title: 'Projects',
      targetPath: '/explore', // After projects, go to explore
      dialogue: [
        "Projects are the heart of All Thrive!",
        "Add projects from GitHub, Figma, or create them with AI assistance.",
      ],
      features: [
        'Import from GitHub or Figma',
        'Use AI to generate project descriptions',
        'Showcase your best work',
      ],
      icon: 'faRocket',
      gradient: 'from-violet-500 to-purple-500',
    },
    {
      id: 'explore',
      title: 'Explore',
      targetPath: '/play/prompt-battles', // After explore, go to battles
      dialogue: [
        "The Explore page is where the magic happens!",
        "Discover amazing projects, AI tools, and talented members.",
      ],
      features: [
        'Browse trending projects',
        'Find AI tools and resources',
        'Connect with other members',
      ],
      icon: 'faCompass',
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      id: 'battles',
      title: 'Prompt Battles',
      // No targetPath - stays on battles for next step (ai-chat)
      dialogue: [
        "This is one of my favorites - Prompt Battles!",
        "Compete against others to craft the best AI prompts. It's fun and you'll learn a lot!",
      ],
      features: [
        'Test your prompting skills',
        'Compete with the community',
        'Learn from other approaches',
      ],
      icon: 'faGamepad',
      gradient: 'from-pink-500 to-rose-500',
    },
    {
      id: 'ai-chat',
      title: 'AI Assistant',
      targetPath: '/onboarding', // After ai-chat, go to quest board
      dialogue: [
        "Need help? I'm always here for you!",
        "Use the AI chat to get help creating projects, answering questions, or just chatting.",
      ],
      features: [
        'Get help with projects',
        'Ask questions anytime',
        'AI-powered assistance',
      ],
      icon: 'faComments',
      gradient: 'from-cyan-500 to-blue-500',
    },
    {
      id: 'quest-board',
      title: 'Quest Board',
      // No targetPath - stays for completion step
      dialogue: [
        "The Quest Board shows all the adventures waiting for you!",
        "Complete quests to earn points and level up your profile.",
      ],
      features: [
        'Track your progress',
        'Discover new features',
        'Earn points and rewards',
      ],
      icon: 'faScroll',
      gradient: 'from-emerald-500 to-green-500',
    },
    {
      id: 'complete',
      title: "You're Ready!",
      // No targetPath - tour ends here
      dialogue: [
        "That's the tour! You're officially ready to start thriving.",
        "Remember, I'm always here if you need help. Now go create something amazing!",
      ],
      features: [
        'Explore at your own pace',
        'Start adding projects',
        'Join the community',
      ],
      icon: 'faStar',
      gradient: 'from-amber-400 to-yellow-500',
    },
  ],
};
