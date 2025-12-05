import type { ChatMessage as ChatMessageType } from '@/hooks/useAuthChatStream';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-xl ${
          isUser
            ? 'bg-cyan-500/20 border border-cyan-500/30 text-white'
            : 'bg-white/5 border border-white/10 text-slate-200'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );
}
