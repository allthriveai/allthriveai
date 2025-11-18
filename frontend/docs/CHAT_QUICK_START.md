# Chat System Quick Start Guide

## 5-Minute Overview

The new chat system lets you create powerful AI agents that work everywhere in your app.

### Three Steps to Add a New Agent

#### Step 1: Create Your Agent Class

```typescript
// src/services/agents/MyAgents.ts
import { BaseAgent } from './BaseAgent';
import type { ChatContext } from '@/types/chat';

export class MyAwesomeAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'my-awesome',
      agentName: 'My Awesome Agent',
      agentDescription: 'Does something amazing',
      initialMessage: 'Hi! I can do amazing things. What do you need?',
    });
  }

  async handleMessage(userMessage: string, context?: ChatContext): Promise<string> {
    // Your magic happens here
    const response = await fetch('/api/my-agent', {
      method: 'POST',
      body: JSON.stringify({ message: userMessage }),
    });
    
    return response.json().then(r => r.response);
  }
}
```

#### Step 2: Register Your Agent

```typescript
// src/services/agents/ExampleAgents.ts
import { MyAwesomeAgent } from './MyAgents';

export const agentFactoryMap = {
  // ... existing agents
  'my-awesome': () => new MyAwesomeAgent(),
};
```

#### Step 3: Use Anywhere

```typescript
// Any component
import { ChatInterface } from '@/components/chat/ChatInterface';
import { useChatSession } from '@/hooks/useChatSession';
import { createAgent } from '@/services/agents/ExampleAgents';
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const { user } = useAuth();
  const agent = createAgent('my-awesome');
  const chatSession = useChatSession({
    agent,
    userId: user?.id || 'anonymous',
  });

  return (
    <ChatInterface
      isOpen={true}
      onClose={() => {}}
      config={agent.config}
      messages={chatSession.messages}
      isLoading={chatSession.isLoading}
      onSendMessage={chatSession.sendMessage}
    />
  );
}
```

That's it! 🎉

## Common Patterns

### Pattern 1: Sliding Chat Panel (Like Profile)

```typescript
function ProfilePage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const handleMenuClick = (menuItem: string) => {
    setSelectedAgent(menuItem);
    setChatOpen(true);
  };

  const agent = selectedAgent ? createAgent(selectedAgent) : null;
  const chatSession = useChatSession({
    agent: agent || createAgent('placeholder'),
    userId: user?.id,
  });

  return (
    <>
      <button onClick={() => handleMenuClick('my-awesome')}>
        Open Agent
      </button>

      {agent && (
        <ChatInterface
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          config={agent.config}
          messages={chatSession.messages}
          isLoading={chatSession.isLoading}
          onSendMessage={chatSession.sendMessage}
        />
      )}
    </>
  );
}
```

### Pattern 2: Full-Page Chat

```typescript
function ChatPage() {
  const agent = createAgent('my-awesome');
  const chatSession = useChatSession({
    agent,
    userId: user?.id,
  });

  return (
    <div className="h-screen flex flex-col">
      <header className="p-4 border-b">
        <h1>{agent.config.agentName}</h1>
      </header>
      
      <ChatInterface
        isOpen={true}
        onClose={() => {}} // Show always
        config={agent.config}
        messages={chatSession.messages}
        isLoading={chatSession.isLoading}
        onSendMessage={chatSession.sendMessage}
      />
    </div>
  );
}
```

### Pattern 3: Agent Switcher

```typescript
function MultiAgentChat() {
  const [selectedAgent, setSelectedAgent] = useState('discovery');
  const agent = createAgent(selectedAgent);
  const chatSession = useChatSession({ agent, userId });

  return (
    <div className="flex gap-4">
      <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
        <option value="discovery">Discovery</option>
        <option value="network">Network</option>
        <option value="learning">Learning</option>
      </select>

      <ChatInterface
        config={agent.config}
        messages={chatSession.messages}
        isLoading={chatSession.isLoading}
        onSendMessage={chatSession.sendMessage}
      />
    </div>
  );
}
```

