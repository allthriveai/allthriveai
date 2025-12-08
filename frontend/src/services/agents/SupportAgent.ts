import { BaseAgent } from './BaseAgent';
import { api } from '@/services/api';
import type { ChatContext } from '@/types/chat';

/**
 * SupportAgent - Handles support questions and general help
 *
 * Routes to backend support agent for:
 * - General questions about the platform
 * - Troubleshooting issues
 * - Feature explanations
 * - User guidance
 */
export class SupportAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'support',
      agentName: 'Support Agent',
      agentDescription: 'AI assistant for platform support and guidance',
      initialMessage: 'Hi! I\'m here to help answer your questions about All Thrive AI. What can I assist you with?',
    });
  }

  /**
   * Handle support message by routing to backend support agent
   */
  async handleMessage(userMessage: string, context?: ChatContext): Promise<string> {
    try {
      // Call backend support agent
      const response = await api.post('/support/chat/', {
        message: userMessage,
        session_id: context?.sessionId,
        conversation_history: context?.conversationHistory?.slice(-10), // Last 10 messages for context
      });

      return response.data.response || 'I apologize, but I couldn\'t generate a response. Please try again.';
    } catch (error: any) {
      console.error('[SupportAgent] Error:', error);

      // User-friendly error handling
      if (error.response?.status === 401) {
        return 'It looks like you\'re not logged in. Please log in to continue.';
      }

      if (error.response?.status === 429) {
        return 'You\'re sending messages too quickly. Please wait a moment and try again.';
      }

      if (error.message?.toLowerCase().includes('network')) {
        return 'I\'m having trouble connecting. Please check your internet connection and try again.';
      }

      return 'I encountered an error processing your request. Please try again or contact support if the problem persists.';
    }
  }

  /**
   * Get initial greeting based on time of day
   */
  getInitialMessage(): string {
    const hour = new Date().getHours();
    let greeting = 'Hi';

    if (hour < 12) {
      greeting = 'Good morning';
    } else if (hour < 18) {
      greeting = 'Good afternoon';
    } else {
      greeting = 'Good evening';
    }

    return `${greeting}! I'm here to help answer your questions about All Thrive AI. What can I assist you with?`;
  }

  /**
   * Validate user input
   */
  validateInput(input: string): boolean {
    const trimmed = input.trim();

    // Must have content
    if (trimmed.length === 0) {
      return false;
    }

    // Reasonable length limits
    if (trimmed.length > 5000) {
      return false;
    }

    return true;
  }
}
