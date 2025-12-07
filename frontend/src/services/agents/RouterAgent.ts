import { BaseAgent } from './BaseAgent';
import type { ChatContext, ChatMessage } from '@/types/chat';
import type { ChatMode, IntegrationContext } from '@/types/chat';

/**
 * RouterAgent - Intelligent intent detection for mode switching
 *
 * Analyzes user input and context to determine the appropriate chat mode:
 * - support: Help, questions, troubleshooting
 * - project-creation: Creating projects from integrations
 * - discovery: Exploring projects, recommendations
 */
export class RouterAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'router',
      agentName: 'Router Agent',
      agentDescription: 'Intelligent intent detection and mode switching',
      initialMessage: 'How can I help you today?',
    });
  }

  /**
   * Detect the appropriate chat mode based on user input and context
   */
  detectMode(
    userMessage: string,
    conversationHistory: ChatMessage[],
    integration?: IntegrationContext
  ): ChatMode {
    // If integration is present, it's project creation
    if (integration) {
      return 'project-creation';
    }

    const lowerMessage = userMessage.toLowerCase().trim();

    // Project creation keywords
    const projectKeywords = [
      'create',
      'import',
      'add project',
      'new project',
      'upload',
      'github',
      'youtube',
      'repository',
      'video',
    ];

    // Support keywords
    const supportKeywords = [
      'help',
      'how do',
      'how can',
      'what is',
      'why',
      'error',
      'problem',
      'issue',
      'support',
      'question',
      'confused',
      'stuck',
    ];

    // Discovery keywords
    const discoveryKeywords = [
      'find',
      'show',
      'search',
      'discover',
      'recommend',
      'explore',
      'browse',
      'similar',
      'like this',
    ];

    // Check for explicit project creation intent
    if (projectKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'project-creation';
    }

    // Check for support intent
    if (supportKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'support';
    }

    // Check for discovery intent
    if (discoveryKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'discovery';
    }

    // Default: Check conversation history for context
    if (conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-3);
      const recentContent = recentMessages.map(m => m.content.toLowerCase()).join(' ');

      if (projectKeywords.some(keyword => recentContent.includes(keyword))) {
        return 'project-creation';
      }

      if (supportKeywords.some(keyword => recentContent.includes(keyword))) {
        return 'support';
      }

      if (discoveryKeywords.some(keyword => recentContent.includes(keyword))) {
        return 'discovery';
      }
    }

    // Default to support for general questions
    return 'support';
  }

  /**
   * Generate mode transition message
   */
  getModeTransitionMessage(newMode: ChatMode, integration?: IntegrationContext): string {
    switch (newMode) {
      case 'project-creation':
        if (integration?.type === 'github') {
          return 'Great! Let\'s import your GitHub repository. Please provide the repository URL.';
        }
        if (integration?.type === 'youtube') {
          return 'Perfect! Let\'s import your YouTube video. Please provide the video URL.';
        }
        if (integration?.type === 'upload') {
          return 'Ready to upload! Please select the files you\'d like to add to your project.';
        }
        if (integration?.type === 'url') {
          return 'I can help you import from any URL. Please paste the URL you\'d like to import.';
        }
        return 'Let\'s create a new project! What would you like to import?';

      case 'discovery':
        return 'I can help you explore projects. What are you looking for?';

      case 'support':
      default:
        return 'How can I help you today?';
    }
  }

  /**
   * Handle message routing (not used directly, but required by BaseAgent)
   */
  async handleMessage(_userMessage: string, _context?: ChatContext): Promise<string> {
    // RouterAgent doesn't handle messages directly
    // It's used by IntelligentChatPanel to determine mode
    return 'RouterAgent is for mode detection only. Use mode-specific agents for handling messages.';
  }

  /**
   * Validate input for mode detection
   */
  validateInput(input: string): boolean {
    return input.trim().length > 0;
  }
}
