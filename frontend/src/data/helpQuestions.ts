/**
 * Help Questions & Answers
 *
 * Precanned help content for the Ask for Help feature in the AI chat.
 * These questions are rooted in actual application features and capabilities.
 */

export interface HelpQuestion {
  id: string;
  question: string;
  category: HelpCategory;
  /** The message that will be sent to the AI agent when this question is clicked */
  chatMessage: string;
  /** Keywords for search/filtering */
  keywords?: string[];
}

export type HelpCategory =
  | 'getting-started'
  | 'projects'
  | 'integrations'
  | 'content-creation'
  | 'tools'
  | 'settings';

export interface HelpCategoryInfo {
  id: HelpCategory;
  title: string;
  icon: string;
  description: string;
}

export const HELP_CATEGORIES: HelpCategoryInfo[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🚀',
    description: 'New to All Thrive? Start here',
  },
  {
    id: 'projects',
    title: 'Projects & Portfolio',
    icon: '📊',
    description: 'Managing and showcasing your work',
  },
  {
    id: 'integrations',
    title: 'Integrations',
    icon: '🔗',
    description: 'Connecting platforms and auto-sync',
  },
  {
    id: 'content-creation',
    title: 'Content Creation',
    icon: '🎨',
    description: 'Creating visuals and media',
  },
  {
    id: 'tools',
    title: 'AI Tools',
    icon: '🔧',
    description: 'Find and explore AI tools',
  },
  {
    id: 'settings',
    title: 'Settings & Account',
    icon: '⚙️',
    description: 'Your profile and preferences',
  },
];

