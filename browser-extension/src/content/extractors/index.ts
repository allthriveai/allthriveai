/**
 * Platform-specific extractors for AI websites
 */

import type { PlatformExtractor } from '../../types';
import { chatGptExtractor } from './chatgpt';
import { claudeExtractor } from './claude';
import { midjourneyExtractor } from './midjourney';
import { geminiExtractor } from './gemini';

const extractors: PlatformExtractor[] = [
  chatGptExtractor,
  claudeExtractor,
  midjourneyExtractor,
  geminiExtractor,
];

export function detectPlatform(url: string): string | null {
  for (const extractor of extractors) {
    if (extractor.matchUrl(url)) {
      return extractor.name;
    }
  }
  return null;
}

export function getPlatformExtractor(platform: string): PlatformExtractor | null {
  return extractors.find((e) => e.name === platform) || null;
}

export { chatGptExtractor, claudeExtractor, midjourneyExtractor, geminiExtractor };
