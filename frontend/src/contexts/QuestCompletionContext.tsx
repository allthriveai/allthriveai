import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { QuestCompletionCelebration } from '@/components/side-quests/QuestCompletionCelebration';

export interface CompletedQuestInfo {
  id: string;
  title: string;
  description: string;
  pointsAwarded: number;
  categoryName: string | null;
}

interface QuestCompletionContextType {
  showCelebration: (quests: CompletedQuestInfo[]) => void;
}

const QuestCompletionContext = createContext<QuestCompletionContextType | null>(null);

export function QuestCompletionProvider({ children }: { children: ReactNode }) {
  const [completedQuests, setCompletedQuests] = useState<CompletedQuestInfo[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const showCelebration = useCallback((quests: CompletedQuestInfo[]) => {
    if (quests.length > 0) {
      setCompletedQuests(quests);
      setIsVisible(true);
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setCompletedQuests([]);
  }, []);

  return (
    <QuestCompletionContext.Provider value={{ showCelebration }}>
      {children}
      {isVisible && completedQuests.length > 0 && (
        <QuestCompletionCelebration
          completedQuests={completedQuests}
          onClose={handleClose}
        />
      )}
    </QuestCompletionContext.Provider>
  );
}

export function useQuestCompletion() {
  const context = useContext(QuestCompletionContext);
  if (!context) {
    throw new Error('useQuestCompletion must be used within a QuestCompletionProvider');
  }
  return context;
}
