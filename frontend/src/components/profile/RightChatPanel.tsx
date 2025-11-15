import { useAuth } from '@/context/AuthContext';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { useChatSession } from '@/hooks/useChatSession';
import { createAgent } from '@/services/agents/ExampleAgents';

interface RightChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMenuItem: string | null;
}

export function RightChatPanel({ isOpen, onClose, selectedMenuItem }: RightChatPanelProps) {
  const { user } = useAuth();
  
  // Don't render anything if no menu item selected
  if (!selectedMenuItem) return null;

  const agent = createAgent(selectedMenuItem);
  const chatSession = useChatSession({
    agent,
    userId: user?.id?.toString() || 'anonymous',
    onError: (error) => console.error('Chat error:', error),
  });

  return (
    <ChatInterface
      isOpen={isOpen}
      onClose={onClose}
      config={agent.config}
      messages={chatSession.messages}
      isLoading={chatSession.isLoading}
      onSendMessage={chatSession.sendMessage}
      inputPlaceholder={`Chat with ${agent.config.agentName}...`}
    />
  );
}
