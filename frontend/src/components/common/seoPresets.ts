/**
 * Preset configurations for common SEO patterns
 * Separated from SEO.tsx to maintain Fast Refresh compatibility
 */

export const SEOPresets = {
  home: {
    title: 'All Thrive - A Community for AI Creators',
    description: 'Join our community of AI creators. Showcase your projects, learn from others, and level up your skills through gamified challenges.',
    keywords: 'AI community, AI creators, share AI work, prompt battles, AI challenges, learn AI, AI showcase, AI builders, level up',
  },
  about: {
    title: 'About All Thrive',
    description: 'Join our community of AI creators. Showcase your projects, learn from others, and level up your skills through gamified challenges.',
    keywords: 'about allthrive, AI platform, AI creators, AI community, learn AI, prompt battles',
  },
  explore: {
    title: 'Explore AI Creations',
    description: 'Discover AI-generated images, apps, agents, and more from the community. Browse creations made with Midjourney, Replit, Claude, and every AI tool.',
    keywords: 'explore AI, AI creations, AI projects, Midjourney gallery, Replit projects, AI showcase, discover AI',
  },
  learn: {
    title: 'Learn AI & Machine Learning',
    description: 'Level up your AI skills through gamified learning challenges. Interactive courses, coding exercises, and achievements in deep learning, NLP, computer vision, and more.',
    keywords: 'learn AI, machine learning courses, AI challenges, gamified learning, coding exercises, AI education',
  },
  tools: {
    title: 'AI Tools Directory',
    description: 'Browse the comprehensive directory of AI tools, frameworks, and libraries. Find the right tools for your ML projects with reviews and comparisons.',
    keywords: 'AI tools, machine learning frameworks, ML libraries, AI tool directory, developer tools',
  },
  dashboard: {
    title: 'Dashboard',
    description: 'Your All Thrive AI dashboard - manage projects, track progress, and view achievements.',
    noindex: true,
  },
  profile: (username: string) => ({
    title: `${username} - All Thrive AI Profile`,
    description: `View ${username}'s AI project portfolio, achievements, and contributions on All Thrive AI.`,
    keywords: `${username}, AI portfolio, developer profile, AI projects`,
  }),
  project: (projectName: string) => ({
    title: projectName,
    description: `${projectName} - AI project showcase on All Thrive AI`,
    keywords: 'AI project, machine learning, project showcase',
    type: 'article',
  }),
};
