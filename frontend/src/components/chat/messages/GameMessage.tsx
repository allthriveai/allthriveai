/**
 * GameMessage - Wrapper for inline games launched from chat
 *
 * Features:
 * - Renders ChatGameCard for snake, quiz, or random games
 * - Passes through game configuration
 * - Displays topic-specific explanation before the game
 */

import { ChatGameCard } from '../games';
import { ChatErrorBoundary } from '../ChatErrorBoundary';
import type { GameMessageProps } from '../core/types';

export function GameMessage({ gameType, gameConfig, explanation }: GameMessageProps) {
  return (
    <div className="flex flex-col gap-3 items-center w-full">
      {explanation && (
        <div className="text-sm text-gray-300 leading-relaxed text-center max-w-md">
          {explanation}
        </div>
      )}
      <div className="flex justify-center w-full">
        <ChatErrorBoundary inline resetKey={`game-${gameType}`}>
          <ChatGameCard gameType={gameType} config={gameConfig} />
        </ChatErrorBoundary>
      </div>
    </div>
  );
}
