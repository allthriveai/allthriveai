/**
 * UserMessage - Displays user's chat message bubble
 *
 * Features:
 * - Cyan gradient background
 * - Right-aligned
 * - Two variants: default (sidebar) and neon (EmberHomePage)
 */

import type { UserMessageProps } from '../core/types';

export function UserMessage({ content, variant = 'default' }: UserMessageProps) {
  const isNeon = variant === 'neon';

  if (isNeon) {
    // Neon Glass variant (EmberHomePage)
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-5 py-4 rounded-2xl rounded-br-sm bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
          <span className="text-lg whitespace-pre-wrap break-words">{content}</span>
        </div>
      </div>
    );
  }

  // Default variant (sidebar)
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] sm:max-w-sm md:max-w-md px-4 py-2 rounded-lg whitespace-pre-wrap bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
        <span className="break-words">{content}</span>
      </div>
    </div>
  );
}
