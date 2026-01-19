/**
 * Idea List Component
 * US-004: Ideas Tab with list view and quick capture
 */

import { IdeaCard } from './IdeaCard';
import type { ContentIdea } from '@/types/contentEngine';

interface IdeaListProps {
  ideas: ContentIdea[];
  onArchive?: (id: number) => void;
  onCreateClip?: (id: number) => void;
  onSchedule?: (id: number) => void;
  onDelete?: (id: number) => void;
  highlightedId?: number | null;
}

export function IdeaList({ ideas, onArchive, onCreateClip, onSchedule, onDelete, highlightedId }: IdeaListProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {ideas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          onArchive={onArchive}
          onCreateClip={onCreateClip}
          onSchedule={onSchedule}
          onDelete={onDelete}
          isHighlighted={idea.id === highlightedId}
        />
      ))}
    </div>
  );
}
