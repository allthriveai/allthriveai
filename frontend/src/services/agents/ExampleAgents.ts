import { BaseAgent } from './BaseAgent';

/**
 * Simple placeholder agent - demonstrates basic implementation
 */
export class PlaceholderAgent extends BaseAgent {
  async handleMessage(userMessage: string): Promise<string> {
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

  async handleMessage(userMessage: string): Promise<string> {
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

  async handleMessage(userMessage: string): Promise<string> {
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

  async handleMessage(userMessage: string): Promise<string> {
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

  async handleMessage(userMessage: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return `I can help you with "${userMessage}". This would apply settings changes in a real implementation.`;
  }
}

/**
 * Create Project Agent - guides users through creating a new project
 * Uses backend streaming API for agentic project creation
 */
export class CreateProjectAgent extends BaseAgent {
  private sessionId: string | null = null;

  constructor() {
    super({
      agentId: 'create-project',
      agentName: 'Create Project',
      agentDescription: 'Create a new project with AI guidance',
      initialMessage:
        "Let's create a new project! I'll help you set it up.\n\nYou can either:\n• Add a link and I can auto-generate your project for you\n• Begin to explain your project or prompt\n\nAfterwards, you'll be able to adjust your project page. What would you like to do?",
      systemPrompt: 'You are a helpful project creation assistant. Guide users through creating a project conversationally.',
    });
  }

  async handleMessage(userMessage: string): Promise<string> {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';

    try {
      const response = await fetch(`${apiUrl}/project/chat/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          session_id: this.sessionId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'token') {
                  fullResponse += data.content;
                } else if (data.type === 'complete') {
                  this.sessionId = data.session_id;

                  // If project was created, dispatch event for profile refresh
                  if (data.project_id) {
                    // Optionally dispatch event for profile refresh
                    window.dispatchEvent(new CustomEvent('project-created', {
                      detail: { projectId: data.project_id, slug: data.project_slug }
                    }));
                  }
                } else if (data.type === 'error') {
                  throw new Error(data.message);
                }
              } catch (e) {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        }
      }

      return fullResponse.trim() || 'Processing...';
    } catch (error) {
      console.error('Project agent error:', error);
      return `Sorry, there was an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;
    }
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
  'create-project': () => new CreateProjectAgent(),
  'Create Project': () => new CreateProjectAgent(),
  placeholder: () => new PlaceholderAgent({
    agentId: 'placeholder',
    agentName: 'Placeholder Agent',
  }),
};

export function createAgent(agentId: string): BaseAgent {
  // Try direct match first
  let factory = agentFactoryMap[agentId];

  // Try lowercase match
  if (!factory) {
    const lowerCaseId = agentId.toLowerCase();
    factory = agentFactoryMap[lowerCaseId];
  }

  // Try kebab-case conversion (e.g., "Create Project" -> "create-project")
  if (!factory) {
    const kebabCase = agentId.toLowerCase().replace(/\s+/g, '-');
    factory = agentFactoryMap[kebabCase];
  }

  if (!factory) {
    // Fall back to placeholder for unknown agents
    return new PlaceholderAgent({
      agentId,
      agentName: agentId,
    });
  }
  return factory();
}
