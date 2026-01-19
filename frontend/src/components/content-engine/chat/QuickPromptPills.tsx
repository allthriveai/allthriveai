/**
 * QuickPromptPills - Contextual suggestion pills below chat
 * US-018: Quick prompt suggestions for Echo brainstorm chat
 */

import { SparklesIcon } from '@heroicons/react/24/outline';
import type { ContentPillar, Platform } from '@/types/contentEngine';

interface QuickPromptPillsProps {
  activePillar: ContentPillar | null;
  activePlatforms: Platform[];
  onPromptSelect: (prompt: string) => void;
  disabled?: boolean;
}

interface PromptSuggestion {
  id: string;
  text: string;
  prompt: string;
  pillars?: string[];
  platforms?: Platform[];
}

const defaultPrompts: PromptSuggestion[] = [
  {
    id: 'brainstorm-ideas',
    text: 'Brainstorm content ideas',
    prompt: "Let's brainstorm some content ideas. What topics are you most excited to share?",
  },
  {
    id: 'trending-topics',
    text: 'Trending topics',
    prompt: 'What are the trending topics in my niche right now that I could create content about?',
  },
  {
    id: 'hook-variations',
    text: 'Generate hooks',
    prompt: 'Help me create some attention-grabbing hooks for my next post.',
  },
  {
    id: 'repurpose-content',
    text: 'Repurpose existing content',
    prompt: 'I have existing content I want to repurpose. Can you help me adapt it for different platforms?',
  },
];

const pillarPrompts: PromptSuggestion[] = [
  {
    id: 'educational-content',
    text: 'Educational content',
    prompt: 'Help me create educational content that teaches my audience something valuable.',
    pillars: ['educational', 'how-to', 'tips'],
  },
  {
    id: 'storytelling',
    text: 'Tell a story',
    prompt: "Let's craft a compelling story that connects with my audience emotionally.",
    pillars: ['story', 'personal', 'narrative'],
  },
  {
    id: 'thought-leadership',
    text: 'Thought leadership',
    prompt: 'Help me develop thought leadership content that positions me as an expert.',
    pillars: ['thought-leadership', 'opinion', 'insights'],
  },
];

const platformPrompts: PromptSuggestion[] = [
  {
    id: 'twitter-thread',
    text: 'Thread ideas',
    prompt: 'Help me create a Twitter thread that will engage my audience and get shares.',
    platforms: ['twitter'],
  },
  {
    id: 'linkedin-post',
    text: 'LinkedIn article',
    prompt: 'Help me write a LinkedIn post that showcases my expertise and drives engagement.',
    platforms: ['linkedin'],
  },
  {
    id: 'youtube-hook',
    text: 'Video hook',
    prompt: 'Create an attention-grabbing opening for my next YouTube video.',
    platforms: ['youtube'],
  },
];

export function QuickPromptPills({
  activePillar,
  activePlatforms,
  onPromptSelect,
  disabled = false,
}: QuickPromptPillsProps) {
  // Build contextual prompts based on active pillar and platforms
  const getContextualPrompts = (): PromptSuggestion[] => {
    const prompts: PromptSuggestion[] = [];

    // Add platform-specific prompts if platforms selected
    if (activePlatforms.length > 0) {
      platformPrompts.forEach((prompt) => {
        if (prompt.platforms?.some((p) => activePlatforms.includes(p))) {
          prompts.push(prompt);
        }
      });
    }

    // Add pillar-specific prompts if pillar selected
    if (activePillar) {
      const pillarSlug = activePillar.slug.toLowerCase();
      pillarPrompts.forEach((prompt) => {
        if (prompt.pillars?.some((p) => pillarSlug.includes(p) || p.includes(pillarSlug))) {
          prompts.push(prompt);
        }
      });
    }

    // Fill remaining slots with default prompts
    const remaining = 4 - prompts.length;
    if (remaining > 0) {
      prompts.push(...defaultPrompts.slice(0, remaining));
    }

    // Limit to 4 prompts and ensure uniqueness
    const seen = new Set<string>();
    return prompts.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    }).slice(0, 4);
  };

  const prompts = getContextualPrompts();

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
      <SparklesIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
      {prompts.map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          onClick={() => onPromptSelect(suggestion.prompt)}
          disabled={disabled}
          className={`
            px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap
            bg-slate-800/50 text-slate-300
            border border-slate-700/50
            transition-all duration-200
            hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/30
            hover:shadow-sm hover:shadow-cyan-500/10
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-800/50 disabled:hover:text-slate-300 disabled:hover:border-slate-700/50
          `}
        >
          {suggestion.text}
        </button>
      ))}
    </div>
  );
}
