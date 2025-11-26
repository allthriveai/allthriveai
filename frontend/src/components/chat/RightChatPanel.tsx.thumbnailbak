import { useAuth } from '@/hooks/useAuth';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { useChatSession } from '@/hooks/useChatSession';
import { createAgent } from '@/services/agents/ExampleAgents';
import { useMemo } from 'react';

interface RightChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMenuItem: string | null;
}

export function RightChatPanel({ isOpen, onClose, selectedMenuItem }: RightChatPanelProps) {
  const { user } = useAuth();

  // Memoize agent creation to prevent infinite loop
  const agent = useMemo(() => {
    console.log('Creating agent for:', selectedMenuItem);
    return selectedMenuItem ? createAgent(selectedMenuItem) : createAgent('discover');
  }, [selectedMenuItem]);

  const chatSession = useChatSession({
    agent,
    userId: user?.id?.toString() || 'anonymous',
  });

  return (
    <ChatInterface
      isOpen={isOpen && !!selectedMenuItem}
      onClose={onClose}
      config={agent.config}
      messages={chatSession.messages}
      isLoading={chatSession.isLoading}
      onSendMessage={chatSession.sendMessage}
      inputPlaceholder={`Chat with ${agent.config.agentName}...`}
    />
  );
}
