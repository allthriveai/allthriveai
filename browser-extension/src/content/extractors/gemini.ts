/**
 * Google Gemini/Bard extractor
 */

import TurndownService from 'turndown';
import type { PlatformExtractor, ClippedContent, ExtractedImage, ProjectType } from '../../types';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

export const geminiExtractor: PlatformExtractor = {
  name: 'gemini',

  matchUrl: (url: string) => {
    return url.includes('gemini.google.com') || url.includes('bard.google.com');
  },

  extract: (document: Document): Partial<ClippedContent> => {
    const messages: string[] = [];
    const images: ExtractedImage[] = [];

    // Find conversation turns
    const conversationContainer = document.querySelector('[class*="conversation"], main, [role="main"]');

    if (conversationContainer) {
      // Look for message containers
      const messageContainers = conversationContainer.querySelectorAll(
        '[class*="turn"], [class*="message"], [data-message-id]'
      );

      if (messageContainers.length > 0) {
        messageContainers.forEach((container) => {
          // Determine if it's user or Gemini
          const isUser = container.className.includes('user') ||
                        container.querySelector('[class*="user"]') !== null ||
                        container.getAttribute('data-author') === 'user';

          const contentEl = container.querySelector('[class*="content"], .markdown, p') || container;
          const text = contentEl.textContent?.trim();

          if (text) {
            const prefix = isUser ? '**User:**' : '**Gemini:**';
            const markdown = contentEl.innerHTML
              ? turndown.turndown(contentEl.innerHTML)
              : text;
            messages.push(`${prefix}\n\n${markdown}`);
          }

          // Extract images
          container.querySelectorAll('img').forEach((img) => {
            if (img.src && !img.src.startsWith('data:') && img.naturalWidth > 50) {
              images.push({
                src: img.src,
                alt: img.alt,
                width: img.naturalWidth,
                height: img.naturalHeight,
                isGenerated: img.src.includes('generated') || img.src.includes('imagen'),
              });
            }
          });
        });
      } else {
        // Fallback: just get text content
        const textContent = conversationContainer.textContent?.trim() || '';
        if (textContent) {
          messages.push(textContent);
        }
      }
    }

    // Get title
    const titleElement = document.querySelector('h1, [class*="title"]');
    let title = titleElement?.textContent?.trim() || 'Gemini Conversation';

    if (title.toLowerCase() === 'gemini' || title.toLowerCase() === 'bard') {
      const firstMessage = messages[0]?.replace('**User:**', '').trim().slice(0, 50);
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
      excerpt: messages[0]?.replace('**User:**', '').replace('**Gemini:**', '').trim().slice(0, 200) || '',
      images,
      platform: 'gemini',
      projectType: 'ai_conversation',
    };
  },

  getProjectType: (): ProjectType => 'ai_conversation',
};
