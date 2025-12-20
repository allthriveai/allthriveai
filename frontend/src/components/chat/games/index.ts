// Main components
export { ChatGameCard } from './ChatGameCard';
export { GamePicker } from './GamePicker';

// Game registry (types and helpers)
export {
  GAME_REGISTRY,
  getEnabledGames,
  getGamesByCategory,
  getRandomGame,
  getGameConfig,
  type GameType,
  type PlayableGameType,
  type MiniGameProps,
  type GameConfig,
} from './gameRegistry';

// Individual game components (for direct use if needed)
export { MiniSnakeGame } from './MiniSnakeGame';
export { QuickQuiz } from './QuickQuiz';
export { MiniEthicsDefender } from './MiniEthicsDefender';
export { PromptBattleChooser } from './PromptBattleChooser';
