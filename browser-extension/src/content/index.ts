/**
 * All Thrive Web Clipper - Content Script
 * Runs on all pages to extract content when requested
 */

import browser from 'webextension-polyfill';
import TurndownService from 'turndown';
import DOMPurify from 'dompurify';
import type { ClippedContent, ExtractedImage, PageMetadata, ProjectType, ExtensionMessage } from '../types';
import { detectPlatform, getPlatformExtractor } from './extractors';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Add custom rules for code blocks
turndownService.addRule('codeBlock', {
  filter: (node) => {
    return node.nodeName === 'PRE' && node.querySelector('code') !== null;
  },
  replacement: (content, node) => {
    const code = (node as HTMLElement).querySelector('code');
    const language = code?.className.match(/language-(\w+)/)?.[1] || '';
    const text = code?.textContent || content;
    return `\n\`\`\`${language}\n${text}\n\`\`\`\n`;
  },
});

// Listen for messages from popup/background
browser.runtime.onMessage.addListener((message: ExtensionMessage): Promise<unknown> | undefined => {
  if (message.type === 'GET_PAGE_CONTENT') {
    const mode = (message.payload as { mode: string })?.mode || 'article';
    const content = extractContent(mode as 'full' | 'selection' | 'article');
    return Promise.resolve({
      type: 'PAGE_CONTENT_RESULT',
      payload: content,
    });
  }

  if (message.type === 'GET_SELECTION') {
    const selection = window.getSelection();
    return Promise.resolve({
      type: 'SELECTION_RESULT',
      payload: selection?.toString() || '',
    });
  }

  if (message.type === 'HIGHLIGHT_MODE') {
    enableHighlightMode();
    return Promise.resolve({ success: true });
  }

  return undefined;
});

function extractContent(mode: 'full' | 'selection' | 'article'): ClippedContent {
  const platform = detectPlatform(window.location.href);
  const platformExtractor = platform ? getPlatformExtractor(platform) : null;

  // Try platform-specific extraction first
  if (platformExtractor) {
    const platformContent = platformExtractor.extract(document);
    if (platformContent.content) {
      return {
        title: platformContent.title || document.title,
        url: window.location.href,
        content: platformContent.content,
        excerpt: platformContent.excerpt,
        platform: platformExtractor.name,
        projectType: platformExtractor.getProjectType(),
        images: platformContent.images || extractImages(),
        metadata: platformContent.metadata || extractMetadata(),
        clippedAt: new Date().toISOString(),
      };
    }
  }

  // Fall back to generic extraction
  let htmlContent: string;
  let textContent: string;

  switch (mode) {
    case 'selection':
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = document.createElement('div');
        container.appendChild(range.cloneContents());
        htmlContent = container.innerHTML;
        textContent = selection.toString();
      } else {
        htmlContent = '';
        textContent = '';
      }
      break;

    case 'full':
      htmlContent = document.body.innerHTML;
      textContent = document.body.textContent || '';
      break;

    case 'article':
    default:
      const article = extractArticle();
      htmlContent = article.html;
      textContent = article.text;
      break;
  }

  // Sanitize and convert to markdown
  const sanitized = DOMPurify.sanitize(htmlContent, {
    ALLOWED_TAGS: [
      'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'a', 'strong', 'em', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
  });

  const markdown = turndownService.turndown(sanitized);

  return {
    title: document.title,
    url: window.location.href,
    content: markdown,
    excerpt: textContent.slice(0, 200).trim() + (textContent.length > 200 ? '...' : ''),
    platform: platform || undefined,
    projectType: guessProjectType(window.location.href, markdown),
    images: extractImages(),
    metadata: extractMetadata(),
    rawHtml: htmlContent,
    clippedAt: new Date().toISOString(),
  };
}

function extractArticle(): { html: string; text: string } {
  // Try to find main content area
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
    '.markdown-body',
    '.prose',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.length > 200) {
      return {
        html: element.innerHTML,
        text: element.textContent,
      };
    }
  }

  // Fall back to body, but try to remove common noise
  const body = document.body.cloneNode(true) as HTMLElement;
  const removeSelectors = [
    'script', 'style', 'nav', 'header', 'footer',
    '.sidebar', '.navigation', '.comments', '.related',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  ];

  removeSelectors.forEach((selector) => {
    body.querySelectorAll(selector).forEach((el) => el.remove());
  });

  return {
    html: body.innerHTML,
    text: body.textContent || '',
  };
}

