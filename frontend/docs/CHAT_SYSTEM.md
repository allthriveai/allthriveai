# Scalable Chat & AI Agent System

This document outlines the architecture of the chat system designed to support multiple AI agents across different scenarios and use cases.

## Architecture Overview

The system is built on three core layers:

1. **Chat Interface** (`ChatInterface.tsx`) - Generic UI component
2. **Chat Session Management** (`useChatSession`) - State and logic management
3. **Agent System** (`BaseAgent`, `ExampleAgents`) - AI agent implementations

## Core Concepts

### ChatMessage
Represents individual messages in a conversation with metadata support:
- `id`: Unique identifier
- `sender`: 'user' | 'agent'
- `content`: Message text
- `messageType`: 'text' | 'action' | 'error' | 'suggestion'
- `metadata`: Custom data for extensions

### ChatConfig
Configuration object for agents:
```typescript
{
  agentId: string;
  agentName: string;
  agentDescription?: string;
  initialMessage?: string;
  systemPrompt?: string;
  contextWindow?: number;
  responseTimeout?: number;
  metadata?: Record<string, any>;
}
```

### IChatAgent
Interface that all agents must implement:
- `handleMessage(userMessage, context)` - Process user input and return response
- `getInitialMessage?()` - Custom initial greeting
- `validateInput?(input)` - Custom input validation
- `onContextChange?(context)` - React to context changes

## Creating New Agents

### 1. Extend BaseAgent

```typescript
export class MyCustomAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'my-agent',
      agentName: 'My Agent Name',
      agentDescription: 'Brief description',
      initialMessage: 'Hello! How can I help?',
      systemPrompt: 'You are a helpful AI...',
    });
  }

  async handleMessage(userMessage: string, context?: ChatContext): Promise<string> {
    // Your agent logic here
    // Call APIs, process data, generate responses

    // Example: Call your backend
    const response = await fetch('/api/agents/my-agent', {
      method: 'POST',
      body: JSON.stringify({ message: userMessage, context }),
    });

    return response.json().then(r => r.response);
  }

  // Optional: Custom validation
  validateInput(input: string): boolean {
    return input.length > 0 && input.length < 1000;
  }

  // Optional: React to context changes
  onContextChange(context: Partial<ChatContext>): void {
    console.log('Context updated:', context);
  }
}
```

### 2. Register in Agent Factory

```typescript
// In src/services/agents/ExampleAgents.ts
export const agentFactoryMap: Record<string, () => BaseAgent> = {
  'my-agent': () => new MyCustomAgent(),
  // ... other agents
};
```

### 3. Use in Components

```typescript
// The system automatically handles the rest
const agent = createAgent('my-agent');
const chatSession = useChatSession({
  agent,
  userId: user.id,
});

// Render with ChatInterface
<ChatInterface
  config={agent.config}
  messages={chatSession.messages}
  isLoading={chatSession.isLoading}
  onSendMessage={chatSession.sendMessage}
/>
```

## Advanced Usage

### Custom Message Rendering

```typescript
<ChatInterface
  {...props}
  customMessageRenderer={(message) => (
    <div className="custom-message">
      {message.messageType === 'action' && (
        <ActionButton {...message.metadata} />
      )}
      {message.messageType === 'text' && (
        <p>{message.content}</p>
      )}
    </div>
  )}
/>
```

### Context Management

Access conversation context in your agent:

```typescript
async handleMessage(userMessage: string, context?: ChatContext) {
  // Access user ID
  console.log(context?.userId);

  // Access session ID
  console.log(context?.sessionId);

  // Access conversation history
  console.log(context?.conversationHistory);

  // Access custom metadata
  console.log(context?.metadata);
}
```

### Error Handling

```typescript
const chatSession = useChatSession({
  agent,
  userId,
  onError: (error) => {
    // Handle errors
    console.error('Chat error:', error);
    // Show user feedback
  },
});
```

## Integration Points

### Backend Integration

Agents can integrate with your backend in multiple ways:

1. **Direct API Calls** (from agent)
2. **Backend Streaming** (WebSocket/SSE)
3. **Message Processing** (queue-based)

Example with streaming:

```typescript
async handleMessage(userMessage: string, context?: ChatContext): Promise<string> {
  const response = await fetch('/api/stream/my-agent', {
    method: 'POST',
    body: JSON.stringify({ message: userMessage }),
  });

  const reader = response.body?.getReader();
  let fullContent = '';

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = new TextDecoder().decode(value);
    fullContent += chunk;
    // Optionally process chunks in real-time
  }

  return fullContent;
}
```

## Best Practices

1. **Stateless Agents**: Keep agents stateless; use context for state management
2. **Error Handling**: Always wrap async operations in try-catch
3. **Input Validation**: Override `validateInput()` for agent-specific rules
4. **Performance**: Use memoization for expensive operations
5. **Logging**: Log important events for debugging
6. **Testing**: Create unit tests for agent logic

## File Structure

```
src/
├── components/
│   └── chat/
│       └── ChatInterface.tsx          # Generic UI component
├── hooks/
│   └── useChatSession.ts              # Session management hook
├── services/
│   └── agents/
│       ├── BaseAgent.ts               # Base class
│       └── ExampleAgents.ts           # Example implementations
├── types/
│   └── chat.ts                        # TypeScript interfaces
└── docs/
    └── CHAT_SYSTEM.md                 # This file
```

## Extensibility

The system is designed for easy extension:

- **Add new agents**: Create a new class extending `BaseAgent`
- **Custom renderers**: Pass `customMessageRenderer` to `ChatInterface`
- **New message types**: Add to `ChatMessage.messageType`
- **Context metadata**: Store custom data in `context.metadata`
- **Streaming support**: Implement in agent's `handleMessage()`

## Example Use Cases

### 1. Support Agent
```typescript
class SupportAgent extends BaseAgent {
  async handleMessage(userMessage) {
    // Search knowledge base
    // Escalate to human if needed
    // Track support tickets
  }
}
```

### 2. Analytics Agent
```typescript
class AnalyticsAgent extends BaseAgent {
  async handleMessage(userMessage) {
    // Query analytics data
    // Generate charts
    // Create reports
  }
}
```

### 3. Recommendation Agent
```typescript
class RecommendationAgent extends BaseAgent {
  async handleMessage(userMessage) {
    // Analyze user preferences
    // Query recommendation engine
    // Return personalized suggestions
  }
}
```

## Performance Considerations

- Messages are kept in memory; consider pagination for long conversations
- Session context window limits prevent unbounded memory growth
- Response timeouts prevent hanging requests
- Loading state prevents duplicate submissions

## Security

- Always validate user input on the backend
- Sanitize messages before rendering
- Use HTTPS for API calls
- Store sensitive context data securely
- Implement rate limiting per agent
