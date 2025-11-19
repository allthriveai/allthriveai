import { useAuth } from '@/hooks/useAuth';
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
  
  // Create agent and session hook (must be called unconditionally)
  const agent = selectedMenuItem ? createAgent(selectedMenuItem) : createAgent('discovery');
  const chatSession = useChatSession({
    agent,
    userId: user?.id?.toString() || 'anonymous',
  });
  
  // Don't render anything if no menu item selected
  if (!selectedMenuItem) return null;

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