## Common Customizations

### Custom Response Handling

```typescript
async handleMessage(userMessage: string, context?: ChatContext) {
  // Log user behavior
  console.log('User ID:', context?.userId);
  console.log('Session ID:', context?.sessionId);
  
  // Access conversation history
  const lastMessages = context?.conversationHistory.slice(-5);
  
  // Make decision based on history
  if (lastMessages?.some(m => m.content.includes('help'))) {
    return "I can help with that!";
  }
  
  // Default behavior
  return "Tell me more...";
}
```

### Custom Input Validation

```typescript
validateInput(input: string): boolean {
  // Only accept questions
  if (!input.includes('?') && !input.includes('how')) {
    return false;
  }
  
  // Limit length
  if (input.length > 500) {
    return false;
  }
  
  return true;
}
```

### Custom Initial Message

```typescript
getInitialMessage(): string {
  // Dynamic greeting based on time
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning! 👋";
  if (hour < 18) return "Good afternoon! 👋";
  return "Good evening! 👋";
}
```

### Error Handling

```typescript
const chatSession = useChatSession({
  agent,
  userId,
  onError: (error) => {
    // Show error toast
    toast.error(`Chat error: ${error.message}`);
    
    // Log for analytics
    analytics.track('chat_error', {
      agent: agent.config.agentId,
      error: error.message,
    });
  },
});
```

## API Integration Examples

### Simple GET Request

```typescript
async handleMessage(userMessage: string) {
  const response = await fetch(`/api/search?q=${userMessage}`);
  const data = await response.json();
  return `Found: ${data.results.join(', ')}`;
}
```

### POST with Context

```typescript
async handleMessage(userMessage: string, context?: ChatContext) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      userId: context?.userId,
      history: context?.conversationHistory,
    }),
  });
  return response.json();
}
```

### Streaming Responses

```typescript
async handleMessage(userMessage: string) {
  const response = await fetch('/api/stream', {
    method: 'POST',
    body: JSON.stringify({ message: userMessage }),
  });

  const reader = response.body?.getReader();
  let fullContent = '';

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    fullContent += new TextDecoder().decode(value);
  }

  return fullContent;
}
```

### Error Recovery

```typescript
async handleMessage(userMessage: string) {
  try {
    const response = await fetch('/api/process', {
      method: 'POST',
      body: JSON.stringify({ message: userMessage }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    return `Sorry, I encountered an error: ${error.message}`;
  }
}
```

## Debugging Tips

### Enable Logging

```typescript
class DebugAgent extends BaseAgent {
  async handleMessage(userMessage: string, context?: ChatContext) {
    console.log('User message:', userMessage);
    console.log('Context:', context);
    
    const response = await this.getResponse(userMessage);
    
    console.log('Agent response:', response);
    return response;
  }
  
  private async getResponse(message: string) {
    // Your logic
  }
}
```

### Access Chat Session State

```typescript
function MyComponent() {
  const chatSession = useChatSession({ agent, userId });

  return (
    <div>
      <ChatInterface {...props} />
      
      {/* Debug panel */}
      <details>
        <summary>Debug</summary>
        <pre>{JSON.stringify(chatSession, null, 2)}</pre>
      </details>
    </div>
  );
}
```

## File Reference

| File | Purpose | Edit? |
|------|---------|-------|
| `ChatInterface.tsx` | Generic UI | Only for styling |
| `useChatSession.ts` | State management | Usually no |
| `BaseAgent.ts` | Agent base class | Extend it |
| `ExampleAgents.ts` | Example implementations | Add your agents here |
| `chat.ts` | Type definitions | Add new types here |

## Next Steps

1. Create your first agent (copy from Example Agents)
2. Test it with the profile page
3. Add your API integration
4. Customize styling if needed
5. Deploy! 🚀

## Need Help?

- Full docs: See `CHAT_SYSTEM.md`
- Architecture deep dive: See `CHAT_ARCHITECTURE_REVIEW.md`
- Examples: Check `ExampleAgents.ts`
