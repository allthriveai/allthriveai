/**
 * GameMessage - Wrapper for inline games launched from chat
 *
 * Features:
 * - Renders ChatGameCard for snake, quiz, or random games
 * - Passes through game configuration
 */

import { ChatGameCard } from '../games';
import { ChatErrorBoundary } from '../ChatErrorBoundary';
import type { GameMessageProps } from '../core/types';

export function GameMessage({ gameType, gameConfig }: GameMessageProps) {
  return (
    <div className="flex justify-start">
      <ChatErrorBoundary inline resetKey={`game-${gameType}`}>
        <ChatGameCard gameType={gameType} config={gameConfig} />
      </ChatErrorBoundary>
    </div>
  );
}