export const HELP_QUESTIONS: HelpQuestion[] = [
  // Getting Started
  {
    id: 'add-first-project',
    question: 'How do I add my first project?',
    category: 'getting-started',
    chatMessage: 'I want to add my first project to my portfolio. Can you guide me through the process?',
    keywords: ['first', 'start', 'begin', 'new', 'initial', 'project', 'add'],
  },
  {
    id: 'what-are-ai-agents',
    question: 'What are AI agents and how do they help me?',
    category: 'getting-started',
    chatMessage: 'What are AI agents in All Thrive and how can they help me build my portfolio?',
    keywords: ['ai', 'agents', 'assistant', 'help', 'what', 'explain'],
  },
  {
    id: 'connect-github',
    question: 'How do I connect my GitHub account?',
    category: 'getting-started',
    chatMessage: 'How do I connect my GitHub account to import my repositories?',
    keywords: ['github', 'connect', 'oauth', 'link', 'account'],
  },
  {
    id: 'connect-youtube',
    question: 'How do I connect my YouTube channel?',
    category: 'getting-started',
    chatMessage: 'How do I connect my YouTube channel to sync my videos?',
    keywords: ['youtube', 'video', 'connect', 'channel', 'google'],
  },

  // Projects & Portfolio
  {
    id: 'import-github-repo',
    question: 'How do I import a GitHub repository?',
    category: 'projects',
    chatMessage: 'I want to import one of my GitHub repositories as a project. How do I do that?',
    keywords: ['github', 'repository', 'import', 'repo', 'code'],
  },
  {
    id: 'import-youtube-videos',
    question: 'How do I import YouTube videos?',
    category: 'projects',
    chatMessage: 'How can I import my YouTube videos to my portfolio?',
    keywords: ['youtube', 'video', 'import', 'content'],
  },
  {
    id: 'create-manual-project',
    question: 'How do I create a project manually?',
    category: 'projects',
    chatMessage: 'I want to create a project from scratch without importing. How do I do that?',
    keywords: ['create', 'manual', 'project', 'new', 'scratch', 'custom'],
  },
  {
    id: 'featured-image',
    question: 'How do I set a featured image for my project?',
    category: 'projects',
    chatMessage: 'How do I add or change the featured image for one of my projects?',
    keywords: ['featured', 'image', 'thumbnail', 'picture', 'cover'],
  },
  {
    id: 'organize-projects',
    question: 'How do I organize and manage my projects?',
    category: 'projects',
    chatMessage: 'How can I organize, edit, and manage my existing projects?',
    keywords: ['organize', 'manage', 'edit', 'delete', 'arrange'],
  },
  {
    id: 'project-visibility',
    question: 'How do I control who sees my projects?',
    category: 'projects',
    chatMessage: 'How can I control the visibility and privacy of my projects?',
    keywords: ['privacy', 'visibility', 'public', 'private', 'showcase'],
  },

  // Integrations
  {
    id: 'available-platforms',
    question: 'What platforms can I connect?',
    category: 'integrations',
    chatMessage: 'What platforms and services can I integrate with All Thrive?',
    keywords: ['platforms', 'integrations', 'connect', 'available', 'services'],
  },
  {
    id: 'youtube-auto-sync',
    question: 'How does auto-sync work for YouTube?',
    category: 'integrations',
    chatMessage: 'How does the automatic sync feature work for YouTube videos?',
    keywords: ['youtube', 'auto', 'sync', 'automatic', 'upload'],
  },
  {
    id: 'disconnect-integration',
    question: 'How do I disconnect an integration?',
    category: 'integrations',
    chatMessage: 'How do I disconnect or remove a connected integration?',
    keywords: ['disconnect', 'remove', 'unlink', 'integration'],
  },
  {
    id: 'reconnect-youtube',
    question: 'Why do I need to reconnect YouTube?',
    category: 'integrations',
    chatMessage: 'Why am I being asked to reconnect my YouTube account?',
    keywords: ['reconnect', 'youtube', 'permissions', 'access'],
  },
  {
    id: 'manual-sync',
    question: 'How do I manually sync my connected accounts?',
    category: 'integrations',
    chatMessage: 'How can I manually trigger a sync for my connected platforms?',
    keywords: ['manual', 'sync', 'refresh', 'update'],
  },

  // Content Creation
  {
    id: 'nano-banana',
    question: 'How do I create images with Nano Banana?',
    category: 'content-creation',
    chatMessage: 'Tell me about Nano Banana and how I can use it to create images.',
    keywords: ['nano', 'banana', 'image', 'create', 'ai', 'generate'],
  },
  {
    id: 'generate-infographics',
    question: 'How do I generate infographics and diagrams?',
    category: 'content-creation',
    chatMessage: 'How can I create infographics, diagrams, or technical visuals for my projects?',
    keywords: ['infographic', 'diagram', 'visual', 'flowchart', 'generate'],
  },
  {
    id: 'ai-capabilities',
    question: 'What can I ask the AI agents to create?',
    category: 'content-creation',
    chatMessage: 'What types of content and assets can the AI agents help me create?',
    keywords: ['ai', 'create', 'generate', 'capabilities', 'what'],
  },
  {
    id: 'image-to-project',
    question: 'How do I turn a generated image into a project?',
    category: 'content-creation',
    chatMessage: 'Can I create a project directly from an image I generated with Nano Banana?',
    keywords: ['image', 'project', 'convert', 'nano banana', 'generated'],
  },

  // AI Tools
  {
    id: 'find-ai-tool',
    question: 'Help me find the right AI tool',
    category: 'tools',
    chatMessage: 'I need help finding the perfect AI tool for my needs. Can you ask me some questions to recommend the best tools?',
    keywords: ['find', 'recommend', 'tool', 'ai', 'which', 'best', 'help'],
  },
  {
    id: 'tool-recommendation-quiz',
    question: 'Take the Tool Finder Quiz',
    category: 'tools',
    chatMessage: 'I want to take the tool recommendation quiz to find the best AI tools for me.',
    keywords: ['quiz', 'tool', 'finder', 'recommendation', 'test'],
  },
  {
    id: 'explore-tools',
    question: 'What AI tools are available?',
    category: 'tools',
    chatMessage: 'What AI tools are available in the directory? Can you show me some popular options?',
    keywords: ['explore', 'browse', 'available', 'tools', 'directory', 'list'],
  },
  {
    id: 'compare-tools',
    question: 'How do I compare AI tools?',
    category: 'tools',
    chatMessage: 'How can I compare different AI tools to decide which one is best for my needs?',
    keywords: ['compare', 'comparison', 'difference', 'vs', 'versus'],
  },

  // Settings & Account
  {
    id: 'profile-settings',
    question: 'How do I change my profile settings?',
    category: 'settings',
    chatMessage: 'How do I update my profile information and settings?',
    keywords: ['profile', 'settings', 'edit', 'change', 'account'],
  },
  {
    id: 'manage-connections',
    question: 'How do I manage my connected accounts?',
    category: 'settings',
    chatMessage: 'Where can I see and manage all my connected integrations?',
    keywords: ['manage', 'connected', 'accounts', 'integrations', 'view'],
  },
  {
    id: 'personalize-experience',
    question: 'How do I personalize my All Thrive experience?',
    category: 'settings',
    chatMessage: 'What customization options are available to personalize my All Thrive experience?',
    keywords: ['personalize', 'customize', 'preferences', 'settings'],
  },
  {
    id: 'portfolio-url',
    question: 'How do I share my portfolio with others?',
    category: 'settings',
    chatMessage: 'How can I share my portfolio URL and what will others see?',
    keywords: ['share', 'url', 'portfolio', 'link', 'public'],
  },
];

/**
 * Get help questions by category
 */
export function getQuestionsByCategory(category: HelpCategory): HelpQuestion[] {
  return HELP_QUESTIONS.filter(q => q.category === category);
}

/**
 * Search help questions by keyword
 */
export function searchHelpQuestions(query: string): HelpQuestion[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return HELP_QUESTIONS;

  return HELP_QUESTIONS.filter(q => {
    // Search in question text
    if (q.question.toLowerCase().includes(lowerQuery)) return true;

    // Search in keywords
    if (q.keywords?.some(keyword => keyword.toLowerCase().includes(lowerQuery))) return true;

    return false;
  });
}

/**
 * Get featured/popular questions (first 6 across categories)
 */
export function getFeaturedQuestions(): HelpQuestion[] {
  return [
    HELP_QUESTIONS.find(q => q.id === 'find-ai-tool')!,
    HELP_QUESTIONS.find(q => q.id === 'add-first-project')!,
    HELP_QUESTIONS.find(q => q.id === 'import-github-repo')!,
    HELP_QUESTIONS.find(q => q.id === 'nano-banana')!,
    HELP_QUESTIONS.find(q => q.id === 'available-platforms')!,
    HELP_QUESTIONS.find(q => q.id === 'what-are-ai-agents')!,
  ];
}
