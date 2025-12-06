import type { Project } from '@/types/models';

// Mock projects for the explore preview section
export const mockProjects: Partial<Project>[] = [
  {
    id: 1,
    title: 'AI-Powered Code Assistant',
    slug: 'ai-code-assistant',
    description: 'A VSCode extension that uses GPT-4 to help you write better code faster',
    username: 'techbuilder',
    featuredImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=400&fit=crop',
    heartCount: 342,
    isLikedByUser: false,
    content: {
      tags: ['VSCode', 'GPT-4', 'Productivity'],
      heroDisplayMode: 'image' as const,
    },
    toolsDetails: [
      { id: 1, name: 'OpenAI', slug: 'openai', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', category: 'llm' },
    ],
  },
  {
    id: 2,
    title: 'Neural Style Transfer App',
    slug: 'neural-style-transfer',
    description: 'Transform your photos into artistic masterpieces using neural networks',
    username: 'artcreator',
    heartCount: 256,
    isLikedByUser: true,
    content: {
      tags: ['Art', 'Neural Networks', 'Creative'],
      heroDisplayMode: 'gradient' as const,
      heroGradientFrom: '#6366f1',
      heroGradientTo: '#ec4899',
      heroQuote: 'Transform Reality into Art',
    },
    toolsDetails: [
      { id: 2, name: 'Stable Diffusion', slug: 'stable-diffusion', logoUrl: '', category: 'image' },
    ],
  },
  {
    id: 3,
    title: 'Conversational AI Chatbot',
    slug: 'conversational-chatbot',
    description: 'A multi-modal chatbot that can understand text, images, and voice',
    username: 'aiexplorer',
    featuredImageUrl: 'https://images.unsplash.com/photo-1676299081847-824916de030a?w=600&h=400&fit=crop',
    heartCount: 189,
    isLikedByUser: false,
    content: {
      tags: ['Chatbot', 'Multi-modal', 'NLP'],
      heroDisplayMode: 'image' as const,
    },
    toolsDetails: [
      { id: 3, name: 'Claude', slug: 'claude', logoUrl: '', category: 'llm' },
    ],
  },
  {
    id: 4,
    title: 'AI Music Composer',
    slug: 'ai-music-composer',
    description: 'Generate original music compositions using machine learning',
    username: 'soundwave',
    heartCount: 423,
    isLikedByUser: false,
    content: {
      tags: ['Music', 'Generation', 'Creative'],
      heroDisplayMode: 'quote' as const,
      heroQuote: 'Where AI Meets Melody',
      heroGradientFrom: '#22d3ee',
      heroGradientTo: '#4ade80',
    },
    toolsDetails: [
      { id: 4, name: 'Suno', slug: 'suno', logoUrl: '', category: 'audio' },
    ],
  },
  {
    id: 5,
    title: 'Smart Document Analyzer',
    slug: 'smart-document-analyzer',
    description: 'Extract insights and summaries from documents using AI',
    username: 'datawhiz',
    featuredImageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop',
    heartCount: 178,
    isLikedByUser: false,
    content: {
      tags: ['Documents', 'Analysis', 'Productivity'],
      heroDisplayMode: 'image' as const,
    },
    toolsDetails: [
      { id: 5, name: 'LangChain', slug: 'langchain', logoUrl: '', category: 'framework' },
    ],
  },
  {
    id: 6,
    title: 'AI Video Editor',
    slug: 'ai-video-editor',
    description: 'Automate video editing with intelligent scene detection and transitions',
    username: 'videocreator',
    heartCount: 567,
    isLikedByUser: true,
    content: {
      tags: ['Video', 'Editing', 'Automation'],
      heroDisplayMode: 'gradient' as const,
      heroGradientFrom: '#f43f5e',
      heroGradientTo: '#f97316',
      heroQuote: 'Edit Smarter, Not Harder',
    },
    toolsDetails: [
      { id: 6, name: 'Runway', slug: 'runway', logoUrl: '', category: 'video' },
    ],
  },
];

// Feature content for sticky scroll reveal
export const featureContent = [
  {
    id: 'showcase',
    title: 'Showcase Your AI Creations',
    description:
      'Build your portfolio with AI-powered projects. Share your work with the community, get feedback, and inspire others. Connect your GitHub to automatically import your best projects.',
    badge: 'Project Showcase',
    color: 'cyan',
  },
  {
    id: 'learn',
    title: 'Learn Through Doing',
    description:
      'Interactive quizzes and learning paths designed for AI enthusiasts. Test your knowledge on topics from prompt engineering to machine learning fundamentals.',
    badge: 'Quizzes',
    color: 'purple',
  },
  {
    id: 'quests',
    title: 'Earn While You Learn',
    description:
      'Complete side quests to earn Points and level up your profile. Unlock achievements, climb the leaderboard, and track your progress through gamified challenges.',
    badge: 'Side Quests',
    color: 'green',
  },
  {
    id: 'community',
    title: 'Join the Thrive Circle',
    description:
      'Connect with fellow AI builders, share feedback, and grow together. Progress through tiers from Seedling to Evergreen as you contribute to the community.',
    badge: 'Community',
    color: 'pink',
  },
];

// Learning modalities for gamified learning section
export const mockSideQuests = [
  {
    id: 'modality-1',
    title: 'Interactive Courses',
    description: 'Structured lessons with hands-on exercises, quizzes, and real-world projects',
    pointsReward: 500,
    difficulty: 'beginner' as const,
    icon: 'academic-cap',
    category: '15+ courses',
  },
  {
    id: 'modality-2',
    title: 'Side Quests',
    description: 'Creative challenges that let you practice skills and build your portfolio',
    pointsReward: 100,
    difficulty: 'intermediate' as const,
    icon: 'quest',
    category: '50+ quests',
  },
  {
    id: 'modality-3',
    title: 'Prompt Battles',
    description: 'Compete against other creators in timed prompt challenges and earn rankings',
    pointsReward: 250,
    difficulty: 'advanced' as const,
    icon: 'battle',
    category: 'Weekly events',
  },
];

// Profile automation steps
export const profileSteps = [
  {
    id: 1,
    title: 'Chat to\nCreate',
    description: 'Describe, scrape, or automate with 10+ integrations',
    icon: 'chat',
  },
  {
    id: 2,
    title: 'AI\nAnalysis',
    description: 'Our AI analyzes your content and detects AI tools used',
    icon: 'sparkles',
  },
  {
    id: 3,
    title: 'Auto\nGenerate',
    description: 'Descriptions, tags, and metadata are created for you',
    icon: 'document-text',
  },
  {
    id: 4,
    title: 'Portfolio\nReady',
    description: 'Your AI portfolio is ready to showcase',
    icon: 'check-circle',
  },
];

// Thrive circle tiers for display
export const thriveTiers = [
  { name: 'Seedling', points: '0-499', color: 'from-emerald-400 to-green-500' },
  { name: 'Sprout', points: '500-999', color: 'from-green-400 to-teal-500' },
  { name: 'Blossom', points: '1,000-2,499', color: 'from-pink-400 to-rose-500' },
  { name: 'Bloom', points: '2,500-4,999', color: 'from-purple-400 to-violet-500' },
  { name: 'Evergreen', points: '5,000+', color: 'from-cyan-400 to-teal-500' },
];
