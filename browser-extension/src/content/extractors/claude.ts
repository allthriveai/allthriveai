/**
 * Claude.ai extractor
 */

import TurndownService from 'turndown';
import type { PlatformExtractor, ClippedContent, ExtractedImage, ProjectType } from '../../types';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

export const claudeExtractor: PlatformExtractor = {
  name: 'claude',

  matchUrl: (url: string) => {
    return url.includes('claude.ai');
  },

  extract: (document: Document): Partial<ClippedContent> => {
    const messages: string[] = [];
    const images: ExtractedImage[] = [];

    // Claude uses different selectors based on version
    const conversationContainer = document.querySelector('[class*="conversation"], main');

    if (conversationContainer) {
      // Find human and assistant messages
      const humanMessages = conversationContainer.querySelectorAll('[class*="human"], [data-role="human"]');
      const assistantMessages = conversationContainer.querySelectorAll('[class*="assistant"], [data-role="assistant"]');

      // If we found role-based messages
      if (humanMessages.length > 0 || assistantMessages.length > 0) {
        // Get all message elements in order
        const allMessages = conversationContainer.querySelectorAll('[class*="message"], [data-role]');

        allMessages.forEach((msg) => {
          const isHuman = msg.className.includes('human') || msg.getAttribute('data-role') === 'human';
          const contentEl = msg.querySelector('[class*="content"], .prose, .markdown') || msg;

          if (contentEl.textContent?.trim()) {
            const prefix = isHuman ? '**Human:**' : '**Claude:**';
            const markdown = turndown.turndown(contentEl.innerHTML);
            messages.push(`${prefix}\n\n${markdown}`);
          }
        });
      } else {
        // Alternative: look for prose/markdown containers
        const proseContainers = conversationContainer.querySelectorAll('.prose, .markdown');
        proseContainers.forEach((container, index) => {
          const prefix = index % 2 === 0 ? '**Human:**' : '**Claude:**';
          const markdown = turndown.turndown(container.innerHTML);
          if (markdown.trim()) {
            messages.push(`${prefix}\n\n${markdown}`);
          }
        });
      }

      // Extract images
      conversationContainer.querySelectorAll('img').forEach((img) => {
        if (img.src && !img.src.startsWith('data:') && img.naturalWidth > 50) {
          images.push({
            src: img.src,
            alt: img.alt,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        }
      });
    }

    // Get title from page or first message
    const titleElement = document.querySelector('h1, title');
    let title = titleElement?.textContent?.trim() || 'Claude Conversation';

    // Clean up title if it's generic
    if (title.toLowerCase().includes('claude')) {
      const firstMessage = messages[0]?.replace('**Human:**', '').trim().slice(0, 50);
      if (firstMessage) {
        title = firstMessage + (firstMessage.length >= 50 ? '...' : '');
      }
    }

    const content = messages.length > 0
      ? `# ${title}\n\n${messages.join('\n\n---\n\n')}`
      : '';

    return {
      title,
      content,
      excerpt: messages[0]?.replace('**Human:**', '').trim().slice(0, 200) || '',
      images,
      platform: 'claude',
      projectType: 'ai_conversation',
    };
  },

  getProjectType: (): ProjectType => 'ai_conversation',
};
