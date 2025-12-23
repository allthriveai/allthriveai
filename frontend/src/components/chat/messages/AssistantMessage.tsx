/**
 * AssistantMessage - Displays AI assistant's chat message
 *
 * Features:
 * - Markdown rendering with ReactMarkdown
 * - Internal link navigation (closes chat and navigates)
 * - External links open in new tab
 * - Code highlighting
 * - Optional GitHub connect button when AI asks user to connect
 * - Optional learning content cards below the message
 * - Optional inline game widget below cards (consolidated from find_content)
 * - Two variants: default (sidebar) and neon (EmberHomePage)
 */

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faFigma } from '@fortawesome/free-brands-svg-icons';
import { LinkIcon } from '@heroicons/react/24/outline';
import type { AssistantMessageProps } from '../core/types';
import type { LearningContentItem } from '@/hooks/useIntelligentChat';
import { LearningTeaserCard } from '../cards';
import { ChatGameCard } from '../games';
import { ChatErrorBoundary } from '../ChatErrorBoundary';
import { isFigmaUrl } from '@/services/figma';

// Reserved paths that are NOT project URLs
const RESERVED_PATHS = [
  'explore', 'tools', 'battles', 'quizzes', 'challenges', 'play',
  'thrive-circle', 'onboarding', 'account', 'settings', 'login',
  'signup', 'creator', 'styleguide', 'api', 'admin', 'learn'
];

/**
 * Check if a path is a project URL (/{username}/{project-slug})
 * Returns the username and slug if it is, null otherwise
 */
function isProjectUrl(path: string): { username: string; slug: string } | null {
  if (!path.startsWith('/')) return null;
  const parts = path.split('/').filter(Boolean);
  // Must be exactly 2 parts: username and slug
  if (parts.length !== 2) return null;
  // First part can't be a reserved path
  if (RESERVED_PATHS.includes(parts[0].toLowerCase())) return null;
  // Second part can't be 'learn' (learning paths: /username/learn/slug)
  if (parts[1].toLowerCase() === 'learn') return null;
  return { username: parts[0], slug: parts[1] };
}

/**
 * Parsed card item from markdown list with image
 */
interface ParsedCardItem {
  title: string;
  description: string;
  imageUrl: string;
  linkUrl?: string;
  difficulty?: string;
}

/**
 * Parse markdown content to extract list items that contain images.
 * Returns the extracted items and the remaining content without the image list.
 *
 * Expected format:
 * - **Title** - Description *(Difficulty)*
 *   ![alt](imageUrl)
 *
 * Or with links:
 * - [**Title**](/path) - Description *(Difficulty)*
 *   ![alt](imageUrl)
 */
function parseImageListFromMarkdown(content: string): {
  items: ParsedCardItem[];
  contentBefore: string;
  contentAfter: string;
} | null {
  // Pattern to match a block of list items with images
  // This is tricky - we need to find a sequence of list items that each have an image
  const listItemWithImagePattern = /^[-*]\s+(?:\[?\*\*([^*\]]+)\*\*\]?\(?([^)]*)\)?)?\s*[-–—]?\s*([^\n]*?)(?:\s*\*?\(([^)]+)\)\*?)?\s*\n\s*!\[([^\]]*)\]\(([^)]+)\)/gm;

  const items: ParsedCardItem[] = [];
  let firstMatchStart = -1;
  let lastMatchEnd = -1;

  let match;
  while ((match = listItemWithImagePattern.exec(content)) !== null) {
    const [fullMatch, title, linkUrl, description, difficulty, , imageUrl] = match;

    if (firstMatchStart === -1) {
      firstMatchStart = match.index;
    }
    lastMatchEnd = match.index + fullMatch.length;

    items.push({
      title: title || 'Untitled',
      description: description?.trim() || '',
      imageUrl: imageUrl,
      linkUrl: linkUrl?.startsWith('/') ? linkUrl : undefined,
      difficulty: difficulty,
    });
  }

  if (items.length === 0) {
    return null;
  }

  return {
    items,
    contentBefore: content.slice(0, firstMatchStart).trim(),
    contentAfter: content.slice(lastMatchEnd).trim(),
  };
}

