import type { ChatConfig, ChatContext, IChatAgent } from '@/types/chat';

/**
 * Base Agent class that implements common agent functionality
 * Extend this class to create specific agent implementations
 */
export abstract class BaseAgent implements IChatAgent {
  config: ChatConfig;

  constructor(config: ChatConfig) {
    this.config = config;
  }

  /**
   * Abstract method that subclasses must implement
   * This is where the agent logic goes
   */
  abstract handleMessage(userMessage: string, context?: ChatContext): Promise<string>;

  /**
   * Optional: Override to provide custom initial message
   */
  getInitialMessage(): string {
    return this.config.initialMessage || `Hello! I'm ${this.config.agentName}.`;
  }

  /**
   * Optional: Override to validate input
   */
  validateInput(input: string): boolean {
    if (!input.trim()) return false;
    if (this.config.contextWindow && input.length > this.config.contextWindow) {
      return false;
    }
    return true;
  }

  /**
   * Optional: Called when context changes
   */
  onContextChange(context: Partial<ChatContext>): void {
    // Override in subclass if needed
  }
}
