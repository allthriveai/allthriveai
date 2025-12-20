/**
 * ContextSnakeGame - Full-page snake game
 *
 * Uses the shared ContextSnakeCore component with full-page layout.
 */

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { ContextSnakeCore } from '@/components/games/ContextSnakeCore';

export default function ContextSnakeGame() {
  return (
    <DashboardLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center">
          <ContextSnakeCore variant="full" />
        </div>
      </div>
    </DashboardLayout>
  );
}