/**
 * ImageCardGrid - Renders parsed image list items as a horizontal card grid
 */
function ImageCardGrid({
  items,
  onOpenProjectPreview,
  onNavigate,
  isNeon = false,
}: {
  items: ParsedCardItem[];
  onOpenProjectPreview?: (item: LearningContentItem) => void;
  onNavigate?: (path: string) => void;
  isNeon?: boolean;
}) {
  const handleCardClick = (item: ParsedCardItem) => {
    if (item.linkUrl) {
      const projectInfo = isProjectUrl(item.linkUrl);
      if (projectInfo && onOpenProjectPreview) {
        // Open in preview tray
        onOpenProjectPreview({
          id: '0',
          title: item.title,
          slug: projectInfo.slug,
          url: item.linkUrl,
          author_username: projectInfo.username,
          featured_image_url: item.imageUrl,
          description: item.description,
        });
        return;
      }
      // Fall back to navigation
      if (onNavigate) {
        onNavigate(item.linkUrl);
      }
    }
  };

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${isNeon ? 'my-4' : 'my-3'}`}>
      {items.map((item, i) => (
        <div
          key={i}
          onClick={() => handleCardClick(item)}
          className={`rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02]
            ${isNeon
              ? 'bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30'
              : 'bg-slate-200/50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 hover:border-cyan-500/30'
            }`}
        >
          <div className={`${isNeon ? 'bg-slate-900/50' : 'bg-slate-100 dark:bg-slate-800'}`}>
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-20 sm:h-24 object-contain p-1"
            />
          </div>
          <div className={`p-2 ${isNeon ? 'text-sm' : 'text-xs'}`}>
            <p className={`font-medium line-clamp-1 ${isNeon ? 'text-slate-200' : 'text-slate-900 dark:text-slate-100'}`}>
              {item.title}
            </p>
            {item.description && (
              <p className={`line-clamp-1 mt-0.5 ${isNeon ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {item.description}
              </p>
            )}
            {item.difficulty && (
              <p className="text-cyan-400 text-xs italic mt-0.5">({item.difficulty})</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Normalize AllThrive URLs to relative paths.
 * Converts absolute URLs like https://allthrive.ai/path to relative URLs like /path
 * for proper internal navigation.
 */
function normalizeAllThriveUrl(href: string | undefined): string | undefined {
  if (!href) return href;

  // Match allthrive.ai or www.allthrive.ai (with or without https://)
  const allThrivePattern = /^(https?:\/\/)?(www\.)?allthrive\.ai/i;
  if (allThrivePattern.test(href)) {
    // Extract the path portion after the domain
    const url = href.replace(allThrivePattern, '');
    // Ensure it starts with /
    return url.startsWith('/') ? url : `/${url}`;
  }

  return href;
}

export function AssistantMessage({
  content,
  variant = 'default',
  onNavigate,
  showGitHubConnectButton = false,
  onConnectGitHub,
  showFigmaConnectButton = false,
  onConnectFigma,
  showFigmaUrlInput = false,
  onFigmaUrlSubmit,
  learningContent,
  onOpenProjectPreview,
}: AssistantMessageProps) {
  const isNeon = variant === 'neon';
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaUrlError, setFigmaUrlError] = useState<string | null>(null);
  const [isSubmittingFigma, setIsSubmittingFigma] = useState(false);

  const handleFigmaUrlChange = (value: string) => {
    setFigmaUrl(value);
    if (value.trim() && !isFigmaUrl(value)) {
      setFigmaUrlError('Please enter a valid Figma URL (e.g., figma.com/design/... or figma.com/file/...)');
    } else {
      setFigmaUrlError(null);
    }
  };

  const handleFigmaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!figmaUrl.trim() || !isFigmaUrl(figmaUrl) || !onFigmaUrlSubmit) return;
    setIsSubmittingFigma(true);
    setFigmaUrlError(null); // Clear previous errors
    try {
      await onFigmaUrlSubmit(figmaUrl);
    } catch (error: unknown) {
      // Show error to user
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to import Figma file. Please check your access and try again.';
      setFigmaUrlError(errorMessage);
    } finally {
      setIsSubmittingFigma(false);
    }
  };

  // Split content: extract learning path offer to render after cards/game
  const learningPathPattern = /\n\n(Would you like me to (?:create|save) (?:a |this as a )?(?:personalized )?learning path[^?]*\?)/i;
  const match = content.match(learningPathPattern);
  const mainContent = match ? content.replace(learningPathPattern, '') : content;
  const learningPathOffer = match ? match[1] : null;
  const hasLearningContent = learningContent && (learningContent.items?.length > 0 || learningContent.inlineGame);

  // Markdown link handler - opens projects in tray, others navigate
  const handleLinkClick = (href: string | undefined, e: React.MouseEvent) => {
    if (!href) return;

    // Normalize AllThrive URLs to relative paths
    const normalizedHref = normalizeAllThriveUrl(href);
    const isInternal = normalizedHref?.startsWith('/');

    if (isInternal && normalizedHref) {
      e.preventDefault();

      // Check if it's a project URL - open in tray instead of navigating
      const projectInfo = isProjectUrl(normalizedHref);
      if (projectInfo && onOpenProjectPreview) {
        onOpenProjectPreview({
          id: '0', // Tray will fetch full data
          title: projectInfo.slug.replace(/-/g, ' '),
          slug: projectInfo.slug,
          url: normalizedHref,
          author_username: projectInfo.username,
        });
        return;
      }

      // Fall back to navigation for non-project URLs
      if (onNavigate) {
        onNavigate(normalizedHref);
      }
    }
  };

  // Render learning content cards
  const renderLearningCards = () => {
    if (!learningContent || !learningContent.items || learningContent.items.length === 0) {
      return null;
    }

    return (
      <div className="mt-4">
        <p className={`text-sm mb-2 ${isNeon ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
          Here are some <span className="text-cyan-400 font-medium">{learningContent.topicDisplay}</span> resources:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {learningContent.items.map((item) => (
            <LearningTeaserCard
              key={item.id}
              item={{
                id: item.id,
                title: item.title,
                description: item.description,
                url: item.url,
                thumbnail: item.thumbnail,
                featured_image_url: item.featured_image_url || item.featuredImageUrl,
                author_username: item.author_username,
                author_avatar_url: item.author_avatar_url,
                key_techniques: item.key_techniques,
                difficulty: item.difficulty,
                question_count: item.question_count,
                slug: item.slug,
              }}
              contentType={learningContent.contentType}
              onNavigate={onNavigate}
              onOpenProjectPreview={onOpenProjectPreview}
              compact
            />
          ))}
        </div>
      </div>
    );
  };

  // Render inline game widget (consolidated from find_content)
  const renderInlineGame = () => {
    if (!learningContent?.inlineGame) {
      return null;
    }

    const { gameType, gameConfig } = learningContent.inlineGame;
    const topicDisplay = learningContent.topicDisplay || 'this topic';

    return (
      <div className="mt-4">
        <p className={`text-sm mb-2 ${isNeon ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
          Here's a fun game about <span className="text-cyan-400 font-medium">{topicDisplay}</span>:
        </p>
        <ChatErrorBoundary inline resetKey={`inline-game-${gameType}`}>
          <ChatGameCard gameType={gameType} config={gameConfig} />
        </ChatErrorBoundary>
      </div>
    );
  };

  // Render Figma connect button or URL input
  const renderFigmaAction = () => {
    if (showFigmaConnectButton && onConnectFigma) {
      return (
        <div className={`mt-3 pt-3 border-t ${isNeon ? 'border-white/10' : 'border-slate-200 dark:border-slate-700'}`}>
          <button
            onClick={onConnectFigma}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <FontAwesomeIcon icon={faFigma} />
            Connect Figma
          </button>
        </div>
      );
    }

    if (showFigmaUrlInput && onFigmaUrlSubmit) {
      return (
        <div className={`mt-3 pt-3 border-t ${isNeon ? 'border-white/10' : 'border-slate-200 dark:border-slate-700'}`}>
          <form onSubmit={handleFigmaSubmit} className="space-y-2">
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="url"
                value={figmaUrl}
                onChange={(e) => handleFigmaUrlChange(e.target.value)}
                placeholder="https://www.figma.com/design/..."
                disabled={isSubmittingFigma}
                className={`w-full pl-9 pr-4 py-2 bg-slate-800/50 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none ${
                  figmaUrlError
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-slate-700 focus:border-purple-500'
                } disabled:opacity-50`}
              />
            </div>
            {figmaUrlError && (
              <p className="text-xs text-red-400">{figmaUrlError}</p>
            )}
            <button
              type="submit"
              disabled={!figmaUrl.trim() || !!figmaUrlError || isSubmittingFigma}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isSubmittingFigma ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Importing...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faFigma} />
                  Import Design
                </>
              )}
            </button>
          </form>
          <p className="text-xs text-slate-500 text-center mt-2">
            Supported: Figma design files, prototypes, and FigJam boards
          </p>
        </div>
      );
    }

    return null;
  };

  // Parse content for image lists - render as card grid if found
  const parsedContent = parseImageListFromMarkdown(mainContent);

  // Common markdown components factory
  const getMarkdownComponents = (neon: boolean) => ({
    p: ({ children }: { children: React.ReactNode }) => (
      <p className={`${neon ? 'mb-4' : 'mb-3'} last:mb-0 leading-relaxed`}>{children}</p>
    ),
    ul: ({ children }: { children: React.ReactNode }) => (
      <ul className={`${neon ? 'mb-4' : 'mb-3'} ml-4 space-y-2 list-disc list-outside`}>{children}</ul>
    ),
    ol: ({ children }: { children: React.ReactNode }) => (
      <ol className={`${neon ? 'mb-4' : 'mb-3'} ml-4 space-y-2 list-decimal list-outside`}>{children}</ol>
    ),
    li: ({ children }: { children: React.ReactNode }) => (
      <li className="leading-relaxed pl-1">{children}</li>
    ),
    h1: ({ children }: { children: React.ReactNode }) => (
      <h1 className={`${neon ? 'text-xl' : 'text-base'} font-bold ${neon ? 'mb-3 mt-4' : 'mb-2 mt-3'} first:mt-0`}>{children}</h1>
    ),
    h2: ({ children }: { children: React.ReactNode }) => (
      <h2 className={`${neon ? 'text-lg' : 'text-sm'} font-semibold ${neon ? 'mb-2 mt-4' : 'mb-1.5 mt-3'} first:mt-0`}>{children}</h2>
    ),
    h3: ({ children }: { children: React.ReactNode }) => (
      <h3 className={`${neon ? 'text-base' : 'text-sm'} font-semibold ${neon ? 'mb-2 mt-3' : 'mb-1 mt-2'} first:mt-0`}>{children}</h3>
    ),
    strong: ({ children }: { children: React.ReactNode }) => (
      <strong className={`font-semibold ${neon ? 'text-slate-900 dark:text-white' : ''}`}>{children}</strong>
    ),
    em: ({ children }: { children: React.ReactNode }) => <em className="italic">{children}</em>,
    blockquote: ({ children }: { children: React.ReactNode }) => (
      <blockquote className={`border-l-${neon ? '4' : '2'} border-cyan-500/50 pl-${neon ? '4' : '3'} my-${neon ? '4' : '3'} italic ${neon ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
        {children}
      </blockquote>
    ),
    a: ({ href, children }: { href?: string; children: React.ReactNode }) => {
      const normalizedHref = normalizeAllThriveUrl(href);
      const isInternal = normalizedHref?.startsWith('/');
      if (isInternal && normalizedHref) {
        return (
          <a
            href={normalizedHref}
            onClick={(e) => handleLinkClick(normalizedHref, e)}
            className={`${neon ? 'text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300' : 'text-cyan-400 hover:text-cyan-300'} hover:underline cursor-pointer`}
          >
            {children}
          </a>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${neon ? 'text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300' : 'text-cyan-400 hover:text-cyan-300'} hover:underline`}
        >
          {children}
        </a>
      );
    },
    pre: ({ children }: { children: React.ReactNode }) => (
      <pre className={`overflow-x-auto whitespace-pre-wrap break-words ${neon ? 'bg-slate-900/50 dark:bg-slate-950/50 p-4' : 'bg-slate-900 dark:bg-slate-950 p-3'} rounded-lg text-sm ${neon ? 'my-4' : 'my-3'}`}>
        {children}
      </pre>
    ),
    code: ({ children, node }: { children: React.ReactNode; node?: { position?: { start: { line: number }; end: { line: number } } } }) => {
      const isInline = node?.position?.start.line === node?.position?.end.line;
      return isInline ? (
        <code className={`${neon ? 'bg-slate-200/50 dark:bg-white/10 px-1.5 py-0.5' : 'bg-gray-200 dark:bg-gray-700 px-1 py-0.5'} rounded text-sm font-mono break-all`}>
          {children}
        </code>
      ) : (
        <code className={`${neon ? '' : 'text-slate-300'} break-words`}>{children}</code>
      );
    },
    img: ({ src, alt }: { src?: string; alt?: string }) => (
      <img
        src={src}
        alt={alt || ''}
        className={`max-w-full ${neon ? 'max-h-48' : 'max-h-40'} w-auto h-auto rounded-lg my-2 object-contain`}
      />
    ),
  });

  // Render markdown content with optional image card grid
  const renderMarkdownContent = (contentToRender: string, neon: boolean) => {
    if (parsedContent && contentToRender === mainContent) {
      // Render in parts: before, card grid, after
      return (
        <>
          {parsedContent.contentBefore && (
            <ReactMarkdown components={getMarkdownComponents(neon)}>
              {parsedContent.contentBefore}
            </ReactMarkdown>
          )}
          <ImageCardGrid
            items={parsedContent.items}
            onOpenProjectPreview={onOpenProjectPreview}
            onNavigate={onNavigate}
            isNeon={neon}
          />
          {parsedContent.contentAfter && (
            <ReactMarkdown components={getMarkdownComponents(neon)}>
              {parsedContent.contentAfter}
            </ReactMarkdown>
          )}
        </>
      );
    }
    return (
      <ReactMarkdown components={getMarkdownComponents(neon)}>
        {contentToRender}
      </ReactMarkdown>
    );
  };

  if (isNeon) {
    // Neon Glass variant (EmberHomePage)
    return (
      <div className="flex flex-col justify-start w-full">
        <div className="flex items-end">
          <img
            src="/ember-avatar.png"
            alt="Ember"
            className="w-12 h-12 rounded-full flex-shrink-0 mr-4 object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="glass-message px-5 py-4 rounded-2xl rounded-bl-sm">
              <div className="text-lg text-slate-700 dark:text-slate-200 prose prose-lg prose-slate dark:prose-invert max-w-none">
                {renderMarkdownContent(mainContent, true)}
              </div>
              {showGitHubConnectButton && onConnectGitHub && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
                  <button
                    onClick={onConnectGitHub}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <FontAwesomeIcon icon={faGithub} />
                    Connect GitHub
                  </button>
                </div>
              )}
              {renderFigmaAction()}
            </div>
          </div>
        </div>
        {renderLearningCards()}
        {renderInlineGame()}
        {/* Learning path offer rendered after cards and game */}
        {learningPathOffer && hasLearningContent && (
          <p className="mt-4 text-lg text-slate-700 dark:text-slate-200">{learningPathOffer}</p>
        )}
      </div>
    );
  }

  // Default variant (sidebar)
  return (
    <div className="flex justify-start w-full">
      <div className="max-w-[85%]">
        <div className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {renderMarkdownContent(mainContent, false)}
          </div>
          {showGitHubConnectButton && onConnectGitHub && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={onConnectGitHub}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <FontAwesomeIcon icon={faGithub} />
                Connect GitHub
              </button>
            </div>
          )}
          {renderFigmaAction()}
        </div>
        {renderLearningCards()}
        {renderInlineGame()}
        {/* Learning path offer rendered after cards and game */}
        {learningPathOffer && hasLearningContent && (
          <p className="mt-4 text-sm text-slate-900 dark:text-slate-100">{learningPathOffer}</p>
        )}
      </div>
    </div>
  );
}
