export type TopicSlug =
  | 'chatbots-conversation'
  | 'websites-apps'
  | 'images-design-branding'
  | 'video-creative-media'
  | 'podcasts-education'
  | 'games-interactive'
  | 'workflows-automation'
  | 'productivity'
  | 'developer-coding'
  | 'prompts-templates'
  | 'thought-experiments'
  | 'wellness-growth'
  | 'ai-agents-multitool'
  | 'ai-models-research'
  | 'data-analytics';

export interface Topic {
  slug: TopicSlug;
  label: string;
  description: string;
  color: string; // hex or Tailwind class name
}

export const TOPICS: Topic[] = [
  {
    slug: 'chatbots-conversation',
    label: 'Chatbots & Conversation Projects',
    description: 'Chat and text-based experiences: Q&A bots, conversational guides, coaching/mentor bots.',
    color: 'blue',
  },
  {
    slug: 'websites-apps',
    label: 'Websites & Apps Built with AI',
    description: 'Sites and apps where AI helps power the experience: landing pages, tools, dashboards.',
    color: 'cyan',
  },
  {
    slug: 'images-design-branding',
    label: 'Images, Design & Branding',
    description: 'Visual work with AI: illustrations, brand systems, social graphics, UI mockups.',
    color: 'purple',
  },
  {
    slug: 'video-creative-media',
    label: 'Video & Multimodal Media',
    description: 'AI-generated or AI-edited videos, animations, and multimodal content.',
    color: 'red',
  },
  {
    slug: 'podcasts-education',
    label: 'Podcasts & Educational Series',
    description: 'AI-related podcasts, interviews, lecture series, tutorials, and learning journeys.',
    color: 'amber',
  },
  {
    slug: 'games-interactive',
    label: 'Games & Interactive Experiences',
    description: 'Playable and interactive projects: story games, simulations, quizzes, challenges.',
    color: 'pink',
  },
  {
    slug: 'workflows-automation',
    label: 'Workflows & Automation',
    description: 'Multi-step flows: n8n/Zapier-style pipelines and "when X then Y" automations with AI.',
    color: 'indigo',
  },
  {
    slug: 'productivity',
    label: 'Productivity',
    description: 'Systems that help you get things done: task boards, planning spaces, AI-powered notes.',
    color: 'emerald',
  },
  {
    slug: 'developer-coding',
    label: 'Developer & Coding Projects',
    description: 'Code-centric work: dev tools, libraries, CLIs, coding helpers, infra projects.',
    color: 'slate',
  },
  {
    slug: 'prompts-templates',
    label: 'Prompt Collections & Templates',
    description: 'Reusable prompts and frameworks: prompt packs, templates, scripts, prompt systems.',
    color: 'teal',
  },
  {
    slug: 'thought-experiments',
    label: 'Thought Experiments & Concept Pieces',
    description: 'Creative outlets, ideas, and AI exploration.',
    color: 'fuchsia',
  },
  {
    slug: 'wellness-growth',
    label: 'Wellness & Personal Growth',
    description: 'Inner growth and projects for wellbeing.',
    color: 'lime',
  },
  {
    slug: 'ai-agents-multitool',
    label: 'AI Agents & Multi-Tool Systems',
    description: 'AI agents and systems that reason, call tools, and coordinate multi-step work.',
    color: 'violet',
  },
  {
    slug: 'ai-models-research',
    label: 'AI Models & Research',
    description: 'Custom models, fine-tuning, research, and ML experiments.',
    color: 'orange',
  },
  {
    slug: 'data-analytics',
    label: 'Data & Analytics',
    description: 'Data visualization, analytics dashboards, and insights projects.',
    color: 'yellow',
  },
];

export function getTopicBySlug(slug: TopicSlug): Topic | undefined {
  return TOPICS.find(t => t.slug === slug);
}

export function getTopicLabel(slug: TopicSlug): string {
  return getTopicBySlug(slug)?.label ?? slug;
}
