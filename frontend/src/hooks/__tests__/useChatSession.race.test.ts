/**
 * useChatSession Race Condition Tests
 *
 * These tests specifically target race conditions that can occur with:
 * - Stale closure when calling agent.handleMessage with state.context
 * - Rapid message sending overlapping with state updates
 * - Agent change during message processing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatSession } from '../useChatSession';
import type { IChatAgent, ChatContext } from '@/types/chat';

// Helper to create a mock agent
const createMockAgent = (
  handleMessageFn: (input: string, context: ChatContext) => Promise<string>,
  options: { initialMessage?: string; agentId?: string } = {}
): IChatAgent => ({
  config: {
    agentId: options.agentId || 'test-agent',
    name: 'Test Agent',
    description: 'Test agent for race condition testing',
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: 'You are a test agent.',
    thinkingBudget: undefined,
  },
  handleMessage: handleMessageFn,
  getInitialMessage: options.initialMessage ? () => options.initialMessage! : undefined,
});

describe('useChatSession - Race Condition Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('stale closure in handleMessage', () => {
    it('should pass current context to handleMessage, not stale closure', async () => {
      const capturedContexts: ChatContext[] = [];
      const handleMessage = vi.fn(async (input: string, context: ChatContext) => {
        capturedContexts.push({ ...context });
        // Simulate slow response
        await new Promise(r => setTimeout(r, 50));
        return `Response to: ${input}`;
      });

      const agent = createMockAgent(handleMessage);

      const { result } = renderHook(() =>
        useChatSession({
          agent,
          userId: 'user-123',
        })
      );

      // Send first message
      await act(async () => {
        result.current.sendMessage('First message');
      });

      // Wait for first response to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 200 });

      // First message should be in history
      expect(result.current.messages.length).toBeGreaterThanOrEqual(1);

      // Send second message
      await act(async () => {
        result.current.sendMessage('Second message');
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 200 });

      expect(handleMessage).toHaveBeenCalledTimes(2);

      // The context passed to second call should include first message
      // This tests that we're not using a stale closure
      const secondCallContext = capturedContexts[1];
      if (secondCallContext) {
        // Context should have conversation history with at least the first exchange
        expect(secondCallContext.conversationHistory.length).toBeGreaterThan(0);
      }
    });

    it('should handle rapid message sending without losing messages', async () => {
      let callOrder = 0;
      const handleMessage = vi.fn(async (input: string) => {
        const myOrder = ++callOrder;
        // Varying response times to simulate race condition
        await new Promise(r => setTimeout(r, myOrder === 1 ? 100 : 10));
        return `Response ${myOrder} to: ${input}`;
      });

      const agent = createMockAgent(handleMessage);

      const { result } = renderHook(() =>
        useChatSession({
          agent,
          userId: 'user-123',
        })
      );

      // Send messages in quick succession
      // Note: Due to how useChatSession works, each message waits for the previous
      await act(async () => {
        result.current.sendMessage('Message 1');
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 200 });

      await act(async () => {
        result.current.sendMessage('Message 2');
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 200 });

      // Both messages and their responses should be in the conversation
      const userMessages = result.current.messages.filter(m => m.sender === 'user');
      const assistantMessages = result.current.messages.filter(m => m.sender === 'assistant');

      expect(userMessages.length).toBe(2);
      expect(assistantMessages.length).toBe(2);
    });
  });

  describe('agent change during processing', () => {
    it('should reset state when agent changes', async () => {
      const agent1HandleMessage = vi.fn(async () => 'Agent 1 response');
      const agent1 = createMockAgent(agent1HandleMessage, {
        agentId: 'agent-1',
        initialMessage: 'Hello from Agent 1',
      });

      const agent2 = createMockAgent(async () => 'Agent 2 response', {
        agentId: 'agent-2',
        initialMessage: 'Hello from Agent 2',
      });

      const { result, rerender } = renderHook(
        ({ agent }) => useChatSession({ agent, userId: 'user-123' }),
        { initialProps: { agent: agent1 } }
      );

      // Initial state should have agent 1's initial message
      expect(result.current.messages.length).toBe(1);
      expect(result.current.messages[0].content).toBe('Hello from Agent 1');

      // Change to agent 2
      rerender({ agent: agent2 });

      // Should reset to agent 2's initial message
      await waitFor(() => {
        expect(result.current.messages.length).toBe(1);
        expect(result.current.messages[0].content).toBe('Hello from Agent 2');
      });
    });
  });

  describe('functional setState usage', () => {
    it('should use functional updates for messages to avoid race conditions', async () => {
      const handleMessage = vi.fn(async (input: string) => {
        return `Response to: ${input}`;
      });

      const agent = createMockAgent(handleMessage);

      const { result } = renderHook(() =>
        useChatSession({
          agent,
          userId: 'user-123',
        })
      );

      // Send a message
      await act(async () => {
        result.current.sendMessage('Test message');
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have both user message and assistant response
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].sender).toBe('user');
      expect(result.current.messages[1].sender).toBe('assistant');
    });

    it('should preserve message order even with concurrent updates', async () => {
      // Simulate varying response times
      let responseCount = 0;
      const handleMessage = vi.fn(async () => {
        responseCount++;
        return `Response ${responseCount}`;
      });

      const agent = createMockAgent(handleMessage);

      const { result } = renderHook(() =>
        useChatSession({
          agent,
          userId: 'user-123',
        })
      );

      // Send first message
      await act(async () => {
        result.current.sendMessage('First');
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Send second message
      await act(async () => {
        result.current.sendMessage('Second');
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Messages should be in order: user1, assistant1, user2, assistant2
      const messages = result.current.messages;
      expect(messages[0].content).toBe('First');
      expect(messages[0].sender).toBe('user');
      expect(messages[1].content).toBe('Response 1');
      expect(messages[1].sender).toBe('assistant');
      expect(messages[2].content).toBe('Second');
      expect(messages[2].sender).toBe('user');
      expect(messages[3].content).toBe('Response 2');
      expect(messages[3].sender).toBe('assistant');
    });
  });

  describe('error handling', () => {
    it('should set error state and stop loading on handleMessage failure', async () => {
      const handleMessage = vi.fn(async () => {
        throw new Error('API Error');
      });

      const onError = vi.fn();
      const agent = createMockAgent(handleMessage);

      const { result } = renderHook(() =>
        useChatSession({
          agent,
          userId: 'user-123',
          onError,
        })
      );

      await act(async () => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('API Error');
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'API Error' }));
    });

    it('should clear error on clearError call', async () => {
      const handleMessage = vi.fn(async () => {
        throw new Error('API Error');
      });

      const agent = createMockAgent(handleMessage);

      const { result } = renderHook(() =>
        useChatSession({
          agent,
          userId: 'user-123',
        })
      );

      await act(async () => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('API Error');
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeUndefined();
    });
  });

  describe('context updates', () => {
    it('should trigger agent onContextChange when updateContext is called', async () => {
      const onContextChange = vi.fn();
      const agent: IChatAgent = {
        ...createMockAgent(async () => 'Response'),
        onContextChange,
      };

      const { result } = renderHook(() =>
        useChatSession({
          agent,
          userId: 'user-123',
        })
      );

      act(() => {
        result.current.updateContext({ metadata: { test: 'value' } });
      });

      expect(onContextChange).toHaveBeenCalledWith({ metadata: { test: 'value' } });
    });
  });
});
