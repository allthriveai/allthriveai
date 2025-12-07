/**
 * Midjourney extractor
 */

import type { PlatformExtractor, ClippedContent, ExtractedImage, ProjectType } from '../../types';

export const midjourneyExtractor: PlatformExtractor = {
  name: 'midjourney',

  matchUrl: (url: string) => {
    return url.includes('midjourney.com');
  },

  extract: (document: Document): Partial<ClippedContent> => {
    const images: ExtractedImage[] = [];
    const prompts: string[] = [];

    // Find image containers on Midjourney
    const imageContainers = document.querySelectorAll('[class*="image"], [class*="artwork"], img[src*="mj"]');

    imageContainers.forEach((container) => {
      if (container.tagName === 'IMG') {
        const img = container as HTMLImageElement;
        if (img.src && !img.src.startsWith('data:')) {
          images.push({
            src: img.src,
            alt: img.alt,
            width: img.naturalWidth,
            height: img.naturalHeight,
            isGenerated: true,
          });
        }
      } else {
        const img = container.querySelector('img');
        if (img?.src && !img.src.startsWith('data:')) {
          images.push({
            src: img.src,
            alt: img.alt,
            width: img.naturalWidth,
            height: img.naturalHeight,
            isGenerated: true,
          });
        }
      }

      // Look for prompt text near images
      const promptEl = container.querySelector('[class*="prompt"], [class*="description"]') ||
                       container.parentElement?.querySelector('[class*="prompt"]');
      if (promptEl?.textContent) {
        prompts.push(promptEl.textContent.trim());
      }
    });

    // Also search for prompts in common locations
    document.querySelectorAll('[class*="prompt"], [class*="command"]').forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text.length > 10 && !prompts.includes(text)) {
        prompts.push(text);
      }
    });

    // Build content
    let content = '# Midjourney Generated Images\n\n';

    if (prompts.length > 0) {
      content += '## Prompts\n\n';
      prompts.forEach((prompt, i) => {
        content += `${i + 1}. ${prompt}\n\n`;
      });
    }

    if (images.length > 0) {
      content += '## Images\n\n';
      images.forEach((img, i) => {
        content += `![Image ${i + 1}](${img.src})\n\n`;
      });
    }

    const title = prompts[0]?.slice(0, 50) || 'Midjourney Generation';

    return {
      title: title + (prompts[0]?.length > 50 ? '...' : ''),
      content,
      excerpt: prompts.join(' ').slice(0, 200),
      images,
      platform: 'midjourney',
      projectType: 'ai_image',
    };
  },

  getProjectType: (): ProjectType => 'ai_image',
};