function extractImages(): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const seen = new Set<string>();

  document.querySelectorAll('img').forEach((img) => {
    const src = img.src;
    if (!src || seen.has(src) || src.startsWith('data:')) return;

    // Skip tiny images (likely icons)
    if (img.naturalWidth < 100 || img.naturalHeight < 100) return;

    seen.add(src);
    images.push({
      src,
      alt: img.alt,
      width: img.naturalWidth,
      height: img.naturalHeight,
      isGenerated: isAiGeneratedImage(img),
    });
  });

  return images.slice(0, 20); // Limit to 20 images
}

function isAiGeneratedImage(img: HTMLImageElement): boolean {
  // Check for common AI image indicators
  const src = img.src.toLowerCase();
  const alt = (img.alt || '').toLowerCase();
  const parent = img.parentElement;

  const aiIndicators = [
    'midjourney', 'dalle', 'stable-diffusion', 'generated',
    'ai-generated', 'oaidalleapiprodscus', 'cdn.openai.com',
  ];

  return aiIndicators.some((indicator) =>
    src.includes(indicator) ||
    alt.includes(indicator) ||
    parent?.textContent?.toLowerCase().includes(indicator)
  );
}

function extractMetadata(): PageMetadata {
  const getMeta = (name: string): string | undefined => {
    const meta = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    return meta?.getAttribute('content') || undefined;
  };

  return {
    ogTitle: getMeta('og:title'),
    ogDescription: getMeta('og:description'),
    ogImage: getMeta('og:image'),
    author: getMeta('author') || getMeta('article:author'),
    publishedAt: getMeta('article:published_time'),
    siteName: getMeta('og:site_name'),
    favicon: document.querySelector('link[rel="icon"]')?.getAttribute('href') ||
             document.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
             '/favicon.ico',
  };
}

function guessProjectType(url: string, content: string): ProjectType {
  const urlLower = url.toLowerCase();
  const contentLower = content.toLowerCase();

  // AI conversation platforms
  if (urlLower.includes('chat.openai.com') || urlLower.includes('chatgpt.com')) {
    return 'ai_conversation';
  }
  if (urlLower.includes('claude.ai')) {
    return 'ai_conversation';
  }
  if (urlLower.includes('bard.google.com') || urlLower.includes('gemini.google.com')) {
    return 'ai_conversation';
  }

  // AI image platforms
  if (urlLower.includes('midjourney.com')) {
    return 'ai_image';
  }
  if (urlLower.includes('leonardo.ai') || urlLower.includes('playground.ai')) {
    return 'ai_image';
  }

  // Code platforms
  if (urlLower.includes('github.com') || urlLower.includes('gitlab.com')) {
    return 'ai_code';
  }
  if (urlLower.includes('replit.com') || urlLower.includes('codepen.io')) {
    return 'ai_code';
  }

  // Content analysis
  if (contentLower.includes('```') || contentLower.includes('function ') || contentLower.includes('const ')) {
    return 'ai_code';
  }

  // Check for tutorial patterns
  if (contentLower.includes('step 1') || contentLower.includes('how to ')) {
    return 'tutorial';
  }

  return 'other';
}

function enableHighlightMode() {
  // Add highlighting overlay for visual selection
  const overlay = document.createElement('div');
  overlay.id = 'allthrive-highlight-overlay';
  overlay.innerHTML = `
    <style>
      #allthrive-highlight-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        pointer-events: none;
      }
      .allthrive-highlight {
        outline: 3px solid #22c55e !important;
        outline-offset: 2px;
        background-color: rgba(34, 197, 94, 0.1) !important;
      }
      #allthrive-highlight-tooltip {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 1000000;
        pointer-events: auto;
      }
    </style>
    <div id="allthrive-highlight-tooltip">
      Click on an element to clip it, or press Escape to cancel
    </div>
  `;
  document.body.appendChild(overlay);

  let currentHighlight: Element | null = null;

  const handleMouseOver = (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.id === 'allthrive-highlight-overlay' || target.closest('#allthrive-highlight-overlay')) {
      return;
    }

    if (currentHighlight) {
      currentHighlight.classList.remove('allthrive-highlight');
    }
    currentHighlight = target;
    target.classList.add('allthrive-highlight');
  };

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (currentHighlight) {
      const html = currentHighlight.outerHTML;
      const markdown = turndownService.turndown(DOMPurify.sanitize(html));

      browser.runtime.sendMessage({
        type: 'HIGHLIGHT_CONTENT',
        payload: {
          html,
          markdown,
          element: currentHighlight.tagName.toLowerCase(),
        },
      });
    }

    cleanup();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };

  const cleanup = () => {
    if (currentHighlight) {
      currentHighlight.classList.remove('allthrive-highlight');
    }
    document.removeEventListener('mouseover', handleMouseOver);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown);
    overlay.remove();
  };

  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown);
}

// Initialize
console.log('All Thrive Web Clipper loaded');
