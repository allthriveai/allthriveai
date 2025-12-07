/**
 * ChatGPT/OpenAI extractor
 */

import TurndownService from 'turndown';
import type { PlatformExtractor, ClippedContent, ExtractedImage, ProjectType } from '../../types';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

export const chatGptExtractor: PlatformExtractor = {
  name: 'chatgpt',

  matchUrl: (url: string) => {
    return url.includes('chat.openai.com') || url.includes('chatgpt.com');
  },

  extract: (document: Document): Partial<ClippedContent> => {
    const messages: string[] = [];
    const images: ExtractedImage[] = [];

    // Find all message containers
    const messageContainers = document.querySelectorAll('[data-message-author-role]');

    if (messageContainers.length === 0) {
      // Try alternative selectors for different ChatGPT versions
      const altMessages = document.querySelectorAll('.text-base, .group\\/conversation-turn');
      altMessages.forEach((msg) => {
        const text = msg.textContent?.trim();
        if (text) {
          messages.push(text);
        }
      });
    } else {
      messageContainers.forEach((container) => {
        const role = container.getAttribute('data-message-author-role');
        const content = container.querySelector('.markdown, .prose, .text-message');

        if (content) {
          const prefix = role === 'user' ? '**User:**' : '**ChatGPT:**';
          const markdown = turndown.turndown(content.innerHTML);
          messages.push(`${prefix}\n\n${markdown}`);

          // Extract any images
          content.querySelectorAll('img').forEach((img) => {
            if (img.src && !img.src.startsWith('data:')) {
              images.push({
                src: img.src,
                alt: img.alt,
                isGenerated: img.src.includes('oaidalleapiprodscus') || img.src.includes('dalle'),
              });
            }
          });
        }
      });
    }

    // Get conversation title
    const titleElement = document.querySelector('h1, [data-testid="conversation-title"]');
    const title = titleElement?.textContent?.trim() || 'ChatGPT Conversation';

    // Build content with proper formatting
    const content = messages.length > 0
      ? `# ${title}\n\n${messages.join('\n\n---\n\n')}`
      : '';

    return {
      title,
      content,
      excerpt: messages[0]?.slice(0, 200) || '',
      images,
      platform: 'chatgpt',
      projectType: 'ai_conversation',
    };
  },

  getProjectType: (): ProjectType => 'ai_conversation',
};
