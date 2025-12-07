import { BaseAgent } from './BaseAgent';
import { api } from '@/services/api';
import type { ChatContext } from '@/types/chat';
import type { IntegrationContext } from '@/types/chat';
import { getUserFriendlyError } from '@/utils/errorMessages';

/**
 * ProjectCreationAgent - Handles project creation from various integrations
 *
 * Supports:
 * - GitHub repository import
 * - YouTube video import
 * - File uploads
 * - Generic URL import
 *
 * Features:
 * - Streaming responses for real-time feedback
 * - Auto-scraping and content analysis
 * - Marketing copy generation
 * - Auto-tagging
 */
export class ProjectCreationAgent extends BaseAgent {
  private integration?: IntegrationContext;

  constructor(integration?: IntegrationContext) {
    super({
      agentId: 'project-creation',
      agentName: 'Project Creation Agent',
      agentDescription: 'AI assistant for creating projects from integrations',
      initialMessage: 'Let\'s create your project! What would you like to import?',
    });

    this.integration = integration;
  }

  /**
   * Update integration context
   */
  setIntegration(integration: IntegrationContext) {
    this.integration = integration;
  }

  /**
   * Get initial message based on integration type
   */
  getInitialMessage(): string {
    if (!this.integration) {
      return 'Let\'s create your project! What would you like to import?';
    }

    switch (this.integration.type) {
      case 'github':
        return 'Great! Let\'s import your GitHub repository. Please provide the repository URL (e.g., https://github.com/username/repo).';

      case 'youtube':
        return 'Perfect! Let\'s import your YouTube video. Please provide the video URL or pick from your channel.';

      case 'upload':
        return 'Ready to create your project! Please upload your files and I\'ll help you set everything up.';

      case 'url':
        return 'I can import content from any URL. Please paste the URL you\'d like to import.';

      default:
        return 'Let\'s create your project! What would you like to import?';
    }
  }

  /**
   * Handle project creation message with streaming support
   */
  async handleMessage(userMessage: string, context?: ChatContext): Promise<string> {
    try {
      // Determine the integration type from message or context
      const integrationType = this.integration?.type || this.detectIntegrationType(userMessage);

      // Route to appropriate handler
      switch (integrationType) {
        case 'github':
          return await this.handleGitHubImport(userMessage, context);

        case 'youtube':
          return await this.handleYouTubeImport(userMessage, context);

        case 'upload':
          return await this.handleFileUpload(userMessage, context);

        case 'url':
          return await this.handleURLImport(userMessage, context);

        default:
          return 'I can help you create a project from GitHub, YouTube, file uploads, or any URL. What would you like to import?';
      }
    } catch (error: any) {
      console.error('[ProjectCreationAgent] Error:', error);

      // Use error message utility for user-friendly errors
      const friendlyError = getUserFriendlyError(error);
      return `${friendlyError.title}: ${friendlyError.message}`;
    }
  }

  /**
   * Detect integration type from user message
   */
  private detectIntegrationType(message: string): string | null {
    const lower = message.toLowerCase();

    if (lower.includes('github') || lower.includes('repository') || message.includes('github.com')) {
      return 'github';
    }

    if (lower.includes('youtube') || lower.includes('video') || message.includes('youtube.com') || message.includes('youtu.be')) {
      return 'youtube';
    }

    if (lower.includes('upload') || lower.includes('file')) {
      return 'upload';
    }

    // Check if message is a URL
    try {
      const url = new URL(message);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return 'url';
      }
    } catch {
      // Not a URL
    }

    return null;
  }

  /**
   * Handle GitHub repository import
   */
  private async handleGitHubImport(userMessage: string, context?: ChatContext): Promise<string> {
    // Extract GitHub URL from message
    const urlMatch = userMessage.match(/https?:\/\/github\.com\/[\w-]+\/[\w-]+/);

    if (!urlMatch) {
      return 'Please provide a valid GitHub repository URL (e.g., https://github.com/username/repo).';
    }

    const repoUrl = urlMatch[0];

    // Call backend to import repository
    const response = await api.post('/integrations/github/import/', {
      url: repoUrl,
      session_id: context?.sessionId,
    });

    if (response.data.success) {
      const project = response.data.project;
      return `Great! I've imported "${project.title}" from GitHub. The project is being processed and will be available on your profile shortly.`;
    }

    return 'Failed to import the repository. Please check the URL and try again.';
  }

  /**
   * Handle YouTube video import
   */
  private async handleYouTubeImport(userMessage: string, context?: ChatContext): Promise<string> {
    // Extract YouTube URL from message
    const urlMatch = userMessage.match(/https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/);

    if (!urlMatch) {
      return 'Please provide a valid YouTube video URL (e.g., https://youtube.com/watch?v=VIDEO_ID).';
    }

    const videoUrl = urlMatch[0];

    // Call backend to import video
    const response = await api.post('/integrations/youtube/import/', {
      url: videoUrl,
      session_id: context?.sessionId,
    });

    if (response.data.success) {
      const project = response.data.project;
      return `Perfect! I've imported "${project.title}" from YouTube. The video is being processed and will appear on your profile soon.`;
    }

    return 'Failed to import the video. Please check the URL and try again.';
  }

  /**
   * Handle file upload
   */
  private async handleFileUpload(userMessage: string, context?: ChatContext): Promise<string> {
    if (!this.integration?.files || this.integration.files.length === 0) {
      return 'Please upload files to create your project.';
    }

    // Create FormData for file upload
    const formData = new FormData();
    this.integration.files.forEach((file, index) => {
      formData.append(`file_${index}`, file);
    });
    formData.append('description', userMessage);
    formData.append('session_id', context?.sessionId || '');

    // Call backend to process upload
    const response = await api.post('/projects/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data.success) {
      const project = response.data.project;
      return `Excellent! I've created "${project.title}" from your uploaded files. The project is being processed and will be available shortly.`;
    }

    return 'Failed to upload files. Please try again.';
  }

  /**
   * Handle generic URL import
   */
  private async handleURLImport(userMessage: string, context?: ChatContext): Promise<string> {
    // Extract URL from message
    let url: string;
    try {
      const urlObj = new URL(userMessage);
      url = urlObj.toString();
    } catch {
      return 'Please provide a valid URL (e.g., https://example.com).';
    }

    // Call backend to import from URL
    const response = await api.post('/projects/import/url/', {
      url,
      session_id: context?.sessionId,
    });

    if (response.data.success) {
      const project = response.data.project;
      return `Great! I've imported content from "${url}". The project "${project.title}" is being processed and will be available on your profile soon.`;
    }

    return 'Failed to import from URL. Please check the URL and try again.';
  }

  /**
   * Validate input
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
