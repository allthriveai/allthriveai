import { BaseAgent } from './BaseAgent';
import type { ChatConfig, ChatContext } from '@/types/chat';

/**
 * Simple placeholder agent - demonstrates basic implementation
 */
export class PlaceholderAgent extends BaseAgent {
  async handleMessage(userMessage: string, context?: ChatContext): Promise<string> {
    // Simulate a delay for API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    return `Placeholder response to: "${userMessage}"`;
  }
}

/**
 * Discovery Agent - helps users explore features
 */
export class DiscoveryAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'discovery',
      agentName: 'Discovery Guide',
      agentDescription: 'Explore new AI agents and features',
      initialMessage:
        'Welcome! I can help you discover and explore different AI agents available on the platform. What would you like to explore?',
      systemPrompt:
        'You are a helpful guide for discovering AI agents and features. Be enthusiastic and informative.',
    });
  }

  async handleMessage(userMessage: string, context?: ChatContext): Promise<string> {
    // This would call your backend API to get discovery info
    await new Promise((resolve) => setTimeout(resolve, 800));
    return `I found some interesting agents related to "${userMessage}". In a real implementation, this would query our agent database.`;
  }
}

/**
 * Network Agent - facilitates networking and connections
 */
export class NetworkAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'network',
      agentName: 'Network Assistant',
      agentDescription: 'Connect with other AI agents and users',
      initialMessage:
        'Hello! I help you connect with other members and AI agents in the network. Who would you like to connect with?',
      systemPrompt: 'You are a friendly networking assistant. Help users find and connect with others.',
    });
  }

  async handleMessage(userMessage: string, context?: ChatContext): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return `I can help you find people interested in "${userMessage}". This would search the network in a real implementation.`;
  }
}

/**
 * Learning Agent - provides educational support
 */
export class LearningAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'learning',
      agentName: 'Learning Coach',
      agentDescription: 'Learn from educational content and resources',
      initialMessage:
        'Hello! I\'m your learning coach. I can help you find resources, tutorials, and educational content. What would you like to learn?',
      systemPrompt:
        'You are an educational AI coach. Provide helpful, clear explanations and recommend learning resources.',
    });
  }

  async handleMessage(userMessage: string, context?: ChatContext): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return `Great question about "${userMessage}"! I found several resources that might help. In a real implementation, I would provide curated learning materials.`;
  }
}

/**
 * Settings Agent - manages user preferences and configurations
 */
export class SettingsAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'settings',
      agentName: 'Settings Assistant',
      agentDescription: 'Manage your preferences and account settings',
      initialMessage:
        'Welcome! I can help you manage your account settings and preferences. What would you like to configure?',
      systemPrompt: 'You are a helpful settings assistant. Guide users through configuration options clearly.',
    });
  }

  async handleMessage(userMessage: string, context?: ChatContext): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return `I can help you with "${userMessage}". This would apply settings changes in a real implementation.`;
  }
}

/**
 * Agent Factory - creates agents by ID
 */
export const agentFactoryMap: Record<string, () => BaseAgent> = {
  discover: () => new DiscoveryAgent(),
  network: () => new NetworkAgent(),
  learning: () => new LearningAgent(),
  settings: () => new SettingsAgent(),
  placeholder: () => new PlaceholderAgent(),
};

export function createAgent(agentId: string): BaseAgent {
  const factory = agentFactoryMap[agentId];
  if (!factory) {
    console.warn(`Unknown agent ID: ${agentId}, using placeholder`);
    return new PlaceholderAgent({
      agentId,
      agentName: agentId,
    });
  }
  return factory();
}
