/**
 * MiniSnakeGame - Compact snake game for chat sidebar
 *
 * Uses the shared ContextSnakeCore component with mini layout.
 */

import { ContextSnakeCore } from '../../games/ContextSnakeCore';

interface MiniSnakeGameProps {
  onGameEnd?: (score: number) => void;
}

export function MiniSnakeGame({ onGameEnd }: MiniSnakeGameProps) {
  return <ContextSnakeCore variant="mini" onGameEnd={onGameEnd} />;
}
