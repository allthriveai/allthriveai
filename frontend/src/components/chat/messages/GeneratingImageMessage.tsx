/**
 * GeneratingImageMessage - Shows Nano Banana image generation in progress
 *
 * Features:
 * - Animated banana emoji
 * - Custom message support
 * - Yellow/orange gradient styling
 */

interface GeneratingImageMessageProps {
  message?: string;
}

export function GeneratingImageMessage({ message }: GeneratingImageMessageProps) {
  return (
    <div className="flex justify-start">
      <div className="max-w-md px-4 py-3 rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center gap-3">
          <div className="animate-bounce text-2xl">🍌</div>
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Nano Banana is creating...
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              {message || 'Generating your image...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
