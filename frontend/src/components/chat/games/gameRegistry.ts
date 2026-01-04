/**
 * Game Registry - Scalable system for inline chat games
 *
 * To add a new game:
 * 1. Create a MiniXxxGame component implementing MiniGameProps
 * 2. Add an entry to GAME_REGISTRY
 * 3. The game will automatically appear in ChatGameCard
 */

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faWorm, faQuestion, faShieldHalved, faBolt } from '@fortawesome/free-solid-svg-icons';
import type { ComponentType } from 'react';

// Standard props all mini games must implement
export interface MiniGameProps {
  onGameEnd?: (score: number) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
}

// All available game types
export type GameType = 'snake' | 'quiz' | 'ethics' | 'prompt_battle' | 'random';

// Playable game types (excludes 'random' which is a meta-type)
export type PlayableGameType = Exclude<GameType, 'random'>;

// Game configuration
export interface GameConfig {
  id: PlayableGameType;
  name: string;
  icon: IconDefinition;
  description: string;
  // Short tagline for compact displays
  tagline: string;
  // Promo image path (optional)
  promoImage?: string;
  // Lazy-loaded component for code splitting
  component: () => Promise<{ default: ComponentType<MiniGameProps> }>;
  // Category for grouping games
  category: 'action' | 'trivia' | 'multiplayer' | 'puzzle';
  // Whether the game is ready for production
  enabled: boolean;
}

// Game registry - add new games here!
export const GAME_REGISTRY: Record<PlayableGameType, GameConfig> = {
  snake: {
    id: 'snake',
    name: 'Context Snake',
    icon: faWorm,
    description: 'Context is finite, so play accordingly!',
    tagline: 'You are the context window',
    promoImage: '/games/game-context-snake-promo.png',
    component: () => import('./MiniSnakeGame').then(m => ({ default: m.MiniSnakeGame })),
    category: 'action',
    enabled: true,
  },
  quiz: {
    id: 'quiz',
    name: 'AI Trivia',
    icon: faQuestion,
    description: 'Test your AI knowledge with a quick question!',
    tagline: 'Test your AI knowledge',
    promoImage: '/ai-trivia-promo.png',
    component: () => import('./QuickQuiz').then(m => ({ default: m.QuickQuiz })),
    category: 'trivia',
    enabled: true,
  },
  ethics: {
    id: 'ethics',
    name: 'Ethics Defender',
    icon: faShieldHalved,
    description: 'Blast the correct answer to defend AI ethics!',
    tagline: 'Defend AI ethics',
    promoImage: '/games/game-ethics-defender-promo.png',
    component: () => import('./MiniEthicsDefender').then(m => ({ default: m.MiniEthicsDefender })),
    category: 'action',
    enabled: true,
  },
  prompt_battle: {
    id: 'prompt_battle',
    name: 'Prompt Battle',
    icon: faBolt,
    description: 'Battle Pip or challenge a friend to a prompt duel!',
    tagline: 'Challenge to a duel',
    promoImage: '/games/game-prompt-battle-promo.png',
    component: () => import('./PromptBattleChooser').then(m => ({ default: m.PromptBattleChooser })),
    category: 'multiplayer',
    enabled: true,
  },
};

// Get all enabled games
export function getEnabledGames(): GameConfig[] {
  return Object.values(GAME_REGISTRY).filter(game => game.enabled);
}

// Get games by category
export function getGamesByCategory(category: GameConfig['category']): GameConfig[] {
  return getEnabledGames().filter(game => game.category === category);
}

// Get a random enabled game
export function getRandomGame(): PlayableGameType {
  const enabledGames = getEnabledGames();
  const index = Math.floor(Math.random() * enabledGames.length);
  return enabledGames[index].id;
}

// Get game config by ID
export function getGameConfig(gameType: PlayableGameType): GameConfig {
  return GAME_REGISTRY[gameType];
}
